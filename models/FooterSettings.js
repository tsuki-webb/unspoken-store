const mongoose = require("mongoose")

const footerLinkSchema = new mongoose.Schema({
    label: { type: String, default: "" },
    href: { type: String, default: "" }
}, { _id: false })

const footerSectionSchema = new mongoose.Schema({
    title: { type: String, default: "" },
    items: { type: [footerLinkSchema], default: [] }
}, { _id: false })

const footerBadgeSchema = new mongoose.Schema({
    label: { type: String, default: "" },
    href: { type: String, default: "" },
    badge: { type: String, default: "" }
}, { _id: false })

const footerSocialSchema = new mongoose.Schema({
    label: { type: String, default: "" },
    href: { type: String, default: "" },
    icon: { type: String, default: "" },
    imageUrl: { type: String, default: "" }
}, { _id: false })

const footerSettingsSchema = new mongoose.Schema({
    singletonKey: {
        type: String,
        default: "site-footer",
        unique: true
    },
    homegrownText: { type: String, default: "HOMEGROWN INDIAN BRAND" },
    headlineBefore: { type: String, default: "Over" },
    headlineStrong: { type: String, default: "6 Million" },
    headlineAfter: { type: String, default: "Happy Customers" },
    brandTitle: { type: String, default: "Unspoken Store" },
    brandDescription: {
        type: String,
        default: "Premium streetwear, custom tees, curated drops, and a clean shopping experience built for every screen."
    },
    linkSections: { type: [footerSectionSchema], default: [] },
    featureRows: { type: [footerSocialSchema], default: [] },
    appTitle: { type: String, default: "Experience the Unspoken Store app" },
    appButtons: { type: [footerBadgeSchema], default: [] },
    socialLinks: { type: [footerSocialSchema], default: [] },
    infoTitle: { type: String, default: "Who we are" },
    infoBody: {
        type: String,
        default: "Unspoken Store creates premium everyday streetwear with thoughtful fits, responsive support, and custom design workflows for production-ready apparel."
    },
    paymentText: { type: String, default: "100% secure payment" },
    paymentItems: { type: [String], default: [] },
    shippingText: { type: String, default: "Shipping partners" },
    shippingItems: { type: [String], default: [] },
    copyrightText: { type: String, default: "© Unspoken Store 2026-27" }
}, { timestamps: true })

module.exports = mongoose.models.FooterSettings || mongoose.model("FooterSettings", footerSettingsSchema)
