(function adminAuthBootstrap() {
    const ADMIN_TOKEN_KEY = "luxoraAdminTokenV1"
    const nativeFetch = window.fetch.bind(window)

    function normalizeText(value) {
        return String(value || "").trim()
    }

    function isApiRequest(input) {
        const url = typeof input === "string"
            ? input
            : String(input?.url || "")

        if (!url) return false

        try {
            const parsed = new URL(url, window.location.origin)
            return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/")
        } catch (err) {
            return url.startsWith("/api/")
        }
    }

    function readToken() {
        return normalizeText(localStorage.getItem(ADMIN_TOKEN_KEY))
    }

    function saveToken(token) {
        const normalized = normalizeText(token)
        if (normalized) {
            localStorage.setItem(ADMIN_TOKEN_KEY, normalized)
        }
    }

    function clearToken() {
        localStorage.removeItem(ADMIN_TOKEN_KEY)
    }

    function requestToken() {
        return ""
    }

    function getToken() {
        return readToken()
    }

    function mergeAdminHeaders(init = {}, token = "") {
        const headers = new Headers(init.headers || {})
        if (token) {
            headers.set("x-admin-token", token)
        }

        return {
            ...init,
            headers
        }
    }

    window.fetch = async function adminFetch(input, init = {}) {
        if (!isApiRequest(input)) {
            return nativeFetch(input, init)
        }

        const token = getToken()
        const response = await nativeFetch(input, mergeAdminHeaders(init, token))

        if (response.status !== 401 && response.status !== 503) {
            return response
        }

        clearToken()
        return response
    }

    window.LuxoraAdminAuth = {
        readToken,
        saveToken,
        clearToken,
        requestToken
    }
})()
