const mongoose = require("mongoose")

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        trim: true,
        lowercase: true,
        index: true
    },
    password: {
        type: String,
        required: true
    },
    name: {
        type: String,
        default: ""
    },
    photo: {
        type: String,
        default: ""
    },
    provider: {
        type: String,
        default: "email"
    }
}, { timestamps: true })

module.exports = mongoose.models.User || mongoose.model("User", userSchema)
