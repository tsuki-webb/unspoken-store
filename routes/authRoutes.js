const crypto = require("crypto")
const express = require("express")
const router = express.Router()

const User = require("../models/User")
const { requireAdminToken } = require("../middleware/adminAuth")
const {
    normalizeEmail,
    normalizeText,
    isValidEmail,
    setAuthSession,
    clearAuthSession,
    getSessionEmailFromRequest,
    resolveAuthenticatedUser,
    toPublicUser
} = require("../middleware/sessionAuth")

const PASSWORD_PREFIX = "scrypt"
const PASSWORD_KEY_LENGTH = 64

function hashPassword(rawPassword) {
    const password = String(rawPassword || "")
    const salt = crypto.randomBytes(16).toString("hex")
    const hash = crypto.scryptSync(password, salt, PASSWORD_KEY_LENGTH).toString("hex")
    return `${PASSWORD_PREFIX}$${salt}$${hash}`
}

function safeEqual(a, b) {
    const aBuf = Buffer.from(String(a || ""))
    const bBuf = Buffer.from(String(b || ""))

    if (aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
}

function verifyPassword(rawPassword, storedPassword) {
    const candidate = String(rawPassword || "")
    const stored = String(storedPassword || "")

    if (stored.startsWith(`${PASSWORD_PREFIX}$`)) {
        const [, salt, storedHash] = stored.split("$")
        if (!salt || !storedHash) return false

        const candidateHash = crypto.scryptSync(candidate, salt, PASSWORD_KEY_LENGTH).toString("hex")
        return safeEqual(candidateHash, storedHash)
    }

    return safeEqual(candidate, stored)
}

function isLegacyPassword(storedPassword) {
    return !String(storedPassword || "").startsWith(`${PASSWORD_PREFIX}$`)
}

function deriveNameFromEmail(email) {
    const localPart = normalizeText(String(email || "").split("@")[0] || "")
    if (!localPart) return "User"

    return localPart
        .replace(/[._-]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map(part => part[0].toUpperCase() + part.slice(1).toLowerCase())
        .join(" ")
}

function requireValidEmailAndPassword(res, email, password) {
    if (!isValidEmail(email)) {
        res.status(400).json({ success: false, message: "Please provide a valid email address." })
        return false
    }

    if (!String(password || "").trim()) {
        res.status(400).json({ success: false, message: "Password is required." })
        return false
    }

    return true
}

async function loginUserAndRespond(res, user, message = "Login successful") {
    setAuthSession(res, user.email)

    res.json({
        success: true,
        authenticated: true,
        message,
        user: toPublicUser(user, user.email)
    })
}

router.post("/signup", async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email)
        const password = String(req.body?.password || "")
        const name = normalizeText(req.body?.name)

        if (!requireValidEmailAndPassword(res, email, password)) return

        const existingUser = await User.findOne({ email })

        if (existingUser) {
            return res.status(409).json({
                success: false,
                authenticated: false,
                message: "User already exists. Please login instead."
            })
        }

        const newUser = new User({
            email,
            password: hashPassword(password),
            name: name || deriveNameFromEmail(email),
            provider: "email"
        })

        await newUser.save()
        await loginUserAndRespond(res, newUser, "Account created and signed in.")
    } catch (err) {
        console.log("AUTH SIGNUP ERROR:", err)
        res.status(500).json({ success: false, message: "Unable to create account right now." })
    }
})

router.post("/login", async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email)
        const password = String(req.body?.password || "")

        if (!requireValidEmailAndPassword(res, email, password)) return

        const user = await User.findOne({ email })
        if (!user) {
            return res.status(401).json({ success: false, message: "Invalid login credentials." })
        }

        if (!normalizeText(user.password)) {
            return res.status(401).json({ success: false, message: "Invalid login credentials." })
        }

        const isValid = verifyPassword(password, user.password)
        if (!isValid) {
            return res.status(401).json({ success: false, message: "Invalid login credentials." })
        }

        let shouldSave = false

        if (isLegacyPassword(user.password)) {
            user.password = hashPassword(password)
            shouldSave = true
        }

        if (!normalizeText(user.name)) {
            user.name = deriveNameFromEmail(email)
            shouldSave = true
        }

        if (!normalizeText(user.provider)) {
            user.provider = "email"
            shouldSave = true
        }

        if (shouldSave) {
            await user.save()
        }

        await loginUserAndRespond(res, user)
    } catch (err) {
        console.log("AUTH LOGIN ERROR:", err)
        res.status(500).json({ success: false, message: "Unable to login right now." })
    }
})

router.post("/google", async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email)
        const name = normalizeText(req.body?.name)
        const photo = normalizeText(req.body?.photo)

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Valid Google account email is required."
            })
        }

        let user = await User.findOne({ email })

        if (!user) {
            const generatedPassword = hashPassword(crypto.randomBytes(24).toString("hex"))
            user = new User({
                email,
                password: generatedPassword,
                name: name || deriveNameFromEmail(email),
                photo,
                provider: "google"
            })
        } else {
            if (name) user.name = name
            if (photo) user.photo = photo
            user.provider = "google"
        }

        if (!normalizeText(user.password)) {
            user.password = hashPassword(crypto.randomBytes(24).toString("hex"))
        }

        await user.save()
        await loginUserAndRespond(res, user, "Google login successful.")
    } catch (err) {
        console.log("AUTH GOOGLE ERROR:", err)
        res.status(500).json({ success: false, message: "Google login failed." })
    }
})

router.get("/session", async (req, res) => {
    try {
        const auth = await resolveAuthenticatedUser(req)

        if (!auth.email || !auth.user) {
            const hasSessionCookie = String(req.headers?.cookie || "").includes("luxora_session=")
            if (hasSessionCookie || getSessionEmailFromRequest(req)) {
                clearAuthSession(res)
            }

            return res.json({
                authenticated: false,
                user: null
            })
        }

        res.json({
            authenticated: true,
            user: toPublicUser(auth.user, auth.email)
        })
    } catch (err) {
        console.log("AUTH SESSION ERROR:", err)
        res.status(500).json({
            authenticated: false,
            user: null,
            message: "Unable to verify session right now."
        })
    }
})

router.post("/logout", (req, res) => {
    clearAuthSession(res)
    res.json({ success: true, message: "Logged out successfully." })
})

router.get("/users", requireAdminToken, async (req, res) => {
    try {
        const users = await User.find().select("-password")
        res.json(users)
    } catch (err) {
        res.status(500).json({ error: err.message })
    }
})

module.exports = router
