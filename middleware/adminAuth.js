function normalizeText(value) {
    return String(value || "").trim()
}

function getConfiguredAdminToken() {
    return normalizeText(process.env.ADMIN_TOKEN)
}

function getRequestAdminToken(req) {
    const authHeader = normalizeText(req.headers?.authorization)
    if (authHeader.toLowerCase().startsWith("bearer ")) {
        return normalizeText(authHeader.slice(7))
    }

    return normalizeText(
        req.headers?.["x-admin-token"] ||
        req.query?.adminToken ||
        req.body?.adminToken
    )
}

function requireAdminToken(req, res, next) {
    const configuredToken = getConfiguredAdminToken()

    if (!configuredToken) {
        return res.status(503).json({
            error: "Admin token is not configured. Add ADMIN_TOKEN in .env."
        })
    }

    const requestToken = getRequestAdminToken(req)
    if (!requestToken || requestToken !== configuredToken) {
        return res.status(401).json({ error: "Admin token is required." })
    }

    next()
}

module.exports = {
    requireAdminToken
}
