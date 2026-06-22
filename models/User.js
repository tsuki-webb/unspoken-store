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
    phone: {
        type: String,
        default: "",
        trim: true
    },
    stylePreference: {
        type: String,
        default: "",
        trim: true
    },
    fitPreference: {
        type: String,
        default: "",
        trim: true
    },
    wantsUpdates: {
        type: Boolean,
        default: true
    },
    provider: {
        type: String,
        default: "email"
    }
    ,
    wishlist: {
        type: [
            {
                type: require("mongoose").Schema.Types.ObjectId,
                ref: "Product"
            }
        ],
        default: []
    }
}, { timestamps: true })

module.exports = mongoose.models.User || mongoose.model("User", userSchema)
