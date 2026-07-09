const express = require("express")
const router = express.Router()
const mongoose = require("mongoose")
const Product = require("../models/Product")
const upload = require("../middleware/upload")
const cloudinary = require("../config/cloudinary")
const streamifier = require("streamifier")

const VALID_GENDERS = new Set(["men", "women", "unisex"])
const VALID_TYPES = new Set(["tshirt", "top", "shirt", "short", "sweatpant"])
const VALID_FITS = new Set(["oversized", "regular"])
const ALLOWED_TYPES_BY_GENDER = {
    men: new Set(["tshirt", "shirt", "short", "sweatpant"]),
    women: new Set(["tshirt", "top", "sweatpant"]),
    unisex: new Set(["tshirt"])
}

function normalizeText(value) {
    return String(value || "").trim().toLowerCase()
}

function normalizeBoolean(value, fallback = false) {
    if (value === undefined || value === null || value === "") {
        return fallback
    }

    if (typeof value === "boolean") {
        return value
    }

    const normalized = normalizeText(value)

    if (normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on") {
        return true
    }

    if (normalized === "false" || normalized === "0" || normalized === "no" || normalized === "off") {
        return false
    }

    return fallback
}

function normalizePriority(value, fallback = null) {
    if (value === undefined || value === null || value === "") {
        return fallback
    }

    const parsed = Number.parseInt(String(value), 10)

    if (Number.isNaN(parsed) || parsed < 1) {
        return fallback
    }

    return parsed
}

function getRequestBody(req) {
    return req?.body && typeof req.body === "object" ? req.body : {}
}

async function getNextNewCollectionPriority(excludeProductId = null) {
    const query = { newCollection: true }

    if (excludeProductId) {
        query._id = { $ne: excludeProductId }
    }

    const rows = await Product.find(query).select("newCollectionPriority").lean()

    const maxPriority = rows.reduce((max, row) => {
        const value = normalizePriority(row.newCollectionPriority, 0)
        return Math.max(max, value || 0)
    }, 0)

    return maxPriority + 1
}

function normalizeCategory(gender, type, fit) {
    const normalizedGender = normalizeText(gender)
    const normalizedType = normalizeText(type)

    if (!VALID_GENDERS.has(normalizedGender)) {
        return { error: "Invalid gender value" }
    }

    if (!VALID_TYPES.has(normalizedType)) {
        return { error: "Invalid product type value" }
    }

    if (!ALLOWED_TYPES_BY_GENDER[normalizedGender]?.has(normalizedType)) {
        return { error: `Type '${normalizedType}' is not allowed for ${normalizedGender}` }
    }

    if (normalizedType === "tshirt") {
        const normalizedFit = normalizeText(fit)

        if (!VALID_FITS.has(normalizedFit)) {
            return { error: "T-Shirts must have a valid fit (oversized or regular)" }
        }

        return {
            gender: normalizedGender,
            type: normalizedType,
            fit: normalizedFit
        }
    }

    return {
        gender: normalizedGender,
        type: normalizedType,
        fit: undefined
    }
}

// helper: upload one buffer to Cloudinary
function uploadToCloudinary(fileBuffer, folder = "luxora-products") {
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

// GET all products
router.get("/", async (req, res) => {
    try {
        const query = {}

        const gender = normalizeText(req.query.gender)
        const type = normalizeText(req.query.type)
        const fit = normalizeText(req.query.fit)
        const hasValidGender = VALID_GENDERS.has(gender)
        const hasValidType = VALID_TYPES.has(type)

        if (hasValidGender) {
            query.gender = gender
        }

        if (hasValidType && hasValidGender) {
            if (!ALLOWED_TYPES_BY_GENDER[gender]?.has(type)) {
                return res.json([])
            }

            query.type = type
        } else if (hasValidType) {
            query.type = type
        } else if (hasValidGender) {
            query.type = { $in: [...ALLOWED_TYPES_BY_GENDER[gender]] }
        }

        if (VALID_FITS.has(fit)) {
            query.fit = fit
        }

        if (req.query.featured !== undefined) {
            query.featured = normalizeBoolean(req.query.featured, false)
        }

        if (req.query.newCollection !== undefined) {
            query.newCollection = normalizeBoolean(req.query.newCollection, false)
        }

        let products = await Product.find(query).select("-subtitle").sort({ createdAt: -1 })

        const search = normalizeText(req.query.search)

        if (search) {
            const lowered = search.toLowerCase()
            products = products.filter(product => {
                const matchText = [
                    product.name,
                    product.description
                ]
                    .map(value => String(value || "").toLowerCase())
                    .join(" ")

                return matchText.includes(lowered)
            })
        }

        res.json(products)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// CREATE product with up to 5 images
router.post("/", upload.array("images", 5), async (req, res) => {
    try {
        const requestBody = getRequestBody(req)
        const {
            name,
            price,
            gender,
            type,
            fit,
            featured,
            newCollection,
            newCollectionPriority,
            deliveryChargeEnabled,
            deliveryChargeAmount
        } = requestBody

        if (!name || !price) {
            return res.status(400).json({ error: "Name and price are required" })
        }

        const normalizedCategory = normalizeCategory(gender, type, fit)

        if (normalizedCategory.error) {
            return res.status(400).json({ error: normalizedCategory.error })
        }

        const uploadedImages = []

        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const result = await uploadToCloudinary(file.buffer)
                uploadedImages.push(result.secure_url)
            }
        }

        const shouldBeInNewCollection = normalizeBoolean(newCollection, false)
        let resolvedNewCollectionPriority = null

        if (shouldBeInNewCollection) {
            resolvedNewCollectionPriority =
                normalizePriority(newCollectionPriority, null) || await getNextNewCollectionPriority()
        }

        const shouldChargeDelivery = normalizeBoolean(deliveryChargeEnabled, true)
        const resolvedDeliveryChargeAmount = shouldChargeDelivery
            ? (normalizePriority(deliveryChargeAmount, 99) || 99)
            : 0

        const product = new Product({
            name,
            price,
            images: uploadedImages,
            gender: normalizedCategory.gender,
            type: normalizedCategory.type,
            ...(normalizedCategory.fit ? { fit: normalizedCategory.fit } : {}),
            featured: normalizeBoolean(featured, false),
            newCollection: shouldBeInNewCollection,
            newCollectionPriority: resolvedNewCollectionPriority,
            deliveryChargeEnabled: shouldChargeDelivery,
            deliveryChargeAmount: resolvedDeliveryChargeAmount
        })

        await product.save()

        res.status(201).json(product)

    } catch (err) {
        console.log("Create product error:", err)
        res.status(500).json({ error: err.message })
    }
})

// DELETE product
router.delete("/:id", async (req, res) => {
    try {
        await Product.findByIdAndDelete(req.params.id)
        res.json({ message: "Deleted" })
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

// UPDATE product
router.put("/:id", upload.array("newImages", 5), async (req, res) => {
    try {
        const existingProduct = await Product.findById(req.params.id)

        if (!existingProduct) {
            return res.status(404).json({ error: "Product not found" })
        }

        const requestBody = getRequestBody(req)
        const {
            existingImages,
            gender,
            type,
            fit,
            featured,
            newCollection,
            name,
            price,
            material,
            care,
            manufacturedBy,
            address,
            customerCare,
            countryOfOrigin,
            description,
            artistDetails,
            deliveryChargeEnabled,
            deliveryChargeAmount
        } = requestBody

        const normalizedCategory = normalizeCategory(
            gender || existingProduct.gender,
            type || existingProduct.type,
            fit !== undefined ? fit : existingProduct.fit
        )

        if (normalizedCategory.error) {
            return res.status(400).json({ error: normalizedCategory.error })
        }

        let finalImages = Array.isArray(existingProduct.images)
            ? [...existingProduct.images]
            : []

        const shouldBeInNewCollection = normalizeBoolean(newCollection, existingProduct.newCollection)

        let resolvedNewCollectionPriority = normalizePriority(
            existingProduct.newCollectionPriority,
            null
        )

        if (shouldBeInNewCollection) {
            if (!resolvedNewCollectionPriority || !existingProduct.newCollection) {
                resolvedNewCollectionPriority = await getNextNewCollectionPriority(existingProduct._id)
            }
        } else {
            resolvedNewCollectionPriority = null
        }

        // keep existing images in submitted order when provided
        if (existingImages) {
            try {
                const parsed = JSON.parse(existingImages)
                finalImages = Array.isArray(parsed) ? parsed : finalImages
            } catch (parseErr) {
                return res.status(400).json({ error: "Invalid existingImages payload" })
            }
        }

        // append new uploads after existing images
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const result = await uploadToCloudinary(file.buffer)
                finalImages.push(result.secure_url)
            }
        }

        const shouldChargeDelivery = normalizeBoolean(deliveryChargeEnabled, existingProduct.deliveryChargeEnabled)
        const resolvedDeliveryChargeAmount = shouldChargeDelivery
            ? (normalizePriority(deliveryChargeAmount, existingProduct.deliveryChargeAmount || 99) || 99)
            : 0

        const updatePayload = {
            name,
            price,
            gender: normalizedCategory.gender,
            type: normalizedCategory.type,
            fit: normalizedCategory.fit,
            featured: normalizeBoolean(featured, existingProduct.featured),
            newCollection: shouldBeInNewCollection,
            newCollectionPriority: resolvedNewCollectionPriority,
            deliveryChargeEnabled: shouldChargeDelivery,
            deliveryChargeAmount: resolvedDeliveryChargeAmount,
            material,
            care,
            manufacturedBy,
            address,
            customerCare,
            countryOfOrigin,
            description,
            artistDetails,
            images: finalImages
        }

        const updated = await Product.findByIdAndUpdate(
            req.params.id,
            {
                $set: updatePayload,
                $unset: { subtitle: "" }
            },
            { new: true, runValidators: true, strict: false }
        ).select("-subtitle")

        res.json(updated)

    } catch (err) {
        console.log("UPDATE ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

// REORDER New Collection priorities
router.patch("/new-collection/order", async (req, res) => {
    try {
        if (!Array.isArray(req.body?.orderedIds)) {
            return res.status(400).json({ error: "orderedIds must be an array" })
        }

        const requestedRemoveIds = Array.isArray(req.body?.removeIds)
            ? req.body.removeIds
            : []

        const requestedOrder = [...new Set(
            req.body.orderedIds
                .map(id => String(id || "").trim())
                .filter(Boolean)
        )]

        const requestedRemoveSet = new Set(
            requestedRemoveIds
                .map(id => String(id || "").trim())
                .filter(Boolean)
        )

        const currentProducts = await Product.find({ newCollection: true })
            .select("_id newCollectionPriority createdAt")
            .lean()

        if (!currentProducts.length) {
            return res.json([])
        }

        const sortedCurrent = [...currentProducts].sort((a, b) => {
            const aPriority = normalizePriority(a.newCollectionPriority, Number.MAX_SAFE_INTEGER)
            const bPriority = normalizePriority(b.newCollectionPriority, Number.MAX_SAFE_INTEGER)

            if (aPriority !== bPriority) {
                return aPriority - bPriority
            }

            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        })

        const currentIds = sortedCurrent.map(row => String(row._id))
        const currentIdSet = new Set(currentIds)
        const validRemoveSet = new Set(
            [...requestedRemoveSet].filter(id => currentIdSet.has(id))
        )

        const validRequestedOrder = requestedOrder.filter(
            id => currentIdSet.has(id) && !validRemoveSet.has(id)
        )
        const baseIds = currentIds.filter(id => !validRemoveSet.has(id))
        const remainingIds = baseIds.filter(id => !validRequestedOrder.includes(id))
        const finalOrder = [...validRequestedOrder, ...remainingIds]

        const reorderOperations = finalOrder.map((id, index) => ({
            updateOne: {
                filter: { _id: id },
                update: {
                    newCollection: true,
                    newCollectionPriority: index + 1
                }
            }
        }))

        const removeOperations = [...validRemoveSet].map(id => ({
            updateOne: {
                filter: { _id: id },
                update: {
                    newCollection: false,
                    newCollectionPriority: null
                }
            }
        }))

        const operations = [...reorderOperations, ...removeOperations]

        if (operations.length) {
            await Product.bulkWrite(operations)
        }

        const updated = await Product.find({ newCollection: true })
            .sort({ newCollectionPriority: 1, createdAt: -1 })

        res.json(updated)
    } catch (err) {
        console.log("NEW COLLECTION REORDER ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

// UPDATE collection flags explicitly
router.patch("/:id/flags", async (req, res) => {
    try {
        const existingProduct = await Product.findById(req.params.id)

        if (!existingProduct) {
            return res.status(404).json({ error: "Product not found" })
        }

        const { featured, newCollection } = req.body || {}

        const shouldBeInNewCollection = normalizeBoolean(newCollection, existingProduct.newCollection)

        let resolvedNewCollectionPriority = normalizePriority(
            existingProduct.newCollectionPriority,
            null
        )

        if (shouldBeInNewCollection) {
            if (!resolvedNewCollectionPriority || !existingProduct.newCollection) {
                resolvedNewCollectionPriority = await getNextNewCollectionPriority(existingProduct._id)
            }
        } else {
            resolvedNewCollectionPriority = null
        }

        const updated = await Product.findByIdAndUpdate(
            req.params.id,
            {
                featured: normalizeBoolean(featured, existingProduct.featured),
                newCollection: shouldBeInNewCollection,
                newCollectionPriority: resolvedNewCollectionPriority
            },
            { new: true, runValidators: true }
        )

        res.json(updated)
    } catch (err) {
        console.log("FLAGS UPDATE ERROR:", err)
        res.status(500).json({ error: err.message })
    }
})

module.exports = router
