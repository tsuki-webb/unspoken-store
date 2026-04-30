const mongoose = require("mongoose")

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
    presetId: {
        type: String,
        default: ""
    },
    presetName: {
        type: String,
        default: ""
    },
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
    baseColor: {
        type: String,
        default: "Black"
    },
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
    signature: {
        type: String,
        default: ""
    }
}, { _id: false })

const cartItemSchema = new mongoose.Schema({
    itemType: {
        type: String,
        enum: ["product", "custom-preset"],
        default: "product"
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: function requireProductForProductItems() {
            return String(this.itemType || "product") === "product"
        }
    },
    quantity: {
        type: Number,
        default: 1,
        min: 1,
        max: 999
    },
    size: {
        type: String,
        enum: CART_SIZES,
        default: "M"
    },
    unitPrice: {
        type: Number,
        default: 0,
        min: 0
    },
    productName: {
        type: String,
        default: ""
    },
    productImage: {
        type: String,
        default: ""
    },
    customPreset: {
        type: customPresetSchema,
        default: null
    }
}, { _id: true })

const cartSchema = new mongoose.Schema({
    userEmail: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
        index: true
    },
    items: {
        type: [cartItemSchema],
        default: []
    }
}, { timestamps: true })

module.exports = mongoose.models.Cart || mongoose.model("Cart", cartSchema)
