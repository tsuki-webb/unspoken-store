// ================= INIT =================
console.log("INDEX JS LOADED")

// ================= SLIDER =================
let currentSlide = 0
const slides = document.querySelectorAll(".slide")
const dots = document.querySelectorAll(".dot")

function showSlide(index){
    slides.forEach((slide, i) => {
        slide.classList.remove("active")
        if (dots[i]) dots[i].classList.remove("active")
    })

    if(slides[index]) slides[index].classList.add("active")
    if(dots[index]) dots[index].classList.add("active")

    currentSlide = index
}

function nextSlide(){
    if(slides.length === 0) return
    currentSlide = (currentSlide + 1) % slides.length
    showSlide(currentSlide)
}

function prevSlide(){
    if(slides.length === 0) return
    currentSlide = (currentSlide - 1 + slides.length) % slides.length
    showSlide(currentSlide)
}

function goToSlide(index){
    showSlide(index)
}

if (slides.length > 1) {
    setInterval(nextSlide, 4500)
}

// ================= NAVBAR SCROLL =================
let lastScroll = 0
const navbar = document.querySelector(".navbar")
const sideMenu = document.getElementById("sideMenu")
const overlay = document.getElementById("overlay")
const menuToggleBtn = document.getElementById("menuToggleBtn")
const menuSearchInput = document.getElementById("menuSearchInput")
const menuSearchBtn = document.getElementById("menuSearchBtn")
const menuSearchResults = document.getElementById("menuSearchResults")
const menuSearch = document.querySelector(".menu-search")
const menuFooterContact = document.getElementById("menuFooterContact")
const menuDynamicContent = document.getElementById("menuDynamicContent")
const homeSearchBox = document.getElementById("homeSearchBox")
const homeSearchInput = document.getElementById("homeSearchInput")
const homeSearchResults = document.getElementById("homeSearchResults")
const authOverlay = document.getElementById("authOverlay")
const mobileNavQuery = window.matchMedia("(max-width: 760px)")
let menuProductsCache = []
let menuCategoryCardsCache = []
let hasLoadedMenuProducts = false
let hasRenderedMenuSections = false
const STOREFRONT_ALLOWED_TYPES_BY_GENDER = {
    men: new Set(["tshirt", "shirt", "short", "sweatpant"]),
    women: new Set(["tshirt", "top", "sweatpant"]),
    unisex: new Set(["tshirt"])
}
const MENU_IMAGE_PLACEHOLDER = "https://via.placeholder.com/700x875?text=UNSPOKEN"
const MENU_COLLECTIONS = {
    men: {
        label: "Men",
        page: "men.html",
        headline: "Men's streetwear essentials",
        summary: "Oversized tees, sharp shirts, relaxed shorts, and sweatpants built for everyday movement.",
        categories: [
            {
                id: "tshirts",
                label: "T-Shirts",
                type: "tshirt",
                summary: "Core graphics and clean everyday fits.",
                subcategories: [
                    { label: "Oversized Fit", href: "men.html?fit=oversized#tshirts", fit: "oversized" },
                    { label: "Regular Fit", href: "men.html?fit=regular#tshirts", fit: "regular" }
                ]
            },
            { id: "shirts", label: "Shirts", type: "shirt", summary: "Layering pieces with a polished streetwear edge." },
            { id: "shorts", label: "Shorts", type: "short", summary: "Comfort-focused bottoms for off-duty styling." },
            { id: "sweatpants", label: "Sweatpants", type: "sweatpant", summary: "Soft utility for travel, lounges, and daily wear." }
        ]
    },
    women: {
        label: "Women",
        page: "women.html",
        headline: "Women's refined streetwear",
        summary: "Soft structure, expressive tees, elevated tops, and comfort bottoms in a cleaner edit.",
        categories: [
            {
                id: "tshirts",
                label: "T-Shirts",
                type: "tshirt",
                summary: "Graphic and essential tees across two fits.",
                subcategories: [
                    { label: "Oversized Fit", href: "women.html?fit=oversized#tshirts", fit: "oversized" },
                    { label: "Regular Fit", href: "women.html?fit=regular#tshirts", fit: "regular" }
                ]
            },
            { id: "tops", label: "Tops", type: "top", summary: "Polished essentials with effortless shape." },
            { id: "sweatpants", label: "Sweatpants", type: "sweatpant", summary: "Comfort pieces with clean everyday styling." }
        ]
    },
    unisex: {
        label: "Unisex",
        page: "unisex.html",
        headline: "Universal T-Shirt fits",
        summary: "Balanced silhouettes for shared wardrobes, clean graphics, and easy daily styling.",
        categories: [
            {
                id: "tshirts",
                label: "T-Shirts",
                type: "tshirt",
                summary: "Universal tees in oversized and regular fits.",
                subcategories: [
                    { label: "Oversized Fit", href: "unisex.html?fit=oversized#tshirts", fit: "oversized" },
                    { label: "Regular Fit", href: "unisex.html?fit=regular#tshirts", fit: "regular" }
                ]
            }
        ]
    }
}
const mobilePreviewAutoScrollers = new WeakMap()

function isStorefrontProductVisible(product) {
    const gender = String(product?.gender || "").trim().toLowerCase()
    const type = String(product?.type || "").trim().toLowerCase()
    const allowed = STOREFRONT_ALLOWED_TYPES_BY_GENDER[gender]
    if (!allowed) return true
    return allowed.has(type)
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

function isEnabledFlag(value) {
    if (typeof value === "boolean") return value
    if (typeof value === "number") return value === 1

    const normalized = String(value || "").trim().toLowerCase()
    return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on"
}

function isMenuOpen() {
    return !!sideMenu && sideMenu.classList.contains("active")
}

function isAuthOpen() {
    return !!authOverlay && authOverlay.classList.contains("active")
}

function syncPageScrollLock() {
    document.body.classList.toggle("no-scroll", isMenuOpen() || isAuthOpen())
}

function updateMenuUiState(open) {
    if (sideMenu) {
        sideMenu.classList.toggle("active", open)
        sideMenu.setAttribute("aria-hidden", open ? "false" : "true")
    }

    if (overlay) {
        overlay.classList.toggle("active", open)
    }

    if (menuToggleBtn) {
        menuToggleBtn.setAttribute("aria-expanded", open ? "true" : "false")
    }

    syncPageScrollLock()
}

window.addEventListener("scroll", () => {
    if (!navbar || isMenuOpen()) return

    if (window.innerWidth <= 900) {
        navbar.classList.remove("hide")
        lastScroll = window.pageYOffset
        return
    }

    const currentScroll = window.pageYOffset

    if (currentScroll <= 10) {
        navbar.classList.remove("hide")
        lastScroll = currentScroll
        return
    }

    if (currentScroll > lastScroll + 8) {
        navbar.classList.add("hide")
    } else if (currentScroll < lastScroll - 8) {
        navbar.classList.remove("hide")
    }

    lastScroll = currentScroll
})

// ================= MENU =================
function getMenuTypeLabel(type) {
    const normalized = String(type || "").trim().toLowerCase()
    if (normalized === "tshirt") return "T-SHIRT"
    if (normalized === "top") return "TOP"
    if (normalized === "shirt") return "SHIRT"
    if (normalized === "short") return "SHORTS"
    if (normalized === "sweatpant") return "SWEATPANTS"
    return normalized.toUpperCase()
}

function formatMenuProductType(product) {
    const gender = String(product.gender || "").toUpperCase()
    const type = getMenuTypeLabel(product.type)
    const fit = product.fit ? ` ${String(product.fit || "").toUpperCase()}` : ""
    return `${gender} | ${type}${fit}`.trim()
}

function getMatchingProducts(query, limit = 6) {
    const normalized = String(query || "").trim().toLowerCase()
    if (normalized.length < 2) return []

    return menuProductsCache
        .filter(product => {
            const name = String(product.name || "").toLowerCase()
            const type = String(product.type || "").toLowerCase()
            const typeLabel = getMenuTypeLabel(product.type).toLowerCase()
            const gender = String(product.gender || "").toLowerCase()
            const fit = String(product.fit || "").toLowerCase()

            return `${name} ${type} ${typeLabel} ${gender} ${fit}`.includes(normalized)
        })
        .slice(0, limit)
}

function renderMenuSearchResults(query = "") {
    if (!menuSearchResults) return

    const normalized = String(query || "").trim().toLowerCase()

    if (normalized.length < 2) {
        menuSearchResults.innerHTML = '<p class="menu-search-hint">Type at least 2 letters to search products.</p>'
        return
    }

    const matches = getMatchingProducts(normalized, 6)

    if (!matches.length) {
        menuSearchResults.innerHTML = '<p class="menu-search-hint">No matching products found.</p>'
        return
    }

    menuSearchResults.innerHTML = matches.map(product => `
        <a class="menu-search-item" href="product.html?id=${encodeURIComponent(String(product._id || ""))}">
            <img src="${escapeHtml(product.images?.[0] || product.image || "")}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">
            <div>
                <h4>${escapeHtml(product.name)}</h4>
                <p>${escapeHtml(formatMenuProductType(product))} | &#8377; ${escapeHtml(product.price)}</p>
            </div>
        </a>
    `).join("")
}

function renderHomeSearchResults(query = "") {
    if (!homeSearchResults) return

    const normalized = String(query || "").trim().toLowerCase()

    if (normalized.length < 2) {
        homeSearchResults.classList.remove("active")
        homeSearchResults.innerHTML = ""
        return
    }

    const matches = getMatchingProducts(normalized, 7)

    if (!matches.length) {
        homeSearchResults.classList.add("active")
        homeSearchResults.innerHTML = '<p class="home-search-hint">No products found.</p>'
        return
    }

    homeSearchResults.classList.add("active")
    homeSearchResults.innerHTML = matches.map(product => `
        <a class="home-search-item" href="product.html?id=${encodeURIComponent(String(product._id || ""))}">
            <img src="${escapeHtml(product.images?.[0] || product.image || "")}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">
            <div>
                <h4>${escapeHtml(product.name)}</h4>
                <p>${escapeHtml(formatMenuProductType(product))} | &#8377; ${escapeHtml(product.price)}</p>
            </div>
        </a>
    `).join("")
}

function closeHomeSearchResults() {
    if (!homeSearchResults) return
    homeSearchResults.classList.remove("active")
    homeSearchResults.innerHTML = ""
}

async function ensureMenuProductsLoaded() {
    if (hasLoadedMenuProducts) return

    hasLoadedMenuProducts = true

    try {
        const response = await fetch("/api/products")
        const products = await response.json()
        menuProductsCache = (Array.isArray(products) ? products : [])
            .filter(isStorefrontProductVisible)
    } catch (err) {
        console.log("Menu search load error:", err)
        menuProductsCache = []
        hasLoadedMenuProducts = false
    }
}

async function ensureMenuCategoryCardsLoaded() {
    if (Array.isArray(menuCategoryCardsCache) && menuCategoryCardsCache.length) return

    try {
        const response = await fetch("/api/category-cards")
        const cards = await response.json()
        menuCategoryCardsCache = Array.isArray(cards) ? cards : []
    } catch (err) {
        console.log("Menu category card load error:", err)
        menuCategoryCardsCache = []
    }
}

async function ensureMenuAssetsLoaded() {
    await Promise.all([
        ensureMenuProductsLoaded(),
        ensureMenuCategoryCardsLoaded()
    ])
    renderStoreMenuSections()
}

function getMenuProductsForCategory(gender, category, limit = 6) {
    return menuProductsCache
        .filter(product => {
            if (String(product?.gender || "").toLowerCase() !== gender) return false
            if (String(product?.type || "").toLowerCase() !== category.type) return false
            return true
        })
        .sort((a, b) => {
            const flagDiff = Number(isEnabledFlag(b?.newCollection)) - Number(isEnabledFlag(a?.newCollection))
            if (flagDiff !== 0) return flagDiff
            return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
        })
        .slice(0, limit)
}

function getMenuProductsForCollection(gender, limit = 4) {
    return menuProductsCache
        .filter(product => String(product?.gender || "").toLowerCase() === gender)
        .sort((a, b) => {
            const featuredDiff = Number(isEnabledFlag(b?.featured)) - Number(isEnabledFlag(a?.featured))
            if (featuredDiff !== 0) return featuredDiff
            const newDiff = Number(isEnabledFlag(b?.newCollection)) - Number(isEnabledFlag(a?.newCollection))
            if (newDiff !== 0) return newDiff
            return new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)
        })
        .slice(0, limit)
}

function findMenuCategoryCard(gender, categoryId) {
    return menuCategoryCardsCache.find(card => {
        return String(card?.gender || "").toLowerCase() === gender &&
            String(card?.categoryId || "").toLowerCase() === categoryId
    })
}

function getMenuCategoryImage(gender, category) {
    const categoryCard = findMenuCategoryCard(gender, category.id)
    if (categoryCard?.image) return categoryCard.image

    const product = getMenuProductsForCategory(gender, category, 1)[0]
    return product?.images?.[0] || product?.image || MENU_IMAGE_PLACEHOLDER
}

function getMenuProductImage(product) {
    return product?.images?.[0] || product?.image || MENU_IMAGE_PLACEHOLDER
}

function getCategoryHref(genderConfig, category) {
    return `${genderConfig.page}#${encodeURIComponent(category.id)}`
}

function renderMenuCategoryTiles(gender, genderConfig) {
    return genderConfig.categories.map(category => {
        const products = getMenuProductsForCategory(gender, category, 8)
        const categoryCard = findMenuCategoryCard(gender, category.id)
        const image = getMenuCategoryImage(gender, category)
        const title = categoryCard?.title || category.label
        const subtitle = categoryCard?.subtitle || category.summary
        const countLabel = products.length
            ? `${products.length} item${products.length === 1 ? "" : "s"}`
            : "Explore"

        return `
            <a class="menu-category-card" href="${escapeHtml(getCategoryHref(genderConfig, category))}">
                <span class="menu-category-media">
                    <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">
                </span>
                <span class="menu-category-copy">
                    <strong>${escapeHtml(title)}</strong>
                    <small>${escapeHtml(subtitle)}</small>
                    <em>${escapeHtml(countLabel)}</em>
                </span>
            </a>
        `
    }).join("")
}

function renderMenuFitLinks(category) {
    if (!Array.isArray(category.subcategories) || !category.subcategories.length) return ""

    return `
        <div class="menu-fit-links">
            ${category.subcategories.map(subcategory => `
                <a href="${escapeHtml(subcategory.href)}">${escapeHtml(subcategory.label)}</a>
            `).join("")}
        </div>
    `
}

function renderMenuAccordions(gender, genderConfig) {
    return genderConfig.categories.map((category, index) => {
        const products = getMenuProductsForCategory(gender, category, 3)
        const isOpen = index === 0 ? " open" : ""

        return `
            <details class="menu-accordion"${isOpen}>
                <summary>
                    <span>${escapeHtml(category.label)}</span>
                    <small>${escapeHtml(category.summary)}</small>
                </summary>
                ${renderMenuFitLinks(category)}
                <div class="menu-mini-products">
                    ${products.length ? products.map(product => `
                        <a class="menu-mini-product" href="product.html?id=${encodeURIComponent(String(product._id || ""))}">
                            <img src="${escapeHtml(getMenuProductImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">
                            <span>
                                <strong>${escapeHtml(product.name)}</strong>
                                <small>${escapeHtml(formatMenuProductType(product))}</small>
                            </span>
                        </a>
                    `).join("") : `
                        <a class="menu-mini-product empty" href="${escapeHtml(getCategoryHref(genderConfig, category))}">
                            <span>
                                <strong>Browse ${escapeHtml(category.label)}</strong>
                                <small>Open the full section to see available pieces.</small>
                            </span>
                        </a>
                    `}
                </div>
            </details>
        `
    }).join("")
}

function renderMenuSpotlight(gender, genderConfig) {
    const products = getMenuProductsForCollection(gender, 4)

    if (!products.length) {
        return `
            <a class="menu-hero-card" href="${escapeHtml(genderConfig.page)}">
                <span class="menu-hero-copy">
                    <small>${escapeHtml(genderConfig.label)} Edit</small>
                    <strong>${escapeHtml(genderConfig.headline)}</strong>
                    <em>${escapeHtml(genderConfig.summary)}</em>
                </span>
            </a>
        `
    }

    const mainProduct = products[0]

    return `
        <a class="menu-hero-card has-image" href="${escapeHtml(genderConfig.page)}">
            <img src="${escapeHtml(getMenuProductImage(mainProduct))}" alt="${escapeHtml(mainProduct.name)}" loading="lazy" decoding="async">
            <span class="menu-hero-copy">
                <small>${escapeHtml(genderConfig.label)} Edit</small>
                <strong>${escapeHtml(genderConfig.headline)}</strong>
                <em>${escapeHtml(genderConfig.summary)}</em>
            </span>
        </a>
        <div class="menu-product-strip" aria-label="${escapeHtml(genderConfig.label)} featured products">
            ${products.map(product => `
                <a href="product.html?id=${encodeURIComponent(String(product._id || ""))}">
                    <img src="${escapeHtml(getMenuProductImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">
                    <span>${escapeHtml(product.name)}</span>
                </a>
            `).join("")}
        </div>
    `
}

function renderStoreMenuSections() {
    Object.entries(MENU_COLLECTIONS).forEach(([gender, genderConfig]) => {
        const panel = document.getElementById(gender)
        if (!panel) return

        panel.innerHTML = `
            <div class="menu-section-stack">
                ${renderMenuSpotlight(gender, genderConfig)}

                <section class="menu-visual-section" aria-label="${escapeHtml(genderConfig.label)} categories">
                    <div class="menu-section-head">
                        <span>Shop by category</span>
                        <a href="${escapeHtml(genderConfig.page)}">View all</a>
                    </div>
                    <div class="menu-category-grid">
                        ${renderMenuCategoryTiles(gender, genderConfig)}
                    </div>
                </section>

                <section class="menu-visual-section" aria-label="${escapeHtml(genderConfig.label)} quick links">
                    <div class="menu-section-head">
                        <span>Refine the edit</span>
                    </div>
                    <div class="menu-accordion-stack">
                        ${renderMenuAccordions(gender, genderConfig)}
                    </div>
                </section>

                <div class="menu-service-links">
                    <a href="custom-design.html">Custom T-Shirt Studio</a>
                    <a href="index.html#featuredProducts">New Collection</a>
                </div>
            </div>
        `
    })

    hasRenderedMenuSections = true
}

function initializeMenuInteractions() {
    if (menuSearchInput) {
        menuSearchInput.addEventListener("input", async () => {
            await ensureMenuProductsLoaded()
            renderMenuSearchResults(menuSearchInput.value)
        })

        menuSearchInput.addEventListener("focus", async () => {
            await ensureMenuProductsLoaded()
            renderMenuSearchResults(menuSearchInput.value)
        })

        menuSearchInput.addEventListener("keydown", async event => {
            if (event.key !== "Enter") return
            event.preventDefault()
            await ensureMenuProductsLoaded()
            renderMenuSearchResults(menuSearchInput.value)
        })
    }

    if (menuSearchBtn) {
        menuSearchBtn.addEventListener("click", async () => {
            await ensureMenuProductsLoaded()
            renderMenuSearchResults(menuSearchInput?.value || "")
            menuSearchInput?.focus()
        })
    }

    if (menuDynamicContent) {
        let menuLastScrollTop = 0

        menuDynamicContent.addEventListener("scroll", () => {
            const scrollTop = menuDynamicContent.scrollTop
            const scrollHeight = menuDynamicContent.scrollHeight
            const clientHeight = menuDynamicContent.clientHeight

            if (menuSearch) {
                if (scrollTop > menuLastScrollTop + 6) {
                    menuSearch.classList.add("menu-search-hidden")
                } else if (scrollTop < menuLastScrollTop - 6 || scrollTop <= 10) {
                    menuSearch.classList.remove("menu-search-hidden")
                }
            }

            const atBottom = scrollTop + clientHeight >= scrollHeight - 6
            if (menuFooterContact) {
                menuFooterContact.classList.toggle("active", atBottom)
            }

            menuLastScrollTop = scrollTop
        })
    }

    if (homeSearchInput) {
        homeSearchInput.addEventListener("input", async () => {
            await ensureMenuProductsLoaded()
            renderHomeSearchResults(homeSearchInput.value)
        })

        homeSearchInput.addEventListener("focus", async () => {
            await ensureMenuProductsLoaded()
            renderHomeSearchResults(homeSearchInput.value)
        })
    }

    if (sideMenu) {
        sideMenu.addEventListener("click", event => {
            const link = event.target.closest("a")
            if (!link) return
            toggleMenu(false)
        })
    }

    document.addEventListener("click", event => {
        const clickedInHomeSearch = homeSearchBox?.contains(event.target)
        if (!clickedInHomeSearch) {
            closeHomeSearchResults()
        }

        const profileWrapper = document.getElementById("profileWrapper")
        const clickedInProfileMenu = profileWrapper?.contains(event.target)
        if (!clickedInProfileMenu) {
            closeProfileMenu()
        }
    })

    window.addEventListener("keydown", event => {
        if (event.key !== "Escape") return

        if (isMenuOpen()) {
            toggleMenu(false)
        }

        if (isAuthOpen()) {
            closeAuth()
        }

        closeProfileMenu()
        closeHomeSearchResults()
    })
}

initializeMenuInteractions()
syncPageScrollLock()

async function toggleMenu(forceOpen){
    const open = typeof forceOpen === "boolean" ? forceOpen : !isMenuOpen()

    if (open) {
        closeProfileMenu()
        closeHomeSearchResults()

        if (menuSearch) {
            menuSearch.classList.remove("menu-search-hidden")
        }

        if (menuFooterContact && menuDynamicContent) {
            const atBottom = menuDynamicContent.scrollTop + menuDynamicContent.clientHeight >= menuDynamicContent.scrollHeight - 6
            menuFooterContact.classList.toggle("active", atBottom)
        }
    }

    updateMenuUiState(open)

    if (!open) {
        return
    }

    if (menuSearchResults && !menuSearchResults.innerHTML.trim()) {
        renderMenuSearchResults("")
    }

    await ensureMenuAssetsLoaded()

    if (menuSearchInput) {
        renderMenuSearchResults(menuSearchInput.value)
        menuSearchInput.focus()
    }
}

// ================= AUTH =================
window.openAuth = function() {
    closeProfileMenu()

    if (isMenuOpen()) {
        toggleMenu(false)
    }

    if (authOverlay) {
        authOverlay.classList.add("active")
    }

    setAuthMode("login")
    syncPageScrollLock()
}

window.closeAuth = function() {
    if (authOverlay) {
        authOverlay.classList.remove("active")
    }

    syncPageScrollLock()
}

if (authOverlay) {
    authOverlay.addEventListener("click", event => {
        if (event.target !== authOverlay) return
        closeAuth()
    })
}

window.googleLogin = window.googleLogin || function () {
    alert("Google Sign-In is loading. Please try again.")
}

function setAuthMode(mode = "login") {
    const normalizedMode = mode === "signup" ? "signup" : "login"

    document.querySelectorAll("[data-auth-mode-btn]").forEach(button => {
        button.classList.toggle("active", button.dataset.authModeBtn === normalizedMode)
    })

    document.querySelectorAll("[data-auth-view]").forEach(view => {
        view.classList.toggle("active", view.dataset.authView === normalizedMode)
    })

    setAuthMethod(normalizedMode, "email")
}

function setAuthMethod(mode = "login", method = "email") {
    const normalizedMode = mode === "signup" ? "signup" : "login"
    const normalizedMethod = ["email", "google", "phone"].includes(method) ? method : "email"
    const key = `${normalizedMode}-${normalizedMethod}`

    document.querySelectorAll(`[data-auth-method-btn^="${normalizedMode}-"]`).forEach(button => {
        button.classList.toggle("active", button.dataset.authMethodBtn === key)
    })

    document.querySelectorAll(`[data-auth-method^="${normalizedMode}-"]`).forEach(panel => {
        panel.classList.toggle("active", panel.dataset.authMethod === key)
    })
}

function startPhoneAuth(mode = "login") {
    const inputId = mode === "signup" ? "signupOtpPhone" : "loginPhone"
    const phone = String(document.getElementById(inputId)?.value || "").trim()

    if (!phone) {
        alert("Enter your phone number first.")
        return
    }

    alert("Phone OTP is ready in the UI, but Firebase Phone Authentication still needs to be enabled and connected before OTPs can be sent.")
}

function verifyPhoneOtp() {
    alert("Phone OTP is still loading. Please try again in a moment.")
}

window.setAuthMode = setAuthMode
window.setAuthMethod = setAuthMethod
window.startPhoneAuth = startPhoneAuth
window.verifyPhoneOtp = verifyPhoneOtp

// ================= MENU TABS =================
function switchTab(tabId, clickEvent){
    if (!hasRenderedMenuSections) {
        ensureMenuAssetsLoaded()
    }

    document.querySelectorAll(".tab").forEach(btn => btn.classList.remove("active"))
    document.querySelectorAll(".menu-content").forEach(c => c.classList.remove("active"))

    const panel = document.getElementById(tabId)
    if(panel) panel.classList.add("active")

    const clickedTab = clickEvent?.currentTarget || document.querySelector(`.tab[data-tab="${tabId}"]`)
    if(clickedTab){
        clickedTab.classList.add("active")
    }
}

function setLocalUserState(user) {
    const email = String(user?.email || "").trim().toLowerCase()
    if (!email) return

    localStorage.setItem("userEmail", email)

    const name = String(user?.name || "").trim()
    if (name) {
        localStorage.setItem("userName", name)
    } else if (!localStorage.getItem("userName")) {
        localStorage.setItem("userName", email.split("@")[0])
    }

    const photo = String(user?.photo || "").trim()
    if (photo) {
        localStorage.setItem("userPhoto", photo)
    }

    const phone = String(user?.phone || "").trim()
    if (phone) {
        localStorage.setItem("userPhone", phone)
    }
}

function clearLocalUserState() {
    localStorage.removeItem("userEmail")
    localStorage.removeItem("userName")
    localStorage.removeItem("userPhoto")
    localStorage.removeItem("userPhone")
}

function getRedirectAfterAuth() {
    const params = new URLSearchParams(window.location.search)
    const next = String(params.get("next") || "").trim()
    if (!next || !next.startsWith("/") || next.startsWith("//")) return ""
    return next
}

function applyPostAuthRedirect() {
    const next = getRedirectAfterAuth()
    if (!next) return false
    window.location.href = next
    return true
}

async function syncAuthStateFromBackend() {
    if (!window.LuxoraCart?.refreshSession) {
        updateNavbarUserState()
        return
    }

    try {
        const payload = await window.LuxoraCart.refreshSession({ silent: true })
        if (payload?.authenticated && payload?.user) {
            setLocalUserState(payload.user)
        } else if (payload?.authenticated === false) {
            clearLocalUserState()
        }
    } catch (err) {
        console.log("Auth session sync error:", err)
    }

    updateNavbarUserState()
}

// ================= SIGNUP =================
async function signup() {
    const name = String(document.getElementById("signupName")?.value || "").trim()
    const email = String(document.getElementById("signupEmail").value || "").trim()
    const password = String(document.getElementById("signupPassword").value || "").trim()
    const phone = String(document.getElementById("signupPhone")?.value || "").trim()
    const wantsUpdates = !!document.getElementById("signupUpdates")?.checked

    if (!name || !email || !password) {
        alert("Please fill your name, email, and password.")
        return
    }

    if (password.length < 6) {
        alert("Password should be at least 6 characters.")
        return
    }

    try {
        const res = await fetch("/api/auth/signup", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                email,
                password,
                name,
                phone,
                wantsUpdates
            })
        })

        const data = await res.json()
        if (!res.ok || !data.success) {
            alert(data.message || "Signup failed")
            return
        }

        if (data.user) {
            setLocalUserState(data.user)
        } else {
            setLocalUserState({ email })
        }

        await syncAuthStateFromBackend()
        window.LuxoraCart?.refreshCartCount()
        alert(data.message || "Account created")
        closeAuth()

        if (applyPostAuthRedirect()) return

    } catch (error) {
        console.log(error)
        alert("Signup failed")
    }
}

// ================= LOGIN =================
async function login() {
    const email = String(document.getElementById("loginEmail").value || "").trim()
    const password = String(document.getElementById("loginPassword").value || "").trim()

    if (!email || !password) {
        alert("Please fill all fields")
        return
    }

    try {
        const res = await fetch("/api/auth/login", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        })

        const data = await res.json()

        if (res.ok && data.success) {
            if (data.user) {
                setLocalUserState(data.user)
            } else {
                setLocalUserState({ email })
            }

            await syncAuthStateFromBackend()
            window.LuxoraCart?.refreshCartCount()
            alert(data.message || "Login successful")
            closeAuth()

            if (applyPostAuthRedirect()) return
        } else {
            alert(data.message || "Login failed")
        }

    } catch (error) {
        console.log(error)
        alert("Login failed")
    }
}

// ================= USER UI =================
function updateNavbarUserState(){
    const backendUser = window.LuxoraCart?.getUser?.() || null
    if (backendUser?.email) {
        setLocalUserState(backendUser)
    }

    const userName = backendUser?.name || localStorage.getItem("userName")
    const userEmail = backendUser?.email || localStorage.getItem("userEmail")
    const userPhoto = backendUser?.photo || localStorage.getItem("userPhoto")
    const userPhone = backendUser?.phone || localStorage.getItem("userPhone")
    const derivedName = userName || (userEmail ? String(userEmail).split("@")[0] : "")
    const isSignedIn = !!userEmail
    const displayContact = String(userEmail || "").endsWith("@phone.unspoken.local") && userPhone
        ? userPhone
        : userEmail

    const signinBtn = document.getElementById("signinBtn")
    const profileWrapper = document.getElementById("profileWrapper")
    const profileCircle = document.querySelector(".profile-circle")
    const profileMenuName = document.getElementById("profileMenuName")
    const profileMenuEmail = document.getElementById("profileMenuEmail")

    const showMobileProfile = mobileNavQuery.matches

    if(isSignedIn){
        if(signinBtn) signinBtn.style.display = "none"
        if(profileWrapper) profileWrapper.style.display = "flex"

        if(userPhoto && profileCircle){
            profileCircle.innerHTML = `<img src="${userPhoto}" alt="User profile" style="width:100%;height:100%;border-radius:50%">`
            profileCircle.setAttribute("aria-label", "Open account menu")
        } else if (profileCircle) {
            profileCircle.textContent = derivedName.charAt(0).toUpperCase()
            profileCircle.setAttribute("aria-label", "Open account menu")
        }

        if (profileMenuName) {
            profileMenuName.textContent = derivedName
        }

        if (profileMenuEmail) {
            profileMenuEmail.textContent = displayContact || "Signed in"
        }
    } else {
        if(signinBtn) signinBtn.style.display = showMobileProfile ? "none" : "inline-block"
        if(profileWrapper) profileWrapper.style.display = showMobileProfile ? "flex" : "none"

        if (profileCircle) {
            profileCircle.textContent = "U"
            profileCircle.setAttribute("aria-label", "Sign in")
        }

        if (profileMenuName) {
            profileMenuName.textContent = "My Account"
        }

        if (profileMenuEmail) {
            profileMenuEmail.textContent = "Sign in to continue"
        }
    }

    // If user signed-in state changed, refresh wishlist UI
    if (typeof loadUserWishlist === "function") {
        setTimeout(() => loadUserWishlist(), 160)
    }

    if (document.body?.classList.contains("auth-pending")) {
        document.body.classList.remove("auth-pending")
    }
}

function closeProfileMenu(){
    const menu = document.getElementById("profileMenu")
    const trigger = document.querySelector(".profile-circle")
    if(menu) menu.classList.remove("active")
    if (trigger) trigger.setAttribute("aria-expanded", "false")
}

function toggleProfileMenu(){
    const menu = document.getElementById("profileMenu")
    const trigger = document.querySelector(".profile-circle")
    if(!menu) return

    const userEmail = window.LuxoraCart?.getUser?.()?.email || localStorage.getItem("userEmail")
    if (!userEmail) {
        closeProfileMenu()
        openAuth()
        return
    }

    const isOpen = !menu.classList.contains("active")
    if (isOpen) {
        if (isMenuOpen()) toggleMenu(false)
        closeHomeSearchResults()
    }

    menu.classList.toggle("active", isOpen)
    if (trigger) trigger.setAttribute("aria-expanded", isOpen ? "true" : "false")
}

function viewMyAccount() {
    const backendUser = window.LuxoraCart?.getUser?.() || null
    const email = backendUser?.email || localStorage.getItem("userEmail")

    if (!email) {
        closeProfileMenu()
        openAuth()
        return
    }

    const name = backendUser?.name || localStorage.getItem("userName") || String(email).split("@")[0]
    const provider = backendUser?.provider || "email"

    alert(`Account\n\nName: ${name}\nEmail: ${email}\nProvider: ${provider}`)
    closeProfileMenu()
}

async function logout(options = {}){
    const silent = !!options.silent
    closeProfileMenu()

    if (window.LuxoraCart?.logout) {
        await window.LuxoraCart.logout()
    } else {
        try {
            await fetch("/api/auth/logout", {
                method: "POST",
                credentials: "same-origin"
            })
        } catch (err) {
            console.log("Logout request error:", err)
        }
    }

    clearLocalUserState()
    updateNavbarUserState()
    window.LuxoraCart?.refreshCartCount()
    if (!silent) {
        alert("Logged out")
    }
}

async function switchAccount(){
    closeProfileMenu()
    await logout({ silent: true })
    openAuth()
}

window.updateNavbarUserState = updateNavbarUserState
window.toggleProfileMenu = toggleProfileMenu
window.closeProfileMenu = closeProfileMenu
window.viewMyAccount = viewMyAccount
window.logout = logout
window.switchAccount = switchAccount

if (typeof mobileNavQuery.addEventListener === "function") {
    mobileNavQuery.addEventListener("change", updateNavbarUserState)
}

window.quickAddToCart = async function(productId, buttonEl) {
    if (!window.LuxoraCart?.addItem) return

    const button = buttonEl instanceof HTMLButtonElement ? buttonEl : null
    const initialLabel = button ? button.textContent : ""

    try {
        if (button) {
            button.disabled = true
            button.textContent = "Adding..."
        }

        await window.LuxoraCart.addItem({
            productId,
            quantity: 1,
            size: "M"
        })

        if (button) {
            button.textContent = "Added"
        }
    } catch (err) {
        if (button) {
            button.textContent = String(err?.message || "") === "signin-required"
                ? "Sign In"
                : "Retry"
        }
    } finally {
        setTimeout(() => {
            if (button) {
                button.disabled = false
                button.textContent = initialLabel || "Add to Cart"
            }
        }, 900)
    }
}

function renderHomeProductCard(product) {
    const productIdRaw = String(product?._id || "")
    const productId = encodeURIComponent(productIdRaw)
    const productName = escapeHtml(product?.name || "Store Product")
    const productImage = escapeHtml(product?.images?.[0] || product?.image || "")
    const productPrice = escapeHtml(product?.price)
    const productMeta = escapeHtml(formatMenuProductType(product))
    const badges = [
        isEnabledFlag(product?.newCollection) ? '<span class="home-product-badge new">New</span>' : "",
        isEnabledFlag(product?.featured) ? '<span class="home-product-badge featured">Featured</span>' : ""
    ].filter(Boolean).join("")

    return `
        <article class="product-card" data-product-id="${productId}" onclick="window.location.href='product.html?id=${productId}'">
            <div class="home-product-media">
                <img src="${productImage}" alt="${productName}" loading="lazy" decoding="async">
                ${badges ? `<div class="home-product-badges">${badges}</div>` : ""}
                <button class="wishlist-btn" type="button" data-product-id="${productIdRaw}" onclick="event.stopPropagation(); toggleWishlist('${productIdRaw}', this)" aria-label="Toggle wishlist">
                    <span class="heart">&#9825;</span>
                </button>
            </div>
            <div class="home-product-copy">
                <h4>${productName}</h4>
                <p class="home-product-meta">${productMeta}</p>
                <div class="home-product-footer">
                    <span>&#8377; ${productPrice}</span>
                    <button class="home-add-cart-btn" type="button" onclick="event.stopPropagation(); quickAddToCart('${escapeHtml(String(product?._id || ""))}', this)">Add to Cart</button>
                </div>
            </div>
        </article>
    `
}

// ----------------- Wishlist client handlers -----------------
window.userWishlist = new Set()

async function loadUserWishlist() {
    try {
        const localEmail = localStorage.getItem("userEmail") || ""
        const backendEmail = (window.LuxoraCart?.getUser?.() || {}).email || ""
        const userEmail = localEmail || backendEmail || ""
        const query = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : ""
        const headers = {}
        if (userEmail) headers["x-user-email"] = userEmail
        const res = await fetch(`/api/wishlist${query}`, { credentials: "include", headers })
        if (!res.ok) return
        const data = await res.json()
        if (!Array.isArray(data)) return
        window.userWishlist = new Set(data.map(p => String(p._id || p)))

        // mark buttons on page
        document.querySelectorAll(".wishlist-btn").forEach(btn => {
            const pid = String(btn.dataset.productId || "")
            if (window.userWishlist.has(pid)) btn.classList.add("active")
            else btn.classList.remove("active")
        })

        // update navbar badge if present
        const badge = document.querySelector("[data-wishlist-count]")
        if (badge) {
            const count = window.userWishlist.size || 0
            badge.textContent = String(count)
            badge.classList.toggle("hidden", count === 0)
        }

        window.dispatchEvent(new CustomEvent("luxora:wishlist-loaded", {
            detail: {
                ids: Array.from(window.userWishlist)
            }
        }))
    } catch (err) {
        console.log("loadUserWishlist error:", err)
    }
}

async function toggleWishlist(productId, el) {
    try {
        const localEmail = localStorage.getItem("userEmail") || ""
        const backendEmail = (window.LuxoraCart?.getUser?.() || {}).email || ""
        const userEmail = localEmail || backendEmail || ""

        if (!userEmail) {
            // prompt sign in first
            if (typeof openAuth === "function") openAuth()
            else alert("Please sign in to save items to your wishlist.")
            return
        }

        const headers = { "Content-Type": "application/json", "x-user-email": userEmail }

        const res = await fetch(`/api/wishlist/toggle`, {
            method: "POST",
            credentials: "include",
            headers,
            body: JSON.stringify({ productId, userEmail })
        })

        let payload = null
        try { payload = await res.json() } catch (e) { payload = null }

        if (!res.ok) {
            const serverMsg = payload?.message || payload?.error || (await res.text().catch(() => ""))
            console.error("Wishlist toggle failed:", res.status, serverMsg, payload)
            if (res.status === 401) {
                alert(serverMsg || "Please sign in to save items to your wishlist.")
                if (typeof openAuth === "function") openAuth()
                return
            }

            alert(serverMsg || "Unable to update wishlist. Please try again.")
            return
        }
        const ids = Array.isArray(payload?.wishlist) ? payload.wishlist.map(p => String(p._id || p)) : []
        window.userWishlist = new Set(ids)

        // update button states
        document.querySelectorAll(`.wishlist-btn[data-product-id]`).forEach(btn => {
            const pid = String(btn.dataset.productId || "")
            if (window.userWishlist.has(pid)) btn.classList.add("active")
            else btn.classList.remove("active")
        })
        const badge = document.querySelector("[data-wishlist-count]")
        if (badge) {
            const count = window.userWishlist.size || 0
            badge.textContent = String(count)
            badge.classList.toggle("hidden", count === 0)
        }

        window.dispatchEvent(new CustomEvent("luxora:wishlist-updated", {
            detail: {
                ids,
                productId: String(productId || ""),
                wishlist: payload?.wishlist || []
            }
        }))

        return payload
    } catch (err) {
        console.log("toggleWishlist error:", err)
        return null
    }
}

window.loadUserWishlist = loadUserWishlist
window.toggleWishlist = toggleWishlist

// Call loadUserWishlist once DOM is ready and after auth sync
document.addEventListener("DOMContentLoaded", () => {
    // small timeout to let other page scripts sync auth
    setTimeout(() => loadUserWishlist(), 120)
})

// ================= NEW COLLECTION =================
async function loadNewCollection() {
    try {
        const res = await fetch("/api/products")
        const data = await res.json()

        function getPriorityValue(value) {
            const parsed = Number.parseInt(String(value ?? ""), 10)
            if (Number.isNaN(parsed) || parsed < 1) return Number.MAX_SAFE_INTEGER
            return parsed
        }

        const filtered = data
            .filter(isStorefrontProductVisible)
            .filter(p => isEnabledFlag(p.newCollection))
            .sort((a, b) => {
                const priorityDiff =
                    getPriorityValue(a.newCollectionPriority) - getPriorityValue(b.newCollectionPriority)

                if (priorityDiff !== 0) {
                    return priorityDiff
                }

                return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
            })

        const container = document.getElementById("featuredProducts")
        if(!container) return

        container.innerHTML = ""

        const topItems = filtered.slice(0, 6)
        const bottomItems = filtered.slice(6, 12)

        container.innerHTML = `
            <div class="featured-products-stack">
                ${topItems.length ? `
                    <div class="featured-row">
                        ${topItems.map(renderHomeProductCard).join("")}
                    </div>
                ` : ""}
                ${bottomItems.length ? `
                    <div class="featured-row">
                        ${bottomItems.map(renderHomeProductCard).join("")}
                    </div>
                ` : ""}
            </div>



        `

    } catch (err) {
        console.log("New collection error:", err)
    }
}

// ================= PREVIEW =================
async function loadPreview(gender, containerId) {
    try {
        const res = await fetch(`/api/products`)
        const data = await res.json()

        const filtered = data
            .filter(isStorefrontProductVisible)
            .filter(p => p.gender === gender && p.featured === true)
            .slice(0, 4)

        const container = document.getElementById(containerId)
        if(!container) return

        container.innerHTML = ""

        filtered.forEach(p => {
           container.innerHTML += renderHomeProductCard(p)
        })

        setupMobilePreviewAutoScroll(container)

    } catch (err) {
        console.log("Preview error:", err)
    }
}

function setupMobilePreviewAutoScroll(row) {
    if (!row || mobilePreviewAutoScrollers.has(row)) return

    const mobileQuery = window.matchMedia("(max-width: 760px)")
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    let index = 0
    let isPaused = false
    let scrollSyncTimer = null

    function cards() {
        return Array.from(row.querySelectorAll(".product-card"))
    }

    function scrollToCard(card, behavior = "smooth") {
        if (!card) return
        row.scrollTo({
            left: Math.max(0, card.offsetLeft - row.offsetLeft - 2),
            behavior
        })
    }

    function syncToNearestCard() {
        const items = cards()
        if (!items.length) return

        const rowLeft = row.scrollLeft
        let closestIndex = 0
        let closestDistance = Number.POSITIVE_INFINITY

        items.forEach((card, cardIndex) => {
            const distance = Math.abs((card.offsetLeft - row.offsetLeft) - rowLeft)
            if (distance < closestDistance) {
                closestDistance = distance
                closestIndex = cardIndex
            }
        })

        index = closestIndex
    }

    const timer = window.setInterval(() => {
        const items = cards()
        if (
            !mobileQuery.matches ||
            reduceMotionQuery.matches ||
            isPaused ||
            items.length <= 2 ||
            document.hidden
        ) {
            return
        }

        index = (index + 1) % items.length
        scrollToCard(items[index])
    }, 3600)

    row.addEventListener("pointerdown", () => {
        isPaused = true
    })

    row.addEventListener("pointerup", () => {
        syncToNearestCard()
        window.setTimeout(() => {
            isPaused = false
        }, 1600)
    })

    row.addEventListener("pointercancel", () => {
        isPaused = false
    })

    row.addEventListener("focusin", () => {
        isPaused = true
    })

    row.addEventListener("focusout", () => {
        syncToNearestCard()
        isPaused = false
    })

    row.addEventListener("scroll", () => {
        if (!mobileQuery.matches) return
        window.clearTimeout(scrollSyncTimer)
        scrollSyncTimer = window.setTimeout(syncToNearestCard, 140)
    }, { passive: true })

    if (typeof mobileQuery.addEventListener === "function") {
        mobileQuery.addEventListener("change", event => {
            if (!event.matches) {
                row.scrollTo({ left: 0, behavior: "auto" })
                index = 0
            }
        })
    }

    mobilePreviewAutoScrollers.set(row, timer)
}

// ================= BANNERS =================
async function loadBanners() {
    try {
        const res = await fetch("/api/banners")
        const banners = await res.json()

        banners.forEach(b => {

            if (b.type === "homeHero1") {
                const el = document.getElementById("hero1")
                if (el) el.src = b.image
            }

            if (b.type === "homeHero2") {
                const el = document.getElementById("hero2")
                if (el) el.src = b.image
            }

            if (b.type === "homeHero3") {
                const el = document.getElementById("hero3")
                if (el) el.src = b.image
            }

            if (b.type === "homeCollection") {
                const el = document.getElementById("collectionBanner")
                if (el) el.src = b.image
            }

            if (b.type === "homeMenSection") {
                const el = document.getElementById("menBanner")
                if (el) el.src = b.image
            }

            if (b.type === "homeWomenSection") {
                const el = document.getElementById("womenBanner")
                if (el) el.src = b.image
            }

            if (b.type === "homeUnisexSection") {
                const el = document.getElementById("unisexBanner")
                if (el) el.src = b.image
            }

            if (b.type === "homeCustomDesign") {
                const el = document.getElementById("customDesignBanner")
                if (el) el.src = b.image
            }

        })

    } catch (err) {
        console.log("Banner load error:", err)
    }
}
const fadeElements = document.querySelectorAll(".fade-up")

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = "1"
            entry.target.style.transform = "translateY(0)"
        }
    })
})

fadeElements.forEach(el => observer.observe(el))


// ================= TIMER =================
function startCountdown() {
    const totalSeconds = 24 * 60 * 60
    let timeLeft = localStorage.getItem("luxoraTimer")

    if (!timeLeft) timeLeft = totalSeconds
    else timeLeft = parseInt(timeLeft)

    function updateTimer(){
        const hoursEl = document.getElementById("hours")
        const minutesEl = document.getElementById("minutes")
        const secondsEl = document.getElementById("seconds")
        if (!hoursEl || !minutesEl || !secondsEl) return

        let h = Math.floor(timeLeft / 3600)
        let m = Math.floor((timeLeft % 3600) / 60)
        let s = timeLeft % 60

        hoursEl.innerText = String(h).padStart(2, '0')
        minutesEl.innerText = String(m).padStart(2, '0')
        secondsEl.innerText = String(s).padStart(2, '0')

        timeLeft--

        if (timeLeft < 0) timeLeft = totalSeconds

        localStorage.setItem("luxoraTimer", timeLeft)
    }

    updateTimer()
    setInterval(updateTimer, 1000)
}

function bindHomeEnhancements() {
    const reviewButton = document.querySelector(".thoughts-btn")
    reviewButton?.addEventListener("click", () => {
        document.getElementById("footerContact")?.scrollIntoView({ behavior: "smooth", block: "start" })
    })

    window.addEventListener("keydown", event => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
        if (event.key === "ArrowLeft") prevSlide()
        if (event.key === "ArrowRight") nextSlide()
    })
}




// ================= INIT =================
window.addEventListener("load", async () => {
    await syncAuthStateFromBackend()
    window.LuxoraCart?.refreshCartCount()

    const params = new URLSearchParams(window.location.search)
    if (params.get("signin") === "1") {
        openAuth()
    }
})
window.addEventListener("load", () => {
    loadNewCollection()
    loadPreview("men", "menPreview")
    loadPreview("women", "womenPreview")
    loadPreview("unisex", "unisexPreview")
    loadBanners()
    startCountdown()
    bindHomeEnhancements()
})

// ================= MOBILE REVIEWS AUTO SCROLL =================

// ================= MOBILE REVIEWS AUTO SLIDER =================

function startVoicesAutoSlider() {

    if (window.innerWidth > 980) return

    const rows = document.querySelectorAll(".voices-row")

    rows.forEach(row => {

        const cards = row.querySelectorAll(".voice-card, .thoughts-card")

        if (!cards.length) return

        let index = 0

        setInterval(() => {

            index++

            if (index >= cards.length) {
                index = 0
            }

            const card = cards[index]

            row.scrollTo({
                left: card.offsetLeft - 12,
                behavior: "smooth"
            })

        }, 3200)

    })
}

window.addEventListener("load", startVoicesAutoSlider)
