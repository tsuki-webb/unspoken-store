const express = require("express")
const router = express.Router()
const User = require("../models/User")

router.get("/", async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 }).select("-password")
        res.json(users)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

module.exports = router