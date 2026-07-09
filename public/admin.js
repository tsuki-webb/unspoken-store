console.log("ADMIN LOADED")

// Suppress external/admin-token alerts injected by deployment or proxy layers.
// This prevents a blocking alert dialog with the exact message from interrupting admin flows.
;(function suppressAdminTokenAlert() {
    try {
        const originalAlert = window.alert.bind(window)
        window.alert = function (msg) {
            try {
                const text = String(msg || "")
                if (text.includes("Admin token is not configured") || text.includes("ADMIN_TOKEN")) {
                    console.warn("Suppressed alert:", text)
                    return
                }
            } catch (e) {
                // ignore
            }
            return originalAlert(msg)
        }
    } catch (err) {
        // noop
    }
})()

let editId = null
let popupImageList = []
let allProducts = []
let allUsers = []
let allOrders = []
let newCollectionProducts = []
let isNewCollectionQuickEdit = false
let newCollectionBusy = false
let editingBannerId = ""
let editingCategoryCardId = ""
let categoryCardCache = []
let categoryCardReorderBusy = false
let draggingCategoryCardId = ""
let draggingCategoryCardGender = ""
let footerSettingsDraft = null

const imageCompression = window.imageCompression
const FIT_REQUIRED_TYPE = "tshirt"
const ALLOWED_TYPES_BY_GENDER = {
    men: ["tshirt", "shirt", "short", "sweatpant"],
    women: ["tshirt", "top", "sweatpant"],
    unisex: ["tshirt"]
}
const STATIC_BANNER_LABELS = {
    homeHero1: "Home Hero 1",
    homeHero2: "Home Hero 2",
    homeHero3: "Home Hero 3",
    homeCollection: "Home Collection Banner",
    homeMenSection: "Home Men Section",
    homeWomenSection: "Home Women Section",
    homeUnisexSection: "Home Unisex Section",
    homeCustomDesign: "Home Custom Design Banner",
    menHero: "Men Page Hero 1",
    menHero2: "Men Page Hero 2",
    menHero3: "Men Page Hero 3",
    womenHero: "Women Page Hero 1",
    womenHero2: "Women Page Hero 2",
    womenHero3: "Women Page Hero 3",
    unisexHero: "Unisex Page Hero 1",
    unisexHero2: "Unisex Page Hero 2",
    unisexHero3: "Unisex Page Hero 3"
}
const CUSTOM_DESIGN_STATUS_LABELS = {
    pending: "Pending",
    "in-review": "In Review",
    quoted: "Quoted",
    "in-production": "In Production",
    completed: "Completed",
    cancelled: "Cancelled"
}
const CUSTOM_DESIGN_STATUSES = Object.keys(CUSTOM_DESIGN_STATUS_LABELS)
const ORDER_STATUS_LABELS = {
    placed: "Placed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled"
}
const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS)
const CATEGORY_CARD_OPTIONS_BY_GENDER = {
    men: [
        { id: "tshirts", label: "T-Shirts" },
        { id: "shirts", label: "Shirts" },
        { id: "shorts", label: "Shorts" },
        { id: "sweatpants", label: "Sweatpants" }
    ],
    women: [
        { id: "tshirts", label: "T-Shirts" },
        { id: "tops", label: "Tops" },
        { id: "sweatpants", label: "Sweatpants" }
    ],
    unisex: [
        { id: "tshirts", label: "T-Shirts" }
    ]
}
const LEGACY_CATEGORY_CARD_LABELS = {
    men: {
        oversized: "T-Shirts (Legacy Oversized Card)",
        regular: "T-Shirts (Legacy Regular Card)"
    },
    women: {
        oversized: "T-Shirts (Legacy Oversized Card)",
        regular: "T-Shirts (Legacy Regular Card)"
    },
    unisex: {
        oversized: "T-Shirts (Legacy Oversized Card)",
        regular: "T-Shirts (Legacy Regular Card)"
    }
}
const CATEGORY_CARD_GENDER_ORDER = {
    men: 1,
    women: 2,
    unisex: 3
}
const BANNER_SAVE_BTN_DEFAULT_TEXT = "Save Banner"
const CATEGORY_CARD_SAVE_BTN_DEFAULT_TEXT = "Save Category Card"
const ADMIN_ACTIVE_PANEL_KEY = "luxora_admin_active_panel_v1"
const VALID_ADMIN_PANELS = new Set([
    "dashboard",
    "products",
    "banners",
    "categorycards",
    "footer",
    "customdesigns",
    "orders",
    "users"
])
const DEFAULT_FOOTER_SETTINGS = {
    homegrownText: "HOMEGROWN INDIAN BRAND",
    headlineBefore: "Over",
    headlineStrong: "6 Million",
    headlineAfter: "Happy Customers",
    brandTitle: "Unspoken Store",
    brandDescription: "Premium streetwear, custom tees, curated drops, and a clean shopping experience built for every screen.",
    linkSections: [
        {
            title: "Need Help",
            items: [
                { label: "Contact Us", href: "index.html#footerContact" },
                { label: "Track Order", href: "orders.html" },
                { label: "Returns & Refunds", href: "orders.html" },
                { label: "FAQs", href: "index.html#footerContact" },
                { label: "My Account", href: "index.html" }
            ]
        },
        {
            title: "Company",
            items: [
                { label: "About Us", href: "index.html#footerContact" },
                { label: "Custom Studio", href: "custom-design.html" },
                { label: "New Collection", href: "index.html#featuredProducts" },
                { label: "Gift Vouchers", href: "index.html#footerContact" }
            ]
        },
        {
            title: "More Info",
            items: [
                { label: "Terms & Conditions", href: "index.html#footerContact" },
                { label: "Privacy Policy", href: "index.html#footerContact" },
                { label: "Sitemap", href: "index.html" },
                { label: "Blogs", href: "index.html#footerContact" }
            ]
        }
    ],
    featureRows: [
        { icon: "Rs", label: "COD Available", href: "" },
        { icon: "↻", label: "30 Days Easy Returns & Exchanges", href: "" }
    ],
    appTitle: "Experience the Unspoken Store app",
    appButtons: [
        { label: "Google Play", href: "#", badge: "Get it on" },
        { label: "App Store", href: "#", badge: "Download on the" }
    ],
    socialLinks: [
        { label: "Facebook", href: "#", icon: "f" },
        { label: "Instagram", href: "#", icon: "ig" },
        { label: "Snapchat", href: "#", icon: "sc" },
        { label: "X", href: "#", icon: "x" }
    ],
    infoTitle: "Who we are",
    infoBody: "Unspoken Store creates premium everyday streetwear with thoughtful fits, responsive support, and custom design workflows for production-ready apparel.",
    paymentText: "100% secure payment",
    paymentItems: ["PhonePe", "GPay", "Amazon Pay", "Mastercard", "Mobikwik", "Paytm", "Razorpay", "Cash on Delivery"],
    shippingText: "Shipping partners",
    shippingItems: ["DTDC", "Delhivery", "Ecom Express", "Xpressbees"],
    copyrightText: "© Unspoken Store 2026-27"
}

function requiresFit(type) {
    return type === FIT_REQUIRED_TYPE
}

function isAllowedTypeForGender(gender, type) {
    const normalizedGender = String(gender || "").trim().toLowerCase()
    const normalizedType = String(type || "").trim().toLowerCase()
    const allowed = ALLOWED_TYPES_BY_GENDER[normalizedGender]
    if (!allowed) return false
    return allowed.includes(normalizedType)
}

function isEnabledFlag(value) {
    if (typeof value === "boolean") return value
    if (typeof value === "number") return value === 1

    const normalized = String(value || "").trim().toLowerCase()
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on"
}

function normalizeText(value) {
    return String(value || "").trim()
}

function escapeHtml(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;")
}

function getBannerTypeLabel(type) {
    const normalized = String(type || "").trim()
    return STATIC_BANNER_LABELS[normalized] || normalized
}

function getCustomDesignStatusLabel(status) {
    const normalized = String(status || "").trim().toLowerCase()
    return CUSTOM_DESIGN_STATUS_LABELS[normalized] || normalized || "Pending"
}

function formatDateTime(value) {
    const parsed = new Date(value || 0)
    if (Number.isNaN(parsed.getTime())) return "-"

    try {
        return parsed.toLocaleString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
    } catch (err) {
        return parsed.toISOString()
    }
}

function formatCurrencyInr(value) {
    const amount = Number(value || 0)
    if (Number.isNaN(amount)) return "Rs 0.00"

    try {
        return new Intl.NumberFormat("en-IN", {
            style: "currency",
            currency: "INR",
            maximumFractionDigits: 2
        }).format(amount)
    } catch (err) {
        return `Rs ${amount.toFixed(2)}`
    }
}

function resetBannerEditorState() {
    const hint = document.getElementById("bannerEditorHint")
    const saveBtn = document.getElementById("bannerSaveBtn")
    editingBannerId = ""

    if (hint) {
        hint.textContent = ""
        hint.classList.add("hidden")
    }

    if (saveBtn) {
        saveBtn.textContent = BANNER_SAVE_BTN_DEFAULT_TEXT
    }
}

function editBanner(rawType, bannerId = "") {
    const bannerTypeSelect = document.getElementById("bannerType")
    const saveBtn = document.getElementById("bannerSaveBtn")
    const hint = document.getElementById("bannerEditorHint")

    if (!bannerTypeSelect) return

    const normalizedType = String(rawType || "").trim()
    editingBannerId = String(bannerId || "").trim()

    bannerTypeSelect.value = normalizedType

    if (saveBtn) {
        saveBtn.textContent = "Update Banner"
    }

    if (hint) {
        const locationLabel = getBannerTypeLabel(normalizedType)
        hint.textContent = `Editing banner for ${locationLabel}. Upload a new image only if you want to replace the current one, then click Update Banner.`
        hint.classList.remove("hidden")
    }

    const bannerPanel = document.getElementById("banners")
    bannerPanel?.scrollIntoView({ behavior: "smooth", block: "start" })
}

function getCategoryCardLabel(gender, categoryId) {
    const normalizedGender = String(gender || "").trim().toLowerCase()
    const normalizedCategoryId = String(categoryId || "").trim().toLowerCase()
    const options = CATEGORY_CARD_OPTIONS_BY_GENDER[normalizedGender] || []
    const primaryLabel = options.find(option => option.id === normalizedCategoryId)?.label
    if (primaryLabel) return primaryLabel

    const legacyLabel = LEGACY_CATEGORY_CARD_LABELS[normalizedGender]?.[normalizedCategoryId]
    if (legacyLabel) return legacyLabel

    return normalizedCategoryId
}

function isLegacyHiddenWomenCategoryId(categoryId) {
    const normalizedCategoryId = String(categoryId || "").trim().toLowerCase()
    return normalizedCategoryId === "shirts" || normalizedCategoryId === "shorts"
}

function populateCategoryCardOptions(preferredCategoryId = "") {
    const genderSelect = document.getElementById("categoryCardGender")
    const categorySelect = document.getElementById("categoryCardId")
    if (!genderSelect || !categorySelect) return

    const options = CATEGORY_CARD_OPTIONS_BY_GENDER[genderSelect.value] || []
    if (!options.length) {
        categorySelect.innerHTML = ""
        return
    }

    categorySelect.innerHTML = options
        .map(option => `<option value="${option.id}">${option.label}</option>`)
        .join("")

    if (preferredCategoryId && options.some(option => option.id === preferredCategoryId)) {
        categorySelect.value = preferredCategoryId
        return
    }

    categorySelect.value = options[0].id
}

function resetCategoryCardEditorState() {
    const saveBtn = document.getElementById("categoryCardSaveBtn")
    const hint = document.getElementById("categoryCardEditorHint")
    const titleInput = document.getElementById("categoryCardTitle")
    const subtitleInput = document.getElementById("categoryCardSubtitle")
    const imageInput = document.getElementById("categoryCardImage")

    editingCategoryCardId = ""

    if (saveBtn) saveBtn.textContent = CATEGORY_CARD_SAVE_BTN_DEFAULT_TEXT
    if (hint) {
        hint.textContent = ""
        hint.classList.add("hidden")
    }
    if (titleInput) titleInput.value = ""
    if (subtitleInput) subtitleInput.value = ""
    if (imageInput) imageInput.value = ""
}

function editCategoryCard(cardId, gender, categoryId, title = "", subtitle = "") {
    const genderSelect = document.getElementById("categoryCardGender")
    const titleInput = document.getElementById("categoryCardTitle")
    const subtitleInput = document.getElementById("categoryCardSubtitle")
    const saveBtn = document.getElementById("categoryCardSaveBtn")
    const hint = document.getElementById("categoryCardEditorHint")

    if (!genderSelect) return

    editingCategoryCardId = String(cardId || "").trim()
    genderSelect.value = String(gender || "men").trim().toLowerCase()
    populateCategoryCardOptions(String(categoryId || "").trim().toLowerCase())

    if (titleInput) titleInput.value = String(title || "")
    if (subtitleInput) subtitleInput.value = String(subtitle || "")
    if (saveBtn) saveBtn.textContent = "Update Category Card"

    if (hint) {
        const label = getCategoryCardLabel(genderSelect.value, categoryId)
        hint.textContent = `Editing card for ${label}. Upload a new image only if you want to replace the current thumbnail, then click Update Category Card.`
        hint.classList.remove("hidden")
    }

    const panel = document.getElementById("categorycards")
    panel?.scrollIntoView({ behavior: "smooth", block: "start" })
}

function editCategoryCardById(cardId) {
    const card = categoryCardCache.find(item => String(item._id) === String(cardId))
    if (!card) return

    editCategoryCard(card._id, card.gender, card.categoryId, card.title, card.subtitle)
}

function readPersistedPanel() {
    try {
        const stored = String(localStorage.getItem(ADMIN_ACTIVE_PANEL_KEY) || "").trim()
        if (VALID_ADMIN_PANELS.has(stored)) return stored
    } catch (err) {
        // noop: localStorage may be unavailable
    }

    return "dashboard"
}

function persistActivePanel(panelId) {
    try {
        localStorage.setItem(ADMIN_ACTIVE_PANEL_KEY, panelId)
    } catch (err) {
        // noop: localStorage may be unavailable
    }
}

function getPanelFromHash() {
    const fromHash = String(window.location.hash || "").replace(/^#/, "").trim().toLowerCase()
    return VALID_ADMIN_PANELS.has(fromHash) ? fromHash : ""
}

function updatePanelHash(panelId) {
    try {
        const url = new URL(window.location.href)
        if (url.hash === `#${panelId}`) return
        url.hash = panelId
        history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`)
    } catch (err) {
        // noop: URL/history should exist in browser, this is just a safe guard
    }
}

function updateFitState(typeSelectId, fitSelectId) {
    const typeEl = document.getElementById(typeSelectId)
    const fitEl = document.getElementById(fitSelectId)

    if (!typeEl || !fitEl) return

    const needsFit = requiresFit(typeEl.value)

    fitEl.disabled = !needsFit
    fitEl.classList.toggle("is-disabled", !needsFit)

    if (needsFit) {
        if (!fitEl.value) {
            fitEl.value = fitEl.dataset.lastFit || "regular"
        }
        return
    }

    if (fitEl.value) {
        fitEl.dataset.lastFit = fitEl.value
    }

    fitEl.value = ""
}

function updateTypeOptions(genderSelectId, typeSelectId, fitSelectId, preferredType = null) {
    const genderEl = document.getElementById(genderSelectId)
    const typeEl = document.getElementById(typeSelectId)

    if (!genderEl || !typeEl) return

    const allowedTypes = ALLOWED_TYPES_BY_GENDER[genderEl.value] || ["tshirt"]
    let firstAllowedType = null

    Array.from(typeEl.options).forEach(option => {
        const isAllowed = allowedTypes.includes(option.value)
        option.hidden = !isAllowed
        option.disabled = !isAllowed

        if (!firstAllowedType && isAllowed) {
            firstAllowedType = option.value
        }
    })

    if (preferredType && allowedTypes.includes(preferredType)) {
        typeEl.value = preferredType
    } else if (!allowedTypes.includes(typeEl.value)) {
        typeEl.value = firstAllowedType || "tshirt"
    }

    updateFitState(typeSelectId, fitSelectId)
}

function initializeCategoryControls() {
    const genderEl = document.getElementById("gender")
    const typeEl = document.getElementById("type")
    const editGenderEl = document.getElementById("editGender")
    const editTypeEl = document.getElementById("editType")

    if (genderEl) {
        genderEl.addEventListener("change", () => updateTypeOptions("gender", "type", "fit"))
    }

    if (typeEl) {
        typeEl.addEventListener("change", () => updateFitState("type", "fit"))
        updateTypeOptions("gender", "type", "fit")
    }

    if (editGenderEl) {
        editGenderEl.addEventListener("change", () => updateTypeOptions("editGender", "editType", "editFit"))
    }

    if (editTypeEl) {
        editTypeEl.addEventListener("change", () => updateFitState("editType", "editFit"))
        updateTypeOptions("editGender", "editType", "editFit")
    }
}

// ================= PANEL SWITCH =================

function switchPanel(panelId, btn = null, options = {}) {
    const normalizedPanelId = String(panelId || "").trim().toLowerCase()
    if (!VALID_ADMIN_PANELS.has(normalizedPanelId)) return

    const targetPanel = document.getElementById(normalizedPanelId)
    if (!targetPanel) return

    const shouldPersist = options.persist !== false

    document.querySelectorAll(".panel").forEach(p => {
        p.classList.remove("active")
    })

    targetPanel.classList.add("active")

    document.querySelectorAll(".nav-btn").forEach(b => {
        b.classList.remove("active")
    })

    const targetButton = btn || document.querySelector(`.nav-btn[data-panel="${normalizedPanelId}"]`)
    if (targetButton) {
        targetButton.classList.add("active")
    }

    if (shouldPersist) {
        persistActivePanel(normalizedPanelId)
        updatePanelHash(normalizedPanelId)
    }

    if (normalizedPanelId === "banners") {
        loadBanners()
        return
    }

    if (normalizedPanelId === "categorycards") {
        loadCategoryCards()
        return
    }

    if (normalizedPanelId === "footer") {
        loadFooterSettings()
        return
    }

    if (normalizedPanelId === "customdesigns") {
        loadCustomDesignRequests()
        return
    }

    if (normalizedPanelId === "orders") {
        loadOrders()
        return
    }

    if (normalizedPanelId === "users") {
        loadUsers()
        return
    }
}

// ================= DASHBOARD =================

async function loadDashboard() {
    try {
        const [products, banners, users, categoryCards, customDesignCountPayload, orderCountPayload] = await Promise.all([
            fetch("/api/products").then(r => r.json()),
            fetch("/api/banners").then(r => r.json()),
            fetch("/api/users").then(r => r.json()),
            fetch("/api/category-cards").then(r => r.json()),
            fetch("/api/custom-designs?countOnly=1").then(r => r.json()),
            fetch("/api/orders/admin/list?countOnly=1").then(r => r.json())
        ])

        const totalProducts = document.getElementById("totalProducts")
        const totalBanners = document.getElementById("totalBanners")
        const totalUsers = document.getElementById("totalUsers")
        const totalCategoryCards = document.getElementById("totalCategoryCards")
        const totalCustomDesigns = document.getElementById("totalCustomDesigns")
        const totalOrders = document.getElementById("totalOrders")

        if (totalProducts) totalProducts.innerText = Array.isArray(products) ? products.length : 0
        if (totalBanners) totalBanners.innerText = Array.isArray(banners) ? banners.length : 0
        if (totalUsers) totalUsers.innerText = Array.isArray(users) ? users.length : 0
        if (totalCategoryCards) totalCategoryCards.innerText = Array.isArray(categoryCards) ? categoryCards.length : 0
        if (totalCustomDesigns) totalCustomDesigns.innerText = Number(customDesignCountPayload?.count || 0)
        if (totalOrders) totalOrders.innerText = Number(orderCountPayload?.count || 0)

    } catch (err) {
        console.log("Dashboard error:", err)
    }
}

// ================= ADD PRODUCT =================

async function addProduct() {

    const name = document.getElementById("name").value.trim()
    const price = document.getElementById("price").value
    const gender = document.getElementById("gender").value
    const type = document.getElementById("type").value
    const fit = document.getElementById("fit").value

    const featured = document.getElementById("featured").checked
    const newCollection = document.getElementById("newCollection").checked
    const files = document.getElementById("images").files

    if (!name || !price) {
        alert("Fill all required fields")
        return
    }

    if (requiresFit(type) && !fit) {
        alert("Select fit for T-Shirts")
        return
    }

    if (!files.length) {
        alert("Upload at least one image")
        return
    }

    async function compressImage(file) {
        const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1200,
            initialQuality: 0.8,
            useWebWorker: true
        }

        try {
            const compressed = await imageCompression(file, options)
            return compressed
        } catch (err) {
            console.log("Compression failed:", err)
            return file
        }
    }

    try {

        const formData = new FormData()

        formData.append("name", name)
        formData.append("price", price)
        formData.append("gender", gender)
        formData.append("type", type)

        if (requiresFit(type)) {
            formData.append("fit", fit)
        }

        formData.append("featured", featured)
        formData.append("newCollection", newCollection)

        for (const file of files) {
            const compressedFile = await compressImage(file)
            formData.append("images", compressedFile)
        }

        const res = await fetch("/api/products", {
            method: "POST",
            body: formData
        })

        if (!res.ok) {
            const errData = await res.json()
            alert(errData.error || "Upload failed")
            return
        }

        alert("Product added successfully")

        document.getElementById("name").value = ""
        document.getElementById("price").value = ""
        document.getElementById("images").value = ""
        document.getElementById("featured").checked = false
        document.getElementById("newCollection").checked = false

        updateTypeOptions("gender", "type", "fit")

        loadProducts()
        loadDashboard()

    } catch (err) {
        console.log("Upload error:", err)
        alert("Something went wrong")
    }
}

// ================= LOAD PRODUCTS =================

async function loadProducts() {
    try {
        const container = document.getElementById("productList")
        container.innerHTML = ""

        const response = await fetch("/api/products")
        const products = await response.json()

        if (!response.ok) {
            throw new Error(products.error || "Unable to load products")
        }

        allProducts = (Array.isArray(products) ? products : [])
            .filter(product => isAllowedTypeForGender(product?.gender, product?.type))

        const structure = {
            men: {
                tshirt: { oversized: [], regular: [] },
                shirt: [],
                short: [],
                sweatpant: []
            },
            women: {
                tshirt: { oversized: [], regular: [] },
                top: [],
                sweatpant: []
            },
            unisex: {
                tshirt: { oversized: [], regular: [] }
            }
        }

        allProducts.forEach(p => {

            if (!structure[p.gender]) return

            if (p.type === "tshirt") {
                if (p.fit === "oversized" || p.fit === "regular") {
                    structure[p.gender].tshirt[p.fit].push(p)
                }
                return
            }

            if (p.type === "top" && p.gender === "women") {
                structure.women.top.push(p)
                return
            }

            if (p.type === "shirt" || p.type === "short" || p.type === "sweatpant") {
                structure[p.gender][p.type]?.push(p)
            }
        })

        function renderRow(title, items) {

            if (!items.length) return ""

            return `
                <div class="admin-subgroup">
                    <h3>${title}</h3>

                    <div class="product-grid">
                        ${items.map(p => {

                            const img = p.images?.[0] || p.image

                            return `
                                <div class="product-card" onclick="openPopup('${p._id}')">
                                    ${renderProductMarkers(p)}
                                    <img src="${img}">
                                    <div class="info">
                                        <h4>${p.name}</h4>
                                        <p>&#8377; ${p.price}</p>
                                    </div>
                                </div>
                            `
                        }).join("")}
                    </div>
                </div>
            `
        }

        container.innerHTML += `
            <div class="admin-group">
                <h2>MEN</h2>
                ${renderRow("T-Shirts Oversized", structure.men.tshirt.oversized)}
                ${renderRow("T-Shirts Regular", structure.men.tshirt.regular)}
                ${renderRow("Shirts", structure.men.shirt)}
                ${renderRow("Shorts", structure.men.short)}
                ${renderRow("Sweatpants", structure.men.sweatpant)}
            </div>
        `

        container.innerHTML += `
            <div class="admin-group">
                <h2>WOMEN</h2>
                ${renderRow("T-Shirts - Oversized Fit", structure.women.tshirt.oversized)}
                ${renderRow("T-Shirts - Regular Fit", structure.women.tshirt.regular)}
                ${renderRow("Tops", structure.women.top)}
                ${renderRow("Sweatpants", structure.women.sweatpant)}
            </div>
        `

        container.innerHTML += `
            <div class="admin-group">
                <h2>UNISEX</h2>
                ${renderRow("T-Shirts Oversized", structure.unisex.tshirt.oversized)}
                ${renderRow("T-Shirts Regular", structure.unisex.tshirt.regular)}
            </div>
        `

        renderNewCollectionManager()
    } catch (err) {
        console.log("Products load error:", err)
        const container = document.getElementById("productList")
        if (container) {
            container.innerHTML = `<p>Unable to load products right now.</p>`
        }
    }
}

function getPriorityValue(value) {
    const parsed = Number.parseInt(String(value ?? ""), 10)
    if (Number.isNaN(parsed) || parsed < 1) return Number.MAX_SAFE_INTEGER
    return parsed
}

function getAdminTypeLabel(type) {
    const normalized = String(type || "").trim().toLowerCase()
    if (normalized === "tshirt") return "T-SHIRT"
    if (normalized === "top") return "TOP"
    if (normalized === "shirt") return "SHIRT"
    if (normalized === "short") return "SHORTS"
    if (normalized === "sweatpant") return "SWEATPANTS"
    return normalized.toUpperCase()
}

function compareNewCollectionPriority(a, b) {
    const aPriority = getPriorityValue(a.newCollectionPriority)
    const bPriority = getPriorityValue(b.newCollectionPriority)

    if (aPriority !== bPriority) {
        return aPriority - bPriority
    }

    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
}

function getNewCollectionProducts() {
    return allProducts
        .filter(product => isEnabledFlag(product.newCollection))
        .sort(compareNewCollectionPriority)
}

function formatCategoryLabel(product) {
    const gender = String(product.gender || "").toUpperCase()
    const type = getAdminTypeLabel(product.type)
    const fit = product.fit ? ` ${String(product.fit).toUpperCase()}` : ""
    return `${gender} | ${type}${fit}`
}

function renderProductMarkers(product) {
    const markers = []

    if (isEnabledFlag(product?.featured)) {
        markers.push('<span class="product-marker featured" title="Featured section">Featured</span>')
    }

    if (isEnabledFlag(product?.newCollection)) {
        markers.push('<span class="product-marker new-collection" title="New Collection section">New</span>')
    }

    if (!markers.length) {
        return ""
    }

    return `
        <div class="product-markers">
            ${markers.join("")}
        </div>
    `
}

function renderNewCollectionManager() {
    const container = document.getElementById("productList")
    if (!container) return

    newCollectionProducts = getNewCollectionProducts()
    const count = newCollectionProducts.length
    const sectionClass = `admin-group new-collection-group${isNewCollectionQuickEdit ? " is-editing" : ""}`
    const editButtonLabel = isNewCollectionQuickEdit ? "Done" : "Quick Edit Priority"
    const editStatusText = isNewCollectionQuickEdit
        ? "Quick edit is on. Move cards left/right to change priority."
        : "Priority decreases from left to right. Higher priority shows first on homepage."

    const html = `
        <section id="newCollectionManagerSection" class="${sectionClass}">
            <div class="new-collection-header">
                <div class="new-collection-title-wrap">
                    <h2>NEW COLLECTION</h2>
                    <p>${editStatusText}</p>
                </div>
                <button
                    type="button"
                    class="new-collection-edit-btn"
                    onclick="toggleNewCollectionQuickEdit()"
                    ${newCollectionBusy ? "disabled" : ""}
                >
                    ${newCollectionBusy ? "Saving..." : editButtonLabel}
                </button>
            </div>

            <div class="new-collection-summary">
                <span>${count} product${count === 1 ? "" : "s"}</span>
                <span>Order controls affect the customer New Collection section.</span>
            </div>

            ${count ? `
                <div class="new-collection-grid">
                    ${newCollectionProducts.map((product, index) => {
                        const img = product.images?.[0] || product.image
                        const openPopupAction = isNewCollectionQuickEdit ? "" : `onclick="openPopup('${product._id}')"`
                        const isFirst = index === 0
                        const isLast = index === newCollectionProducts.length - 1

                        return `
                            <article class="new-collection-card" ${openPopupAction}>
                                <div class="new-collection-priority-badge">#${index + 1}</div>
                                ${renderProductMarkers(product)}
                                <img src="${img}" alt="${product.name}">
                                <div class="info">
                                    <h4>${product.name}</h4>
                                    <p>&#8377; ${product.price}</p>
                                    <small>${formatCategoryLabel(product)}</small>
                                </div>

                                <div class="new-collection-controls">
                                    <button
                                        type="button"
                                        title="Move higher priority"
                                        onclick="event.stopPropagation(); shiftNewCollectionPriority(${index}, -1)"
                                        ${isFirst || newCollectionBusy ? "disabled" : ""}
                                    >&larr;</button>

                                    <button
                                        type="button"
                                        title="Move lower priority"
                                        onclick="event.stopPropagation(); shiftNewCollectionPriority(${index}, 1)"
                                        ${isLast || newCollectionBusy ? "disabled" : ""}
                                    >&rarr;</button>

                                    <button
                                        type="button"
                                        class="remove"
                                        title="Remove from New Collection"
                                        onclick="event.stopPropagation(); removeFromNewCollection('${product._id}')"
                                        ${newCollectionBusy ? "disabled" : ""}
                                    >Remove</button>
                                </div>
                            </article>
                        `
                    }).join("")}
                </div>
            ` : `
                <div class="new-collection-empty">
                    <p>No products are in New Collection yet.</p>
                    <span>Enable "New Collection" in product edit popup to show products here.</span>
                </div>
            `}
        </section>
    `

    const existingSection = document.getElementById("newCollectionManagerSection")
    if (existingSection) {
        existingSection.outerHTML = html
        return
    }

    container.innerHTML += html
}

function toggleNewCollectionQuickEdit() {
    if (newCollectionBusy) return
    isNewCollectionQuickEdit = !isNewCollectionQuickEdit
    renderNewCollectionManager()
}

async function persistNewCollectionOrder(orderedIds, removeIds = []) {
    const res = await fetch("/api/products/new-collection/order", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            orderedIds,
            removeIds
        })
    })

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.error || "Unable to save New Collection order")
    }

    return res.json()
}

async function shiftNewCollectionPriority(index, direction) {
    if (newCollectionBusy) return

    const targetIndex = index + direction

    if (index < 0 || targetIndex < 0 || targetIndex >= newCollectionProducts.length) {
        return
    }

    const updatedOrder = [...newCollectionProducts]
    ;[updatedOrder[index], updatedOrder[targetIndex]] = [updatedOrder[targetIndex], updatedOrder[index]]

    newCollectionBusy = true
    newCollectionProducts = updatedOrder
    renderNewCollectionManager()

    try {
        await persistNewCollectionOrder(updatedOrder.map(product => product._id))
    } catch (err) {
        alert(err.message || "Failed to update New Collection priority")
    } finally {
        newCollectionBusy = false
        await loadProducts()
    }
}

async function removeFromNewCollection(productId) {
    if (newCollectionBusy) return

    const confirmed = confirm("Remove this product from New Collection section?")
    if (!confirmed) return

    newCollectionBusy = true
    renderNewCollectionManager()

    try {
        const remainingIds = newCollectionProducts
            .filter(product => product._id !== productId)
            .map(product => product._id)

        await persistNewCollectionOrder(remainingIds, [productId])
    } catch (err) {
        alert(err.message || "Unable to update New Collection")
    } finally {
        newCollectionBusy = false
        await loadProducts()
    }
}

// ================= POPUP =================

function isProductPopupOpen() {
    const popup = document.getElementById("productPopup")
    return !!popup && !popup.classList.contains("hidden")
}

function syncAdminScrollLock() {
    document.body.classList.toggle("modal-open", isProductPopupOpen())
}

function initializePopupInteractionBindings() {
    const popup = document.getElementById("productPopup")
    if (!popup) return

    popup.addEventListener("click", event => {
        if (event.target !== popup) return
        closePopup()
    })

    window.addEventListener("keydown", event => {
        if (event.key !== "Escape") return
        if (!isProductPopupOpen()) return
        closePopup()
    })
}

async function openPopup(id) {

    editId = id

    const popup = document.getElementById("productPopup")
    popup.classList.remove("hidden")
    syncAdminScrollLock()

    let p = allProducts.find(x => String(x._id) === String(id))

    if (!p) {
        const res = await fetch("/api/products")
        const products = await res.json()
        p = Array.isArray(products)
            ? products.find(x => String(x._id) === String(id))
            : null
    }

    if (!p) {
        closePopup()
        return
    }

    document.getElementById("editName").value = p.name || ""
    document.getElementById("editPrice").value = p.price || ""
    document.getElementById("editGender").value = p.gender || "men"
    updateTypeOptions("editGender", "editType", "editFit", p.type || "tshirt")
    document.getElementById("editFit").value = p.fit || ""
    document.getElementById("editFeatured").checked = isEnabledFlag(p.featured)
    document.getElementById("editNewCollection").checked = isEnabledFlag(p.newCollection)
    updateFitState("editType", "editFit")

    document.getElementById("editMaterial").value = p.material || ""
    document.getElementById("editCare").value = p.care || ""

    document.getElementById("editManufacturedBy").value = p.manufacturedBy || ""
    document.getElementById("editAddress").value = p.address || ""
    document.getElementById("editCustomerCare").value = p.customerCare || ""
    document.getElementById("editCountry").value = p.countryOfOrigin || "India"

    document.getElementById("editDescription").value = p.description || ""
    document.getElementById("editArtist").value = p.artistDetails || ""

    const imgs = p.images?.length ? p.images : (p.image ? [p.image] : [])
    popupImageList = imgs.filter(Boolean)
    refreshPopupImages()

    document.getElementById("newImages").value = ""
}

function moveLeft(i) {
    if (i <= 0 || i >= popupImageList.length) return
    [popupImageList[i - 1], popupImageList[i]] =
        [popupImageList[i], popupImageList[i - 1]]
    refreshPopupImages()
}

function moveRight(i) {
    if (i < 0 || i >= popupImageList.length - 1) return
    [popupImageList[i + 1], popupImageList[i]] =
        [popupImageList[i], popupImageList[i + 1]]
    refreshPopupImages()
}

function removeImage(i) {
    popupImageList.splice(i, 1)
    refreshPopupImages()
}

function refreshPopupImages() {
    const container = document.getElementById("popupImages")
    container.innerHTML = ""

    popupImageList.forEach((img, index) => {
        container.innerHTML += `
            <div class="img-box">
                <img src="${img}">
                <div class="img-controls">
                    <button onclick="moveLeft(${index})" ${index === 0 ? "disabled" : ""}>&larr;</button>
                    <button onclick="moveRight(${index})" ${index === popupImageList.length - 1 ? "disabled" : ""}>&rarr;</button>
                    <button onclick="removeImage(${index})">&times;</button>
                </div>
            </div>
        `
    })
}

function closePopup() {
    document.getElementById("productPopup").classList.add("hidden")
    editId = null
    syncAdminScrollLock()
}

async function deleteProduct() {

    if (!editId) return

    const confirmDelete = confirm("Delete this product permanently?")

    if (!confirmDelete) return

    const res = await fetch(`/api/products/${editId}`, {
        method: "DELETE"
    })

    if (!res.ok) {
        alert("Delete failed")
        return
    }

    alert("Deleted successfully")

    closePopup()
    loadProducts()
    loadDashboard()
}

async function saveEdit() {

    if (!editId) return

    const type = document.getElementById("editType").value
    const fit = document.getElementById("editFit").value
    const desiredFeatured = document.getElementById("editFeatured").checked
    const desiredNewCollection = document.getElementById("editNewCollection").checked

    if (requiresFit(type) && !fit) {
        alert("Select fit for T-Shirts")
        return
    }

    const formData = new FormData()

    formData.append("name", document.getElementById("editName").value)
    formData.append("price", document.getElementById("editPrice").value)
    formData.append("gender", document.getElementById("editGender").value)
    formData.append("type", type)
    formData.append("featured", desiredFeatured ? "true" : "false")
    formData.append("newCollection", desiredNewCollection ? "true" : "false")

    if (requiresFit(type)) {
        formData.append("fit", fit)
    } else {
        formData.append("fit", "")
    }

    formData.append("material", document.getElementById("editMaterial").value)
    formData.append("care", document.getElementById("editCare").value)

    formData.append("manufacturedBy", document.getElementById("editManufacturedBy").value)
    formData.append("address", document.getElementById("editAddress").value)
    formData.append("customerCare", document.getElementById("editCustomerCare").value)
    formData.append("countryOfOrigin", document.getElementById("editCountry").value)

    formData.append("description", document.getElementById("editDescription").value)
    formData.append("artistDetails", document.getElementById("editArtist").value)

    formData.append("existingImages", JSON.stringify(popupImageList))

    const files = document.getElementById("newImages").files
    for (const file of files) {
        formData.append("newImages", file)
    }

    const res = await fetch(`/api/products/${editId}`, {
        method: "PUT",
        body: formData
    })

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        alert(errorData.error || "Update failed")
        return
    }

    alert("Product updated")

    closePopup()
    loadProducts()
    loadDashboard()
}

// ================= BANNERS =================

async function updateBanner() {

    const type = String(document.getElementById("bannerType").value || "").trim()
    const file = document.getElementById("bannerImage").files[0]

    if (!type) {
        alert("Choose a banner location")
        return
    }

    if (!file && !editingBannerId) {
        alert("Upload image first")
        return
    }

    try {

        const formData = new FormData()

        formData.append("type", type)
        if (editingBannerId) {
            formData.append("bannerId", editingBannerId)
        }
        if (file) {
            formData.append("image", file)
        }

        const res = await fetch("/api/banners", {
            method: "POST",
            body: formData
        })

        const data = await res.json()

        if (!res.ok) {
            alert(data.error || "Upload failed")
            return
        }

        alert("Banner updated")

        const bannerInput = document.getElementById("bannerImage")
        if (bannerInput) bannerInput.value = ""
        resetBannerEditorState()

        loadBanners()
        loadDashboard()

    } catch (err) {
        console.log(err)
        alert("Error uploading banner")
    }
}

async function deleteBanner(bannerId) {
    const confirmed = confirm("Delete this banner?")
    if (!confirmed) return

    try {
        const res = await fetch(`/api/banners/${bannerId}`, {
            method: "DELETE"
        })

        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
            alert(data.error || "Unable to delete banner")
            return
        }

        loadBanners()
        loadDashboard()
    } catch (err) {
        console.log("Banner delete error:", err)
        alert("Unable to delete banner right now")
    }
}

async function loadBanners() {
    try {
        const container = document.getElementById("bannerList")
        if (!container) return

        container.innerHTML = ""

        const banners = await fetch("/api/banners").then(r => r.json())

        if (!Array.isArray(banners) || !banners.length) {
            container.innerHTML = `<div class="banner-list-empty">No banners uploaded yet.</div>`
            return
        }

        banners.forEach(banner => {
            const rawType = String(banner.type || "").trim()
            const locationLabel = getBannerTypeLabel(rawType)
            const label = `Location: ${locationLabel}`

            container.innerHTML += `
                <div class="banner-card">
                    <img src="${escapeHtml(banner.image)}" alt="${escapeHtml(label)}">
                    <p>${escapeHtml(label)}</p>
                    <div class="banner-card-actions">
                        <button type="button" class="banner-edit-btn" onclick="editBanner('${escapeHtml(rawType)}', '${escapeHtml(banner._id)}')">Edit</button>
                        <button type="button" class="banner-delete-btn" onclick="deleteBanner('${banner._id}')">Delete</button>
                    </div>
                </div>
            `
        })
    } catch (err) {
        console.log("Banner load error:", err)
    }
}

// ================= CATEGORY CARDS =================

function getCategoryCardSortIndex(gender, categoryId) {
    const options = CATEGORY_CARD_OPTIONS_BY_GENDER[String(gender || "").trim().toLowerCase()] || []
    const index = options.findIndex(option => option.id === String(categoryId || "").trim().toLowerCase())
    return index === -1 ? Number.MAX_SAFE_INTEGER : index
}

function getCategoryCardDisplayOrder(card) {
    const parsed = Number.parseInt(String(card?.displayOrder ?? ""), 10)
    if (Number.isNaN(parsed) || parsed < 1) return Number.MAX_SAFE_INTEGER
    return parsed
}

function getCategoryCardGenderOrder(gender) {
    return CATEGORY_CARD_GENDER_ORDER[String(gender || "").trim().toLowerCase()] || Number.MAX_SAFE_INTEGER
}

function getSortedCategoryCards(cards) {
    return [...cards].sort((a, b) => {
        const genderDiff = getCategoryCardGenderOrder(a.gender) - getCategoryCardGenderOrder(b.gender)
        if (genderDiff !== 0) return genderDiff

        const orderDiff = getCategoryCardDisplayOrder(a) - getCategoryCardDisplayOrder(b)
        if (orderDiff !== 0) return orderDiff

        const fallbackDiff = getCategoryCardSortIndex(a.gender, a.categoryId) - getCategoryCardSortIndex(b.gender, b.categoryId)
        if (fallbackDiff !== 0) return fallbackDiff

        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    })
}

function clearCategoryCardDragState() {
    draggingCategoryCardId = ""
    draggingCategoryCardGender = ""

    const container = document.getElementById("categoryCardList")
    if (!container) return

    container.querySelectorAll(".category-card-admin-item.is-dragging").forEach(node => {
        node.classList.remove("is-dragging")
    })

    container.querySelectorAll(".category-card-admin-item.drag-over").forEach(node => {
        node.classList.remove("drag-over")
    })
}

async function persistCategoryCardOrder(gender, orderedIds) {
    if (!gender || !Array.isArray(orderedIds) || !orderedIds.length) return
    if (categoryCardReorderBusy) return

    categoryCardReorderBusy = true

    try {
        const response = await fetch("/api/category-cards/order", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                gender,
                orderedIds
            })
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
            alert(payload.error || "Unable to reorder category cards")
            return
        }
    } catch (err) {
        console.log("Category card reorder error:", err)
        alert("Unable to reorder category cards right now")
    } finally {
        categoryCardReorderBusy = false
        await loadCategoryCards()
    }
}

function bindCategoryCardDragAndDrop() {
    const container = document.getElementById("categoryCardList")
    if (!container || container.dataset.dragBound === "true") return
    container.dataset.dragBound = "true"

    container.addEventListener("dragstart", event => {
        if (categoryCardReorderBusy) {
            event.preventDefault()
            return
        }

        const card = event.target.closest(".category-card-admin-item[data-card-id][draggable='true']")
        if (!card) return

        draggingCategoryCardId = String(card.dataset.cardId || "")
        draggingCategoryCardGender = String(card.dataset.gender || "")

        if (!draggingCategoryCardId || !draggingCategoryCardGender) {
            clearCategoryCardDragState()
            return
        }

        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", draggingCategoryCardId)
        card.classList.add("is-dragging")
    })

    container.addEventListener("dragover", event => {
        if (!draggingCategoryCardId || !draggingCategoryCardGender) return

        const board = event.target.closest(".category-card-order-board[data-gender]")
        if (!board || String(board.dataset.gender || "") !== draggingCategoryCardGender) return

        event.preventDefault()
        event.dataTransfer.dropEffect = "move"

        container.querySelectorAll(".category-card-admin-item.drag-over").forEach(node => {
            node.classList.remove("drag-over")
        })

        const card = event.target.closest(".category-card-admin-item[data-card-id]")
        if (!card || String(card.dataset.cardId || "") === draggingCategoryCardId) return
        card.classList.add("drag-over")
    })

    container.addEventListener("dragleave", event => {
        const card = event.target.closest(".category-card-admin-item.drag-over")
        if (card) {
            card.classList.remove("drag-over")
        }
    })

    container.addEventListener("drop", async event => {
        if (!draggingCategoryCardId || !draggingCategoryCardGender) return

        const board = event.target.closest(".category-card-order-board[data-gender]")
        if (!board || String(board.dataset.gender || "") !== draggingCategoryCardGender) {
            clearCategoryCardDragState()
            return
        }

        event.preventDefault()

        const cardsInBoard = Array.from(board.querySelectorAll(".category-card-admin-item[data-card-id]"))
        const currentOrderedIds = cardsInBoard
            .map(card => String(card.dataset.cardId || "").trim())
            .filter(Boolean)

        const sourceIndex = currentOrderedIds.indexOf(draggingCategoryCardId)
        if (sourceIndex === -1) {
            clearCategoryCardDragState()
            return
        }

        const nextOrder = [...currentOrderedIds]
        nextOrder.splice(sourceIndex, 1)

        const dropCard = event.target.closest(".category-card-admin-item[data-card-id]")
        if (!dropCard || String(dropCard.dataset.cardId || "") === draggingCategoryCardId) {
            nextOrder.push(draggingCategoryCardId)
        } else {
            const targetId = String(dropCard.dataset.cardId || "")
            const targetIndex = nextOrder.indexOf(targetId)

            if (targetIndex === -1) {
                nextOrder.push(draggingCategoryCardId)
            } else {
                const rect = dropCard.getBoundingClientRect()
                const insertAfter = event.clientY > rect.top + rect.height / 2
                const insertIndex = insertAfter ? targetIndex + 1 : targetIndex
                nextOrder.splice(insertIndex, 0, draggingCategoryCardId)
            }
        }

        const activeGender = draggingCategoryCardGender
        clearCategoryCardDragState()

        if (JSON.stringify(currentOrderedIds) === JSON.stringify(nextOrder)) {
            return
        }

        await persistCategoryCardOrder(activeGender, nextOrder)
    })

    container.addEventListener("dragend", () => {
        clearCategoryCardDragState()
    })
}

async function saveCategoryCard() {
    if (categoryCardReorderBusy) return

    const genderSelect = document.getElementById("categoryCardGender")
    const categorySelect = document.getElementById("categoryCardId")
    const titleInput = document.getElementById("categoryCardTitle")
    const subtitleInput = document.getElementById("categoryCardSubtitle")
    const imageInput = document.getElementById("categoryCardImage")

    const gender = String(genderSelect?.value || "").trim().toLowerCase()
    const categoryId = String(categorySelect?.value || "").trim().toLowerCase()
    const title = String(titleInput?.value || "").trim()
    const subtitle = String(subtitleInput?.value || "").trim()
    const file = imageInput?.files?.[0]

    if (!gender || !categoryId) {
        alert("Select gender and category")
        return
    }

    if (!file && !editingCategoryCardId) {
        alert("Upload a thumbnail image")
        return
    }

    try {
        const formData = new FormData()
        formData.append("gender", gender)
        formData.append("categoryId", categoryId)
        formData.append("title", title)
        formData.append("subtitle", subtitle)

        if (editingCategoryCardId) {
            formData.append("cardId", editingCategoryCardId)
        }

        if (file) {
            formData.append("image", file)
        }

        const response = await fetch("/api/category-cards", {
            method: "POST",
            body: formData
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
            alert(payload.error || "Unable to save category card")
            return
        }

        alert("Category card saved")
        resetCategoryCardEditorState()

        if (genderSelect) {
            genderSelect.value = gender
            populateCategoryCardOptions(categoryId)
        }

        await loadCategoryCards()
        await loadDashboard()
    } catch (err) {
        console.log("Category card save error:", err)
        alert("Unable to save category card right now")
    }
}

async function deleteCategoryCard(cardId) {
    if (categoryCardReorderBusy) return

    const confirmed = confirm("Delete this category card?")
    if (!confirmed) return

    try {
        const response = await fetch(`/api/category-cards/${cardId}`, {
            method: "DELETE"
        })
        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
            alert(payload.error || "Unable to delete category card")
            return
        }

        await loadCategoryCards()
        await loadDashboard()
    } catch (err) {
        console.log("Category card delete error:", err)
        alert("Unable to delete category card right now")
    }
}

async function loadCategoryCards() {
    const container = document.getElementById("categoryCardList")
    if (!container) return

    try {
        container.innerHTML = ""
        clearCategoryCardDragState()

        const cards = await fetch("/api/category-cards").then(r => r.json())
        categoryCardCache = (Array.isArray(cards) ? cards : [])
            .filter(card => {
                const gender = String(card?.gender || "").trim().toLowerCase()
                if (gender !== "women") return true
                return !isLegacyHiddenWomenCategoryId(card?.categoryId)
            })
        const sorted = getSortedCategoryCards(categoryCardCache)

        if (!sorted.length) {
            container.innerHTML = `<div class="banner-list-empty">No category cards uploaded yet.</div>`
            return
        }

        const genders = ["men", "women", "unisex"]

        container.innerHTML = genders.map(gender => {
            const cardsForGender = sorted.filter(card => String(card.gender || "") === gender)

            const cardMarkup = cardsForGender.length
                ? cardsForGender.map((card, index) => {
                    const label = getCategoryCardLabel(card.gender, card.categoryId)
                    const title = String(card.title || "").trim() || label
                    const subtitle = String(card.subtitle || "").trim()
                    const meta = `${String(card.gender || "").toUpperCase()} | ${label}`
                    const orderValue = getCategoryCardDisplayOrder(card)
                    const orderBadge = orderValue === Number.MAX_SAFE_INTEGER ? index + 1 : orderValue

                    return `
                        <article
                            class="category-card-admin-item"
                            draggable="true"
                            data-card-id="${escapeHtml(card._id)}"
                            data-gender="${escapeHtml(gender)}"
                        >
                            <span class="category-card-drag-handle" title="Drag to reorder" aria-hidden="true">&#9776;</span>
                            <span class="category-card-order-badge">#${orderBadge}</span>

                            <img src="${escapeHtml(card.image)}" alt="${escapeHtml(meta)}">
                            <div class="category-card-admin-content">
                                <p class="category-card-admin-meta">${escapeHtml(meta)}</p>
                                <h3>${escapeHtml(title)}</h3>
                                <p>${escapeHtml(subtitle || "Uses category default subtitle on storefront.")}</p>
                            </div>
                            <div class="category-card-admin-actions">
                                <button type="button" class="banner-edit-btn" onclick="event.stopPropagation(); editCategoryCardById('${escapeHtml(card._id)}')">Edit</button>
                                <button type="button" class="banner-delete-btn" onclick="event.stopPropagation(); deleteCategoryCard('${escapeHtml(card._id)}')">Delete</button>
                            </div>
                        </article>
                    `
                }).join("")
                : `<div class="category-card-group-empty">No cards for ${gender.toUpperCase()} yet.</div>`

            return `
                <section class="category-card-order-group">
                    <div class="category-card-order-head">
                        <h3>${gender.toUpperCase()}</h3>
                        <p>${cardsForGender.length} card${cardsForGender.length === 1 ? "" : "s"} | drag to reorder</p>
                    </div>
                    <div class="category-card-order-board" data-gender="${escapeHtml(gender)}">
                        ${cardMarkup}
                    </div>
                </section>
            `
        }).join("")

        bindCategoryCardDragAndDrop()
    } catch (err) {
        console.log("Category card load error:", err)
        container.innerHTML = `<div class="banner-list-empty">Unable to load category cards right now.</div>`
    }
}

// ================= CUSTOM DESIGN REQUESTS =================

function buildCustomDesignSizeSummary(sizeBreakdown = {}) {
    const labels = [
        ["XS", sizeBreakdown?.xs],
        ["S", sizeBreakdown?.s],
        ["M", sizeBreakdown?.m],
        ["L", sizeBreakdown?.l],
        ["XL", sizeBreakdown?.xl],
        ["XXL", sizeBreakdown?.xxl],
        ["XXXL", sizeBreakdown?.xxxl]
    ]

    const nonZero = labels
        .map(([label, value]) => [label, Number(value || 0)])
        .filter(([, qty]) => qty > 0)
        .map(([label, qty]) => `${label}: ${qty}`)

    return nonZero.length ? nonZero.join(" | ") : "No size split provided"
}

function buildCustomDesignAssetsMarkup(assets = []) {
    if (!Array.isArray(assets) || !assets.length) {
        return '<div class="custom-design-assets-empty">No design files</div>'
    }

    return assets.slice(0, 6).map(asset => {
        const role = String(asset?.role || "reference")
        const roleLabel = role === "front"
            ? "Front"
            : role === "back"
                ? "Back"
                : "Reference"

        const imageUrl = escapeHtml(asset?.url || "")
        return `
            <a class="custom-design-asset" href="${imageUrl}" target="_blank" rel="noopener noreferrer">
                <img src="${imageUrl}" alt="${escapeHtml(roleLabel)} design file">
                <span>${escapeHtml(roleLabel)}</span>
            </a>
        `
    }).join("")
}

async function updateCustomDesignStatus(requestId, nextStatus, triggerButton = null) {
    const normalizedId = String(requestId || "").trim()
    const normalizedStatus = String(nextStatus || "").trim().toLowerCase()
    if (!normalizedId || !CUSTOM_DESIGN_STATUSES.includes(normalizedStatus)) return

    const button = triggerButton instanceof HTMLButtonElement ? triggerButton : null
    const initialLabel = button ? button.textContent : ""

    try {
        if (button) {
            button.disabled = true
            button.textContent = "Saving..."
        }

        const response = await fetch(`/api/custom-designs/${normalizedId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: normalizedStatus })
        })

        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
            alert(payload.error || "Unable to update request status")
            return
        }

        await Promise.all([
            loadCustomDesignRequests(),
            loadDashboard()
        ])
    } catch (err) {
        console.log("Custom request status update error:", err)
        alert("Unable to update request status right now")
    } finally {
        if (button) {
            button.disabled = false
            button.textContent = initialLabel || "Save Status"
        }
    }
}

async function loadCustomDesignRequests() {
    const container = document.getElementById("customDesignList")
    if (!container) return

    const filterEl = document.getElementById("customDesignStatusFilter")
    const normalizedFilter = String(filterEl?.value || "").trim().toLowerCase()

    try {
        container.innerHTML = `<div class="banner-list-empty">Loading custom design requests...</div>`

        const query = new URLSearchParams({ limit: "200" })
        if (CUSTOM_DESIGN_STATUSES.includes(normalizedFilter)) {
            query.set("status", normalizedFilter)
        }

        const response = await fetch(`/api/custom-designs?${query.toString()}`)
        const requests = await response.json().catch(() => [])

        if (!response.ok) {
            throw new Error(requests?.error || "Unable to load requests")
        }

        if (!Array.isArray(requests) || !requests.length) {
            container.innerHTML = `<div class="banner-list-empty">No custom design requests found for this filter.</div>`
            return
        }

        container.innerHTML = requests.map(request => {
            const requestId = String(request?._id || "")
            const requestCode = String(request?.requestCode || "LX-CUS")
            const customerName = String(request?.customerName || "Unknown")
            const email = String(request?.email || "-")
            const phone = String(request?.phone || "-")
            const targetGender = String(request?.targetGender || "unisex").toUpperCase()
            const tshirtFit = String(request?.tshirtFit || "").toUpperCase()
            const printSides = String(request?.printSides || "front")
            const frontPlacement = String(request?.frontPlacement || "-")
            const backPlacement = String(request?.backPlacement || "-")
            const status = String(request?.status || "pending").toLowerCase()
            const statusClass = status.replace(/[^a-z0-9-]/g, "")
            const quantity = Number(request?.quantity || 0)
            const createdAt = formatDateTime(request?.createdAt)
            const deliveryTargetDate = request?.deliveryTargetDate
                ? formatDateTime(request.deliveryTargetDate)
                : "Flexible"
            const sizeSummary = buildCustomDesignSizeSummary(request?.sizeBreakdown || {})
            const designAssetsMarkup = buildCustomDesignAssetsMarkup(request?.designAssets || [])

            const statusOptions = CUSTOM_DESIGN_STATUSES.map(statusValue => `
                <option value="${statusValue}" ${statusValue === status ? "selected" : ""}>
                    ${escapeHtml(getCustomDesignStatusLabel(statusValue))}
                </option>
            `).join("")

            return `
                <article class="custom-design-card">
                    <div class="custom-design-card-head">
                        <div>
                            <h3>${escapeHtml(requestCode)}</h3>
                            <p>Submitted ${escapeHtml(createdAt)}</p>
                        </div>
                        <span class="custom-design-status status-${escapeHtml(statusClass)}">
                            ${escapeHtml(getCustomDesignStatusLabel(status))}
                        </span>
                    </div>

                    <div class="custom-design-meta-grid">
                        <p><strong>Customer:</strong> ${escapeHtml(customerName)}</p>
                        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
                        <p><strong>Phone:</strong> ${escapeHtml(phone)}</p>
                        <p><strong>Collection:</strong> ${escapeHtml(targetGender)}</p>
                        <p><strong>T-Shirt:</strong> ${escapeHtml(tshirtFit)}</p>
                        <p><strong>Print Sides:</strong> ${escapeHtml(printSides.toUpperCase())}</p>
                        <p><strong>Quantity:</strong> ${escapeHtml(String(quantity))}</p>
                        <p><strong>Front Placement:</strong> ${escapeHtml(frontPlacement)}</p>
                        <p><strong>Back Placement:</strong> ${escapeHtml(backPlacement)}</p>
                        <p><strong>Delivery Target:</strong> ${escapeHtml(deliveryTargetDate)}</p>
                        <p><strong>Budget:</strong> ${escapeHtml(request?.budget || "-")}</p>
                        <p class="full"><strong>Size Split:</strong> ${escapeHtml(sizeSummary)}</p>
                        <p class="full"><strong>Placement Note:</strong> ${escapeHtml(request?.placementNotes || "-")}</p>
                        <p class="full"><strong>Instruction:</strong> ${escapeHtml(request?.specialInstructions || "-")}</p>
                    </div>

                    <div class="custom-design-assets">
                        ${designAssetsMarkup}
                    </div>

                    <div class="custom-design-status-editor">
                        <label for="customDesignStatus-${escapeHtml(requestId)}">Update Status</label>
                        <select id="customDesignStatus-${escapeHtml(requestId)}">
                            ${statusOptions}
                        </select>
                        <button
                            type="button"
                            onclick="updateCustomDesignStatus('${escapeHtml(requestId)}', document.getElementById('customDesignStatus-${escapeHtml(requestId)}')?.value, this)"
                        >
                            Save Status
                        </button>
                    </div>
                </article>
            `
        }).join("")
    } catch (err) {
        console.log("Custom design requests load error:", err)
        container.innerHTML = `<div class="banner-list-empty">Unable to load custom design requests right now.</div>`
    }
}

// ================= ORDERS =================

function getOrderStatusLabel(status) {
    const normalized = String(status || "").trim().toLowerCase()
    return ORDER_STATUS_LABELS[normalized] || "Placed"
}

function getOrderStatusClass(status) {
    const normalized = String(status || "").trim().toLowerCase()
    return ORDER_STATUS_LABELS[normalized] ? normalized : "placed"
}

function parseOrderCreatedAt(order) {
    return new Date(order?.createdAt || 0).getTime() || 0
}

function parseOrderGrandTotal(order) {
    const parsed = Number(order?.grandTotal || 0)
    return Number.isNaN(parsed) ? 0 : parsed
}

function parseOrderItemCount(order) {
    const parsed = Number(order?.itemCount || 0)
    if (!Number.isNaN(parsed) && parsed > 0) return parsed

    const rawItems = Array.isArray(order?.items) ? order.items : []
    return rawItems.reduce((sum, item) => sum + Number(item?.quantity || 0), 0)
}

function getPaymentMethodLabel(method) {
    const normalized = normalizeText(method || "cod").toLowerCase()
    if (normalized === "cod") return "Cash on Delivery"
    if (normalized === "upi") return "UPI"
    if (normalized === "card") return "Card"
    if (normalized === "netbanking") return "Net Banking"
    if (normalized === "wallet") return "Wallet"
    if (normalized === "razorpay") return "Razorpay"
    return "Unknown"
}

function getPaymentStatusLabel(status) {
    const normalized = normalizeText(status || "unpaid").toLowerCase()
    if (normalized === "paid") return "Paid"
    if (normalized === "pending") return "Pending"
    if (normalized === "cod-pending") return "COD Pending"
    if (normalized === "failed") return "Failed"
    if (normalized === "refunded") return "Refunded"
    return "Unpaid"
}

function getPaymentReference(order) {
    return normalizeText(
        order?.payment?.reference ||
        order?.payment?.transactionId ||
        order?.payment?.gatewayPaymentId
    ) || "-"
}

function getShippingAddressLabel(order) {
    const address = order?.shippingAddress && typeof order.shippingAddress === "object"
        ? order.shippingAddress
        : {}

    const parts = [
        address.line1,
        address.line2,
        address.landmark,
        address.city,
        address.state,
        address.postalCode,
        address.country
    ]
        .map(value => normalizeText(value))
        .filter(Boolean)

    return parts.length ? parts.join(", ") : "-"
}

function toOrderSourceLabel(source) {
    const normalized = normalizeText(source || "web-cart")
    if (!normalized) return "Web Cart"

    return normalized
        .replace(/[-_]+/g, " ")
        .split(" ")
        .filter(Boolean)
        .map(piece => piece[0].toUpperCase() + piece.slice(1).toLowerCase())
        .join(" ")
}

function getOrderItemTypeLabel(type) {
    const normalized = normalizeText(type).toLowerCase()
    if (normalized === "tshirt") return "T-Shirt"
    if (normalized === "top") return "Top"
    if (normalized === "shirt") return "Shirt"
    if (normalized === "short") return "Shorts"
    if (normalized === "sweatpant") return "Sweatpants"
    return normalized
        ? normalized
            .replace(/[-_]+/g, " ")
            .split(" ")
            .filter(Boolean)
            .map(piece => piece[0].toUpperCase() + piece.slice(1).toLowerCase())
            .join(" ")
        : "Product"
}

function getOrderItemMetaLabel(item) {
    const itemType = String(item?.itemType || "product").trim().toLowerCase()

    if (itemType === "custom-preset") {
        const preset = item?.customPreset && typeof item.customPreset === "object" ? item.customPreset : {}
        const gender = normalizeText(preset.targetGender || item?.gender || "unisex").toUpperCase()
        const fit = normalizeText(preset.tshirtFit || item?.fit).toUpperCase()
        const color = normalizeText(preset.baseColor)
        return [gender, "CUSTOM T-SHIRT", fit, color].filter(Boolean).join(" | ")
    }

    const gender = normalizeText(item?.gender).toUpperCase()
    const type = getOrderItemTypeLabel(item?.type).toUpperCase()
    const fit = normalizeText(item?.fit).toUpperCase()
    const parts = [gender, type, fit].filter(Boolean)
    return parts.length ? parts.join(" | ") : "Product"
}

function showOrdersFeedback(message, tone = "muted") {
    const feedback = document.getElementById("ordersFeedback")
    if (!feedback) return

    feedback.className = `orders-feedback ${tone}`
    feedback.textContent = message
}

function getOrderFilters() {
    const query = String(document.getElementById("orderSearchInput")?.value || "").trim().toLowerCase()
    const status = String(document.getElementById("orderStatusFilter")?.value || "all").trim().toLowerCase()
    const source = String(document.getElementById("orderSourceFilter")?.value || "all").trim().toLowerCase()
    const sort = String(document.getElementById("orderSortSelect")?.value || "newest").trim().toLowerCase()

    return { query, status, source, sort }
}

function applyOrderFilters(orders, filters) {
    const normalizedOrders = Array.isArray(orders) ? orders : []
    const query = String(filters?.query || "").trim().toLowerCase()
    const status = String(filters?.status || "all").trim().toLowerCase()
    const source = String(filters?.source || "all").trim().toLowerCase()
    const sort = String(filters?.sort || "newest").trim().toLowerCase()

    let output = normalizedOrders.filter(order => {
        const orderStatus = getOrderStatusClass(order?.status)
        if (status !== "all" && orderStatus !== status) return false

        const orderSource = String(order?.source || "").trim().toLowerCase()
        if (source !== "all" && orderSource !== source) return false

        if (!query) return true

        const lineItems = Array.isArray(order?.items) ? order.items : []
        const itemText = lineItems
            .map(item => `${item?.name || ""} ${getOrderItemMetaLabel(item)}`.trim())
            .join(" ")
            .toLowerCase()

        const haystack = [
            order?.orderCode || "",
            order?.customerName || "",
            order?.userEmail || "",
            order?.customerPhone || "",
            order?.payment?.reference || "",
            order?.payment?.transactionId || "",
            order?.payment?.gatewayPaymentId || "",
            itemText
        ].join(" ").toLowerCase()

        return haystack.includes(query)
    })

    output = [...output].sort((a, b) => {
        if (sort === "oldest") {
            return parseOrderCreatedAt(a) - parseOrderCreatedAt(b)
        }

        if (sort === "total_desc") {
            return parseOrderGrandTotal(b) - parseOrderGrandTotal(a)
        }

        if (sort === "total_asc") {
            return parseOrderGrandTotal(a) - parseOrderGrandTotal(b)
        }

        return parseOrderCreatedAt(b) - parseOrderCreatedAt(a)
    })

    return output
}

function renderOrderStats(allRows, visibleRows) {
    const container = document.getElementById("ordersStats")
    if (!container) return

    const rows = Array.isArray(allRows) ? allRows : []
    const visible = Array.isArray(visibleRows) ? visibleRows : []

    const totalRevenue = rows.reduce((sum, order) => sum + parseOrderGrandTotal(order), 0)
    const deliveredCount = rows.filter(order => getOrderStatusClass(order?.status) === "delivered").length
    const cancelledCount = rows.filter(order => getOrderStatusClass(order?.status) === "cancelled").length
    const activeCount = rows.filter(order => ["placed", "processing", "shipped"].includes(getOrderStatusClass(order?.status))).length

    container.innerHTML = `
        <article class="orders-stat-card">
            <p>Total Orders</p>
            <strong>${rows.length}</strong>
        </article>
        <article class="orders-stat-card">
            <p>Total Revenue</p>
            <strong>${escapeHtml(formatCurrencyInr(totalRevenue))}</strong>
        </article>
        <article class="orders-stat-card">
            <p>Active Orders</p>
            <strong>${activeCount}</strong>
        </article>
        <article class="orders-stat-card">
            <p>Delivered</p>
            <strong>${deliveredCount}</strong>
        </article>
        <article class="orders-stat-card">
            <p>Cancelled</p>
            <strong>${cancelledCount}</strong>
        </article>
        <article class="orders-stat-card">
            <p>Filtered Result</p>
            <strong>${visible.length}</strong>
        </article>
    `
}

function buildOrderStatusOptions(currentStatus) {
    const normalizedStatus = getOrderStatusClass(currentStatus)

    return ORDER_STATUSES.map(status => `
        <option value="${status}" ${normalizedStatus === status ? "selected" : ""}>
            ${escapeHtml(getOrderStatusLabel(status))}
        </option>
    `).join("")
}

function getOrderStatusSelectId(orderId) {
    return `orderStatus_${String(orderId || "").replace(/[^a-zA-Z0-9_-]/g, "") || "unknown"}`
}

function renderOrderItemsMarkup(order) {
    const items = Array.isArray(order?.items) ? order.items : []

    if (!items.length) {
        return `<p class="order-items-empty">No line items found for this order.</p>`
    }

    const previewItems = items.slice(0, 4)
    const remainingItems = items.length - previewItems.length

    const rows = previewItems.map(item => {
        const image = normalizeText(item?.image)
        const itemName = normalizeText(item?.name) || "Item"
        const itemMeta = getOrderItemMetaLabel(item)
        const size = normalizeText(item?.size) || "-"
        const quantity = Number(item?.quantity || 0) || 0
        const lineTotal = formatCurrencyInr(item?.lineTotal || 0)
        const itemType = String(item?.itemType || "product").trim().toLowerCase()
        const itemTypeLabel = itemType === "custom-preset" ? "Custom" : "Product"

        const imageMarkup = image
            ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(itemName)}">`
            : `<span>${escapeHtml(itemName.slice(0, 1).toUpperCase())}</span>`

        return `
            <div class="order-item-row">
                <div class="order-item-thumb ${image ? "has-image" : ""}">
                    ${imageMarkup}
                </div>
                <div class="order-item-meta">
                    <p class="order-item-name">${escapeHtml(itemName)}</p>
                    <p class="order-item-sub">${escapeHtml(itemMeta)}</p>
                    <p class="order-item-sub">Size ${escapeHtml(size)} | Qty ${escapeHtml(String(quantity))}</p>
                </div>
                <div class="order-item-end">
                    <span class="order-item-type ${itemType === "custom-preset" ? "custom" : "product"}">${escapeHtml(itemTypeLabel)}</span>
                    <strong>${escapeHtml(lineTotal)}</strong>
                </div>
            </div>
        `
    }).join("")

    const moreMarkup = remainingItems > 0
        ? `<p class="order-items-more">+${remainingItems} more item${remainingItems === 1 ? "" : "s"} in this order</p>`
        : ""

    return `${rows}${moreMarkup}`
}

function renderOrderCards(rows) {
    const container = document.getElementById("ordersList")
    if (!container) return

    const orders = Array.isArray(rows) ? rows : []
    if (!orders.length) {
        container.innerHTML = `<div class="orders-empty">No orders found for this filter.</div>`
        return
    }

    container.innerHTML = orders.map(order => {
        const orderId = String(order?._id || "").trim()
        const orderCode = normalizeText(order?.orderCode) || "Order"
        const createdAt = formatDateTime(order?.createdAt)
        const customerName = normalizeText(order?.customerName) || "Customer"
        const userEmail = normalizeText(order?.userEmail) || "-"
        const customerPhone = normalizeText(order?.customerPhone) || "-"
        const status = getOrderStatusClass(order?.status)
        const statusLabel = getOrderStatusLabel(status)
        const sourceLabel = toOrderSourceLabel(order?.source)
        const itemCount = parseOrderItemCount(order)
        const grandTotal = formatCurrencyInr(order?.grandTotal || 0)
        const subtotal = formatCurrencyInr(order?.subtotal || 0)
        const shipping = formatCurrencyInr(order?.shipping || 0)
        const tax = formatCurrencyInr(order?.tax || 0)
        const statusSelectId = getOrderStatusSelectId(orderId)
        const encodedOrderId = encodeURIComponent(orderId)
        const userOrdersHref = `admin-user-orders.html?email=${encodeURIComponent(userEmail)}`
        const notes = normalizeText(order?.notes)
        const paymentMethod = getPaymentMethodLabel(order?.payment?.method)
        const paymentStatus = getPaymentStatusLabel(order?.payment?.status)
        const paymentReference = getPaymentReference(order)
        const shippingAddress = getShippingAddressLabel(order)

        return `
            <article class="order-card">
                <div class="order-card-head">
                    <div>
                        <h3>${escapeHtml(orderCode)}</h3>
                        <p>Placed ${escapeHtml(createdAt)} | Source: ${escapeHtml(sourceLabel)}</p>
                    </div>
                    <span class="order-status-badge status-${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
                </div>

                <div class="order-meta-grid">
                    <p><strong>Name:</strong> ${escapeHtml(customerName)}</p>
                    <p><strong>Email:</strong> ${escapeHtml(userEmail)}</p>
                    <p><strong>Phone:</strong> ${escapeHtml(customerPhone)}</p>
                    <p><strong>Items:</strong> ${escapeHtml(String(itemCount))}</p>
                    <p><strong>Subtotal:</strong> ${escapeHtml(subtotal)}</p>
                    <p><strong>Shipping:</strong> ${escapeHtml(shipping)}</p>
                    <p><strong>Tax:</strong> ${escapeHtml(tax)}</p>
                    <p><strong>Total:</strong> ${escapeHtml(grandTotal)}</p>
                    <p><strong>Payment:</strong> ${escapeHtml(paymentMethod)}</p>
                    <p><strong>Pay Status:</strong> ${escapeHtml(paymentStatus)}</p>
                    <p class="full"><strong>Payment Ref:</strong> ${escapeHtml(paymentReference)}</p>
                    <p class="full"><strong>Ship To:</strong> ${escapeHtml(shippingAddress)}</p>
                    ${notes ? `<p class="full"><strong>Note:</strong> ${escapeHtml(notes)}</p>` : ""}
                </div>

                <div class="order-items-wrap">
                    ${renderOrderItemsMarkup(order)}
                </div>

                <div class="order-actions-row">
                    <a href="${escapeHtml(userOrdersHref)}">View User Orders</a>

                    <div class="order-status-editor">
                        <label for="${escapeHtml(statusSelectId)}">Update Status</label>
                        <select id="${escapeHtml(statusSelectId)}">
                            ${buildOrderStatusOptions(status)}
                        </select>
                        <button
                            type="button"
                            onclick="updateOrderStatus('${encodedOrderId}', document.getElementById('${escapeHtml(statusSelectId)}')?.value, this)"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </article>
        `
    }).join("")
}

function handleOrderFiltersChanged() {
    const filtered = applyOrderFilters(allOrders, getOrderFilters())
    renderOrderStats(allOrders, filtered)
    renderOrderCards(filtered)
    showOrdersFeedback(`Showing ${filtered.length} of ${allOrders.length} orders.`, "muted")
}

async function updateOrderStatus(encodedOrderId, nextStatus, triggerButton = null) {
    const orderId = decodeURIComponent(String(encodedOrderId || ""))
    const normalizedStatus = String(nextStatus || "").trim().toLowerCase()
    if (!orderId || !ORDER_STATUSES.includes(normalizedStatus)) {
        alert("Please select a valid status.")
        return
    }

    const button = triggerButton instanceof HTMLButtonElement ? triggerButton : null
    const initialLabel = button ? button.textContent : ""

    try {
        if (button) {
            button.disabled = true
            button.textContent = "Saving..."
        }

        const response = await fetch(`/api/orders/admin/${encodeURIComponent(orderId)}/status`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                status: normalizedStatus
            })
        })

        const payload = await response.json().catch(() => ({}))
        if (!response.ok || !payload?.success) {
            throw new Error(payload?.error || "Unable to update status")
        }

        allOrders = allOrders.map(order => {
            if (String(order?._id) !== String(orderId)) return order
            return {
                ...order,
                status: normalizedStatus
            }
        })

        handleOrderFiltersChanged()
        showOrdersFeedback(`Updated ${payload?.order?.orderCode || "order"} to ${getOrderStatusLabel(normalizedStatus)}.`, "success")
    } catch (err) {
        console.log("Order status update error:", err)
        showOrdersFeedback(err?.message || "Unable to update order status right now.", "error")
    } finally {
        if (button) {
            button.disabled = false
            button.textContent = initialLabel || "Save"
        }
    }
}

function exportOrdersCsv() {
    const filtered = applyOrderFilters(allOrders, getOrderFilters())
    if (!filtered.length) {
        alert("No orders to export for the current filters.")
        return
    }

    const escapeCsv = value => {
        const text = String(value ?? "")
        if (!/[",\n]/.test(text)) return text
        return `"${text.replace(/"/g, "\"\"")}"`
    }

    const lines = [
        [
            "order_code",
            "status",
            "source",
            "customer_name",
            "user_email",
            "customer_phone",
            "item_count",
            "grand_total",
            "payment_method",
            "payment_status",
            "payment_reference",
            "created_at"
        ].join(","),
        ...filtered.map(order => {
            const createdAt = parseOrderCreatedAt(order)
            const createdAtIso = createdAt ? new Date(createdAt).toISOString() : ""
            return [
                escapeCsv(order?.orderCode || ""),
                escapeCsv(getOrderStatusLabel(order?.status)),
                escapeCsv(toOrderSourceLabel(order?.source)),
                escapeCsv(order?.customerName || ""),
                escapeCsv(order?.userEmail || ""),
                escapeCsv(order?.customerPhone || ""),
                escapeCsv(parseOrderItemCount(order)),
                escapeCsv(parseOrderGrandTotal(order).toFixed(2)),
                escapeCsv(getPaymentMethodLabel(order?.payment?.method)),
                escapeCsv(getPaymentStatusLabel(order?.payment?.status)),
                escapeCsv(getPaymentReference(order)),
                escapeCsv(createdAtIso)
            ].join(",")
        })
    ]

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const href = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = href
    link.download = `luxora-orders-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(href)
}

async function loadOrders() {
    showOrdersFeedback("Loading orders...", "muted")

    try {
        const response = await fetch("/api/orders/admin/list?limit=400")
        const payload = await response.json().catch(() => [])

        if (!response.ok) {
            throw new Error(payload?.error || "Unable to load orders")
        }

        allOrders = Array.isArray(payload) ? payload : []
        handleOrderFiltersChanged()
    } catch (err) {
        console.log("Orders load error:", err)
        allOrders = []
        renderOrderStats([], [])
        renderOrderCards([])
        showOrdersFeedback("Unable to load orders right now.", "error")
    }
}

// ================= FOOTER =================

function mergeFooterSettings(settings = {}) {
    const data = settings && typeof settings === "object" ? settings : {}
    return {
        ...DEFAULT_FOOTER_SETTINGS,
        ...data,
        linkSections: Array.isArray(data.linkSections) ? data.linkSections : DEFAULT_FOOTER_SETTINGS.linkSections,
        featureRows: Array.isArray(data.featureRows) ? data.featureRows : DEFAULT_FOOTER_SETTINGS.featureRows,
        appButtons: Array.isArray(data.appButtons) ? data.appButtons : DEFAULT_FOOTER_SETTINGS.appButtons,
        socialLinks: Array.isArray(data.socialLinks) ? data.socialLinks : DEFAULT_FOOTER_SETTINGS.socialLinks,
        paymentItems: Array.isArray(data.paymentItems) ? data.paymentItems : DEFAULT_FOOTER_SETTINGS.paymentItems,
        shippingItems: Array.isArray(data.shippingItems) ? data.shippingItems : DEFAULT_FOOTER_SETTINGS.shippingItems
    }
}

function splitAdminList(value) {
    return String(value || "")
        .split(",")
        .map(item => item.trim())
        .filter(Boolean)
}

function setFooterFeedback(message = "", tone = "muted") {
    const feedback = document.getElementById("footerAdminFeedback")
    if (!feedback) return
    feedback.textContent = message
    feedback.dataset.tone = tone
}

function setInputValue(id, value) {
    const input = document.getElementById(id)
    if (input) input.value = value || ""
}

function renderFooterSectionsEditor(sections = []) {
    const container = document.getElementById("footerSectionsEditor")
    if (!container) return

    const normalized = Array.isArray(sections) ? sections : []
    container.innerHTML = normalized.map((section, sectionIndex) => {
        const items = Array.isArray(section.items) ? section.items : []
        return `
            <article class="footer-edit-block" data-footer-section>
                <div class="footer-edit-block-head">
                    <label>
                        Column Title
                        <input type="text" data-footer-section-title value="${escapeHtml(section.title || "")}" placeholder="Need Help">
                    </label>
                    <button type="button" onclick="removeFooterEditorBlock(this)">Remove Column</button>
                </div>
                <div class="footer-link-list">
                    ${items.map(item => renderFooterLinkRow(item)).join("")}
                </div>
                <button type="button" class="footer-small-action" onclick="addFooterLinkRow(this)">Add Link</button>
            </article>
        `
    }).join("")
}

function renderFooterLinkRow(item = {}) {
    return `
        <div class="footer-link-row" data-footer-link-row>
            <input type="text" data-footer-link-label value="${escapeHtml(item.label || "")}" placeholder="Label">
            <input type="text" data-footer-link-href value="${escapeHtml(item.href || "")}" placeholder="index.html#section">
            <button type="button" onclick="removeFooterEditorBlock(this)">Remove</button>
        </div>
    `
}

function renderIconEditor(containerId, rows = [], type = "feature") {
    const container = document.getElementById(containerId)
    if (!container) return

    const normalized = Array.isArray(rows) ? rows : []
    container.innerHTML = normalized.map(row => {
        const socialUploadMarkup = type === "social"
            ? `
                <div class="footer-social-upload-cell">
                    <label class="footer-upload-chip">
                        <span>Upload logo</span>
                        <input type="file" accept="image/*" data-footer-social-upload>
                    </label>
                    <input type="hidden" data-footer-social-image-url value="${escapeHtml(row.imageUrl || "")}">
                </div>
                <div class="footer-social-preview-wrap">
                    ${row.imageUrl
                        ? `<img class="footer-social-preview" data-footer-social-preview src="${escapeHtml(row.imageUrl)}" alt="">`
                        : `<span class="footer-social-preview-placeholder">No logo</span>`}
                </div>
            `
            : ""

        return `
            <div class="footer-icon-row${type === "social" ? " footer-social-row" : ""}" data-footer-${type}-row>
                <input type="text" data-footer-icon value="${escapeHtml(row.icon || "")}" placeholder="Icon">
                <input type="text" data-footer-label value="${escapeHtml(row.label || "")}" placeholder="Label">
                <input type="text" data-footer-href value="${escapeHtml(row.href || "")}" placeholder="Link (optional)">
                ${socialUploadMarkup}
                <button type="button" onclick="removeFooterEditorBlock(this)">Remove</button>
            </div>
        `
    }).join("")

    if (type === "social") {
        requestAnimationFrame(() => {
            container.querySelectorAll("[data-footer-social-upload]").forEach(input => {
                input.addEventListener("change", async () => {
                    const row = input.closest("[data-footer-social-row]")
                    const hidden = row?.querySelector("[data-footer-social-image-url]")
                    const preview = row?.querySelector("[data-footer-social-preview]")
                    const placeholder = row?.querySelector(".footer-social-preview-placeholder")

                    if (!input.files?.[0] || !hidden || !preview) return

                    try {
                        const formData = new FormData()
                        formData.append("image", input.files[0])

                        const response = await fetch("/api/footer/social-icon", {
                            method: "POST",
                            body: formData
                        })
                        const payload = await response.json().catch(() => ({}))

                        if (!response.ok) {
                            throw new Error(payload?.error || "Unable to upload social logo")
                        }

                        hidden.value = payload.url || ""
                        preview.src = payload.url || ""
                        preview.hidden = false
                        if (placeholder) placeholder.remove()
                    } catch (err) {
                        alert(err?.message || "Unable to upload social logo")
                    }
                })
            })
        })
    }
}

function hydrateFooterForm(settings) {
    const footer = mergeFooterSettings(settings)
    footerSettingsDraft = footer

    setInputValue("footerHomegrownText", footer.homegrownText)
    setInputValue("footerHeadlineBefore", footer.headlineBefore)
    setInputValue("footerHeadlineStrong", footer.headlineStrong)
    setInputValue("footerHeadlineAfter", footer.headlineAfter)
    setInputValue("footerBrandTitle", footer.brandTitle)
    setInputValue("footerBrandDescription", footer.brandDescription)
    setInputValue("footerAppTitle", footer.appTitle)
    setInputValue("footerInfoTitle", footer.infoTitle)
    setInputValue("footerInfoBody", footer.infoBody)
    setInputValue("footerPaymentText", footer.paymentText)
    setInputValue("footerPaymentItems", footer.paymentItems.join(", "))
    setInputValue("footerShippingText", footer.shippingText)
    setInputValue("footerShippingItems", footer.shippingItems.join(", "))
    setInputValue("footerCopyrightText", footer.copyrightText)

    renderFooterSectionsEditor(footer.linkSections)
    renderIconEditor("footerFeaturesEditor", footer.featureRows, "feature")
    renderIconEditor("footerSocialsEditor", footer.socialLinks, "social")
}

function collectFooterSections() {
    return Array.from(document.querySelectorAll("[data-footer-section]")).map(section => {
        const title = normalizeText(section.querySelector("[data-footer-section-title]")?.value)
        const items = Array.from(section.querySelectorAll("[data-footer-link-row]")).map(row => ({
            label: normalizeText(row.querySelector("[data-footer-link-label]")?.value),
            href: normalizeText(row.querySelector("[data-footer-link-href]")?.value) || "#"
        })).filter(item => item.label)

        return { title, items }
    }).filter(section => section.title || section.items.length)
}

function collectFooterIconRows(selector) {
    return Array.from(document.querySelectorAll(selector)).map(row => ({
        icon: normalizeText(row.querySelector("[data-footer-icon]")?.value),
        label: normalizeText(row.querySelector("[data-footer-label]")?.value),
        href: normalizeText(row.querySelector("[data-footer-href]")?.value),
        imageUrl: normalizeText(row.querySelector("[data-footer-social-image-url]")?.value)
    })).filter(item => item.label)
}

function collectFooterPayload() {
    return {
        homegrownText: normalizeText(document.getElementById("footerHomegrownText")?.value),
        headlineBefore: normalizeText(document.getElementById("footerHeadlineBefore")?.value),
        headlineStrong: normalizeText(document.getElementById("footerHeadlineStrong")?.value),
        headlineAfter: normalizeText(document.getElementById("footerHeadlineAfter")?.value),
        brandTitle: normalizeText(document.getElementById("footerBrandTitle")?.value),
        brandDescription: normalizeText(document.getElementById("footerBrandDescription")?.value),
        linkSections: collectFooterSections(),
        featureRows: collectFooterIconRows("[data-footer-feature-row]"),
        appTitle: normalizeText(document.getElementById("footerAppTitle")?.value),
        appButtons: [],
        socialLinks: collectFooterIconRows("[data-footer-social-row]"),
        infoTitle: normalizeText(document.getElementById("footerInfoTitle")?.value),
        infoBody: normalizeText(document.getElementById("footerInfoBody")?.value),
        paymentText: normalizeText(document.getElementById("footerPaymentText")?.value),
        paymentItems: splitAdminList(document.getElementById("footerPaymentItems")?.value),
        shippingText: normalizeText(document.getElementById("footerShippingText")?.value),
        shippingItems: splitAdminList(document.getElementById("footerShippingItems")?.value),
        copyrightText: normalizeText(document.getElementById("footerCopyrightText")?.value)
    }
}

function addFooterSection() {
    const sections = collectFooterSections()
    sections.push({ title: "", items: [{ label: "", href: "" }] })
    renderFooterSectionsEditor(sections)
}

function addFooterLinkRow(button) {
    const list = button?.closest("[data-footer-section]")?.querySelector(".footer-link-list")
    if (!list) return
    list.insertAdjacentHTML("beforeend", renderFooterLinkRow())
}

function addFooterFeature() {
    const rows = collectFooterIconRows("[data-footer-feature-row]")
    rows.push({ icon: "", label: "", href: "" })
    renderIconEditor("footerFeaturesEditor", rows, "feature")
}

function addFooterSocial() {
    const rows = collectFooterIconRows("[data-footer-social-row]")
    rows.push({ icon: "", label: "", href: "" })
    renderIconEditor("footerSocialsEditor", rows, "social")
}

function removeFooterEditorBlock(button) {
    const block = button?.closest("[data-footer-section], [data-footer-link-row], [data-footer-feature-row], [data-footer-social-row]")
    if (block) block.remove()
}

async function loadFooterSettings() {
    setFooterFeedback("Loading footer settings...", "muted")

    try {
        const response = await fetch("/api/footer")
        const payload = await response.json().catch(() => ({}))
        if (!response.ok) {
            throw new Error(payload?.error || "Unable to load footer")
        }

        hydrateFooterForm(payload)
        setFooterFeedback("Footer settings loaded.", "success")
    } catch (err) {
        console.log("Footer settings load error:", err)
        hydrateFooterForm(footerSettingsDraft || DEFAULT_FOOTER_SETTINGS)
        setFooterFeedback("Using default footer settings until the server responds.", "error")
    }
}

async function saveFooterSettings() {
    const payload = collectFooterPayload()
    if (!payload.linkSections.length) {
        alert("Add at least one footer link column.")
        return
    }

    setFooterFeedback("Saving footer settings...", "muted")

    try {
        const response = await fetch("/api/footer", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        })

        const saved = await response.json().catch(() => ({}))
        if (!response.ok) {
            throw new Error(saved?.error || "Unable to save footer")
        }

        hydrateFooterForm(saved)
        try {
            localStorage.setItem("unspoken_footer_refresh", String(Date.now()))
        } catch (err) {
            // noop: storefront will still load the saved footer on refresh
        }
        setFooterFeedback("Footer saved. Storefront pages will use the updated content.", "success")
    } catch (err) {
        console.log("Footer settings save error:", err)
        setFooterFeedback(err?.message || "Unable to save footer right now.", "error")
    }
}

// ================= USERS =================

function getUserProviderLabel(provider) {
    const normalized = String(provider || "").trim().toLowerCase()
    if (normalized === "google") return "Google"
    return "Email"
}

function getUserDisplayName(user) {
    const explicitName = normalizeText(user?.name)
    if (explicitName) return explicitName

    const email = normalizeText(user?.email)
    if (!email) return "No Name"

    const localPart = email.split("@")[0] || ""
    return localPart || "No Name"
}

function getUserInitials(user) {
    const name = getUserDisplayName(user)
    const pieces = String(name).split(" ").filter(Boolean).slice(0, 2)

    if (!pieces.length) return "U"
    return pieces.map(part => part[0]?.toUpperCase() || "").join("")
}

function showUsersFeedback(message, tone = "muted") {
    const feedback = document.getElementById("usersFeedback")
    if (!feedback) return

    feedback.className = `users-feedback ${tone}`
    feedback.textContent = message
}

function parseUserCreatedAt(user) {
    return new Date(user?.createdAt || 0).getTime() || 0
}

function getUserFilters() {
    const query = String(document.getElementById("userSearchInput")?.value || "").trim().toLowerCase()
    const provider = String(document.getElementById("userProviderFilter")?.value || "all").trim().toLowerCase()
    const sort = String(document.getElementById("userSortSelect")?.value || "newest").trim().toLowerCase()

    return { query, provider, sort }
}

function applyUserFilters(users, filters) {
    const normalized = Array.isArray(users) ? users : []
    const query = String(filters?.query || "").trim().toLowerCase()
    const provider = String(filters?.provider || "all").trim().toLowerCase()
    const sort = String(filters?.sort || "newest").trim().toLowerCase()

    let output = normalized.filter(user => {
        const userProvider = String(user?.provider || "email").trim().toLowerCase() || "email"
        if (provider !== "all" && userProvider !== provider) return false

        if (!query) return true
        const name = getUserDisplayName(user).toLowerCase()
        const email = String(user?.email || "").toLowerCase()
        return `${name} ${email}`.includes(query)
    })

    output = [...output].sort((a, b) => {
        if (sort === "oldest") {
            return parseUserCreatedAt(a) - parseUserCreatedAt(b)
        }

        if (sort === "name_asc") {
            return getUserDisplayName(a).localeCompare(getUserDisplayName(b), "en", { sensitivity: "base" })
        }

        if (sort === "email_asc") {
            return String(a?.email || "").localeCompare(String(b?.email || ""), "en", { sensitivity: "base" })
        }

        return parseUserCreatedAt(b) - parseUserCreatedAt(a)
    })

    return output
}

function renderUserStats(allRows, visibleRows) {
    const container = document.getElementById("usersStats")
    if (!container) return

    const rows = Array.isArray(allRows) ? allRows : []
    const visible = Array.isArray(visibleRows) ? visibleRows : []

    const now = Date.now()
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000)
    const googleCount = rows.filter(user => String(user?.provider || "").toLowerCase() === "google").length
    const emailCount = rows.filter(user => String(user?.provider || "").toLowerCase() !== "google").length
    const recentCount = rows.filter(user => parseUserCreatedAt(user) >= sevenDaysAgo).length

    container.innerHTML = `
        <article class="users-stat-card">
            <p>Total Users</p>
            <strong>${rows.length}</strong>
        </article>
        <article class="users-stat-card">
            <p>Google Users</p>
            <strong>${googleCount}</strong>
        </article>
        <article class="users-stat-card">
            <p>Email Users</p>
            <strong>${emailCount}</strong>
        </article>
        <article class="users-stat-card">
            <p>Joined Last 7 Days</p>
            <strong>${recentCount}</strong>
        </article>
        <article class="users-stat-card">
            <p>Filtered Result</p>
            <strong>${visible.length}</strong>
        </article>
    `
}

function renderUserCards(rows) {
    const container = document.getElementById("userList")
    if (!container) return

    const users = Array.isArray(rows) ? rows : []
    if (!users.length) {
        container.innerHTML = `<div class="users-empty">No users found for this filter.</div>`
        return
    }

    container.innerHTML = users.map(user => {
        const email = String(user?.email || "").trim()
        const encodedEmail = encodeURIComponent(email)
        const photo = String(user?.photo || "").trim()
        const provider = String(user?.provider || "email").trim().toLowerCase() || "email"
        const providerLabel = getUserProviderLabel(provider)
        const createdAtTs = parseUserCreatedAt(user)
        const joinedAtLabel = createdAtTs ? formatDateTime(createdAtTs) : "Unknown"
        const displayName = getUserDisplayName(user)
        const initials = getUserInitials(user)

        const avatarMarkup = photo
            ? `<img src="${escapeHtml(photo)}" alt="${escapeHtml(displayName)}">`
            : `<span>${escapeHtml(initials)}</span>`

        return `
            <article class="user-card">
                <div class="user-avatar ${photo ? "has-photo" : ""}">
                    ${avatarMarkup}
                </div>

                <div class="user-card-content">
                    <h3>${escapeHtml(displayName)}</h3>
                    <p>${escapeHtml(email || "-")}</p>

                    <div class="user-chip-row">
                        <span class="user-chip provider-${escapeHtml(provider)}">${escapeHtml(providerLabel)}</span>
                        <span class="user-chip">Joined: ${escapeHtml(joinedAtLabel)}</span>
                    </div>

                    <div class="user-card-actions">
                        <a href="admin-user-orders.html?email=${encodedEmail}">View Orders</a>
                        <a href="mailto:${escapeHtml(email)}">Email User</a>
                        <button type="button" onclick="copyUserEmail('${encodedEmail}', this)">Copy Email</button>
                    </div>
                </div>
            </article>
        `
    }).join("")
}

function handleUserFiltersChanged() {
    const filtered = applyUserFilters(allUsers, getUserFilters())
    renderUserStats(allUsers, filtered)
    renderUserCards(filtered)
    showUsersFeedback(`Showing ${filtered.length} of ${allUsers.length} users.`, "muted")
}

async function copyUserEmail(encodedEmail, triggerButton = null) {
    const email = decodeURIComponent(String(encodedEmail || ""))
    if (!email) return

    const button = triggerButton instanceof HTMLButtonElement ? triggerButton : null
    const initialLabel = button ? button.textContent : ""

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(email)
        } else {
            const fallback = document.createElement("textarea")
            fallback.value = email
            fallback.setAttribute("readonly", "")
            fallback.style.position = "absolute"
            fallback.style.left = "-9999px"
            document.body.appendChild(fallback)
            fallback.select()
            document.execCommand("copy")
            document.body.removeChild(fallback)
        }

        if (button) {
            button.textContent = "Copied"
        }
    } catch (err) {
        window.prompt("Copy this email", email)
    } finally {
        if (button) {
            setTimeout(() => {
                button.textContent = initialLabel || "Copy Email"
            }, 900)
        }
    }
}

function exportUsersCsv() {
    const filtered = applyUserFilters(allUsers, getUserFilters())
    if (!filtered.length) {
        alert("No users to export for the current filters.")
        return
    }

    const escapeCsv = value => {
        const text = String(value ?? "")
        if (!/[",\n]/.test(text)) return text
        return `"${text.replace(/"/g, "\"\"")}"`
    }

    const lines = [
        ["name", "email", "provider", "created_at"].join(","),
        ...filtered.map(user => {
            const createdAtTs = parseUserCreatedAt(user)
            const createdAtIso = createdAtTs ? new Date(createdAtTs).toISOString() : ""

            return [
                escapeCsv(getUserDisplayName(user)),
                escapeCsv(user?.email || ""),
                escapeCsv(getUserProviderLabel(user?.provider || "email")),
                escapeCsv(createdAtIso)
            ].join(",")
        })
    ]

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" })
    const href = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = href
    link.download = `luxora-users-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(href)
}

async function loadUsers() {
    showUsersFeedback("Loading users...", "muted")

    try {
        const response = await fetch("/api/users")
        const payload = await response.json().catch(() => [])

        if (!response.ok) {
            throw new Error(payload?.error || "Unable to load users")
        }

        allUsers = Array.isArray(payload) ? payload : []
        handleUserFiltersChanged()
    } catch (err) {
        console.log("Users load error:", err)
        allUsers = []
        renderUserStats([], [])
        renderUserCards([])
        showUsersFeedback("Unable to load users right now.", "error")
    }
}

window.handleOrderFiltersChanged = handleOrderFiltersChanged
window.exportOrdersCsv = exportOrdersCsv
window.updateOrderStatus = updateOrderStatus
window.loadOrders = loadOrders

window.handleUserFiltersChanged = handleUserFiltersChanged
window.exportUsersCsv = exportUsersCsv
window.copyUserEmail = copyUserEmail

window.loadFooterSettings = loadFooterSettings
window.saveFooterSettings = saveFooterSettings
window.addFooterSection = addFooterSection
window.addFooterLinkRow = addFooterLinkRow
window.addFooterFeature = addFooterFeature
window.addFooterAppButton = addFooterAppButton
window.addFooterSocial = addFooterSocial
window.removeFooterEditorBlock = removeFooterEditorBlock

// ================= INIT =================

function initAdmin() {
    initializeCategoryControls()
    initializePopupInteractionBindings()
    syncAdminScrollLock()

    const bannerTypeSelect = document.getElementById("bannerType")
    if (bannerTypeSelect) {
        bannerTypeSelect.addEventListener("change", () => {
            resetBannerEditorState()
        })
    }
    resetBannerEditorState()

    const categoryCardGender = document.getElementById("categoryCardGender")
    if (categoryCardGender) {
        categoryCardGender.addEventListener("change", () => {
            populateCategoryCardOptions()
            if (!editingCategoryCardId) {
                resetCategoryCardEditorState()
                categoryCardGender.value = categoryCardGender.value || "men"
                populateCategoryCardOptions()
            }
        })
    }

    populateCategoryCardOptions()
    resetCategoryCardEditorState()
    if (categoryCardGender) {
        categoryCardGender.value = categoryCardGender.value || "men"
        populateCategoryCardOptions()
    }

    loadDashboard()
    loadProducts()
    loadBanners()
    loadCategoryCards()
    loadFooterSettings()
    loadCustomDesignRequests()
    loadOrders()
    loadUsers()

    const panelFromHash = getPanelFromHash()
    const initialPanel = panelFromHash || readPersistedPanel()
    switchPanel(initialPanel, null, { persist: true })
}

initAdmin()
