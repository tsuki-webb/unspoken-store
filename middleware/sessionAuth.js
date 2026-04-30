const crypto = require("crypto")
const User = require("../models/User")

const SESSION_COOKIE_NAME = "luxora_session"
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30

function normalizeText(value) {
    return String(value || "").trim()
}

function normalizeEmail(value) {
    return normalizeText(value).toLowerCase()
}

function isValidEmail(value) {
    const email = normalizeEmail(value)
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function getSessionSecret() {
    return String(
        process.env.SESSION_SECRET ||
        process.env.JWT_SECRET ||
        "luxora-dev-session-secret-change-this"
    )
}

function createSignature(encodedPayload) {
    return crypto
        .createHmac("sha256", getSessionSecret())
        .update(encodedPayload)
        .digest("base64url")
}

function createSessionToken(email) {
    const normalizedEmail = normalizeEmail(email)
    const now = Date.now()

    const encodedPayload = Buffer.from(JSON.stringify({
        email: normalizedEmail,
        iat: now,
        exp: now + SESSION_MAX_AGE_MS
    })).toString("base64url")

    const signature = createSignature(encodedPayload)
    return `${encodedPayload}.${signature}`
}

function parseCookies(cookieHeader) {
    const output = {}
    const raw = String(cookieHeader || "")
    if (!raw) return output

    raw.split(";").forEach(chunk => {
        const [rawKey, ...rawValue] = chunk.split("=")
        const key = normalizeText(rawKey)
        if (!key) return
        const joinedValue = rawValue.join("=") || ""
        try {
            output[key] = decodeURIComponent(joinedValue)
        } catch (err) {
            output[key] = joinedValue
        }
    })

    return output
}

function safeEqual(a, b) {
    const aBuf = Buffer.from(String(a || ""))
    const bBuf = Buffer.from(String(b || ""))
    if (aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
}

function verifySessionToken(token) {
    const raw = normalizeText(token)
    if (!raw) return ""

    const [encodedPayload, signature] = raw.split(".")
    if (!encodedPayload || !signature) return ""

    const expectedSignature = createSignature(encodedPayload)
    if (!safeEqual(signature, expectedSignature)) {
        return ""
    }

    try {
        const decoded = Buffer.from(encodedPayload, "base64url").toString("utf8")
        const payload = JSON.parse(decoded)
        const email = normalizeEmail(payload?.email)
        const exp = Number(payload?.exp || 0)

        if (!isValidEmail(email)) return ""
        if (!exp || exp <= Date.now()) return ""

        return email
    } catch (err) {
        return ""
    }
}

function getSessionEmailFromRequest(req) {
    const cookies = parseCookies(req.headers?.cookie)
    return verifySessionToken(cookies[SESSION_COOKIE_NAME])
}

function getFallbackEmailFromRequest(req) {
    return normalizeEmail(
        req.headers?.["x-user-email"] ||
        req.query?.userEmail ||
        req.body?.userEmail
    )
}

function isSecureCookie() {
    return normalizeText(process.env.NODE_ENV) === "production"
}

function setAuthSession(res, email) {
    const normalizedEmail = normalizeEmail(email)
    if (!isValidEmail(normalizedEmail)) return

    res.cookie(SESSION_COOKIE_NAME, createSessionToken(normalizedEmail), {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureCookie(),
        maxAge: SESSION_MAX_AGE_MS,
        path: "/"
    })
}

function clearAuthSession(res) {
    res.cookie(SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: isSecureCookie(),
        expires: new Date(0),
        maxAge: 0,
        path: "/"
    })
}

function toPublicUser(user, fallbackEmail = "") {
    if (!user && !fallbackEmail) return null

    const email = normalizeEmail(user?.email || fallbackEmail)
    const fallbackName = email ? email.split("@")[0] : ""

    return {
        email,
        name: normalizeText(user?.name || fallbackName),
        photo: normalizeText(user?.photo || ""),
        provider: normalizeText(user?.provider || "email")
    }
}

async function resolveAuthenticatedUser(req, options = {}) {
    const allowFallback = !!options.allowFallback
    const sessionEmail = getSessionEmailFromRequest(req)

    if (sessionEmail) {
        const user = await User.findOne({ email: sessionEmail })
            .select("email name photo provider")
            .lean()

        if (user) {
            return {
                email: normalizeEmail(user.email),
                user,
                source: "session"
            }
        }
    }

    if (!allowFallback) {
        return { email: "", user: null, source: "none" }
    }

    const fallbackEmail = getFallbackEmailFromRequest(req)
    if (!isValidEmail(fallbackEmail)) {
        return { email: "", user: null, source: "none" }
    }

    const user = await User.findOne({ email: fallbackEmail })
        .select("email name photo provider")
        .lean()

    if (!user) {
        return { email: "", user: null, source: "none" }
    }

    return {
        email: normalizeEmail(user.email),
        user,
        source: "fallback"
    }
}

module.exports = {
    SESSION_COOKIE_NAME,
    SESSION_MAX_AGE_MS,
    normalizeEmail,
    normalizeText,
    isValidEmail,
    setAuthSession,
    clearAuthSession,
    getSessionEmailFromRequest,
    resolveAuthenticatedUser,
    toPublicUser
}
