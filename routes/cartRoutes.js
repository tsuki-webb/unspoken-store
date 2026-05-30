const express = require("express")
const mongoose = require("mongoose")
const Cart = require("../models/Cart")
const Product = require("../models/Product")
const { resolveAuthenticatedUser } = require("../middleware/sessionAuth")

const router = express.Router()

const CART_SIZES = new Set(["XS", "S", "M", "L", "XL", "XXL", "XXXL"])
const SIZE_KEYS = ["xs", "s", "m", "l", "xl", "xxl", "xxxl"]

const VALID_GENDERS = new Set(["men", "women", "unisex"])
const VALID_FITS = new Set(["oversized", "regular"])
const VALID_PRINT_SIDES = new Set(["front", "back", "both"])

const FREE_SHIPPING_THRESHOLD = 1999
const FLAT_SHIPPING_FEE = 99
const TAX_RATE = 0.05

const CUSTOM_TSHIRT_PRICES = {
    regular: 899,
    oversized: 999
}

const COLOR_HEX_MAP = {
    black: "#111111",
    white: "#f4f4f4",
    navy: "#1f2b4d",
    charcoal: "#2f3438",
    beige: "#d4c3a4",
    olive: "#5d6a41",
    maroon: "#6a2230",
    sky: "#8cb7de",
    mint: "#8bc9b0",
    lavender: "#b4addf",
    coral: "#e48b7a",
    sand: "#c8b18f",
    grey: "#8b8f95",
    gray: "#8b8f95"
}

function normalizeText(value) {
    return String(value || "").trim()
}

function normalizeLower(value) {
    return normalizeText(value).toLowerCase()
}

function toTitleCase(value) {
    return String(value || "")
        .split(" ")
        .map(part => part.trim())
        .filter(Boolean)
        .map(part => part[0].toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
}

function normalizeProductQuantity(value, fallback = 1) {
    const parsed = Number.parseInt(String(value ?? ""), 10)
    if (Number.isNaN(parsed)) return fallback
    if (parsed < 1) return 1
    if (parsed > 20) return 20
    return parsed
}

function normalizeCartQuantity(value, fallback = 1) {
    const parsed = Number.parseInt(String(value ?? ""), 10)
    if (Number.isNaN(parsed)) return fallback
    if (parsed < 1) return 1
    if (parsed > 999) return 999
    return parsed
}

function normalizeSize(value, fallback = "M") {
    const requested = normalizeText(value).toUpperCase()
    if (!requested) return fallback
    if (!CART_SIZES.has(requested)) return fallback
    return requested
}

function getProductImage(product) {
    if (Array.isArray(product?.images) && product.images.length) {
        return product.images[0]
    }

    return String(product?.image || "").trim()
}

function calculateSummary(items) {
    const subtotal = items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0)
    const shipping = subtotal >= FREE_SHIPPING_THRESHOLD
        ? 0
        : (subtotal > 0 ? FLAT_SHIPPING_FEE : 0)
    const tax = subtotal > 0 ? Number((subtotal * TAX_RATE).toFixed(2)) : 0
    const grandTotal = Number((subtotal + shipping + tax).toFixed(2))
    const remainingForFreeShipping = subtotal >= FREE_SHIPPING_THRESHOLD
        ? 0
        : Math.max(FREE_SHIPPING_THRESHOLD - subtotal, 0)

    return {
        uniqueItems: items.length,
        itemCount: items.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
        subtotal: Number(subtotal.toFixed(2)),
        shipping,
        tax,
        taxRate: TAX_RATE,
        grandTotal,
        freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
        remainingForFreeShipping
    }
}

function parsePositiveInt(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? ""), 10)
    if (Number.isNaN(parsed) || parsed < 0) return fallback
    return parsed
}

function normalizeColorName(value) {
    const trimmed = normalizeText(value)
    if (!trimmed) return "Black"
    return toTitleCase(trimmed)
}

function resolveColorHex(colorName) {
    const normalized = normalizeLower(colorName)
    return COLOR_HEX_MAP[normalized] || "#111111"
}

function normalizeCollection(value, fallback = "unisex") {
    const normalized = normalizeLower(value)
    return VALID_GENDERS.has(normalized) ? normalized : fallback
}

function normalizeFit(value, fallback = "oversized") {
    const normalized = normalizeLower(value)
    return VALID_FITS.has(normalized) ? normalized : fallback
}

function normalizePrintSides(value, fallback = "front") {
    const normalized = normalizeLower(value)
    return VALID_PRINT_SIDES.has(normalized) ? normalized : fallback
}

function normalizeSizeBreakdown(input) {
    const source = input && typeof input === "object" ? input : {}

    return {
        xs: parsePositiveInt(source.xs ?? source.XS, 0),
        s: parsePositiveInt(source.s ?? source.S, 0),
        m: parsePositiveInt(source.m ?? source.M, 0),
        l: parsePositiveInt(source.l ?? source.L, 0),
        xl: parsePositiveInt(source.xl ?? source.XL, 0),
        xxl: parsePositiveInt(source.xxl ?? source.XXL, 0),
        xxxl: parsePositiveInt(source.xxxl ?? source.XXXL, 0)
    }
}

function sumSizeBreakdown(sizeBreakdown) {
    return SIZE_KEYS.reduce((sum, key) => sum + Number(sizeBreakdown?.[key] || 0), 0)
}

function resolvePrimarySize(sizeBreakdown, fallback = "M") {
    let winningSize = normalizeSize(fallback, "M")
    let winningQty = 0

    SIZE_KEYS.forEach(key => {
        const qty = Number(sizeBreakdown?.[key] || 0)
        if (qty > winningQty) {
            winningQty = qty
            winningSize = key.toUpperCase()
        }
    })

    return normalizeSize(winningSize, "M")
}

function resolveCustomUnitPrice(fit) {
    const normalizedFit = normalizeFit(fit, "oversized")
    return Number(CUSTOM_TSHIRT_PRICES[normalizedFit] || CUSTOM_TSHIRT_PRICES.oversized)
}

function buildCustomPresetSignature(preset) {
    const normalizedColor = normalizeLower(preset.baseColor)
    const sizeSignature = SIZE_KEYS
        .map(key => `${key}:${Number(preset.sizeBreakdown?.[key] || 0)}`)
        .join("|")

    return [
        normalizeCollection(preset.targetGender, "unisex"),
        normalizeFit(preset.tshirtFit, "oversized"),
        normalizedColor,
        normalizePrintSides(preset.printSides, "front"),
        normalizeSize(preset.primarySize, "M"),
        sizeSignature
    ].join("::")
}

function buildCustomPresetImage(baseColor, fit) {
    const hex = resolveColorHex(baseColor).replace("#", "")
    const fitLabel = normalizeFit(fit, "oversized") === "regular" ? "Regular" : "Oversized"
    const encodedText = encodeURIComponent(`${fitLabel} Custom Tee`)

    return `https://via.placeholder.com/420x520/${hex}/ffffff?text=${encodedText}`
}

function parseSizeBreakdownFromBody(body) {
    const raw = body?.sizeBreakdown

    if (raw && typeof raw === "object") {
        return raw
    }

    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw)
            if (parsed && typeof parsed === "object") {
                return parsed
            }
        } catch (err) {
            return {}
        }
    }

    return {}
}

function buildCustomPresetPayload(body = {}) {
    const targetGender = normalizeCollection(body.targetGender, "unisex")
    const tshirtFit = normalizeFit(body.tshirtFit, "oversized")
    const baseColor = normalizeColorName(body.baseColor)
    const printSides = normalizePrintSides(body.printSides, "front")
    const sizeBreakdown = normalizeSizeBreakdown(parseSizeBreakdownFromBody(body))
    const quantityFromSizes = sumSizeBreakdown(sizeBreakdown)
    const requestedQuantity = parsePositiveInt(body.quantity, 0)
    const resolvedQuantity = normalizeCartQuantity(
        quantityFromSizes > 0 ? quantityFromSizes : requestedQuantity,
        1
    )
    const primarySize = normalizeSize(
        body.primarySize || body.selectedSize || resolvePrimarySize(sizeBreakdown, "M"),
        resolvePrimarySize(sizeBreakdown, "M")
    )

    const presetName = normalizeText(body.presetName) ||
        `${toTitleCase(targetGender)} ${toTitleCase(tshirtFit)} Custom T-Shirt`

    const preset = {
        presetId: normalizeText(body.presetId) ||
            `preset-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
        presetName,
        targetGender,
        tshirtFit,
        baseColor,
        printSides,
        primarySize,
        sizeBreakdown
    }

    preset.signature = buildCustomPresetSignature(preset)

    return {
        preset,
        quantity: resolvedQuantity,
        unitPrice: resolveCustomUnitPrice(tshirtFit),
        image: buildCustomPresetImage(baseColor, tshirtFit)
    }
}

function getItemType(item) {
    const normalized = normalizeLower(item?.itemType || "product")
    return normalized === "custom-preset" ? "custom-preset" : "product"
}

function formatCartItems(cartDoc) {
    const rawItems = Array.isArray(cartDoc?.items) ? cartDoc.items : []

    return rawItems.map(item => {
        const itemType = getItemType(item)
        const productDoc = itemType === "product" &&
            item.product &&
            typeof item.product === "object" &&
            ("name" in item.product || "price" in item.product || "images" in item.product)
            ? item.product
            : null

        const effectivePrice = Number(
            productDoc?.price ??
            item.unitPrice ??
            0
        )

        const quantity = normalizeCartQuantity(item.quantity, 1)
        const lineTotal = Number((effectivePrice * quantity).toFixed(2))

        if (itemType === "custom-preset") {
            const customPreset = item.customPreset && typeof item.customPreset === "object"
                ? item.customPreset
                : {}

            const baseColor = normalizeColorName(customPreset.baseColor || "Black")
            const fit = normalizeFit(customPreset.tshirtFit || "oversized", "oversized")

            return {
                itemId: String(item._id || ""),
                itemType: "custom-preset",
                productId: "",
                quantity,
                size: normalizeSize(item.size || customPreset.primarySize, "M"),
                unitPrice: Number(effectivePrice.toFixed(2)),
                lineTotal,
                isAvailable: true,
                name: String(item.productName || customPreset.presetName || "Custom T-Shirt"),
                image: String(item.productImage || buildCustomPresetImage(baseColor, fit)),
                gender: String(customPreset.targetGender || ""),
                type: "tshirt",
                fit,
                customPreset
            }
        }

        return {
            itemId: String(item._id || ""),
            itemType: "product",
            productId: String(productDoc?._id || item.product || ""),
            quantity,
            size: normalizeSize(item.size, "M"),
            unitPrice: Number(effectivePrice.toFixed(2)),
            lineTotal,
            isAvailable: !!productDoc,
            name: String(productDoc?.name || item.productName || "Product"),
            image: String(getProductImage(productDoc) || item.productImage || ""),
            gender: String(productDoc?.gender || ""),
            type: String(productDoc?.type || ""),
            fit: String(productDoc?.fit || ""),
            customPreset: null
        }
    })
}

async function getHydratedCart(userEmail) {
    return Cart.findOne({ userEmail }).populate(
        "items.product",
        "name price images image gender type fit"
    )
}

async function respondWithCart(res, userEmail, statusCode = 200) {
    const cart = await getHydratedCart(userEmail)
    const items = cart ? formatCartItems(cart) : []
    const summary = calculateSummary(items)

    res.status(statusCode).json({
        userEmail,
        cartId: cart ? String(cart._id) : "",
        items,
        ...summary,
        updatedAt: cart?.updatedAt || null
    })
}

async function ensureCart(userEmail) {
    let cart = await Cart.findOne({ userEmail })

    if (!cart) {
        cart = new Cart({ userEmail, items: [] })
    }

    return cart
}

async function requireUserEmail(req, res) {
    const auth = await resolveAuthenticatedUser(req, { allowFallback: true })
    const userEmail = String(auth?.email || "")

    if (!userEmail) {
        res.status(401).json({ error: "Please sign in to use your cart." })
        return null
    }

    return userEmail
}

function isDuplicateCartTarget(candidate, target) {
    if (String(candidate?._id || "") === String(target?._id || "")) return false
    if (getItemType(candidate) !== getItemType(target)) return false

    if (getItemType(target) === "custom-preset") {
        const candidateSignature = String(candidate?.customPreset?.signature || "")
        const targetSignature = String(target?.customPreset?.signature || "")
        if (!candidateSignature || !targetSignature) return false
        return candidateSignature === targetSignature
    }

    return String(candidate?.product || "") === String(target?.product || "")
}

router.get("/", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        await respondWithCart(res, userEmail)
    } catch (err) {
        console.log("CART GET ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

router.post("/items", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        const productId = normalizeText(req.body?.productId)
        const quantity = normalizeProductQuantity(req.body?.quantity, 1)
        const size = normalizeSize(req.body?.size, "M")

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            return res.status(400).json({ error: "Invalid product id." })
        }

        const product = await Product.findById(productId).select("name price images image")

        if (!product) {
            return res.status(404).json({ error: "Product not found." })
        }

        const cart = await ensureCart(userEmail)
        const productObjectId = new mongoose.Types.ObjectId(productId)

        const existingItem = cart.items.find(item =>
            getItemType(item) === "product" &&
            String(item.product) === String(productObjectId) &&
            normalizeSize(item.size, "M") === size
        )

        if (existingItem) {
            existingItem.quantity = normalizeProductQuantity(existingItem.quantity + quantity, 1)
            existingItem.unitPrice = Number(product.price || 0)
            existingItem.productName = String(product.name || "")
            existingItem.productImage = getProductImage(product)
        } else {
            cart.items.push({
                itemType: "product",
                product: productObjectId,
                quantity,
                size,
                unitPrice: Number(product.price || 0),
                productName: String(product.name || ""),
                productImage: getProductImage(product)
            })
        }

        await cart.save()
        await respondWithCart(res, userEmail, 201)
    } catch (err) {
        console.log("CART ADD ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

router.post("/custom-items", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        const { preset, quantity, unitPrice, image } = buildCustomPresetPayload(req.body || {})
        const cart = await ensureCart(userEmail)

        const existingItem = cart.items.find(item =>
            getItemType(item) === "custom-preset" &&
            String(item.customPreset?.signature || "") === String(preset.signature || "") &&
            normalizeSize(item.size, "M") === normalizeSize(preset.primarySize, "M")
        )

        if (existingItem) {
            existingItem.quantity = normalizeCartQuantity(existingItem.quantity + quantity, 1)
            existingItem.unitPrice = unitPrice
            existingItem.productName = preset.presetName
            existingItem.productImage = image
            existingItem.size = normalizeSize(preset.primarySize, "M")
            existingItem.customPreset = preset
        } else {
            cart.items.push({
                itemType: "custom-preset",
                quantity,
                size: normalizeSize(preset.primarySize, "M"),
                unitPrice,
                productName: preset.presetName,
                productImage: image,
                customPreset: preset
            })
        }

        await cart.save()
        await respondWithCart(res, userEmail, 201)
    } catch (err) {
        console.log("CART CUSTOM ADD ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

router.patch("/items/:itemId", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        const itemId = normalizeText(req.params?.itemId)

        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ error: "Invalid cart item id." })
        }

        const cart = await ensureCart(userEmail)
        const target = cart.items.id(itemId)

        if (!target) {
            return res.status(404).json({ error: "Cart item not found." })
        }

        if (req.body?.quantity !== undefined) {
            if (getItemType(target) === "custom-preset") {
                target.quantity = normalizeCartQuantity(req.body.quantity, target.quantity)
            } else {
                target.quantity = normalizeProductQuantity(req.body.quantity, target.quantity)
            }
        }

        if (req.body?.size !== undefined) {
            target.size = normalizeSize(req.body.size, target.size)
        }

        const duplicate = cart.items.find(item =>
            isDuplicateCartTarget(item, target) &&
            normalizeSize(item.size, "M") === normalizeSize(target.size, "M")
        )

        if (duplicate) {
            if (getItemType(target) === "custom-preset") {
                duplicate.quantity = normalizeCartQuantity(duplicate.quantity + target.quantity, 1)
            } else {
                duplicate.quantity = normalizeProductQuantity(duplicate.quantity + target.quantity, 1)
            }

            cart.items.pull(target._id)
        }

        await cart.save()
        await respondWithCart(res, userEmail)
    } catch (err) {
        console.log("CART UPDATE ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

router.delete("/items/:itemId", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        const itemId = normalizeText(req.params?.itemId)

        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({ error: "Invalid cart item id." })
        }

        const cart = await ensureCart(userEmail)
        const target = cart.items.id(itemId)

        if (!target) {
            return res.status(404).json({ error: "Cart item not found." })
        }

        cart.items.pull(target._id)
        await cart.save()
        await respondWithCart(res, userEmail)
    } catch (err) {
        console.log("CART REMOVE ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

router.delete("/clear", async (req, res) => {
    try {
        const userEmail = await requireUserEmail(req, res)
        if (!userEmail) return

        const cart = await ensureCart(userEmail)
        cart.items = []
        await cart.save()

        await respondWithCart(res, userEmail)
    } catch (err) {
        console.log("CART CLEAR ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

module.exports = router
