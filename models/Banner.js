const mongoose = require("mongoose")

const bannerSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true,
        unique: true
    },
    image: {
        type: String,
        required: true
    }
}, { timestamps: true })

module.exports = mongoose.models.Banner || mongoose.model("Banner", bannerSchema)
