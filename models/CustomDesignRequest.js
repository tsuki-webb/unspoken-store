const mongoose = require("mongoose")

const VALID_PLACEMENTS = [
    "center-chest",
    "left-chest",
    "full-front",
    "upper-back",
    "full-back",
    "neck-label",
    "custom"
]

const sizeBreakdownSchema = new mongoose.Schema({
    xs: { type: Number, default: 0, min: 0 },
    s: { type: Number, default: 0, min: 0 },
    m: { type: Number, default: 0, min: 0 },
    l: { type: Number, default: 0, min: 0 },
    xl: { type: Number, default: 0, min: 0 },
    xxl: { type: Number, default: 0, min: 0 },
    xxxl: { type: Number, default: 0, min: 0 }
}, { _id: false })

const designAssetSchema = new mongoose.Schema({
    url: { type: String, required: true },
    role: {
        type: String,
        enum: ["front", "back", "reference"],
        default: "reference"
    },
    originalName: { type: String, default: "" }
}, { _id: false })

const customDesignRequestSchema = new mongoose.Schema({
    requestCode: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    customerName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true
    },
    phone: {
        type: String,
        required: true,
        trim: true
    },
    targetGender: {
        type: String,
        enum: ["men", "women", "unisex"],
        default: "unisex"
    },
    tshirtFit: {
        type: String,
        enum: ["oversized", "regular"],
        required: true
    },
    baseColor: { type: String, default: "" },
    materialPreference: { type: String, default: "" },
    quantity: {
        type: Number,
        required: true,
        min: 1
    },
    sizeBreakdown: {
        type: sizeBreakdownSchema,
        default: () => ({})
    },
    printSides: {
        type: String,
        enum: ["front", "back", "both"],
        required: true
    },
    frontPlacement: {
        type: String,
        enum: VALID_PLACEMENTS,
        default: "center-chest"
    },
    backPlacement: {
        type: String,
        enum: VALID_PLACEMENTS,
        default: "upper-back"
    },
    placementNotes: { type: String, default: "" },
    designAssets: {
        type: [designAssetSchema],
        default: []
    },
    deliveryTargetDate: { type: Date, default: null },
    budget: { type: String, default: "" },
    specialInstructions: { type: String, default: "" },
    status: {
        type: String,
        enum: ["pending", "in-review", "quoted", "in-production", "completed", "cancelled"],
        default: "pending"
    },
    sourcePage: {
        type: String,
        default: "custom-design"
    }
}, { timestamps: true })

module.exports =
    mongoose.models.CustomDesignRequest ||
    mongoose.model("CustomDesignRequest", customDesignRequestSchema)

