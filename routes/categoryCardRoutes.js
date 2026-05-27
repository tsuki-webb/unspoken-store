const express = require("express")
const mongoose = require("mongoose")
const streamifier = require("streamifier")

const CategoryCard = require("../models/CategoryCard")
const upload = require("../middleware/upload")
const cloudinary = require("../config/cloudinary")
const { requireAdminToken } = require("../middleware/adminAuth")

const router = express.Router()

const VALID_GENDERS = new Set(["men", "women", "unisex"])
const VALID_CATEGORY_IDS_BY_GENDER = {
    men: new Set(["tshirts", "shirts", "shorts", "sweatpants"]),
    women: new Set(["tshirts", "tops", "sweatpants"]),
    unisex: new Set(["tshirts"])
}
const LEGACY_HIDDEN_WOMEN_CATEGORY_IDS = new Set(["shirts", "shorts"])

function normalizeText(value) {
    return String(value || "").trim().toLowerCase()
}

function normalizeOptionalText(value) {
    return String(value || "").trim()
}

function normalizeId(value) {
    return String(value || "").trim()
}

function normalizeDisplayOrder(value) {
    const parsed = Number.parseInt(String(value ?? ""), 10)
    if (Number.isNaN(parsed) || parsed < 1) return 0
    return parsed
}

function uploadToCloudinary(fileBuffer, folder = "luxora-category-cards") {
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

function validateCategoryTarget(gender, categoryId) {
    if (!VALID_GENDERS.has(gender)) {
        return "Invalid gender value"
    }

    const allowed = VALID_CATEGORY_IDS_BY_GENDER[gender]
    if (!allowed || !allowed.has(categoryId)) {
        return "Invalid category for selected gender"
    }

    return ""
}

async function getNextDisplayOrder(gender, excludeId = "") {
    const query = { gender }
    if (excludeId && mongoose.Types.ObjectId.isValid(excludeId)) {
        query._id = { $ne: excludeId }
    }

    const lastCard = await CategoryCard.findOne(query)
        .sort({ displayOrder: -1, createdAt: -1 })
        .select("displayOrder")
        .lean()

    const currentMax = normalizeDisplayOrder(lastCard?.displayOrder)
    return currentMax + 1
}

async function normalizeDisplayOrderForGender(gender) {
    if (!VALID_GENDERS.has(gender)) return

    const cards = await CategoryCard.find({ gender })
        .sort({ displayOrder: 1, createdAt: 1, _id: 1 })
        .select("_id")
        .lean()

    if (!cards.length) return

    const operations = cards.map((card, index) => ({
        updateOne: {
            filter: { _id: card._id },
            update: { displayOrder: index + 1 }
        }
    }))

    if (operations.length) {
        await CategoryCard.bulkWrite(operations)
    }
}

router.get("/", async (req, res) => {
    try {
        const query = {}
        const gender = normalizeText(req.query?.gender)
        const categoryId = normalizeText(req.query?.categoryId)

        if (VALID_GENDERS.has(gender)) {
            query.gender = gender
        }

        if (categoryId) {
            query.categoryId = categoryId
        }

        const cards = await CategoryCard.find(query).sort({
            gender: 1,
            displayOrder: 1,
            createdAt: -1
        })

        const normalizedCards = cards.filter(card => {
            const rowGender = normalizeText(card?.gender)
            if (rowGender !== "women") return true
            const rowCategoryId = normalizeText(card?.categoryId)
            return !LEGACY_HIDDEN_WOMEN_CATEGORY_IDS.has(rowCategoryId)
        })

        res.json(normalizedCards)
    } catch (err) {
        console.log("CATEGORY CARDS GET ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

router.post("/", requireAdminToken, upload.single("image"), async (req, res) => {
    try {
        const gender = normalizeText(req.body?.gender)
        const categoryId = normalizeText(req.body?.categoryId)
        const requestedCardId = normalizeId(req.body?.cardId)
        const title = normalizeOptionalText(req.body?.title)
        const subtitle = normalizeOptionalText(req.body?.subtitle)

        const validationError = validateCategoryTarget(gender, categoryId)
        if (validationError) {
            return res.status(400).json({ error: validationError })
        }

        if (requestedCardId && !mongoose.Types.ObjectId.isValid(requestedCardId)) {
            return res.status(400).json({ error: "Invalid category card id" })
        }

        const existingById = requestedCardId
            ? await CategoryCard.findById(requestedCardId)
            : null

        if (requestedCardId && !existingById) {
            return res.status(404).json({ error: "Category card not found" })
        }

        const existingByTarget = await CategoryCard.findOne({ gender, categoryId })
        const targetCard = existingById || existingByTarget || new CategoryCard()
        const originalGender = String(targetCard.gender || "").trim().toLowerCase()
        const isNewCard = !targetCard?._id

        if (existingById && existingByTarget && String(existingById._id) !== String(existingByTarget._id)) {
            return res.status(409).json({ error: "Another card already exists for this category" })
        }

        if (req.file) {
            const uploaded = await uploadToCloudinary(req.file.buffer)
            targetCard.image = uploaded.secure_url
        } else if (!targetCard.image) {
            return res.status(400).json({ error: "Upload a thumbnail image" })
        }

        targetCard.gender = gender
        targetCard.categoryId = categoryId
        targetCard.title = title
        targetCard.subtitle = subtitle

        if (isNewCard) {
            targetCard.displayOrder = await getNextDisplayOrder(gender)
        } else if (originalGender !== gender || normalizeDisplayOrder(targetCard.displayOrder) < 1) {
            targetCard.displayOrder = await getNextDisplayOrder(gender, String(targetCard._id))
        }

        await targetCard.save()

        if (originalGender && originalGender !== gender) {
            await normalizeDisplayOrderForGender(originalGender)
        }

        await normalizeDisplayOrderForGender(gender)

        const savedCard = await CategoryCard.findById(targetCard._id)
        res.json(savedCard)
    } catch (err) {
        console.log("CATEGORY CARD SAVE ERROR:", err)

        if (err?.code === 11000) {
            return res.status(409).json({ error: "Card already exists for this category" })
        }

        res.status(500).json({ error: err.message })
    }
})

router.patch("/order", requireAdminToken, async (req, res) => {
    try {
        const gender = normalizeText(req.body?.gender)
        const orderedIdsRaw = Array.isArray(req.body?.orderedIds) ? req.body.orderedIds : []

        if (!VALID_GENDERS.has(gender)) {
            return res.status(400).json({ error: "Invalid gender value" })
        }

        const currentCards = await CategoryCard.find({ gender })
            .sort({ displayOrder: 1, createdAt: 1, _id: 1 })
            .select("_id")
            .lean()

        if (!currentCards.length) {
            return res.json([])
        }

        const currentIds = currentCards.map(card => String(card._id))
        const currentIdSet = new Set(currentIds)

        const requestedOrder = [...new Set(
            orderedIdsRaw
                .map(id => normalizeId(id))
                .filter(id => id && mongoose.Types.ObjectId.isValid(id) && currentIdSet.has(id))
        )]

        const remainingIds = currentIds.filter(id => !requestedOrder.includes(id))
        const finalOrder = [...requestedOrder, ...remainingIds]

        const operations = finalOrder.map((id, index) => ({
            updateOne: {
                filter: { _id: id, gender },
                update: { displayOrder: index + 1 }
            }
        }))

        if (operations.length) {
            await CategoryCard.bulkWrite(operations)
        }

        const updated = await CategoryCard.find({ gender })
            .sort({ displayOrder: 1, createdAt: -1 })

        res.json(updated)
    } catch (err) {
        console.log("CATEGORY CARD ORDER ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

router.delete("/:id", requireAdminToken, async (req, res) => {
    try {
        const id = normalizeId(req.params?.id)

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ error: "Invalid category card id" })
        }

        const deleted = await CategoryCard.findByIdAndDelete(id)

        if (!deleted) {
            return res.status(404).json({ error: "Category card not found" })
        }

        await normalizeDisplayOrderForGender(String(deleted.gender || "").toLowerCase())

        res.json({ success: true })
    } catch (err) {
        console.log("CATEGORY CARD DELETE ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

module.exports = router
