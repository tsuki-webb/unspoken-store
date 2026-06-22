const express = require("express")
const mongoose = require("mongoose")
const path = require("path")
const cors = require("cors")
require("dotenv").config()

const productRoutes = require("./routes/productRoutes")
const authRoutes = require("./routes/authRoutes")
const bannerRoutes = require("./routes/bannerRoutes")
const categoryCardRoutes = require("./routes/categoryCardRoutes")
const userRoutes = require("./routes/userRoutes")
const cartRoutes = require("./routes/cartRoutes")
const customDesignRoutes = require("./routes/customDesignRoutes")
const orderRoutes = require("./routes/orderRoutes")
const wishlistRoutes = require("./routes/wishlistRoutes")

const app = express()
const PORT = Number(process.env.PORT || 3000)

// ✅ MIDDLEWARE
app.use(cors({
    origin: true,
    credentials: true
}))
app.use("/api/orders/razorpay/webhook", express.raw({ type: "application/json" }))
app.use(express.json())

// ✅ API ROUTES
app.use("/api/products", productRoutes)
app.use("/api/auth", authRoutes)
app.use("/api/banners", bannerRoutes)
app.use("/api/category-cards", categoryCardRoutes)
app.use("/api/users", userRoutes)
app.use("/api/cart", cartRoutes)
app.use("/api/custom-designs", customDesignRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/wishlist", wishlistRoutes)

// ✅ STATIC
app.use(express.static("public"))

// ✅ HOME ROUTE
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"))
})

// ✅ DB + SERVER
mongoose.connect(process.env.MONGO_URI)
    .then(() => {
        console.log("MongoDB Connected")
        app.listen(PORT, () => console.log(`Server running on port ${PORT}`))
    })
    .catch(err => console.log(err))
