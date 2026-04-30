const mongoose = require("mongoose")

const categoryCardSchema = new mongoose.Schema({
    gender: {
        type: String,
        enum: ["men", "women", "unisex"],
        required: true
    },
    categoryId: {
        type: String,
        required: true,
        trim: true
    },
    title: {
        type: String,
        default: "",
        trim: true
    },
    subtitle: {
        type: String,
        default: "",
        trim: true
    },
    displayOrder: {
        type: Number,
        default: 0
    },
    image: {
        type: String,
        required: true
    }
}, { timestamps: true })

categoryCardSchema.index({ gender: 1, categoryId: 1 }, { unique: true })
categoryCardSchema.index({ gender: 1, displayOrder: 1 })

module.exports = mongoose.models.CategoryCard || mongoose.model("CategoryCard", categoryCardSchema)
