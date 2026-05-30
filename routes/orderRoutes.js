const express = require("express")
const mongoose = require("mongoose")
const crypto = require("crypto")
const Razorpay = require("razorpay")
const Order = require("../models/Order")
const Cart = require("../models/Cart")
const { resolveAuthenticatedUser } = require("../middleware/sessionAuth")
const { requireAdminToken } = require("../middleware/adminAuth")

const router = express.Router()

const CART_SIZES = new Set(["XS", "S", "M", "L", "XL", "XXL", "XXXL"])
const ORDER_STATUSES = new Set(["placed", "processing", "shipped", "delivered", "cancelled"])
const PAYMENT_METHODS = new Set(["cod", "upi", "card", "netbanking"])
const PAYMENT_STATUSES = new Set(["unpaid", "pending", "paid", "failed", "refunded", "cod-pending"])

const FREE_SHIPPING_THRESHOLD = 1999
const FLAT_SHIPPING_FEE = 99
const TAX_RATE = 0.05
const RAZORPAY_MIN_AMOUNT_PAISE = 100

const CHECKOUT_PAYMENT_OPTIONS = [
    {
        id: "cod",
        label: "Cash on Delivery",
        description: "Pay when the order arrives at your doorstep.",
        requiresDetails: false
    },
    {
        id: "upi",
        label: "UPI",
        description: "Pay securely using UPI in the payment gateway.",
        requiresDetails: false
    },
    {
        id: "card",
        label: "Credit / Debit Card",
        description: "Pay securely using your credit or debit card.",
        requiresDetails: false
    },
    {
        id: "netbanking",
        label: "Net Banking",
        description: "Pay securely via your bank in the payment gateway.",
        requiresDetails: false
    }
]

function normalizeText(value) {
    return String(value || "").trim()
}

function normalizeLower(value) {
    return normalizeText(value).toLowerCase()
}

function normalizeUpper(value) {
    return normalizeText(value).toUpperCase()
}

function escapeRegex(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function toTitleCase(value) {
    return String(value || "")
        .split(" ")
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => part[0].toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
}

function createHttpError(status, message) {
    const err = new Error(message)
    err.status = Number(status || 500)
    return err
}

function getHttpStatusCode(err, fallback = 500) {
    const statusCode = Number(err?.status || err?.statusCode || fallback)
    return statusCode >= 400 && statusCode <= 599 ? statusCode : fallback
}

function getRazorpayKeyId() {
    return normalizeText(process.env.RAZORPAY_KEY_ID)
}

function getRazorpayKeySecret() {
    return normalizeText(process.env.RAZORPAY_KEY_SECRET)
}

function getRazorpayWebhookSecret() {
    return normalizeText(process.env.RAZORPAY_WEBHOOK_SECRET)
}

function getRazorpayClient() {
    const keyId = getRazorpayKeyId()
    const keySecret = getRazorpayKeySecret()

    if (!keyId || !keySecret) {
        throw createHttpError(503, "Razorpay is not configured. Add Razorpay keys in .env.")
    }

    return new Razorpay({
        key_id: keyId,
        key_secret: keySecret
    })
}

function toRazorpayAmount(amount) {
    return Math.round(Number(amount || 0) * 100)
}

async function createRazorpayGatewayOrder({ amount, currency = "INR", receipt, notes = {} }) {
    const gatewayAmount = toRazorpayAmount(amount)
    if (gatewayAmount < RAZORPAY_MIN_AMOUNT_PAISE) {
        throw createHttpError(400, "Online payment amount must be at least ₹1.")
    }

    const client = getRazorpayClient()
    return client.orders.create({
        amount: gatewayAmount,
        currency,
        receipt: normalizeText(receipt).slice(0, 40),
        notes
    })
}

function verifyRazorpaySignature({ gatewayOrderId, gatewayPaymentId, gatewaySignature }) {
    const keySecret = getRazorpayKeySecret()
    if (!keySecret) {
        throw createHttpError(503, "Razorpay is not configured. Add Razorpay keys in .env.")
    }

    const payload = `${normalizeText(gatewayOrderId)}|${normalizeText(gatewayPaymentId)}`
    const expected = crypto
        .createHmac("sha256", keySecret)
        .update(payload)
        .digest("hex")

    const expectedBuffer = Buffer.from(expected)
    const providedBuffer = Buffer.from(normalizeText(gatewaySignature))

    if (expectedBuffer.length !== providedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
        throw createHttpError(400, "Payment verification failed.")
    }
}

function getWebhookRawBody(req) {
    if (Buffer.isBuffer(req.body)) {
        return req.body
    }

    if (typeof req.body === "string") {
        return Buffer.from(req.body)
    }

    return Buffer.from(JSON.stringify(req.body || {}))
}

function verifyRazorpayWebhookSignature(req) {
    const webhookSecret = getRazorpayWebhookSecret()
    if (!webhookSecret) {
        throw createHttpError(503, "Razorpay webhook secret is not configured.")
    }

    const providedSignature = normalizeText(req.headers["x-razorpay-signature"])
    if (!providedSignature) {
        throw createHttpError(400, "Missing Razorpay webhook signature.")
    }

    const expectedSignature = crypto
        .createHmac("sha256", webhookSecret)
        .update(getWebhookRawBody(req))
        .digest("hex")

    const expectedBuffer = Buffer.from(expectedSignature)
    const providedBuffer = Buffer.from(providedSignature)

    if (expectedBuffer.length !== providedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, providedBuffer)) {
        throw createHttpError(400, "Invalid Razorpay webhook signature.")
    }
}

function parseRazorpayWebhookPayload(req) {
    const rawBody = getWebhookRawBody(req)

    try {
        return JSON.parse(rawBody.toString("utf8"))
    } catch (err) {
        throw createHttpError(400, "Invalid Razorpay webhook payload.")
    }
}

async function verifyRazorpayPaymentCapture({ gatewayPaymentId, expectedAmount, expectedCurrency = "INR" }) {
    const client = getRazorpayClient()
    const expectedGatewayAmount = toRazorpayAmount(expectedAmount)
    const expectedGatewayCurrency = normalizeUpper(expectedCurrency || "INR")

    let payment = await client.payments.fetch(gatewayPaymentId)

    if (normalizeLower(payment?.status) === "authorized") {
        payment = await client.payments.capture(
            gatewayPaymentId,
            expectedGatewayAmount,
            expectedGatewayCurrency
        )
    }

    if (normalizeLower(payment?.status) !== "captured") {
        throw createHttpError(400, "Payment was not captured.")
    }

    if (Number(payment?.amount || 0) !== expectedGatewayAmount) {
        throw createHttpError(400, "Payment amount does not match this order.")
    }

    if (normalizeUpper(payment?.currency || "INR") !== expectedGatewayCurrency) {
        throw createHttpError(400, "Payment currency does not match this order.")
    }

    return payment
}

function isTruthyFlag(value) {
    const normalized = normalizeLower(value)
    return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on"
}

function parseLimit(rawValue, fallback = 50, max = 200) {
    const parsed = Number.parseInt(String(rawValue ?? ""), 10)
    if (Number.isNaN(parsed)) return fallback
    return Math.max(1, Math.min(parsed, max))
}

function normalizeSize(value, fallback = "M") {
    const requested = normalizeUpper(value)
    if (!requested) return fallback
    if (!CART_SIZES.has(requested)) return fallback
    return requested
}

function normalizeQuantity(value, fallback = 1, max = 999) {
    const parsed = Number.parseInt(String(value ?? ""), 10)
    if (Number.isNaN(parsed)) return fallback
    if (parsed < 1) return 1
    if (parsed > max) return max
    return parsed
}

function normalizePhone(value) {
    const trimmed = normalizeText(value)
    if (!trimmed) return ""

    const hasPlus = trimmed.startsWith("+")
    const digits = trimmed.replace(/[^0-9]/g, "")
    if (!digits) return ""

    return hasPlus ? `+${digits}` : digits
}

function isValidPhone(value) {
    const digits = String(value || "").replace(/[^0-9]/g, "")
    return digits.length >= 10 && digits.length <= 15
}

function normalizePostalCode(value) {
    return normalizeText(value).replace(/\s+/g, " ")
}

function isValidPostalCode(value) {
    const normalized = normalizePostalCode(value)
    return /^[A-Za-z0-9][A-Za-z0-9\-\s]{3,9}$/.test(normalized)
}

function generateReference(prefix = "PAY") {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")
    const randomPart = Math.floor(100000 + Math.random() * 900000)
    return `${normalizeUpper(prefix)}-${year}${month}${day}-${randomPart}`
}

function getCheckoutOptionsPayload() {
    return {
        currency: "INR",
        paymentOptions: CHECKOUT_PAYMENT_OPTIONS
    }
}

async function requireUserEmail(req, res) {
    const auth = await resolveAuthenticatedUser(req, { allowFallback: true })
    const userEmail = String(auth?.email || "")

    if (!userEmail) {
        res.status(401).json({ error: "Please sign in before checkout." })
        return null
    }

    return userEmail
}

function calculateSummary(items) {
    const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0)
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD
        ? 0
        : (subtotal > 0 ? FLAT_SHIPPING_FEE : 0)
    const tax = subtotal > 0 ? Number((subtotal * TAX_RATE).toFixed(2)) : 0
    const grandTotal = Number((subtotal + shipping + tax).toFixed(2))

    return {
        uniqueItems: items.length,
        itemCount: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        subtotal: Number(subtotal.toFixed(2)),
        shipping,
        tax,
        taxRate: TAX_RATE,
        grandTotal,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD
    }
}

function getItemType(item) {
    const normalized = normalizeLower(item?.itemType || "product")
    return normalized === "custom-preset" ? "custom-preset" : "product"
}

function getProductImage(product) {
    if (Array.isArray(product?.images) && product.images.length) {
        return product.images[0]
    }

    return String(product?.image || "").trim()
}

function formatCartItemsForOrder(cartDoc) {
    const rawItems = Array.isArray(cartDoc?.items) ? cartDoc.items : []

    return rawItems.map(item => {
        const itemType = getItemType(item)
        const productDoc = itemType === "product" &&
            item.product &&
            typeof item.product === "object" &&
            ("name" in item.product || "price" in item.product || "images" in item.product)
            ? item.product
            : null

        const unitPrice = Number(productDoc?.price ?? item.unitPrice ?? 0)
        const quantity = normalizeQuantity(item.quantity, 1)
        const lineTotal = Number((unitPrice * quantity).toFixed(2))

        if (itemType === "custom-preset") {
            const customPreset = item.customPreset && typeof item.customPreset === "object"
                ? item.customPreset
                : {}

            return {
                itemType: "custom-preset",
                productId: null,
                quantity,
                size: normalizeSize(item.size || customPreset.primarySize, "M"),
                unitPrice: Number(unitPrice.toFixed(2)),
                lineTotal,
                name: String(item.productName || customPreset.presetName || "Custom T-Shirt"),
                image: String(item.productImage || ""),
                gender: String(customPreset.targetGender || ""),
                type: "tshirt",
                fit: String(customPreset.tshirtFit || ""),
                customPreset
            }
        }

        return {
            itemType: "product",
            productId: productDoc?._id || item.product || null,
            quantity,
            size: normalizeSize(item.size, "M"),
            unitPrice: Number(unitPrice.toFixed(2)),
            lineTotal,
            name: String(productDoc?.name || item.productName || "Product"),
            image: String(getProductImage(productDoc) || item.productImage || ""),
            gender: String(productDoc?.gender || ""),
            type: String(productDoc?.type || ""),
            fit: String(productDoc?.fit || ""),
            customPreset: null
        }
    })
}

function deriveFallbackCustomerName(userEmail) {
    const localPart = normalizeText(String(userEmail || "").split("@")[0] || "")
    if (!localPart) return "Customer"
    return toTitleCase(localPart.replace(/[._-]+/g, " "))
}

function formatOrderCode(date = new Date()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const randomPart = Math.floor(1000 + Math.random() * 9000)
    return `LX-ORD-${year}${month}${day}-${randomPart}`
}

async function generateUniqueOrderCode() {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const orderCode = formatOrderCode()
        const existing = await Order.findOne({ orderCode }).select("_id").lean()
        if (!existing) {
            return orderCode
        }
    }

    return `LX-ORD-${Date.now()}`
}

function toCartResponse(cartDoc) {
    const items = formatCartItemsForOrder(cartDoc)
    const summary = calculateSummary(items)

    return {
        userEmail: String(cartDoc?.userEmail || ""),
        cartId: cartDoc?._id ? String(cartDoc._id) : "",
        items,
        ...summary,
        updatedAt: cartDoc?.updatedAt || null
    }
}

function normalizeAddress(input, fallbackName = "", fallbackPhone = "") {
    const source = input && typeof input === "object" ? input : {}

    const recipientName = normalizeText(source.recipientName || source.name || fallbackName)
    const phone = normalizePhone(source.phone || source.mobile || fallbackPhone)

    return {
        recipientName,
        phone,
        line1: normalizeText(source.line1 || source.addressLine1 || source.address1),
        line2: normalizeText(source.line2 || source.addressLine2 || source.address2),
        landmark: normalizeText(source.landmark),
        city: normalizeText(source.city),
        state: normalizeText(source.state),
        postalCode: normalizePostalCode(source.postalCode || source.pincode || source.zip),
        country: normalizeText(source.country || "India") || "India"
    }
}

function validateAddress(address) {
    if (!normalizeText(address?.recipientName)) {
        throw createHttpError(400, "Recipient name is required.")
    }

    if (!isValidPhone(address?.phone)) {
        throw createHttpError(400, "Please enter a valid phone number.")
    }

    if (!normalizeText(address?.line1)) {
        throw createHttpError(400, "Address line 1 is required.")
    }

    if (!normalizeText(address?.city)) {
        throw createHttpError(400, "City is required.")
    }

    if (!normalizeText(address?.state)) {
        throw createHttpError(400, "State is required.")
    }

    if (!isValidPostalCode(address?.postalCode)) {
        throw createHttpError(400, "Please enter a valid postal code.")
    }

    if (!normalizeText(address?.country)) {
        throw createHttpError(400, "Country is required.")
    }
}

function normalizePaymentMethod(value) {
    const method = normalizeLower(value || "cod")
    if (!PAYMENT_METHODS.has(method)) {
        throw createHttpError(400, "Invalid payment method.")
    }
    return method
}

function buildPaymentPayload(rawPayment, grandTotal, gatewayOrder = null) {
    const paymentInput = rawPayment && typeof rawPayment === "object" ? rawPayment : {}
    const method = normalizePaymentMethod(paymentInput.method || "cod")
    const amount = Number(Number(grandTotal || 0).toFixed(2))
    const providedReference = normalizeText(paymentInput.reference)

    if (method === "cod") {
        return {
            method,
            provider: "cod",
            status: "cod-pending",
            amount,
            currency: "INR",
            reference: providedReference || generateReference("COD"),
            transactionId: "",
            gatewayOrderId: "",
            gatewayPaymentId: "",
            gatewaySignature: "",
            paidAt: null,
            details: {}
        }
    }

    return {
        method,
        provider: "razorpay",
        status: "pending",
        amount,
        currency: "INR",
        reference: providedReference || generateReference("PAY"),
        transactionId: "",
        gatewayOrderId: normalizeText(gatewayOrder?.id),
        gatewayPaymentId: "",
        gatewaySignature: "",
        paidAt: null,
        details: {
            mode: "gateway-pending",
            preferredMethod: method,
            note: "Awaiting secure payment gateway confirmation.",
            gatewayAmount: Number(gatewayOrder?.amount || 0),
            gatewayCurrency: normalizeText(gatewayOrder?.currency || "INR")
        }
    }
}

function buildPaymentConfirmationPayload(existingPayment = {}, confirmation = {}) {
    const method = normalizePaymentMethod(
        confirmation.method ||
        existingPayment?.method ||
        "upi"
    )

    if (method === "cod") {
        throw createHttpError(400, "Cash on delivery orders do not need online payment confirmation.")
    }

    const gatewayOrderId = normalizeText(confirmation.gatewayOrderId || existingPayment?.gatewayOrderId)
    const gatewayPaymentId = normalizeText(
        confirmation.razorpay_payment_id ||
        confirmation.gatewayPaymentId ||
        confirmation.transactionId ||
        existingPayment?.gatewayPaymentId ||
        existingPayment?.transactionId
    )
    const gatewaySignature = normalizeText(
        confirmation.razorpay_signature ||
        confirmation.gatewaySignature ||
        existingPayment?.gatewaySignature
    )
    const providedGatewayOrderId = normalizeText(
        confirmation.razorpay_order_id ||
        confirmation.gatewayOrderId ||
        existingPayment?.gatewayOrderId
    )

    if (!gatewayPaymentId) {
        throw createHttpError(400, "Payment ID is required to confirm payment.")
    }

    if (!providedGatewayOrderId || providedGatewayOrderId !== gatewayOrderId) {
        throw createHttpError(400, "Payment order ID does not match this order.")
    }

    if (!gatewaySignature) {
        throw createHttpError(400, "Payment signature is required.")
    }

    verifyRazorpaySignature({
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature
    })

    return {
        method,
        provider: "razorpay",
        status: "paid",
        reference: normalizeText(confirmation.reference || gatewayPaymentId || existingPayment?.reference),
        transactionId: gatewayPaymentId,
        gatewayOrderId,
        gatewayPaymentId,
        gatewaySignature,
        paidAt: new Date(),
        details: {
            ...(existingPayment?.details && typeof existingPayment.details === "object" ? existingPayment.details : {}),
            mode: "gateway-confirmed",
            note: "Payment confirmed through secure gateway callback/confirmation."
        }
    }
}

function getWebhookPaymentEntity(payload) {
    const entity = payload?.payload?.payment?.entity
    return entity && typeof entity === "object" ? entity : null
}

async function findOrderForWebhookPayment(paymentEntity) {
    const gatewayPaymentId = normalizeText(paymentEntity?.id)
    const gatewayOrderId = normalizeText(paymentEntity?.order_id)

    const queries = []
    if (gatewayPaymentId) queries.push({ "payment.gatewayPaymentId": gatewayPaymentId })
    if (gatewayOrderId) queries.push({ "payment.gatewayOrderId": gatewayOrderId })

    if (!queries.length) return null
    return Order.findOne({ $or: queries })
}

function ensureWebhookAmountMatchesOrder(order, paymentEntity) {
    const expectedAmount = toRazorpayAmount(order?.grandTotal)
    const actualAmount = Number(paymentEntity?.amount || 0)

    if (expectedAmount !== actualAmount) {
        throw createHttpError(400, "Webhook payment amount does not match this order.")
    }
}

async function markOrderPaidFromWebhook(order, paymentEntity, eventName) {
    ensureWebhookAmountMatchesOrder(order, paymentEntity)

    const existingPayment = order.payment && typeof order.payment.toObject === "function"
        ? order.payment.toObject()
        : order.payment || {}

    order.payment = {
        ...existingPayment,
        method: normalizePaymentMethod(existingPayment.method || "upi"),
        provider: "razorpay",
        status: "paid",
        amount: Number(order.grandTotal || 0),
        currency: normalizeUpper(paymentEntity?.currency || existingPayment.currency || "INR"),
        reference: normalizeText(existingPayment.reference || paymentEntity?.id),
        transactionId: normalizeText(paymentEntity?.id || existingPayment.transactionId),
        gatewayOrderId: normalizeText(paymentEntity?.order_id || existingPayment.gatewayOrderId),
        gatewayPaymentId: normalizeText(paymentEntity?.id || existingPayment.gatewayPaymentId),
        gatewaySignature: normalizeText(existingPayment.gatewaySignature),
        paidAt: existingPayment.paidAt || new Date(Number(paymentEntity?.created_at || 0) * 1000 || Date.now()),
        details: {
            ...(existingPayment.details && typeof existingPayment.details === "object" ? existingPayment.details : {}),
            mode: "gateway-webhook",
            gatewayStatus: normalizeText(paymentEntity?.status || "captured"),
            gatewayEvent: normalizeText(eventName),
            gatewayFee: Number(paymentEntity?.fee || 0),
            gatewayTax: Number(paymentEntity?.tax || 0)
        }
    }

    await order.save()
    return order
}

async function markOrderFailedFromWebhook(order, paymentEntity, eventName) {
    if (normalizeLower(order.payment?.status) === "paid") {
        return order
    }

    const existingPayment = order.payment && typeof order.payment.toObject === "function"
        ? order.payment.toObject()
        : order.payment || {}

    order.payment = {
        ...existingPayment,
        provider: "razorpay",
        status: "failed",
        amount: Number(order.grandTotal || 0),
        currency: normalizeUpper(paymentEntity?.currency || existingPayment.currency || "INR"),
        transactionId: normalizeText(paymentEntity?.id || existingPayment.transactionId),
        gatewayOrderId: normalizeText(paymentEntity?.order_id || existingPayment.gatewayOrderId),
        gatewayPaymentId: normalizeText(paymentEntity?.id || existingPayment.gatewayPaymentId),
        details: {
            ...(existingPayment.details && typeof existingPayment.details === "object" ? existingPayment.details : {}),
            mode: "gateway-webhook",
            gatewayStatus: normalizeText(paymentEntity?.status || "failed"),
            gatewayEvent: normalizeText(eventName),
            failureReason: normalizeText(paymentEntity?.error_description || paymentEntity?.error_reason || "Payment failed.")
        }
    }

    await order.save()
    return order
}

async function clearCartForPaidOrder(order) {
    const userEmail = normalizeLower(order?.userEmail)
    if (!userEmail) return

    const cart = await Cart.findOne({ userEmail })
    if (!cart) return

    cart.items = []
    await cart.save()
}

async function createOrderFromCart({
    userEmail,
    body,
    source = "web-checkout",
    requireFullCheckout = true
}) {
    const payload = body && typeof body === "object" ? body : {}

    const fallbackName = deriveFallbackCustomerName(userEmail)
    const customerName = normalizeText(payload.customerName) || fallbackName
    const customerPhone = normalizePhone(payload.customerPhone)
    const notes = normalizeText(payload.notes)
    const paymentMethod = normalizePaymentMethod(payload.payment?.method || "cod")
    const shouldClearCart = paymentMethod === "cod" && payload.clearCart !== false

    const shippingAddress = normalizeAddress(payload.shippingAddress, customerName, customerPhone)

    if (!customerName || customerName.length < 2) {
        throw createHttpError(400, "Please provide your full name.")
    }

    if (requireFullCheckout) {
        validateAddress(shippingAddress)
    }

    if (customerPhone && !isValidPhone(customerPhone)) {
        throw createHttpError(400, "Please enter a valid phone number.")
    }

    const cart = await Cart.findOne({ userEmail }).populate(
        "items.product",
        "name price images image gender type fit"
    )

    if (!cart || !Array.isArray(cart.items) || !cart.items.length) {
        throw createHttpError(400, "Your cart is empty.")
    }

    const orderItems = formatCartItemsForOrder(cart)
    if (!orderItems.length) {
        throw createHttpError(400, "No valid items found in your cart.")
    }

    const summary = calculateSummary(orderItems)
    const orderCode = await generateUniqueOrderCode()
    const gatewayOrder = paymentMethod === "cod"
        ? null
        : await createRazorpayGatewayOrder({
            amount: summary.grandTotal,
            currency: "INR",
            receipt: orderCode,
            notes: {
                orderCode,
                userEmail,
                paymentMethod
            }
        })

    const payment = buildPaymentPayload(
        {
            ...(payload.payment && typeof payload.payment === "object" ? payload.payment : {}),
            method: paymentMethod
        },
        summary.grandTotal,
        gatewayOrder
    )

    const order = new Order({
        orderCode,
        userEmail,
        customerName,
        customerPhone: customerPhone || normalizePhone(shippingAddress.phone),
        shippingAddress,
        items: orderItems,
        ...summary,
        payment,
        notes,
        source: normalizeText(source || "web-checkout") || "web-checkout"
    })

    await order.save()

    let updatedCart = cart
    if (shouldClearCart) {
        cart.items = []
        await cart.save()
        updatedCart = await Cart.findOne({ userEmail }).populate(
            "items.product",
            "name price images image gender type fit"
        )
    }

    return {
        order,
        cart: toCartResponse(updatedCart || { userEmail, items: [] }),
        gatewayOrder
    }
}

router.get("/checkout/options", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        const cart = await Cart.findOne({ userEmail }).populate(
            "items.product",
            "name price images image gender type fit"
        )

        const cartPayload = toCartResponse(cart || { userEmail, items: [] })

        res.json({
            success: true,
            userEmail,
            cart: cartPayload,
            checkout: getCheckoutOptionsPayload()
        })
    } catch (err) {
        console.log("CHECKOUT OPTIONS ERROR:", err)
        res.status(500).json({ error: err.message || "Unable to prepare checkout options." })
    }
})

router.post("/checkout", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        const result = await createOrderFromCart({
            userEmail,
            body: req.body,
            source: "web-checkout",
            requireFullCheckout: true
        })

        const paymentStatus = normalizeLower(result?.order?.payment?.status)

        let message = "Order placed successfully."
        if (paymentStatus === "cod-pending") {
            message = "Order placed successfully. Cash on delivery selected."
        } else if (paymentStatus === "pending") {
            message = "Order placed. Complete payment securely to confirm your order."
        }

        res.status(201).json({
            success: true,
            message,
            order: result.order,
            cart: result.cart,
            checkout: getCheckoutOptionsPayload(),
            paymentGateway: result.gatewayOrder ? {
                provider: "razorpay",
                keyId: getRazorpayKeyId(),
                orderId: result.gatewayOrder.id,
                amount: result.gatewayOrder.amount,
                currency: result.gatewayOrder.currency || "INR",
                name: "The Unspoken Store",
                description: `Order ${result.order.orderCode}`,
                prefill: {
                    name: result.order.customerName,
                    email: result.order.userEmail,
                    contact: result.order.customerPhone
                }
            } : null
        })
    } catch (err) {
        console.log("CHECKOUT CREATE ERROR:", err)
        const statusCode = getHttpStatusCode(err)
        res.status(statusCode).json({ error: err.message || "Unable to place order." })
    }
})

router.post("/razorpay/webhook", async (req, res) => {
    try {
        verifyRazorpayWebhookSignature(req)

        const payload = parseRazorpayWebhookPayload(req)
        const eventName = normalizeText(payload?.event)
        const paymentEntity = getWebhookPaymentEntity(payload)

        if (!paymentEntity) {
            return res.json({
                success: true,
                message: "Webhook received. No payment entity to process."
            })
        }

        const order = await findOrderForWebhookPayment(paymentEntity)
        if (!order) {
            return res.json({
                success: true,
                message: "Webhook received. Matching order not found yet."
            })
        }

        if (eventName === "payment.captured") {
            const updatedOrder = await markOrderPaidFromWebhook(order, paymentEntity, eventName)
            await clearCartForPaidOrder(updatedOrder)
            return res.json({
                success: true,
                message: "Payment captured webhook processed.",
                orderId: String(updatedOrder._id),
                orderCode: updatedOrder.orderCode
            })
        }

        if (eventName === "payment.failed") {
            const updatedOrder = await markOrderFailedFromWebhook(order, paymentEntity, eventName)
            return res.json({
                success: true,
                message: "Payment failed webhook processed.",
                orderId: String(updatedOrder._id),
                orderCode: updatedOrder.orderCode
            })
        }

        res.json({
            success: true,
            message: `Webhook event ignored: ${eventName || "unknown"}.`
        })
    } catch (err) {
        console.log("RAZORPAY WEBHOOK ERROR:", err)
        const statusCode = getHttpStatusCode(err)
        res.status(statusCode).json({ error: err.message || "Unable to process Razorpay webhook." })
    }
})

router.post("/:orderId/payment/confirm", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        const orderId = normalizeText(req.params?.orderId)
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: "Invalid order ID." })
        }

        const order = await Order.findById(orderId)
        if (!order) {
            return res.status(404).json({ error: "Order not found." })
        }

        if (normalizeLower(order.userEmail) !== normalizeLower(userEmail)) {
            return res.status(403).json({ error: "You can only confirm payment for your own orders." })
        }

        const nextPayment = buildPaymentConfirmationPayload(order.payment, req.body || {})
        const gatewayPayment = await verifyRazorpayPaymentCapture({
            gatewayPaymentId: nextPayment.gatewayPaymentId,
            expectedAmount: Number(order.grandTotal || 0),
            expectedCurrency: "INR"
        })

        nextPayment.details = {
            ...(nextPayment.details && typeof nextPayment.details === "object" ? nextPayment.details : {}),
            gatewayStatus: normalizeText(gatewayPayment?.status),
            gatewayFee: Number(gatewayPayment?.fee || 0),
            gatewayTax: Number(gatewayPayment?.tax || 0)
        }

        order.payment = {
            ...(order.payment && typeof order.payment.toObject === "function" ? order.payment.toObject() : order.payment || {}),
            ...nextPayment,
            amount: Number(order.grandTotal || 0),
            currency: "INR"
        }

        await order.save()

        const cart = await Cart.findOne({ userEmail })
        if (cart) {
            cart.items = []
            await cart.save()
        }

        const refreshedCart = await Cart.findOne({ userEmail }).populate(
            "items.product",
            "name price images image gender type fit"
        )

        res.json({
            success: true,
            message: "Payment confirmed successfully.",
            order,
            cart: toCartResponse(refreshedCart || { userEmail, items: [] })
        })
    } catch (err) {
        console.log("PAYMENT CONFIRM ERROR:", err)
        const statusCode = getHttpStatusCode(err)
        res.status(statusCode).json({ error: err.message || "Unable to confirm payment." })
    }
})

router.post("/:orderId/payment/failed", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        const orderId = normalizeText(req.params?.orderId)
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res.status(400).json({ error: "Invalid order ID." })
        }

        const order = await Order.findById(orderId)
        if (!order) {
            return res.status(404).json({ error: "Order not found." })
        }

        if (normalizeLower(order.userEmail) !== normalizeLower(userEmail)) {
            return res.status(403).json({ error: "You can only update your own payment." })
        }

        if (normalizeLower(order.payment?.status) !== "paid") {
            order.payment = {
                ...(order.payment && typeof order.payment.toObject === "function" ? order.payment.toObject() : order.payment || {}),
                status: "failed",
                details: {
                    ...(order.payment?.details && typeof order.payment.details === "object" ? order.payment.details : {}),
                    failureReason: normalizeText(req.body?.reason || "Payment was not completed.")
                }
            }

            await order.save()
        }

        res.json({
            success: true,
            message: "Payment failure recorded.",
            order
        })
    } catch (err) {
        console.log("PAYMENT FAILED UPDATE ERROR:", err)
        const statusCode = getHttpStatusCode(err)
        res.status(statusCode).json({ error: err.message || "Unable to update payment status." })
    }
})

router.get("/admin/list", requireAdminToken, async (req, res) => {
    try {
        const query = {}
        const userEmail = normalizeLower(req.query?.userEmail)
        const status = normalizeLower(req.query?.status)
        const source = normalizeLower(req.query?.source)
        const paymentMethod = normalizeLower(req.query?.paymentMethod)
        const paymentStatus = normalizeLower(req.query?.paymentStatus)
        const search = normalizeText(req.query?.search)
        const sort = normalizeLower(req.query?.sort || "newest")
        const limit = parseLimit(req.query?.limit, 120, 500)
        const countOnly = isTruthyFlag(req.query?.countOnly)

        if (userEmail) {
            query.userEmail = userEmail
        }

        if (status && ORDER_STATUSES.has(status)) {
            query.status = status
        }

        if (source && source !== "all") {
            query.source = source
        }

        if (paymentMethod && paymentMethod !== "all" && PAYMENT_METHODS.has(paymentMethod)) {
            query["payment.method"] = paymentMethod
        }

        if (paymentStatus && paymentStatus !== "all" && PAYMENT_STATUSES.has(paymentStatus)) {
            query["payment.status"] = paymentStatus
        }

        if (search) {
            const searchRegex = new RegExp(escapeRegex(search), "i")
            query.$or = [
                { orderCode: searchRegex },
                { customerName: searchRegex },
                { userEmail: searchRegex },
                { customerPhone: searchRegex },
                { "payment.reference": searchRegex },
                { "payment.transactionId": searchRegex },
                { "payment.gatewayPaymentId": searchRegex }
            ]
        }

        if (countOnly) {
            const count = await Order.countDocuments(query)
            return res.json({ count })
        }

        const sortStage = sort === "oldest"
            ? { createdAt: 1 }
            : { createdAt: -1 }

        const orders = await Order.find(query)
            .sort(sortStage)
            .limit(limit)

        res.json(orders)
    } catch (err) {
        console.log("ADMIN ORDER LIST ERROR:", err)
        res.status(500).json({ error: err.message || "Unable to load orders." })
    }
})

router.patch("/admin/:orderId/status", requireAdminToken, async (req, res) => {
    try {
        const orderId = normalizeText(req.params?.orderId)
        const nextStatus = normalizeLower(req.body?.status)

        if (!orderId) {
            return res.status(400).json({ error: "Order ID is required." })
        }

        if (!ORDER_STATUSES.has(nextStatus)) {
            return res.status(400).json({ error: "Invalid order status." })
        }

        const order = await Order.findById(orderId)
        if (!order) {
            return res.status(404).json({ error: "Order not found." })
        }

        order.status = nextStatus
        await order.save()

        res.json({
            success: true,
            message: "Order status updated.",
            order
        })
    } catch (err) {
        console.log("ADMIN ORDER STATUS UPDATE ERROR:", err)
        res.status(500).json({ error: err.message || "Unable to update order status." })
    }
})

router.get("/", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        const requestedEmail = normalizeLower(req.query?.userEmail)
        if (requestedEmail && requestedEmail !== userEmail) {
            return res.status(403).json({ error: "You can only access your own orders." })
        }

        const query = { userEmail: requestedEmail || userEmail }
        const limit = parseLimit(req.query?.limit, 50, 200)

        const orders = await Order.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)

        res.json(orders)
    } catch (err) {
        console.log("ORDER LIST ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

router.post("/", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        const result = await createOrderFromCart({
            userEmail,
            body: {
                ...(req.body && typeof req.body === "object" ? req.body : {}),
                payment: req.body?.payment || { method: "cod" }
            },
            source: "web-cart",
            requireFullCheckout: false
        })

        res.status(201).json({
            success: true,
            message: "Order placed successfully.",
            order: result.order,
            cart: result.cart
        })
    } catch (err) {
        console.log("ORDER CREATE ERROR:", err)
        const statusCode = getHttpStatusCode(err)
        res.status(statusCode).json({ error: err.message || "Unable to place order." })
    }
})

module.exports = router
