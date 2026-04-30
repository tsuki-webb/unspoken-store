const mongoose = require("mongoose")

const ORDER_STATUSES = [
    "placed",
    "processing",
    "shipped",
    "delivered",
    "cancelled"
]

const PAYMENT_METHODS = [
    "cod",
    "upi",
    "card",
    "netbanking",
    "razorpay"
]

const PAYMENT_STATUSES = [
    "unpaid",
    "pending",
    "paid",
    "failed",
    "refunded",
    "cod-pending"
]

const CART_SIZES = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]

const sizeBreakdownSchema = new mongoose.Schema({
    xs: { type: Number, default: 0, min: 0 },
    s: { type: Number, default: 0, min: 0 },
    m: { type: Number, default: 0, min: 0 },
    l: { type: Number, default: 0, min: 0 },
    xl: { type: Number, default: 0, min: 0 },
    xxl: { type: Number, default: 0, min: 0 },
    xxxl: { type: Number, default: 0, min: 0 }
}, { _id: false })

const customPresetSchema = new mongoose.Schema({
    presetId: { type: String, default: "" },
    presetName: { type: String, default: "" },
    targetGender: {
        type: String,
        enum: ["men", "women", "unisex"],
        default: "unisex"
    },
    tshirtFit: {
        type: String,
        enum: ["oversized", "regular"],
        default: "oversized"
    },
    baseColor: { type: String, default: "Black" },
    printSides: {
        type: String,
        enum: ["front", "back", "both"],
        default: "front"
    },
    primarySize: {
        type: String,
        enum: CART_SIZES,
        default: "M"
    },
    sizeBreakdown: {
        type: sizeBreakdownSchema,
        default: () => ({})
    },
    signature: { type: String, default: "" }
}, { _id: false })

const orderItemSchema = new mongoose.Schema({
    itemType: {
        type: String,
        enum: ["product", "custom-preset"],
        default: "product"
    },
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        default: null
    },
    quantity: {
        type: Number,
        default: 1,
        min: 1
    },
    size: {
        type: String,
        enum: CART_SIZES,
        default: "M"
    },
    unitPrice: {
        type: Number,
        required: true,
        min: 0
    },
    lineTotal: {
        type: Number,
        required: true,
        min: 0
    },
    name: {
        type: String,
        default: "Product"
    },
    subtitle: {
        type: String,
        default: ""
    },
    image: {
        type: String,
        default: ""
    },
    gender: {
        type: String,
        default: ""
    },
    type: {
        type: String,
        default: ""
    },
    fit: {
        type: String,
        default: ""
    },
    customPreset: {
        type: customPresetSchema,
        default: null
    }
}, { _id: false })

const addressSchema = new mongoose.Schema({
    recipientName: {
        type: String,
        default: "",
        trim: true
    },
    phone: {
        type: String,
        default: "",
        trim: true
    },
    line1: {
        type: String,
        default: "",
        trim: true
    },
    line2: {
        type: String,
        default: "",
        trim: true
    },
    landmark: {
        type: String,
        default: "",
        trim: true
    },
    city: {
        type: String,
        default: "",
        trim: true
    },
    state: {
        type: String,
        default: "",
        trim: true
    },
    postalCode: {
        type: String,
        default: "",
        trim: true
    },
    country: {
        type: String,
        default: "India",
        trim: true
    }
}, { _id: false })

const paymentSchema = new mongoose.Schema({
    method: {
        type: String,
        enum: PAYMENT_METHODS,
        default: "cod"
    },
    provider: {
        type: String,
        default: "manual"
    },
    status: {
        type: String,
        enum: PAYMENT_STATUSES,
        default: "cod-pending"
    },
    amount: {
        type: Number,
        default: 0,
        min: 0
    },
    currency: {
        type: String,
        default: "INR",
        uppercase: true,
        trim: true
    },
    reference: {
        type: String,
        default: "",
        trim: true
    },
    transactionId: {
        type: String,
        default: "",
        trim: true
    },
    gatewayOrderId: {
        type: String,
        default: "",
        trim: true
    },
    gatewayPaymentId: {
        type: String,
        default: "",
        trim: true
    },
    gatewaySignature: {
        type: String,
        default: "",
        trim: true
    },
    paidAt: {
        type: Date,
        default: null
    },
    details: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { _id: false })

const orderSchema = new mongoose.Schema({
    orderCode: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userEmail: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    customerPhone: {
        type: String,
        default: "",
        trim: true
    },
    shippingAddress: {
        type: addressSchema,
        default: () => ({})
    },
    items: {
        type: [orderItemSchema],
        default: []
    },
    uniqueItems: {
        type: Number,
        default: 0
    },
    itemCount: {
        type: Number,
        default: 0
    },
    subtotal: {
        type: Number,
        default: 0
    },
    shipping: {
        type: Number,
        default: 0
    },
    tax: {
        type: Number,
        default: 0
    },
    taxRate: {
        type: Number,
        default: 0.05
    },
    grandTotal: {
        type: Number,
        default: 0
    },
    freeShippingThreshold: {
        type: Number,
        default: 1999
    },
    status: {
        type: String,
        enum: ORDER_STATUSES,
        default: "placed"
    },
    payment: {
        type: paymentSchema,
        default: () => ({})
    },
    source: {
        type: String,
        default: "web-cart"
    },
    notes: {
        type: String,
        default: ""
    }
}, { timestamps: true })

module.exports = mongoose.models.Order || mongoose.model("Order", orderSchema)
