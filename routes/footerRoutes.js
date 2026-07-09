const express = require("express")
const router = express.Router()

const FooterSettings = require("../models/FooterSettings")
const upload = require("../middleware/upload")
const cloudinary = require("../config/cloudinary")
const streamifier = require("streamifier")

const DEFAULT_FOOTER = {
    homegrownText: "HOMEGROWN INDIAN BRAND",
    headlineBefore: "Over",
    headlineStrong: "6 Million",
    headlineAfter: "Happy Customers",
    brandTitle: "Unspoken Store",
    brandDescription: "Premium streetwear, custom tees, curated drops, and a clean shopping experience built for every screen.",
    linkSections: [
        {
            title: "Need Help",
            items: [
                { label: "Contact Us", href: "index.html#footerContact" },
                { label: "Track Order", href: "orders.html" },
                { label: "Returns & Refunds", href: "orders.html" },
                { label: "FAQs", href: "index.html#footerContact" },
                { label: "My Account", href: "index.html" }
            ]
        },
        {
            title: "Company",
            items: [
                { label: "About Us", href: "index.html#footerContact" },
                { label: "Custom Studio", href: "custom-design.html" },
                { label: "New Collection", href: "index.html#featuredProducts" },
                { label: "Gift Vouchers", href: "index.html#footerContact" }
            ]
        },
        {
            title: "More Info",
            items: [
                { label: "Terms & Conditions", href: "index.html#footerContact" },
                { label: "Privacy Policy", href: "index.html#footerContact" },
                { label: "Sitemap", href: "index.html" },
                { label: "Blogs", href: "index.html#footerContact" }
            ]
        }
    ],
    featureRows: [
        { icon: "₹", label: "COD Available", href: "" },
        { icon: "↻", label: "30 Days Easy Returns & Exchanges", href: "" }
    ],
    appTitle: "Experience the Unspoken Store app",
    appButtons: [
        { label: "Google Play", href: "#", badge: "Get it on" },
        { label: "App Store", href: "#", badge: "Download on the" }
    ],
    socialLinks: [
        { label: "Facebook", href: "#", icon: "f" },
        { label: "Instagram", href: "#", icon: "ig" },
        { label: "Snapchat", href: "#", icon: "sc" },
        { label: "X", href: "#", icon: "x" }
    ],
    infoTitle: "Who we are",
    infoBody: "Unspoken Store creates premium everyday streetwear with thoughtful fits, responsive support, and custom design workflows for production-ready apparel.",
    paymentText: "100% secure payment",
    paymentItems: ["PhonePe", "GPay", "Amazon Pay", "Mastercard", "Mobikwik", "Paytm", "Razorpay", "Cash on Delivery"],
    shippingText: "Shipping partners",
    shippingItems: ["DTDC", "Delhivery", "Ecom Express", "Xpressbees"],
    copyrightText: "© Unspoken Store 2026-27"
}

function normalizeText(value, fallback = "") {
    const normalized = String(value ?? "").trim()
    return normalized || fallback
}

function sanitizeLinks(items) {
    return (Array.isArray(items) ? items : [])
        .map(item => ({
            label: normalizeText(item?.label),
            href: normalizeText(item?.href, "#")
        }))
        .filter(item => item.label)
        .slice(0, 12)
}

function sanitizeSections(sections) {
    return (Array.isArray(sections) ? sections : [])
        .map(section => ({
            title: normalizeText(section?.title),
            items: sanitizeLinks(section?.items)
        }))
        .filter(section => section.title || section.items.length)
        .slice(0, 4)
}

function sanitizeIconRows(items) {
    return (Array.isArray(items) ? items : [])
        .map(item => ({
            label: normalizeText(item?.label),
            href: normalizeText(item?.href),
            icon: normalizeText(item?.icon),
            imageUrl: normalizeText(item?.imageUrl)
        }))
        .filter(item => item.label)
        .slice(0, 8)
}

function sanitizeBadges(items) {
    return (Array.isArray(items) ? items : [])
        .map(item => ({
            label: normalizeText(item?.label),
            href: normalizeText(item?.href, "#"),
            badge: normalizeText(item?.badge)
        }))
        .filter(item => item.label)
        .slice(0, 4)
}

function sanitizeStringList(items) {
    return (Array.isArray(items) ? items : [])
        .map(item => normalizeText(item))
        .filter(Boolean)
        .slice(0, 12)
}

function sanitizePayload(body = {}) {
    return {
        homegrownText: normalizeText(body.homegrownText, DEFAULT_FOOTER.homegrownText),
        headlineBefore: normalizeText(body.headlineBefore, DEFAULT_FOOTER.headlineBefore),
        headlineStrong: normalizeText(body.headlineStrong, DEFAULT_FOOTER.headlineStrong),
        headlineAfter: normalizeText(body.headlineAfter, DEFAULT_FOOTER.headlineAfter),
        brandTitle: normalizeText(body.brandTitle, DEFAULT_FOOTER.brandTitle),
        brandDescription: normalizeText(body.brandDescription, DEFAULT_FOOTER.brandDescription),
        linkSections: sanitizeSections(body.linkSections),
        featureRows: sanitizeIconRows(body.featureRows),
        appTitle: normalizeText(body.appTitle, DEFAULT_FOOTER.appTitle),
        appButtons: sanitizeBadges(body.appButtons),
        socialLinks: sanitizeIconRows(body.socialLinks),
        infoTitle: normalizeText(body.infoTitle, DEFAULT_FOOTER.infoTitle),
        infoBody: normalizeText(body.infoBody, DEFAULT_FOOTER.infoBody),
        paymentText: normalizeText(body.paymentText, DEFAULT_FOOTER.paymentText),
        paymentItems: sanitizeStringList(body.paymentItems),
        shippingText: normalizeText(body.shippingText, DEFAULT_FOOTER.shippingText),
        shippingItems: sanitizeStringList(body.shippingItems),
        copyrightText: normalizeText(body.copyrightText, DEFAULT_FOOTER.copyrightText)
    }
}

function mergeWithDefaults(settings) {
    const raw = settings?.toObject ? settings.toObject() : settings
    return {
        ...DEFAULT_FOOTER,
        ...(raw || {}),
        linkSections: Array.isArray(raw?.linkSections) ? raw.linkSections : DEFAULT_FOOTER.linkSections,
        featureRows: Array.isArray(raw?.featureRows) ? raw.featureRows : DEFAULT_FOOTER.featureRows,
        appButtons: Array.isArray(raw?.appButtons) ? raw.appButtons : DEFAULT_FOOTER.appButtons,
        socialLinks: Array.isArray(raw?.socialLinks) ? raw.socialLinks : DEFAULT_FOOTER.socialLinks,
        paymentItems: Array.isArray(raw?.paymentItems) ? raw.paymentItems : DEFAULT_FOOTER.paymentItems,
        shippingItems: Array.isArray(raw?.shippingItems) ? raw.shippingItems : DEFAULT_FOOTER.shippingItems
    }
}

function uploadToCloudinary(fileBuffer, folder = "luxora-footer-socials") {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "image" },
            (error, result) => {
                if (error) return reject(error)
                resolve(result)
            }
        )
        streamifier.createReadStream(fileBuffer).pipe(stream)
    })
}

router.post("/social-icon", upload.single("image"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No image uploaded" })
        }

        const result = await uploadToCloudinary(req.file.buffer)
        res.json({ url: result.secure_url })
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: err.message })
    }
})

router.get("/", async (req, res) => {
    try {
        res.set("Cache-Control", "no-store")
        const settings = await FooterSettings.findOne({ singletonKey: "site-footer" })
        res.json(mergeWithDefaults(settings))
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: err.message })
    }
})

router.put("/", async (req, res) => {
    try {
        res.set("Cache-Control", "no-store")
        const payload = sanitizePayload(req.body)
        const settings = await FooterSettings.findOneAndUpdate(
            { singletonKey: "site-footer" },
            { $set: { ...payload, singletonKey: "site-footer" } },
            { new: true, upsert: true, runValidators: true }
        )

        res.json(mergeWithDefaults(settings))
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: err.message })
    }
})

module.exports = router
