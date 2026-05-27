const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")

const Banner = require("../models/Banner")
const upload = require("../middleware/upload")
const { requireAdminToken } = require("../middleware/adminAuth")
const cloudinary = require("../config/cloudinary")
const streamifier = require("streamifier")

const VALID_BANNER_TYPES = new Set([
    "homeHero1",
    "homeHero2",
    "homeHero3",
    "homeCollection",
    "homeMenSection",
    "homeWomenSection",
    "homeUnisexSection",
    "homeCustomDesign",
    "menHero",
    "menHero2",
    "menHero3",
    "womenHero",
    "womenHero2",
    "womenHero3",
    "unisexHero",
    "unisexHero2",
    "unisexHero3"
])

// ===== HELPER =====
function uploadToCloudinary(fileBuffer, folder = "luxora-banners") {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder },
            (error, result) => {
                if (error) return reject(error)
                resolve(result)
            }
        )
        streamifier.createReadStream(fileBuffer).pipe(stream)
    })
}

function normalizeText(value) {
    return String(value || "").trim()
}

// ===== GET =====
router.get("/", async (req, res) => {
    try {
        const banners = await Banner.find({
            type: { $in: [...VALID_BANNER_TYPES] }
        })
            .sort({ createdAt: -1 })

        res.json(banners)
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: err.message })
    }
})

// ===== CREATE / UPDATE =====
router.post("/", requireAdminToken, upload.single("image"), async (req, res) => {
    try {
        const locationType = normalizeText(req.body?.type)
        const requestedBannerId = normalizeText(req.body?.bannerId)
        const file = req.file

        if (!locationType) {
            return res.status(400).json({ error: "Choose a banner location" })
        }

        if (!VALID_BANNER_TYPES.has(locationType)) {
            return res.status(400).json({ error: "Invalid banner location" })
        }

        if (requestedBannerId && !mongoose.Types.ObjectId.isValid(requestedBannerId)) {
            return res.status(400).json({ error: "Invalid banner id" })
        }

        const existingById = requestedBannerId
            ? await Banner.findById(requestedBannerId)
            : null

        if (requestedBannerId && !existingById) {
            return res.status(404).json({ error: "Banner not found" })
        }

        const existingByLocation = await Banner.findOne({ type: locationType })
        let targetBanner = existingById || existingByLocation || null

        if (existingById && existingByLocation && String(existingById._id) !== String(existingByLocation._id)) {
            return res.status(409).json({ error: "Another banner already exists for this location" })
        }

        if (!targetBanner) {
            targetBanner = new Banner()
        }

        if (file) {
            const result = await uploadToCloudinary(file.buffer)
            targetBanner.image = result.secure_url
        } else if (!targetBanner.image) {
            return res.status(400).json({ error: "No image uploaded" })
        }

        targetBanner.type = locationType

        await targetBanner.save()

        const populatedBanner = await Banner.findById(targetBanner._id)

        res.json(populatedBanner)

    } catch (err) {
        console.log(err)
        res.status(500).json({ error: err.message })
    }
})

// ===== DELETE =====
router.delete("/:id", requireAdminToken, async (req, res) => {
    try {
        await Banner.findByIdAndDelete(req.params.id)
        res.json({ success: true })
    } catch (err) {
        console.log(err)
        res.status(500).json({ error: err.message })
    }
})

module.exports = router
