const mongoose = require("mongoose")

const bannerSchema = new mongoose.Schema({
    section: String, // men / women / unisex
    image: String
})

module.exports = mongoose.model("Banner", bannerSchema)