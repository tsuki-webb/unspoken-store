(function cartCoreBootstrap() {
    const CART_UPDATE_EVENT = "luxora:cart-updated"
    const COUNT_SELECTOR = "[data-cart-count]"
    const CART_PAGE_PATH = "/cart.html"

    const EMPTY_CART = {
        userEmail: "",
        cartId: "",
        items: [],
        uniqueItems: 0,
        itemCount: 0,
        subtotal: 0,
        shipping: 0,
        // tax: 0,
        // taxRate: 0,
        grandTotal: 0,
        freeShippingThreshold: 1999,
        remainingForFreeShipping: 0,
        updatedAt: null
    }

    const sessionState = {
        loaded: false,
        loadingPromise: null,
        authenticated: false,
        user: null
    }
    let sessionRefreshRunId = 0

    function normalizeEmail(value) {
        return String(value || "").trim().toLowerCase()
    }

    function normalizeText(value) {
        return String(value || "").trim()
    }

    function readLocalEmail() {
        return normalizeEmail(localStorage.getItem("userEmail"))
    }

    function readLocalName() {
        return normalizeText(localStorage.getItem("userName"))
    }

    function normalizeQuantity(value, fallback = 1) {
        const parsed = Number.parseInt(String(value ?? ""), 10)
        if (Number.isNaN(parsed)) return fallback
        if (parsed < 1) return 1
        if (parsed > 20) return 20
        return parsed
    }

    function normalizeCartQuantity(value, fallback = 1) {
        const parsed = Number.parseInt(String(value ?? ""), 10)
        if (Number.isNaN(parsed)) return fallback
        if (parsed < 1) return 1
        if (parsed > 999) return 999
        return parsed
    }

    function normalizeSize(value, fallback = "M") {
        const requested = String(value || "").trim().toUpperCase()
        if (!requested) return fallback
        if (!["XS", "S", "M", "L", "XL", "XXL", "XXXL"].includes(requested)) return fallback
        return requested
    }

    function normalizeSizeBreakdown(value) {
        const source = value && typeof value === "object" ? value : {}
        const normalize = key => {
            const parsed = Number.parseInt(String(source[key] ?? source[key.toUpperCase()] ?? 0), 10)
            if (Number.isNaN(parsed) || parsed < 0) return 0
            if (parsed > 999) return 999
            return parsed
        }

        return {
            xs: normalize("xs"),
            s: normalize("s"),
            m: normalize("m"),
            l: normalize("l"),
            xl: normalize("xl"),
            xxl: normalize("xxl"),
            xxxl: normalize("xxxl")
        }
    }

    function updateCountBadge(itemCount) {
        const count = Math.max(0, Number(itemCount || 0))
        const text = count > 99 ? "99+" : String(count)

        document.querySelectorAll(COUNT_SELECTOR).forEach(node => {
            node.textContent = text
            node.classList.toggle("hidden", count <= 0)
        })
    }

    function dispatchCartUpdate(payload) {
        window.dispatchEvent(new CustomEvent(CART_UPDATE_EVENT, { detail: payload }))
    }

    function getFallbackUserFromLocalStorage() {
        const email = readLocalEmail()
        if (!email) return null

        const localPart = email.split("@")[0] || ""
        return {
            email,
            name: readLocalName() || localPart,
            photo: normalizeText(localStorage.getItem("userPhoto")),
            provider: "email"
        }
    }

    function writeLocalUser(user) {
        const email = normalizeEmail(user?.email)
        if (!email) return

        localStorage.setItem("userEmail", email)

        const name = normalizeText(user?.name)
        if (name) {
            localStorage.setItem("userName", name)
        } else if (!localStorage.getItem("userName")) {
            localStorage.setItem("userName", email.split("@")[0])
        }

        const photo = normalizeText(user?.photo)
        if (photo) {
            localStorage.setItem("userPhoto", photo)
        }
    }

    function clearLocalUser() {
        localStorage.removeItem("userEmail")
        localStorage.removeItem("userName")
        localStorage.removeItem("userPhoto")
    }

    function readUserEmail() {
        const localEmail = readLocalEmail()
        if (localEmail) return localEmail
        return normalizeEmail(sessionState.user?.email)
    }

    function readUser() {
        if (sessionState.user?.email) return sessionState.user
        return getFallbackUserFromLocalStorage()
    }

    async function requestJson(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            credentials: "same-origin",
            headers: {
                ...(options.headers || {})
            }
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
            const message = payload?.error || payload?.message || `Request failed (${response.status})`
            throw new Error(message)
        }

        return payload
    }

    async function refreshSession({ silent = false, force = false } = {}) {
        if (sessionState.loadingPromise && !force) {
            return sessionState.loadingPromise
        }

        const runId = ++sessionRefreshRunId

        sessionState.loadingPromise = (async () => {
            try {
                const payload = await requestJson("/api/auth/session")
                const authenticated = !!payload?.authenticated
                const email = normalizeEmail(payload?.user?.email)

                if (runId !== sessionRefreshRunId) {
                    return {
                        authenticated: sessionState.authenticated,
                        user: sessionState.user
                    }
                }

                if (authenticated && email) {
                    sessionState.loaded = true
                    sessionState.authenticated = true
                    sessionState.user = {
                        email,
                        name: normalizeText(payload?.user?.name),
                        photo: normalizeText(payload?.user?.photo),
                        provider: normalizeText(payload?.user?.provider || "email")
                    }

                    writeLocalUser(sessionState.user)
                    return { authenticated: true, user: sessionState.user }
                }

                sessionState.loaded = true
                sessionState.authenticated = false
                sessionState.user = null
                clearLocalUser()
                return { authenticated: false, user: null }
            } catch (err) {
                if (!silent) {
                    console.log("Session refresh error:", err)
                }

                if (runId !== sessionRefreshRunId) {
                    return {
                        authenticated: sessionState.authenticated,
                        user: sessionState.user
                    }
                }

                const fallbackUser = getFallbackUserFromLocalStorage()
                sessionState.loaded = true
                sessionState.authenticated = !!fallbackUser
                sessionState.user = fallbackUser

                return {
                    authenticated: !!fallbackUser,
                    user: fallbackUser
                }
            } finally {
                if (runId === sessionRefreshRunId) {
                    sessionState.loadingPromise = null
                }
            }
        })()

        return sessionState.loadingPromise
    }

    function getAuthHeaders() {
        const email = readUserEmail()
        const headers = {}
        if (email) {
            headers["x-user-email"] = email
        }
        return headers
    }

    async function requestCart(path, options = {}) {
        const response = await fetch(path, {
            ...options,
            credentials: "same-origin",
            headers: {
                ...(options.headers || {}),
                ...getAuthHeaders()
            }
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
            if (response.status === 401) {
                throw new Error("signin-required")
            }

            const message = payload?.error || payload?.message || `Cart request failed (${response.status})`
            throw new Error(message)
        }

        return payload
    }

    function promptSignIn() {
        if (typeof window.openAuth === "function") {
            window.openAuth()
            return
        }

        const path = String(window.location.pathname || "")
        const onHome = path === "/" || path.endsWith("/index.html")

        if (!onHome) {
            const nextPath = `${window.location.pathname || ""}${window.location.search || ""}${window.location.hash || ""}`
            const next = encodeURIComponent(nextPath || "/")
            window.location.href = `/index.html?signin=1&next=${next}`
            return
        }

        window.alert("Please sign in to use your cart.")
    }

    async function ensureSignedIn() {
        const existing = readUserEmail()
        if (existing) return existing

        const session = await refreshSession({ silent: true })
        const email = normalizeEmail(session?.user?.email)

        if (email) return email

        promptSignIn()
        throw new Error("signin-required")
    }

    function getEmptyCartPayload() {
        return { ...EMPTY_CART }
    }

    async function getCart() {
        let email = readUserEmail()

        if (!email) {
            const session = await refreshSession({ silent: true })
            email = normalizeEmail(session?.user?.email)
        }

        if (!email) {
            const emptyCart = getEmptyCartPayload()
            updateCountBadge(0)
            dispatchCartUpdate(emptyCart)
            return emptyCart
        }

        const payload = await requestCart("/api/cart")
        updateCountBadge(payload.itemCount || 0)
        dispatchCartUpdate(payload)
        return payload
    }

    async function addItem({ productId, quantity = 1, size = "M" }) {
        await ensureSignedIn()

        const payload = await requestCart("/api/cart/items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                productId: String(productId || ""),
                quantity: normalizeQuantity(quantity, 1),
                size: normalizeSize(size, "M")
            })
        })

        updateCountBadge(payload.itemCount || 0)
        dispatchCartUpdate(payload)
        return payload
    }

    async function addCustomPreset({
        presetName = "",
        targetGender = "unisex",
        tshirtFit = "oversized",
        baseColor = "Black",
        printSides = "front",
        primarySize = "M",
        quantity = 1,
        sizeBreakdown = {}
    } = {}) {
        await ensureSignedIn()

        const payload = await requestCart("/api/cart/custom-items", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                presetName: String(presetName || "").trim(),
                targetGender: String(targetGender || "").trim().toLowerCase(),
                tshirtFit: String(tshirtFit || "").trim().toLowerCase(),
                baseColor: String(baseColor || "").trim(),
                printSides: String(printSides || "").trim().toLowerCase(),
                primarySize: normalizeSize(primarySize, "M"),
                quantity: normalizeCartQuantity(quantity, 1),
                sizeBreakdown: normalizeSizeBreakdown(sizeBreakdown)
            })
        })

        updateCountBadge(payload.itemCount || 0)
        dispatchCartUpdate(payload)
        return payload
    }

    async function updateItem(itemId, { quantity, size }) {
        await ensureSignedIn()

        const body = {}
        if (quantity !== undefined) body.quantity = normalizeQuantity(quantity, 1)
        if (size !== undefined) body.size = normalizeSize(size, "M")

        const payload = await requestCart(`/api/cart/items/${encodeURIComponent(String(itemId || ""))}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        })

        updateCountBadge(payload.itemCount || 0)
        dispatchCartUpdate(payload)
        return payload
    }

    async function removeItem(itemId) {
        await ensureSignedIn()

        const payload = await requestCart(`/api/cart/items/${encodeURIComponent(String(itemId || ""))}`, {
            method: "DELETE"
        })

        updateCountBadge(payload.itemCount || 0)
        dispatchCartUpdate(payload)
        return payload
    }

    async function clearCart() {
        await ensureSignedIn()

        const payload = await requestCart("/api/cart/clear", {
            method: "DELETE"
        })

        updateCountBadge(payload.itemCount || 0)
        dispatchCartUpdate(payload)
        return payload
    }

    async function logout() {
        try {
            await requestJson("/api/auth/logout", { method: "POST" })
        } catch (err) {
            console.log("Logout request error:", err)
        }

        clearLocalUser()
        sessionState.loaded = true
        sessionState.authenticated = false
        sessionState.user = null
        updateCountBadge(0)
        dispatchCartUpdate(getEmptyCartPayload())
    }

    async function refreshCartCount() {
        try {
            return await getCart()
        } catch (err) {
            if (String(err?.message || "") === "signin-required") {
                updateCountBadge(0)
                dispatchCartUpdate(getEmptyCartPayload())
                return getEmptyCartPayload()
            }

            console.log("Cart count refresh error:", err)
            updateCountBadge(0)
            return null
        }
    }

    function goToCart() {
        window.location.href = CART_PAGE_PATH
    }

    window.LuxoraCart = {
        eventName: CART_UPDATE_EVENT,
        getUserEmail: readUserEmail,
        getUser: readUser,
        ensureSignedIn,
        refreshSession,
        logout,
        getCart,
        addItem,
        addCustomPreset,
        updateItem,
        removeItem,
        clearCart,
        refreshCartCount,
        goToCart
    }

    document.addEventListener("DOMContentLoaded", async () => {
        await refreshSession({ silent: true })
        refreshCartCount()
    })

    window.addEventListener("storage", event => {
        if (!["userEmail", "userName", "userPhoto"].includes(event.key)) return
        refreshSession({ silent: true }).then(refreshCartCount)
    })
})()
