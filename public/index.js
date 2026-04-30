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
const homeSearchBox = document.getElementById("homeSearchBox")
const homeSearchInput = document.getElementById("homeSearchInput")
const homeSearchResults = document.getElementById("homeSearchResults")
const authOverlay = document.getElementById("authOverlay")
let menuProductsCache = []
let hasLoadedMenuProducts = false
const STOREFRONT_ALLOWED_TYPES_BY_GENDER = {
    men: new Set(["tshirt", "shirt", "short", "sweatpant"]),
    women: new Set(["tshirt", "top", "sweatpant"]),
    unisex: new Set(["tshirt"])
}

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
            const subtitle = String(product.subtitle || "").toLowerCase()
            const type = String(product.type || "").toLowerCase()
            const typeLabel = getMenuTypeLabel(product.type).toLowerCase()
            const gender = String(product.gender || "").toLowerCase()
            const fit = String(product.fit || "").toLowerCase()

            return `${name} ${subtitle} ${type} ${typeLabel} ${gender} ${fit}`.includes(normalized)
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
        <a class="menu-search-item" href="product.html?id=${product._id}">
            <img src="${product.images?.[0] || product.image}" alt="${product.name}">
            <div>
                <h4>${product.name}</h4>
                <p>${formatMenuProductType(product)} | &#8377; ${product.price}</p>
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
        <a class="home-search-item" href="product.html?id=${product._id}">
            <img src="${product.images?.[0] || product.image}" alt="${product.name}">
            <div>
                <h4>${product.name}</h4>
                <p>${formatMenuProductType(product)} | &#8377; ${product.price}</p>
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
    }

    updateMenuUiState(open)

    if (!open) {
        return
    }

    if (menuSearchResults && !menuSearchResults.innerHTML.trim()) {
        renderMenuSearchResults("")
    }

    await ensureMenuProductsLoaded()

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

// ================= MENU TABS =================
function switchTab(tabId, clickEvent){
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
}

function clearLocalUserState() {
    localStorage.removeItem("userEmail")
    localStorage.removeItem("userName")
    localStorage.removeItem("userPhoto")
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
    const email = String(document.getElementById("signupEmail").value || "").trim()
    const password = String(document.getElementById("signupPassword").value || "").trim()

    if (!email || !password) {
        alert("Please fill all fields")
        return
    }

    try {
        const res = await fetch("/api/auth/signup", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
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
    const derivedName = userName || (userEmail ? String(userEmail).split("@")[0] : "")

    const signinBtn = document.getElementById("signinBtn")
    const profileWrapper = document.getElementById("profileWrapper")
    const profileCircle = document.querySelector(".profile-circle")
    const profileMenuName = document.getElementById("profileMenuName")
    const profileMenuEmail = document.getElementById("profileMenuEmail")

    if(derivedName){
        if(signinBtn) signinBtn.style.display = "none"
        if(profileWrapper) profileWrapper.style.display = "flex"

        if(userPhoto && profileCircle){
            profileCircle.innerHTML = `<img src="${userPhoto}" alt="User profile" style="width:100%;height:100%;border-radius:50%">`
        } else if (profileCircle) {
            profileCircle.textContent = derivedName.charAt(0).toUpperCase()
        }

        if (profileMenuName) {
            profileMenuName.textContent = derivedName
        }

        if (profileMenuEmail) {
            profileMenuEmail.textContent = userEmail || "Signed in"
        }
    } else {
        if(signinBtn) signinBtn.style.display = "inline-block"
        if(profileWrapper) profileWrapper.style.display = "none"

        if (profileMenuName) {
            profileMenuName.textContent = "My Account"
        }

        if (profileMenuEmail) {
            profileMenuEmail.textContent = "Guest"
        }
    }
}

function closeProfileMenu(){
    const menu = document.getElementById("profileMenu")
    if(menu) menu.classList.remove("active")
}

function toggleProfileMenu(){
    const menu = document.getElementById("profileMenu")
    if(!menu) return
    menu.classList.toggle("active")
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

// ================= NEW COLLECTION =================
async function loadNewCollection() {
    try {
        const res = await fetch("/api/products")
        const data = await res.json()

        function isEnabledFlag(value) {
            if (typeof value === "boolean") return value
            if (typeof value === "number") return value === 1

            const normalized = String(value || "").trim().toLowerCase()
            return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on"
        }

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

        function renderProductCards(items) {
            return items.map(p => `
                <div class="product-card" onclick="window.location.href='product.html?id=${p._id}'">
                    <img src="${p.images?.[0] || p.image}">
                    <h4>${p.name}</h4>
                    <span>&#8377; ${p.price}</span>
                    <button class="home-add-cart-btn" type="button" onclick="event.stopPropagation(); quickAddToCart('${p._id}', this)">Add to Cart</button>
                </div>
            `).join("")
        }

        container.innerHTML = `
            <div class="featured-products-stack">
                <div class="featured-row">
                    ${renderProductCards(topItems)}
                </div>
                <div class="featured-row">
                    ${renderProductCards(bottomItems)}
                </div>
            </div>

            <div class="cta-card featured-cta" onclick="window.location.href='men.html'">
                <h3>Explore Now</h3>
                <p>Discover the full collection</p>
                <button>Shop</button>
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
           container.innerHTML += `
    <div class="product-card" onclick="window.location.href='product.html?id=${p._id}'">
                    <img src="${p.images?.[0] || p.image}">
                    <h4>${p.name}</h4>
                    <span>&#8377; ${p.price}</span>
                    <button class="home-add-cart-btn" type="button" onclick="event.stopPropagation(); quickAddToCart('${p._id}', this)">Add to Cart</button>
                </div>
            `
        })

    } catch (err) {
        console.log("Preview error:", err)
    }
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
        let h = Math.floor(timeLeft / 3600)
        let m = Math.floor((timeLeft % 3600) / 60)
        let s = timeLeft % 60

        document.getElementById("hours").innerText = String(h).padStart(2, '0')
        document.getElementById("minutes").innerText = String(m).padStart(2, '0')
        document.getElementById("seconds").innerText = String(s).padStart(2, '0')

        timeLeft--

        if (timeLeft < 0) timeLeft = totalSeconds

        localStorage.setItem("luxoraTimer", timeLeft)
    }

    updateTimer()
    setInterval(updateTimer, 1000)
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
})

