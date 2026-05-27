const express = require("express")
const mongoose = require("mongoose")
const streamifier = require("streamifier")

const upload = require("../middleware/upload")
const cloudinary = require("../config/cloudinary")
const CustomDesignRequest = require("../models/CustomDesignRequest")
const { requireAdminToken } = require("../middleware/adminAuth")

const router = express.Router()

const VALID_GENDERS = new Set(["men", "women", "unisex"])
const VALID_FITS = new Set(["oversized", "regular"])
const VALID_PRINT_SIDES = new Set(["front", "back", "both"])
const VALID_PLACEMENTS = new Set([
    "center-chest",
    "left-chest",
    "full-front",
    "upper-back",
    "full-back",
    "neck-label",
    "custom"
])
const VALID_STATUSES = new Set([
    "pending",
    "in-review",
    "quoted",
    "in-production",
    "completed",
    "cancelled"
])
const SIZE_KEYS = ["xs", "s", "m", "l", "xl", "xxl", "xxxl"]

function normalizeText(value) {
    return String(value || "").trim()
}

function normalizeLower(value) {
    return normalizeText(value).toLowerCase()
}

function parsePositiveInt(value, fallback = 0) {
    const parsed = Number.parseInt(String(value ?? ""), 10)
    if (Number.isNaN(parsed) || parsed < 0) return fallback
    return parsed
}

function parseDate(value) {
    const raw = normalizeText(value)
    if (!raw) return null

    const parsed = new Date(raw)
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
}

function normalizePlacement(value, fallback) {
    const normalized = normalizeLower(value)
    return VALID_PLACEMENTS.has(normalized) ? normalized : fallback
}

function buildSizeBreakdown(body) {
    const breakdown = {
        xs: parsePositiveInt(body.sizeXs),
        s: parsePositiveInt(body.sizeS),
        m: parsePositiveInt(body.sizeM),
        l: parsePositiveInt(body.sizeL),
        xl: parsePositiveInt(body.sizeXl),
        xxl: parsePositiveInt(body.sizeXxl),
        xxxl: parsePositiveInt(body.sizeXxxl)
    }

    const total = SIZE_KEYS.reduce((sum, key) => sum + Number(breakdown[key] || 0), 0)

    return { breakdown, total }
}

function formatRequestCode(date = new Date()) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    const randomPart = Math.floor(1000 + Math.random() * 9000)
    return `LX-CUS-${year}${month}${day}-${randomPart}`
}

async function generateUniqueRequestCode() {
    for (let attempt = 0; attempt < 8; attempt += 1) {
        const code = formatRequestCode()
        const existing = await CustomDesignRequest.findOne({ requestCode: code })
            .select("_id")
            .lean()

        if (!existing) {
            return code
        }
    }

    return `LX-CUS-${Date.now()}`
}

function uploadToCloudinary(fileBuffer, folder = "luxora-custom-designs") {
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

async function uploadAssets(files = [], role = "reference") {
    const uploaded = []
    for (const file of files) {
        const result = await uploadToCloudinary(file.buffer)
        uploaded.push({
            url: result.secure_url,
            role,
            originalName: file.originalname || ""
        })
    }
    return uploaded
}

router.get("/", requireAdminToken, async (req, res) => {
    try {
        const status = normalizeLower(req.query.status)
        const query = {}
        if (status && VALID_STATUSES.has(status)) {
            query.status = status
        }

        const countOnly = normalizeLower(req.query.countOnly)
        if (countOnly === "1" || countOnly === "true" || countOnly === "yes") {
            const count = await CustomDesignRequest.countDocuments(query)
            return res.json({ count })
        }

        const limit = Math.min(Math.max(parsePositiveInt(req.query.limit, 60), 1), 200)

        const requests = await CustomDesignRequest.find(query)
            .sort({ createdAt: -1 })
            .limit(limit)

        res.json(requests)
    } catch (err) {
        console.log("Custom design list error:", err)
        res.status(500).json({ error: err.message })
    }
})

router.post(
    "/",
    upload.fields([
        { name: "frontDesign", maxCount: 1 },
        { name: "backDesign", maxCount: 1 },
        { name: "referenceDesigns", maxCount: 6 }
    ]),
    async (req, res) => {
        try {
            const customerName = normalizeText(req.body.customerName)
            const email = normalizeText(req.body.email).toLowerCase()
            const phone = normalizeText(req.body.phone)
            const targetGender = normalizeLower(req.body.targetGender || "unisex")
            const tshirtFit = normalizeLower(req.body.tshirtFit)
            const printSides = normalizeLower(req.body.printSides || "front")

            if (!customerName || !email || !phone) {
                return res.status(400).json({ error: "Name, email and phone are required" })
            }

            if (!VALID_GENDERS.has(targetGender)) {
                return res.status(400).json({ error: "Invalid collection category selected" })
            }

            if (!VALID_FITS.has(tshirtFit)) {
                return res.status(400).json({ error: "Choose T-Shirt type: Oversized or Regular" })
            }

            if (!VALID_PRINT_SIDES.has(printSides)) {
                return res.status(400).json({ error: "Invalid print side selection" })
            }

            const { breakdown, total: totalFromSizes } = buildSizeBreakdown(req.body)
            const requestedQuantity = parsePositiveInt(req.body.quantity, 0)

            if (requestedQuantity > 0 && totalFromSizes > 0 && requestedQuantity !== totalFromSizes) {
                return res.status(400).json({
                    error: "Quantity does not match your size breakdown total"
                })
            }

            const resolvedQuantity = totalFromSizes > 0 ? totalFromSizes : requestedQuantity
            if (!resolvedQuantity || resolvedQuantity < 1) {
                return res.status(400).json({ error: "Please provide quantity and size details" })
            }

            const frontFiles = Array.isArray(req.files?.frontDesign) ? req.files.frontDesign : []
            const backFiles = Array.isArray(req.files?.backDesign) ? req.files.backDesign : []
            const referenceFiles = Array.isArray(req.files?.referenceDesigns) ? req.files.referenceDesigns : []

            if (!frontFiles.length && !backFiles.length && !referenceFiles.length) {
                return res.status(400).json({ error: "Upload at least one design file" })
            }

            const [frontAssets, backAssets, referenceAssets] = await Promise.all([
                uploadAssets(frontFiles, "front"),
                uploadAssets(backFiles, "back"),
                uploadAssets(referenceFiles, "reference")
            ])

            const requestCode = await generateUniqueRequestCode()

            const customRequest = new CustomDesignRequest({
                requestCode,
                customerName,
                email,
                phone,
                targetGender,
                tshirtFit,
                baseColor: normalizeText(req.body.baseColor),
                materialPreference: normalizeText(req.body.materialPreference),
                quantity: resolvedQuantity,
                sizeBreakdown: breakdown,
                printSides,
                frontPlacement: normalizePlacement(req.body.frontPlacement, "center-chest"),
                backPlacement: normalizePlacement(req.body.backPlacement, "upper-back"),
                placementNotes: normalizeText(req.body.placementNotes),
                designAssets: [...frontAssets, ...backAssets, ...referenceAssets],
                deliveryTargetDate: parseDate(req.body.deliveryTargetDate),
                budget: normalizeText(req.body.budget),
                specialInstructions: normalizeText(req.body.specialInstructions),
                sourcePage: normalizeText(req.body.sourcePage) || "custom-design"
            })

            await customRequest.save()

            res.status(201).json({
                success: true,
                message: "Custom design request submitted successfully",
                request: customRequest
            })
        } catch (err) {
            console.log("Custom design create error:", err)
            res.status(500).json({ error: err.message })
        }
    }
)

router.patch("/:id/status", requireAdminToken, express.json(), async (req, res) => {
    try {
        const requestId = normalizeText(req.params.id)
        const status = normalizeLower(req.body.status)

        if (!mongoose.Types.ObjectId.isValid(requestId)) {
            return res.status(400).json({ error: "Invalid request id" })
        }

        if (!VALID_STATUSES.has(status)) {
            return res.status(400).json({ error: "Invalid status value" })
        }

        const updated = await CustomDesignRequest.findByIdAndUpdate(
            requestId,
            { status },
            { new: true, runValidators: true }
        )

        if (!updated) {
            return res.status(404).json({ error: "Request not found" })
        }

        res.json(updated)
    } catch (err) {
        console.log("Custom design status update error:", err)
        res.status(500).json({ error: err.message })
    }
})

module.exports = router
