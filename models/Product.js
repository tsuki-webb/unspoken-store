const mongoose = require("mongoose")

const productSchema = new mongoose.Schema({

    name: { type: String, required: true },
    subtitle: { type: String, default: "" },
    price: { type: Number, required: true },

    images: { type: [String], default: [] },

    gender: {
        type: String,
        enum: ["men", "women", "unisex"],
        required: true
    },

    type: {
        type: String,
        enum: ["tshirt", "top", "shirt", "short", "sweatpant"],
        required: true
    },

    fit: {
        type: String,
        enum: ["oversized", "regular"],
        required: function requiredFitForTshirts() {
            return this.type === "tshirt"
        }
    },

    description: { type: String, default: "" },
    material: { type: String, default: "" },
    care: { type: String, default: "" },

    manufacturedBy: { type: String, default: "" },
    address: { type: String, default: "" },
    customerCare: { type: String, default: "" },

    artistDetails: { type: String, default: "" },

    countryOfOrigin: { type: String, default: "India" },

    featured: { type: Boolean, default: false },
    newCollection: { type: Boolean, default: false },
    newCollectionPriority: { type: Number, default: null }

}, { timestamps: true })

module.exports = mongoose.models.Product || mongoose.model("Product", productSchema)
