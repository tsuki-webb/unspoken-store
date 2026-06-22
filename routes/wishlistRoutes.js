const express = require("express")
const router = express.Router()
const User = require("../models/User")
const Product = require("../models/Product")
const { resolveAuthenticatedUser } = require("../middleware/sessionAuth")
const mongoose = require("mongoose")

async function getValidProductId(req, res) {
    let productId = String((req.body || {}).productId || "").trim()
    try { productId = decodeURIComponent(productId) } catch (e) {}

    if (!productId) {
        res.status(400).json({ error: "productId is required" })
        return ""
    }

    if (!mongoose.Types.ObjectId.isValid(productId)) {
        res.status(400).json({ error: "Invalid productId" })
        return ""
    }

    const productExists = await Product.exists({ _id: productId })
    if (!productExists) {
        res.status(404).json({ error: "Product not found" })
        return ""
    }

    return productId
}

router.get("/", async (req, res) => {
    try {
        const auth = await resolveAuthenticatedUser(req, { allowFallback: true })
        const email = auth?.email
        if (!email) return res.json([])

        const user = await User.findOne({ email }).populate("wishlist").lean()
        if (!user) return res.json([])

        res.json(Array.isArray(user.wishlist) ? user.wishlist : [])
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

router.post("/toggle", async (req, res) => {
    try {
        const productId = await getValidProductId(req, res)
        if (!productId) return

        const auth = await resolveAuthenticatedUser(req, { allowFallback: true })
        const email = auth?.email
        if (!email) return res.status(401).json({ error: "unauthenticated" })

        const user = await User.findOne({ email })
        if (!user) return res.status(404).json({ error: "user not found" })

        const exists = (user.wishlist || []).some(id => String(id) === String(productId))
        if (exists) {
            user.wishlist = (user.wishlist || []).filter(id => String(id) !== String(productId))
        } else {
            user.wishlist = user.wishlist || []
            user.wishlist.push(productId)
        }

        await user.save()
        await user.populate("wishlist")

        res.json({ success: true, wishlist: user.wishlist })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

router.post("/remove", async (req, res) => {
    try {
        const productId = await getValidProductId(req, res)
        if (!productId) return

        const auth = await resolveAuthenticatedUser(req, { allowFallback: true })
        const email = auth?.email
        if (!email) return res.status(401).json({ error: "unauthenticated" })

        const user = await User.findOne({ email })
        if (!user) return res.status(404).json({ error: "user not found" })

        user.wishlist = (user.wishlist || []).filter(id => String(id) !== String(productId))
        await user.save()
        await user.populate("wishlist")

        res.json({ success: true, wishlist: user.wishlist })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

module.exports = router
