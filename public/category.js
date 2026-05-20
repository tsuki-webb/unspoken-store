(function categoryPageBootstrap() {
    const INR_SYMBOL = String.fromCharCode(8377)
    const SORT_KEYS = new Set(["newest", "price_asc", "price_desc", "featured"])
    const SEARCH_DEBOUNCE_MS = 220
    const FALLBACK_PRODUCT_IMAGE = "https://via.placeholder.com/900x1200?text=THE+UNSPOKEN+STORE"
    const STOREFRONT_ALLOWED_TYPES_BY_GENDER = {
        men: new Set(["tshirt", "shirt", "short", "sweatpant"]),
        women: new Set(["tshirt", "top", "sweatpant"]),
        unisex: new Set(["tshirt"])
    }

    const COLLECTION_CONFIG = {
        men: {
            pageTitle: "Men Category",
            collectionHref: "men.html",
            categories: [
                {
                    id: "tshirts",
                    navLabel: "T-Shirts",
                    title: "T-Shirts",
                    subtitle: "Core silhouettes with versatile fits for every day.",
                    type: "tshirt",
                    cardAliases: ["oversized", "regular"],
                    subcategories: [
                        {
                            id: "all",
                            navLabel: "All Fits",
                            title: "T-Shirts",
                            subtitle: "Explore every fit in the men's t-shirt lineup."
                        },
                        {
                            id: "oversized",
                            navLabel: "Oversized",
                            title: "Oversized T-Shirts",
                            subtitle: "Relaxed fits with a stronger visual stance.",
                            fit: "oversized"
                        },
                        {
                            id: "regular",
                            navLabel: "Regular",
                            title: "Regular T-Shirts",
                            subtitle: "Clean, everyday staples with structured proportions.",
                            fit: "regular"
                        }
                    ]
                },
                { id: "shirts", navLabel: "Shirts", title: "Shirts", subtitle: "Refined layering essentials for smart casual styling.", type: "shirt" },
                { id: "shorts", navLabel: "Shorts", title: "Shorts", subtitle: "Comfort-first silhouettes for daily movement.", type: "short" },
                { id: "sweatpants", navLabel: "Sweatpants", title: "Sweatpants", subtitle: "Relaxed jogger fits for off-duty and travel looks.", type: "sweatpant" }
            ],
            categoryAliases: {
                oversized: { categoryId: "tshirts", subcategoryId: "oversized" },
                regular: { categoryId: "tshirts", subcategoryId: "regular" }
            }
        },
        women: {
            pageTitle: "Women Category",
            collectionHref: "women.html",
            categories: [
                {
                    id: "tshirts",
                    navLabel: "T-Shirts",
                    title: "T-Shirts",
                    subtitle: "Core silhouettes with versatile fits for every day.",
                    type: "tshirt",
                    cardAliases: ["oversized", "regular"],
                    subcategories: [
                        {
                            id: "all",
                            navLabel: "All Fits",
                            title: "T-Shirts",
                            subtitle: "Explore every fit in the women's t-shirt lineup."
                        },
                        {
                            id: "oversized",
                            navLabel: "Oversized",
                            title: "Oversized T-Shirts",
                            subtitle: "Loose and expressive silhouettes with effortless drape.",
                            fit: "oversized"
                        },
                        {
                            id: "regular",
                            navLabel: "Regular",
                            title: "Regular T-Shirts",
                            subtitle: "Sharp basics for clean everyday styling.",
                            fit: "regular"
                        }
                    ]
                },
                { id: "tops", navLabel: "Tops", title: "Tops", subtitle: "Elevated essentials with polished femininity.", type: "top" },
                { id: "sweatpants", navLabel: "Sweatpants", title: "Sweatpants", subtitle: "Soft comfort made for all-day wear and travel.", type: "sweatpant" }
            ],
            categoryAliases: {
                oversized: { categoryId: "tshirts", subcategoryId: "oversized" },
                regular: { categoryId: "tshirts", subcategoryId: "regular" }
            }
        },
        unisex: {
            pageTitle: "Unisex Category",
            collectionHref: "unisex.html",
            categories: [
                {
                    id: "tshirts",
                    navLabel: "T-Shirts",
                    title: "T-Shirts",
                    subtitle: "Universal silhouettes with expressive and everyday fits.",
                    type: "tshirt",
                    cardAliases: ["oversized", "regular"],
                    subcategories: [
                        {
                            id: "all",
                            navLabel: "All Fits",
                            title: "T-Shirts",
                            subtitle: "Explore every fit in the unisex t-shirt lineup."
                        },
                        {
                            id: "oversized",
                            navLabel: "Oversized",
                            title: "Oversized T-Shirts",
                            subtitle: "Relaxed silhouettes with universal appeal.",
                            fit: "oversized"
                        },
                        {
                            id: "regular",
                            navLabel: "Regular",
                            title: "Regular T-Shirts",
                            subtitle: "Balanced fits for everyday versatility.",
                            fit: "regular"
                        }
                    ]
                }
            ],
            categoryAliases: {
                oversized: { categoryId: "tshirts", subcategoryId: "oversized" },
                regular: { categoryId: "tshirts", subcategoryId: "regular" }
            }
        }
    }

    function normalizeText(value) {
        return String(value || "").trim()
    }

    function toTitleCase(value) {
        return String(value || "")
            .split(" ")
            .filter(Boolean)
            .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
            .join(" ")
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
    }

    function isEnabledFlag(value) {
        if (typeof value === "boolean") return value
        if (typeof value === "number") return value === 1
        const normalized = String(value || "").trim().toLowerCase()
        return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on"
    }

    function getTypeLabel(type) {
        const normalized = String(type || "").trim().toLowerCase()
        if (normalized === "tshirt") return "T-Shirt"
        if (normalized === "top") return "Top"
        if (normalized === "shirt") return "Shirt"
        if (normalized === "short") return "Shorts"
        if (normalized === "sweatpant") return "Sweatpants"
        return toTitleCase(normalized)
    }

    function normalizeImageSrc(source) {
        const value = normalizeText(source)
        if (!value) return ""

        const slashFixed = value.replace(/\\/g, "/")
        if (/^(https?:\/\/|data:|blob:)/i.test(slashFixed)) return slashFixed
        if (slashFixed.startsWith("/")) return slashFixed

        return `/${slashFixed.replace(/^\.?\//, "")}`
    }

    function getProductImage(product) {
        const imageSource = Array.isArray(product?.images) && product.images.length
            ? product.images[0]
            : product?.image
        return normalizeImageSrc(imageSource) || FALLBACK_PRODUCT_IMAGE
    }

    function getProductTimestamp(product) {
        return new Date(product?.createdAt || 0).getTime()
    }

    function normalizeSubcategories(category) {
        if (!Array.isArray(category?.subcategories) || !category.subcategories.length) return []

        return category.subcategories
            .map(sub => ({
                id: String(sub?.id || "").trim().toLowerCase(),
                navLabel: String(sub?.navLabel || sub?.label || "").trim(),
                title: String(sub?.title || "").trim(),
                subtitle: String(sub?.subtitle || "").trim(),
                fit: String(sub?.fit || "").trim().toLowerCase()
            }))
            .filter(sub => sub.id)
    }

    function getCategoryAliasIds(category) {
        const aliases = Array.isArray(category?.cardAliases) ? category.cardAliases : []
        return [category?.id, ...aliases]
            .map(value => String(value || "").trim().toLowerCase())
            .filter(Boolean)
    }

    function isStorefrontProductVisible(product) {
        const gender = String(product?.gender || "").trim().toLowerCase()
        const type = String(product?.type || "").trim().toLowerCase()
        const allowed = STOREFRONT_ALLOWED_TYPES_BY_GENDER[gender]
        if (!allowed) return true
        return allowed.has(type)
    }

    function productMatchesCategory(product, category) {
        if (!category) return false
        if (category.type && String(product.type || "") !== String(category.type)) return false
        if (category.fit && String(product.fit || "") !== String(category.fit)) return false
        return true
    }

    function productMatchesSubcategory(product, subcategory) {
        if (!subcategory) return true
        if (subcategory.fit && String(product.fit || "") !== String(subcategory.fit)) return false
        return true
    }

    function formatCurrency(value) {
        const number = Number(value || 0)
        return `${INR_SYMBOL} ${number.toLocaleString("en-IN")}`
    }

    function fetchJson(url) {
        return fetch(url).then(async response => {
            const payload = await response.json().catch(() => [])
            if (!response.ok) {
                const message = payload?.error || `Request failed: ${response.status}`
                throw new Error(message)
            }
            return payload
        })
    }

    function getCardDisplayOrder(card) {
        const parsed = Number.parseInt(String(card?.displayOrder ?? ""), 10)
        if (Number.isNaN(parsed) || parsed < 1) return Number.MAX_SAFE_INTEGER
        return parsed
    }

    const params = new URLSearchParams(window.location.search)
    const requestedCollection = normalizeText(params.get("gender") || params.get("collection")).toLowerCase()
    const collectionKey = COLLECTION_CONFIG[requestedCollection] ? requestedCollection : "men"
    const config = COLLECTION_CONFIG[collectionKey]
    const requestedCategory = normalizeText(params.get("category")).toLowerCase()
    const requestedFit = normalizeText(params.get("fit")).toLowerCase()
    const categoryAliasMap = config.categoryAliases || {}
    const categoryAliasHit = categoryAliasMap[requestedCategory] || null
    const resolvedRequestedCategory = normalizeText(categoryAliasHit?.categoryId || requestedCategory).toLowerCase()
    const resolvedRequestedSubcategory = normalizeText(categoryAliasHit?.subcategoryId || requestedFit).toLowerCase()
    document.body?.setAttribute("data-collection", collectionKey)

    const dom = {
        kicker: document.getElementById("categoryKicker"),
        pageTitle: document.getElementById("categoryPageTitle"),
        pageSubtitle: document.getElementById("categoryPageSubtitle"),
        backBtn: document.getElementById("backToCollectionBtn"),
        searchInput: document.getElementById("categorySearchInput"),
        sortSelect: document.getElementById("categorySortSelect"),
        toolbarSummary: document.getElementById("categoryToolbarSummary"),
        subcategoryWrap: document.getElementById("categorySubcategoryWrap"),
        subcategoryChips: document.getElementById("categorySubcategoryChips"),
        quickLinks: document.getElementById("categoryQuickLinks"),
        productsWrap: document.getElementById("categoryProductsWrap"),
        productsHeading: document.getElementById("categoryProductsHeading"),
        productsSubheading: document.getElementById("categoryProductsSubheading"),
        productsCount: document.getElementById("categoryProductsCount"),
        productsGrid: document.getElementById("categoryProductsGrid"),
        empty: document.getElementById("categoryEmpty"),
        error: document.getElementById("categoryError"),
        errorMessage: document.getElementById("categoryErrorMessage"),
        scrollProgress: document.getElementById("scrollProgress"),
        backToTopBtn: document.getElementById("backToTopBtn"),
        toastHost: document.getElementById("toastHost")
    }

    const initialCategory = config.categories.find(category => category.id === resolvedRequestedCategory) || config.categories[0]
    const initialSubcategories = normalizeSubcategories(initialCategory)
    const initialSubcategoryId = initialSubcategories.some(sub => sub.id === resolvedRequestedSubcategory)
        ? resolvedRequestedSubcategory
        : (initialSubcategories[0]?.id || "")

    const state = {
        allProducts: [],
        categoryCards: [],
        search: "",
        sort: "newest",
        searchTimer: null,
        selectedCategory: initialCategory,
        selectedSubcategoryId: initialSubcategoryId,
        orderedCategories: [...config.categories]
    }

    function showError(message) {
        if (dom.errorMessage) dom.errorMessage.textContent = message || "Unable to load this category right now."
        dom.error?.classList.remove("hidden")
    }

    function hideError() {
        dom.error?.classList.add("hidden")
    }

    function toast(message, type = "info") {
        if (!dom.toastHost) return
        const node = document.createElement("div")
        node.className = `toast ${type}`
        node.textContent = message
        dom.toastHost.appendChild(node)
        setTimeout(() => node.remove(), 2400)
    }

    function getActiveSubcategory(category = state.selectedCategory) {
        const subcategories = normalizeSubcategories(category)
        if (!subcategories.length) return null
        return subcategories.find(sub => sub.id === state.selectedSubcategoryId) || subcategories[0]
    }

    function syncSubcategorySelectionForCategory(category) {
        const subcategories = normalizeSubcategories(category)
        if (!subcategories.length) {
            state.selectedSubcategoryId = ""
            return
        }

        if (subcategories.some(sub => sub.id === state.selectedSubcategoryId)) return
        state.selectedSubcategoryId = subcategories[0].id
    }

    function getCategoryOverride(category) {
        const aliasIds = getCategoryAliasIds(category)
        const normalizedCategoryId = String(category?.id || "").trim().toLowerCase()

        const exact = state.categoryCards.find(card =>
            String(card?.gender || "") === collectionKey &&
            String(card?.categoryId || "").trim().toLowerCase() === normalizedCategoryId
        )

        if (exact) return exact

        return state.categoryCards.find(card =>
            String(card?.gender || "") === collectionKey &&
            aliasIds.includes(String(card?.categoryId || "").trim().toLowerCase())
        )
    }

    function getCategoryDisplayMeta(category) {
        const override = getCategoryOverride(category)
        const activeSubcategory = getActiveSubcategory(category)
        const baseTitle = normalizeText(activeSubcategory?.title) || normalizeText(category.title) || "Category"
        const baseSubtitle = normalizeText(activeSubcategory?.subtitle) || normalizeText(category.subtitle) || "Premium streetwear category."
        const title = normalizeText(override?.title) || baseTitle
        const subtitle = normalizeText(override?.subtitle) || baseSubtitle
        return { title, subtitle }
    }

    function resolveOrderedCategories() {
        const defaultIndexById = new Map(config.categories.map((category, index) => [category.id, index]))

        const cardOrderByCategoryId = new Map(
            state.categoryCards
                .filter(card => String(card?.gender || "") === collectionKey)
                .sort((a, b) => {
                    const orderDiff = getCardDisplayOrder(a) - getCardDisplayOrder(b)
                    if (orderDiff !== 0) return orderDiff
                    return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0)
                })
                .map((card, index) => [String(card?.categoryId || "").trim().toLowerCase(), index + 1])
        )

        state.orderedCategories = [...config.categories].sort((a, b) => {
            const orderA = getCategoryAliasIds(a).reduce((min, aliasId) => {
                const order = cardOrderByCategoryId.get(aliasId)
                return order && order < min ? order : min
            }, Number.MAX_SAFE_INTEGER)
            const orderB = getCategoryAliasIds(b).reduce((min, aliasId) => {
                const order = cardOrderByCategoryId.get(aliasId)
                return order && order < min ? order : min
            }, Number.MAX_SAFE_INTEGER)
            if (orderA !== orderB) return orderA - orderB

            return (defaultIndexById.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (defaultIndexById.get(b.id) ?? Number.MAX_SAFE_INTEGER)
        })

        if (!state.orderedCategories.some(category => category.id === state.selectedCategory?.id)) {
            state.selectedCategory = state.orderedCategories[0]
        }

        syncSubcategorySelectionForCategory(state.selectedCategory)
    }

    function getCategoryProducts(category) {
        const activeSubcategory = getActiveSubcategory(category)
        return state.allProducts
            .filter(product => productMatchesCategory(product, category))
            .filter(product => productMatchesSubcategory(product, activeSubcategory))
            .sort((a, b) => getProductTimestamp(b) - getProductTimestamp(a))
    }

    function getFilteredAndSortedProducts(baseProducts) {
        const normalizedSearch = String(state.search || "").trim().toLowerCase()

        const filtered = baseProducts.filter(product => {
            if (!normalizedSearch) return true

            const searchBlob = [
                product.name,
                product.description,
                product.type,
                product.fit
            ]
                .map(value => String(value || "").toLowerCase())
                .join(" ")

            return searchBlob.includes(normalizedSearch)
        })

        return [...filtered].sort((a, b) => {
            if (state.sort === "price_asc") return Number(a.price || 0) - Number(b.price || 0)
            if (state.sort === "price_desc") return Number(b.price || 0) - Number(a.price || 0)
            if (state.sort === "featured") {
                const featuredDiff = Number(isEnabledFlag(b.featured)) - Number(isEnabledFlag(a.featured))
                if (featuredDiff !== 0) return featuredDiff
            }
            return getProductTimestamp(b) - getProductTimestamp(a)
        })
    }

    function buildProductMetaLabel(product) {
        const fit = product.fit ? ` | ${toTitleCase(product.fit)}` : ""
        return `${toTitleCase(collectionKey)} | ${getTypeLabel(product.type)}${fit}`
    }

    function renderPageHeader(category) {
        const { title, subtitle } = getCategoryDisplayMeta(category)
        document.title = `${title} | ${config.pageTitle}`

        if (dom.kicker) dom.kicker.textContent = `${toTitleCase(collectionKey)} Collection`
        if (dom.pageTitle) dom.pageTitle.textContent = title
        if (dom.pageSubtitle) dom.pageSubtitle.textContent = subtitle

        if (dom.backBtn) {
            dom.backBtn.href = config.collectionHref
            dom.backBtn.textContent = `Back to ${toTitleCase(collectionKey)}`
        }
    }

    function renderToolbarSummary(filteredProducts, baseProducts) {
        if (!dom.toolbarSummary) return
        const activeSubcategory = getActiveSubcategory(state.selectedCategory)
        const fitLabel = normalizeText(activeSubcategory?.navLabel || activeSubcategory?.title) || "All Fits"
        const fitSegment = activeSubcategory ? ` | Fit: ${fitLabel}` : ""
        dom.toolbarSummary.textContent = `${filteredProducts.length} / ${baseProducts.length} products${fitSegment}`
    }

    function renderSubcategoryControls(category) {
        if (!dom.subcategoryWrap || !dom.subcategoryChips) return

        const subcategories = normalizeSubcategories(category)
        if (!subcategories.length) {
            dom.subcategoryWrap.classList.add("hidden")
            dom.subcategoryChips.innerHTML = ""
            return
        }

        const activeSubcategory = getActiveSubcategory(category)
        dom.subcategoryWrap.classList.remove("hidden")
        dom.subcategoryChips.innerHTML = subcategories
            .map(subcategory => `
                <button
                    type="button"
                    class="category-subcategory-chip ${activeSubcategory?.id === subcategory.id ? "active" : ""}"
                    data-action="set-subcategory"
                    data-subcategory-id="${escapeHtml(subcategory.id)}"
                >${escapeHtml(subcategory.navLabel || subcategory.title || subcategory.id)}</button>
            `)
            .join("")
    }

    function renderQuickLinks() {
        if (!dom.quickLinks) return

        dom.quickLinks.innerHTML = state.orderedCategories
            .map(category => {
                const isActive = state.selectedCategory?.id === category.id
                const nextParams = new URLSearchParams()
                nextParams.set("gender", collectionKey)
                nextParams.set("category", category.id)
                const activeSubcategory = isActive ? getActiveSubcategory(category) : null
                if (activeSubcategory?.fit) {
                    nextParams.set("fit", activeSubcategory.id)
                }
                const href = `category.html?${nextParams.toString()}`

                return `
                    <a class="category-btn ${isActive ? "active" : ""}" href="${escapeHtml(href)}">
                        ${escapeHtml(category.navLabel || category.title)}
                    </a>
                `
            })
            .join("")
    }

    function renderProductCard(product) {
        const productId = String(product._id || "")
        const featured = isEnabledFlag(product.featured)
        const isNew = isEnabledFlag(product.newCollection)

        return `
            <article class="product-card" data-product-id="${escapeHtml(productId)}">
                <a class="product-media" href="product.html?id=${escapeHtml(productId)}" aria-label="View ${escapeHtml(product.name)}">
                    <img
                        src="${escapeHtml(getProductImage(product))}"
                        alt="${escapeHtml(product.name)}"
                        loading="lazy"
                        decoding="async"
                        data-fallback-image="1"
                    >
                    <div class="product-badges">
                        ${featured ? '<span class="product-badge featured">Featured</span>' : ""}
                        ${isNew ? '<span class="product-badge new">New</span>' : ""}
                    </div>
                </a>
                <div class="product-info">
                    <h3 class="product-name">${escapeHtml(product.name)}</h3>
                    <p class="product-meta">${escapeHtml(buildProductMetaLabel(product))}</p>
                    <p class="product-price">${escapeHtml(formatCurrency(product.price))}</p>
                    <div class="product-actions">
                        <button type="button" class="primary" data-action="add-to-cart" data-id="${escapeHtml(productId)}">Add to Cart</button>
                    </div>
                </div>
            </article>
        `
    }

    function bindImageFallbacks(scopeNode) {
        if (!scopeNode) return
        scopeNode.querySelectorAll("img[data-fallback-image]").forEach(img => {
            if (img.dataset.fallbackBound === "1") return
            img.dataset.fallbackBound = "1"
            img.addEventListener("error", () => {
                if (img.dataset.fallbackApplied === "1") return
                img.dataset.fallbackApplied = "1"
                img.src = FALLBACK_PRODUCT_IMAGE
            })
        })
    }

    function renderProducts(category, filteredProducts) {
        const { title, subtitle } = getCategoryDisplayMeta(category)

        if (dom.productsHeading) dom.productsHeading.textContent = title
        if (dom.productsSubheading) dom.productsSubheading.textContent = subtitle
        if (dom.productsCount) dom.productsCount.textContent = `${filteredProducts.length} item${filteredProducts.length === 1 ? "" : "s"}`

        if (!filteredProducts.length) {
            dom.productsWrap?.classList.add("hidden")
            dom.empty?.classList.remove("hidden")
            if (dom.productsGrid) dom.productsGrid.innerHTML = ""
            return
        }

        dom.productsWrap?.classList.remove("hidden")
        dom.empty?.classList.add("hidden")

        if (dom.productsGrid) {
            dom.productsGrid.innerHTML = filteredProducts.map(renderProductCard).join("")
            bindImageFallbacks(dom.productsGrid)
        }
    }

    function syncStateToUrl() {
        const categoryId = String(state.selectedCategory?.id || "")
        if (!categoryId) return

        const params = new URLSearchParams()
        params.set("gender", collectionKey)
        params.set("category", categoryId)

        const activeSubcategory = getActiveSubcategory(state.selectedCategory)
        if (activeSubcategory?.fit) {
            params.set("fit", activeSubcategory.id)
        }

        history.replaceState({}, "", `category.html?${params.toString()}`)
    }

    function renderAll() {
        const category = state.selectedCategory
        if (!category) return
        syncSubcategorySelectionForCategory(category)

        const baseProducts = getCategoryProducts(category)
        const filteredProducts = getFilteredAndSortedProducts(baseProducts)

        renderPageHeader(category)
        renderSubcategoryControls(category)
        renderToolbarSummary(filteredProducts, baseProducts)
        renderQuickLinks()
        renderProducts(category, filteredProducts)
        syncStateToUrl()
    }

    function syncActiveNav() {
        document.querySelectorAll(".collection-nav-links a[data-nav]").forEach(link => {
            const isActive = String(link.dataset.nav || "") === collectionKey
            link.classList.toggle("active", isActive)
        })
    }

    function updateScrollUi() {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0
        const docHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
        const windowHeight = window.innerHeight
        const maxScrollable = Math.max(docHeight - windowHeight, 1)
        const progress = Math.min(100, Math.max(0, (scrollTop / maxScrollable) * 100))

        if (dom.scrollProgress) dom.scrollProgress.style.width = `${progress}%`
        if (dom.backToTopBtn) dom.backToTopBtn.classList.toggle("visible", scrollTop > 420)
    }

    async function addProductToCart(productId) {
        const cart = window.LuxoraCart
        if (!cart) {
            toast("Cart module is unavailable.", "warn")
            return
        }

        const product = state.allProducts.find(item => String(item._id) === String(productId))
        if (!product) {
            toast("Product is unavailable right now.", "warn")
            return
        }

        try {
            await cart.addItem({
                productId: String(product._id),
                quantity: 1,
                size: "M"
            })

            toast(`${product.name} added to cart.`, "success")
        } catch (err) {
            if (String(err?.message || "") === "signin-required") {
                toast("Sign in to save items in your cart.", "warn")
                return
            }

            toast(err?.message || "Unable to add product to cart.", "warn")
        }
    }

    function bindEvents() {
        document.addEventListener("click", event => {
            const actionTarget = event.target.closest("[data-action]")
            if (!actionTarget) return

            const action = String(actionTarget.dataset.action || "")
            if (action === "set-subcategory") {
                const category = state.selectedCategory
                if (!category) return

                const subcategories = normalizeSubcategories(category)
                if (!subcategories.length) return

                const nextSubcategoryId = String(actionTarget.dataset.subcategoryId || "").trim().toLowerCase()
                if (!subcategories.some(sub => sub.id === nextSubcategoryId)) return

                state.selectedSubcategoryId = nextSubcategoryId
                renderAll()
                return
            }

            if (action === "add-to-cart") {
                const productId = String(actionTarget.dataset.id || "")
                if (!productId) return
                addProductToCart(productId)
            }
        })

        if (dom.searchInput) {
            dom.searchInput.addEventListener("input", event => {
                clearTimeout(state.searchTimer)
                state.searchTimer = setTimeout(() => {
                    state.search = normalizeText(event.target.value || "")
                    renderAll()
                }, SEARCH_DEBOUNCE_MS)
            })
        }

        if (dom.sortSelect) {
            dom.sortSelect.addEventListener("change", event => {
                const requestedSort = String(event.target.value || "newest")
                state.sort = SORT_KEYS.has(requestedSort) ? requestedSort : "newest"
                renderAll()
            })
        }

        dom.backToTopBtn?.addEventListener("click", () => {
            window.scrollTo({ top: 0, behavior: "smooth" })
        })

        window.addEventListener("scroll", updateScrollUi, { passive: true })
        window.addEventListener("resize", updateScrollUi)
    }

    async function loadData() {
        try {
            hideError()

            const [productsResult, cardsResult] = await Promise.allSettled([
                fetchJson(`/api/products?gender=${encodeURIComponent(collectionKey)}`),
                fetchJson("/api/category-cards")
            ])

            if (productsResult.status !== "fulfilled") {
                throw productsResult.reason || new Error("Unable to load products")
            }

            state.allProducts = (Array.isArray(productsResult.value) ? productsResult.value : [])
                .filter(isStorefrontProductVisible)
            state.categoryCards = cardsResult.status === "fulfilled" && Array.isArray(cardsResult.value)
                ? cardsResult.value
                : []

            resolveOrderedCategories()
            renderAll()
            updateScrollUi()
        } catch (err) {
            console.log("CATEGORY PAGE LOAD ERROR:", err)
            showError(err?.message || "Unable to load this category right now.")
        }
    }

    syncActiveNav()
    bindEvents()
    loadData()
    window.LuxoraCart?.refreshCartCount()
})()
