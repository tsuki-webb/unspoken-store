(function collectionCoreBootstrap() {
    const INR_SYMBOL = String.fromCharCode(8377)
    const RECENTLY_VIEWED_KEY = "luxora_recently_viewed_v1"
    const PRESET_KEY_PREFIX = "luxora_collection_filter_preset_"
    const SEARCH_DEBOUNCE_MS = 220
    const SORT_KEYS = new Set(["newest", "price_asc", "price_desc", "featured", "new_collection"])
    const CATEGORY_CARD_PLACEHOLDER = "https://via.placeholder.com/900x1125?text=THE+UNSPOKEN+STORE"
    const categoryCardAutoScrollers = new WeakMap()
    const STOREFRONT_ALLOWED_TYPES_BY_GENDER = {
        men: new Set(["tshirt", "shirt", "short", "sweatpant"]),
        women: new Set(["tshirt", "top", "sweatpant"]),
        unisex: new Set(["tshirt"])
    }

    function safeParseJson(raw, fallback) {
        try {
            return JSON.parse(raw)
        } catch (err) {
            return fallback
        }
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
    }

    function formatCurrency(value) {
        const number = Number(value || 0)
        return `${INR_SYMBOL} ${number.toLocaleString("en-IN")}`
    }

    function isEnabledFlag(value) {
        if (typeof value === "boolean") return value
        if (typeof value === "number") return value === 1
        const normalized = String(value || "").trim().toLowerCase()
        return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "on"
    }

    function toTitleCase(value) {
        return String(value || "")
            .split(" ")
            .filter(Boolean)
            .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
            .join(" ")
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

    function getProductImage(product) {
        if (Array.isArray(product?.images) && product.images.length) return product.images[0]
        return product?.image || "https://via.placeholder.com/600x750?text=THE+UNSPOKEN+STORE"
    }

    function getProductTimestamp(product) {
        return new Date(product?.createdAt || 0).getTime()
    }

    function getGenderLabel(gender) {
        const normalized = String(gender || "").trim().toLowerCase()
        if (normalized === "men") return "Men"
        if (normalized === "women") return "Women"
        if (normalized === "unisex") return "Unisex"
        return toTitleCase(normalized)
    }

    function normalizeQuickTypes(config) {
        if (Array.isArray(config?.quickTypes) && config.quickTypes.length) {
            return config.quickTypes
        }

        const unique = new Set()
        ;(config?.categories || []).forEach(section => {
            if (section?.type) {
                unique.add(section.type)
            }
        })

        return [
            { value: "all", label: "All" },
            ...[...unique].map(type => ({
                value: type,
                label: getTypeLabel(type)
            }))
        ]
    }

    function normalizeBannerTypes(config) {
        const rawTypes = Array.isArray(config?.bannerTypes) && config.bannerTypes.length
            ? config.bannerTypes
            : [config?.bannerType]

        return rawTypes
            .map(type => String(type || "").trim())
            .filter(Boolean)
            .slice(0, 3)
    }

    function readRecentEntries() {
        const raw = localStorage.getItem(RECENTLY_VIEWED_KEY)
        if (!raw) return []

        const parsed = safeParseJson(raw, [])
        if (!Array.isArray(parsed)) return []

        return parsed
            .map(entry => ({
                id: String(entry?.id || "").trim(),
                viewedAt: Number(entry?.viewedAt || 0)
            }))
            .filter(entry => entry.id)
    }

    function dedupeById(rows) {
        const seen = new Set()
        const output = []

        rows.forEach(row => {
            const id = String(row?._id || "")
            if (!id || seen.has(id)) return
            seen.add(id)
            output.push(row)
        })

        return output
    }

    function createSearchIndex(product) {
        const searchableType = getTypeLabel(product.type)

        return [
            product.name,
            product.description,
            product.gender,
            product.type,
            searchableType,
            product.fit
        ]
            .map(value => String(value || "").toLowerCase())
            .join(" ")
    }

    function normalizeSubcategories(section) {
        if (!Array.isArray(section?.subcategories) || !section.subcategories.length) return []

        return section.subcategories
            .map(subcategory => ({
                id: String(subcategory?.id || "").trim().toLowerCase(),
                navLabel: String(subcategory?.navLabel || subcategory?.label || "").trim(),
                title: String(subcategory?.title || "").trim(),
                subtitle: String(subcategory?.subtitle || "").trim(),
                fit: String(subcategory?.fit || "").trim().toLowerCase()
            }))
            .filter(subcategory => subcategory.id)
    }

    function getSectionAliasIds(section) {
        const aliases = Array.isArray(section?.cardAliases) ? section.cardAliases : []
        return [section?.id, ...aliases]
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

    function productMatchesCategory(product, section) {
        if (!section) return false

        if (section.type && product.type !== section.type) {
            return false
        }

        if (section.fit && product.fit !== section.fit) {
            return false
        }

        return true
    }

    function productMatchesSubcategory(product, subcategory) {
        if (!subcategory) return true
        if (subcategory.fit && product.fit !== subcategory.fit) return false
        return true
    }

    function initCollectionPage(userConfig) {
        const config = {
            quickTypes: normalizeQuickTypes(userConfig),
            bannerTypes: normalizeBannerTypes(userConfig),
            ...userConfig
        }
        config.bannerTypes = normalizeBannerTypes(config)

        const state = {
            search: "",
            sort: "newest",
            type: "all",
            featuredOnly: false,
            newOnly: false,
            subcategories: {}
        }

        let allProducts = []
        let filteredProducts = []
        let categoryCards = []
        let searchTimer = null
        let sectionObserver = null
        let compareIds = []
        let quickViewProductId = null
        let hasHandledInitialHash = false
        let heroSlideIndex = 0
        let heroSlideCount = 0
        let heroSlideTimer = null

        const dom = {
            body: document.body,
            heroImage: document.getElementById("collectionHeroImage"),
            heroSlides: Array.from(document.querySelectorAll("[data-collection-hero-slide]")),
            heroDots: document.getElementById("collectionHeroDots"),
            heroEyebrow: document.getElementById("heroEyebrow"),
            heroTitle: document.getElementById("heroTitle"),
            heroSubtitle: document.getElementById("heroSubtitle"),
            heroStats: document.getElementById("heroStats"),
            categoryStrip: document.getElementById("categoryStrip"),
            categoryCardsGrid: document.getElementById("categoryCardsGrid"),
            mobileFilterToggle: document.getElementById("mobileFilterToggle"),
            filterPanel: document.getElementById("filterPanel"),
            filterCloseBtn: document.getElementById("filterCloseBtn"),
            searchInput: document.getElementById("collectionSearchInput"),
            sortSelect: document.getElementById("collectionSortSelect"),
            quickTypeChips: document.getElementById("quickTypeChips"),
            flagChips: document.getElementById("flagChips"),
            savePresetBtn: document.getElementById("savePresetBtn"),
            loadPresetBtn: document.getElementById("loadPresetBtn"),
            clearFiltersBtn: document.getElementById("clearFiltersBtn"),
            filterSummary: document.getElementById("collectionFilterSummary"),
            sectionsHost: document.getElementById("collectionSections"),
            emptyState: document.getElementById("collectionEmpty"),
            emptyResetBtn: document.getElementById("emptyResetBtn"),
            errorState: document.getElementById("collectionError"),
            errorRetryBtn: document.getElementById("collectionRetryBtn"),
            recentRail: document.getElementById("recentlyViewedRail"),
            recentRailRow: document.getElementById("recentlyViewedRow"),
            newRail: document.getElementById("newCollectionRail"),
            newRailRow: document.getElementById("newCollectionRow"),
            quickViewModal: document.getElementById("quickViewModal"),
            quickViewOverlay: document.getElementById("quickViewOverlay"),
            quickViewClose: document.getElementById("quickViewCloseBtn"),
            quickViewBody: document.getElementById("quickViewBody"),
            compareBar: document.getElementById("compareBar"),
            compareItems: document.getElementById("compareItems"),
            compareOpenBtn: document.getElementById("openCompareBtn"),
            compareClearBtn: document.getElementById("clearCompareBtn"),
            compareModal: document.getElementById("compareModal"),
            compareOverlay: document.getElementById("compareOverlay"),
            compareCloseBtn: document.getElementById("compareCloseBtn"),
            compareBody: document.getElementById("compareBody"),
            scrollProgress: document.getElementById("scrollProgress"),
            backToTopBtn: document.getElementById("backToTopBtn"),
            toastHost: document.getElementById("toastHost")
        }

        function syncOverlayScrollLock() {
            const quickViewOpen = !!dom.quickViewModal?.classList.contains("active")
            const compareModalOpen = !!dom.compareModal?.classList.contains("active")
            const filtersOpen = dom.body.classList.contains("filters-open")
            const filterDrawerHidden = window.innerWidth <= 900 ? !filtersOpen : false

            dom.body.classList.toggle("no-scroll", quickViewOpen || compareModalOpen || filtersOpen)
            dom.mobileFilterToggle?.setAttribute("aria-expanded", filtersOpen ? "true" : "false")
            dom.filterPanel?.setAttribute("aria-hidden", filterDrawerHidden ? "true" : "false")
        }

        function stopHeroSlider() {
            if (heroSlideTimer) {
                clearInterval(heroSlideTimer)
                heroSlideTimer = null
            }
        }

        function setHeroSlide(index) {
            if (!heroSlideCount) return

            heroSlideIndex = ((Number(index) || 0) + heroSlideCount) % heroSlideCount

            dom.heroSlides.forEach((slide, slideIndex) => {
                const isActive = slideIndex === heroSlideIndex
                slide.classList.toggle("active", isActive)
                slide.setAttribute("aria-hidden", isActive ? "false" : "true")
            })

            dom.heroDots?.querySelectorAll("[data-hero-slide-index]").forEach(dot => {
                const isActive = Number(dot.dataset.heroSlideIndex) === heroSlideIndex
                dot.classList.toggle("active", isActive)
                dot.setAttribute("aria-current", isActive ? "true" : "false")
            })
        }

        function startHeroSlider() {
            stopHeroSlider()
            if (heroSlideCount <= 1) return

            heroSlideTimer = setInterval(() => {
                setHeroSlide(heroSlideIndex + 1)
            }, 4500)
        }

        function renderHeroDots() {
            if (!dom.heroDots) return

            if (heroSlideCount <= 1) {
                dom.heroDots.innerHTML = ""
                return
            }

            dom.heroDots.innerHTML = Array.from({ length: heroSlideCount }, (_, index) => `
                <button
                    type="button"
                    class="collection-hero-dot ${index === 0 ? "active" : ""}"
                    data-hero-slide-index="${index}"
                    aria-label="Show hero banner ${index + 1}"
                    aria-current="${index === 0 ? "true" : "false"}"
                ></button>
            `).join("")
        }

        function renderHeroSlides(imageUrls = []) {
            const slides = imageUrls
                .map(url => String(url || "").trim())
                .filter(Boolean)

            if (!slides.length && config.heroFallbackImage) {
                slides.push(config.heroFallbackImage)
            }

            const limitedSlides = slides.slice(0, dom.heroSlides.length || 1)
            heroSlideCount = limitedSlides.length

            if (dom.heroSlides.length) {
                dom.heroSlides.forEach((slide, index) => {
                    const imageUrl = limitedSlides[index] || ""
                    slide.hidden = !imageUrl
                    slide.src = imageUrl
                    slide.alt = `${config.pageTitle || "Collection"} hero ${index + 1}`
                    slide.classList.toggle("active", index === 0 && !!imageUrl)
                    slide.setAttribute("aria-hidden", index === 0 && !!imageUrl ? "false" : "true")
                })
            } else if (dom.heroImage && limitedSlides[0]) {
                dom.heroImage.src = limitedSlides[0]
                dom.heroImage.alt = `${config.pageTitle || "Collection"} hero`
                heroSlideCount = 1
            }

            heroSlideIndex = 0
            renderHeroDots()
            setHeroSlide(0)
            startHeroSlider()
        }

        function syncPageMeta() {
            document.title = `${config.pageTitle}`

            if (dom.heroEyebrow) dom.heroEyebrow.textContent = config.heroEyebrow || "Collection"
            if (dom.heroTitle) dom.heroTitle.textContent = config.heroTitle || config.pageTitle
            if (dom.heroSubtitle) dom.heroSubtitle.textContent = config.heroSubtitle || ""

            renderHeroSlides([config.heroFallbackImage])

            document.querySelectorAll(".collection-nav-links a[data-nav]").forEach(link => {
                const isActive = String(link.dataset.nav || "") === String(config.gender || "")
                link.classList.toggle("active", isActive)
            })
        }

        function getSectionById(sectionId) {
            const normalizedSectionId = String(sectionId || "").trim().toLowerCase()
            return config.categories.find(section => String(section?.id || "").trim().toLowerCase() === normalizedSectionId) || null
        }

        function getSectionSubcategory(section) {
            const subcategories = normalizeSubcategories(section)
            if (!subcategories.length) return null

            const sectionId = String(section?.id || "").trim().toLowerCase()
            const selectedId = String(state.subcategories?.[sectionId] || "").trim().toLowerCase()
            return subcategories.find(subcategory => subcategory.id === selectedId) || subcategories[0]
        }

        function syncSectionSubcategory(section) {
            const subcategories = normalizeSubcategories(section)
            if (!subcategories.length) return

            const sectionId = String(section?.id || "").trim().toLowerCase()
            const currentId = String(state.subcategories?.[sectionId] || "").trim().toLowerCase()

            if (subcategories.some(subcategory => subcategory.id === currentId)) return

            state.subcategories[sectionId] = subcategories[0].id
        }

        function syncAllSectionSubcategories() {
            config.categories.forEach(section => {
                syncSectionSubcategory(section)
            })
        }

        function getHashAlias(hashValue) {
            const aliases = config.hashAliases || {}
            const normalizedHash = String(hashValue || "").trim().toLowerCase()
            return aliases[normalizedHash] || null
        }

        function getCurrentFitParamValue() {
            const fitValues = config.categories
                .map(section => getSectionSubcategory(section))
                .filter(Boolean)
                .map(subcategory => String(subcategory?.fit || "").trim().toLowerCase())
                .filter(Boolean)

            return fitValues[0] || ""
        }

        function syncStateToControls() {
            if (dom.searchInput) dom.searchInput.value = state.search
            if (dom.sortSelect) dom.sortSelect.value = state.sort

            if (dom.quickTypeChips) {
                dom.quickTypeChips.querySelectorAll(".filter-chip").forEach(chip => {
                    chip.classList.toggle("active", chip.dataset.value === state.type)
                })
            }

            if (dom.flagChips) {
                dom.flagChips.querySelectorAll(".filter-chip").forEach(chip => {
                    const flag = chip.dataset.flag
                    const active = (flag === "featured" && state.featuredOnly) || (flag === "new" && state.newOnly)
                    chip.classList.toggle("active", active)
                })
            }

        }

        function syncStateToUrl() {
            const url = new URL(window.location.href)
            const hash = window.location.hash || ""

            if (state.search) url.searchParams.set("q", state.search)
            else url.searchParams.delete("q")

            if (state.sort !== "newest") url.searchParams.set("sort", state.sort)
            else url.searchParams.delete("sort")

            if (state.type !== "all") url.searchParams.set("type", state.type)
            else url.searchParams.delete("type")

            if (state.featuredOnly) url.searchParams.set("featured", "1")
            else url.searchParams.delete("featured")

            if (state.newOnly) url.searchParams.set("new", "1")
            else url.searchParams.delete("new")

            const fitValue = getCurrentFitParamValue()
            if (fitValue) url.searchParams.set("fit", fitValue)
            else url.searchParams.delete("fit")

            history.replaceState({}, "", `${url.pathname}${url.search}${hash}`)
        }

        function hydrateStateFromUrl() {
            const params = new URLSearchParams(window.location.search)
            const requestedSort = String(params.get("sort") || "").trim().toLowerCase()
            const requestedFit = String(params.get("fit") || "").trim().toLowerCase()

            state.search = String(params.get("q") || "").trim()
            state.sort = SORT_KEYS.has(requestedSort) ? requestedSort : "newest"
            state.type = String(params.get("type") || "all").trim().toLowerCase() || "all"
            state.featuredOnly = String(params.get("featured") || "") === "1"
            state.newOnly = String(params.get("new") || "") === "1"
            state.subcategories = {}

            const validTypes = new Set(config.quickTypes.map(item => item.value))
            if (!validTypes.has(state.type)) {
                state.type = "all"
            }

            config.categories.forEach(section => {
                const subcategories = normalizeSubcategories(section)
                if (!subcategories.length) return

                const sectionId = String(section?.id || "").trim().toLowerCase()
                const fitMatch = requestedFit
                    ? subcategories.find(subcategory =>
                        subcategory.id === requestedFit || subcategory.fit === requestedFit
                    )
                    : null

                state.subcategories[sectionId] = fitMatch?.id || subcategories[0].id
            })

            const hashId = String(window.location.hash || "").replace(/^#/, "").trim().toLowerCase()
            const hashAlias = getHashAlias(hashId)
            if (hashAlias?.sectionId) {
                const section = getSectionById(hashAlias.sectionId)
                const subcategories = normalizeSubcategories(section)
                if (section && subcategories.length && hashAlias.subcategoryId) {
                    const aliasSubcategory = String(hashAlias.subcategoryId || "").trim().toLowerCase()
                    const match = subcategories.find(subcategory =>
                        subcategory.id === aliasSubcategory || subcategory.fit === aliasSubcategory
                    )
                    if (match) {
                        state.subcategories[String(section.id || "").trim().toLowerCase()] = match.id
                    }
                }
            }

            syncAllSectionSubcategories()
        }

        function buildHeroStats() {
            if (!dom.heroStats) return

            const featuredCount = allProducts.filter(product => isEnabledFlag(product.featured)).length
            const newCount = allProducts.filter(product => isEnabledFlag(product.newCollection)).length

            dom.heroStats.innerHTML = [
                `${allProducts.length} Products`,
                `${featuredCount} Featured`,
                `${newCount} New Collection`
            ]
                .map(label => `<li>${escapeHtml(label)}</li>`)
                .join("")
        }

        function renderQuickTypeChips() {
            if (!dom.quickTypeChips) return

            dom.quickTypeChips.innerHTML = config.quickTypes
                .map(type => `
                    <button
                        type="button"
                        class="filter-chip ${state.type === type.value ? "active" : ""}"
                        data-action="set-type"
                        data-value="${escapeHtml(type.value)}"
                    >${escapeHtml(type.label)}</button>
                `)
                .join("")
        }

        function renderFlagChips() {
            if (!dom.flagChips) return

            dom.flagChips.innerHTML = `
                <button type="button" class="filter-chip ${state.featuredOnly ? "active" : ""}" data-action="toggle-flag" data-flag="featured">
                    Featured Only
                </button>
                <button type="button" class="filter-chip ${state.newOnly ? "active" : ""}" data-action="toggle-flag" data-flag="new">
                    New Collection Only
                </button>
            `
        }

        function renderCategoryStrip() {
            if (!dom.categoryStrip) return

            dom.categoryStrip.innerHTML = config.categories
                .map((section, index) => `
                    <button
                        type="button"
                        class="category-btn ${index === 0 ? "active" : ""}"
                        data-action="scroll-section"
                        data-target="${escapeHtml(section.id)}"
                    >${escapeHtml(section.navLabel || section.title)}</button>
                `)
                .join("")
        }

        function getCategoryCardOverride(section) {
            const aliasIds = getSectionAliasIds(section)
            const normalizedSectionId = String(section?.id || "").trim().toLowerCase()

            const exact = categoryCards.find(card =>
                String(card?.gender || "") === String(config.gender || "") &&
                String(card?.categoryId || "").trim().toLowerCase() === normalizedSectionId
            )

            if (exact) return exact

            return categoryCards.find(card =>
                String(card?.gender || "") === String(config.gender || "") &&
                aliasIds.includes(String(card?.categoryId || "").trim().toLowerCase())
            )
        }

        function getCategoryCardDisplayOrder(card) {
            const parsed = Number.parseInt(String(card?.displayOrder ?? ""), 10)
            if (Number.isNaN(parsed) || parsed < 1) return Number.MAX_SAFE_INTEGER
            return parsed
        }

        function getOrderedCategoriesForCards() {
            const defaultIndexById = new Map(
                config.categories.map((section, index) => [String(section.id || ""), index])
            )

            const cardOrderByCategoryId = new Map(
                categoryCards
                    .filter(card => String(card?.gender || "") === String(config.gender || ""))
                    .sort((a, b) => {
                        const orderDiff = getCategoryCardDisplayOrder(a) - getCategoryCardDisplayOrder(b)
                        if (orderDiff !== 0) return orderDiff
                        return new Date(a?.createdAt || 0) - new Date(b?.createdAt || 0)
                    })
                    .map((card, index) => [String(card?.categoryId || "").trim().toLowerCase(), index + 1])
            )

            return [...config.categories].sort((a, b) => {
                const orderA = getSectionAliasIds(a).reduce((min, aliasId) => {
                    const order = cardOrderByCategoryId.get(aliasId)
                    return order && order < min ? order : min
                }, Number.MAX_SAFE_INTEGER)
                const orderB = getSectionAliasIds(b).reduce((min, aliasId) => {
                    const order = cardOrderByCategoryId.get(aliasId)
                    return order && order < min ? order : min
                }, Number.MAX_SAFE_INTEGER)
                if (orderA !== orderB) return orderA - orderB

                const fallbackA = defaultIndexById.get(String(a.id || "")) ?? Number.MAX_SAFE_INTEGER
                const fallbackB = defaultIndexById.get(String(b.id || "")) ?? Number.MAX_SAFE_INTEGER
                return fallbackA - fallbackB
            })
        }

        function getCategoryFallbackImage(section) {
            const matches = allProducts
                .filter(product => productMatchesCategory(product, section))
                .sort((a, b) => getProductTimestamp(b) - getProductTimestamp(a))

            if (matches.length) {
                return getProductImage(matches[0])
            }

            return CATEGORY_CARD_PLACEHOLDER
        }

        function getCategoryPageLink(section) {
            const params = new URLSearchParams()
            params.set("gender", String(config.gender || ""))
            params.set("category", String(section?.id || ""))

            const activeSubcategory = getSectionSubcategory(section)
            if (activeSubcategory?.fit) {
                params.set("fit", activeSubcategory.id)
            }

            return `category.html?${params.toString()}`
        }

        function renderCategoryCards() {
            if (!dom.categoryCardsGrid) return

            dom.categoryCardsGrid.innerHTML = getOrderedCategoriesForCards()
                .map(section => {
                    const override = getCategoryCardOverride(section)
                    const title = String(override?.title || section.navLabel || section.title || "")
                    const subtitle = String(override?.subtitle || section.subtitle || "")
                    const image = String(override?.image || getCategoryFallbackImage(section) || CATEGORY_CARD_PLACEHOLDER)
                    const sectionLink = getCategoryPageLink(section)

                    return `
                        <a class="category-preview-card" href="${escapeHtml(sectionLink)}">
                            <div class="category-preview-media">
                                <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy" decoding="async">
                            </div>
                            <div class="category-preview-meta">
                                <h3>${escapeHtml(title)}</h3>
                                <p>${escapeHtml(subtitle || `${getGenderLabel(config.gender)} collection`)}</p>
                            </div>
                        </a>
                    `
                })
                .join("")

            setupCategoryCardsAutoScroll(dom.categoryCardsGrid)
        }

        function setupCategoryCardsAutoScroll(grid) {
            if (!grid || categoryCardAutoScrollers.has(grid)) return

            const mobileQuery = window.matchMedia("(max-width: 760px)")
            const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
            let index = 0
            let isPaused = false
            let scrollSyncTimer = null

            function cards() {
                return Array.from(grid.querySelectorAll(".category-preview-card"))
            }

            function scrollToCard(card, behavior = "smooth") {
                if (!card) return
                grid.scrollTo({
                    left: Math.max(0, card.offsetLeft - grid.offsetLeft - 1),
                    behavior
                })
            }

            function syncToNearestCard() {
                const items = cards()
                if (!items.length) return

                const currentLeft = grid.scrollLeft
                let closestIndex = 0
                let closestDistance = Number.POSITIVE_INFINITY

                items.forEach((card, cardIndex) => {
                    const distance = Math.abs((card.offsetLeft - grid.offsetLeft) - currentLeft)
                    if (distance < closestDistance) {
                        closestDistance = distance
                        closestIndex = cardIndex
                    }
                })

                index = closestIndex
            }

            window.setInterval(() => {
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
            }, 3800)

            grid.addEventListener("pointerdown", () => {
                isPaused = true
            })

            grid.addEventListener("pointerup", () => {
                syncToNearestCard()
                window.setTimeout(() => {
                    isPaused = false
                }, 1600)
            })

            grid.addEventListener("pointercancel", () => {
                isPaused = false
            })

            grid.addEventListener("focusin", () => {
                isPaused = true
            })

            grid.addEventListener("focusout", () => {
                syncToNearestCard()
                isPaused = false
            })

            grid.addEventListener("scroll", () => {
                if (!mobileQuery.matches) return
                window.clearTimeout(scrollSyncTimer)
                scrollSyncTimer = window.setTimeout(syncToNearestCard, 140)
            }, { passive: true })

            if (typeof mobileQuery.addEventListener === "function") {
                mobileQuery.addEventListener("change", event => {
                    if (!event.matches) {
                        grid.scrollTo({ left: 0, behavior: "auto" })
                        index = 0
                    }
                })
            }

            categoryCardAutoScrollers.set(grid, true)
        }

        function renderSkeletons() {
            if (!dom.sectionsHost) return

            dom.sectionsHost.innerHTML = config.categories
                .map((section, index) => `
                    <section class="collection-section ${index % 2 === 1 ? "alt" : ""}" id="${escapeHtml(section.id)}">
                        <div class="section-head">
                            <div>
                                <h2>${escapeHtml(section.title)}</h2>
                                <p>${escapeHtml(section.subtitle || "")}</p>
                            </div>
                            <span class="section-count">Loading</span>
                        </div>
                        <div class="products-grid skeleton-grid">
                            ${Array.from({ length: 4 }).map(() => `
                                <article class="skeleton-card">
                                    <div class="skeleton-media"></div>
                                    <div class="skeleton-body">
                                        <div class="skeleton-line lg"></div>
                                        <div class="skeleton-line md"></div>
                                        <div class="skeleton-line sm"></div>
                                    </div>
                                </article>
                            `).join("")}
                        </div>
                    </section>
                `)
                .join("")
        }

        function showError(message) {
            if (dom.errorState) {
                dom.errorState.classList.remove("hidden")
                const text = dom.errorState.querySelector("[data-error-message]")
                if (text) text.textContent = message || "Unable to load collection right now."
            }
        }

        function hideError() {
            if (dom.errorState) dom.errorState.classList.add("hidden")
        }

        function showEmptyState(show) {
            if (dom.emptyState) dom.emptyState.classList.toggle("hidden", !show)
            if (dom.sectionsHost) dom.sectionsHost.style.display = show ? "none" : ""
        }

        function buildProductMetaLabel(product) {
            const type = getTypeLabel(product.type)
            const fit = product.fit ? ` | ${toTitleCase(product.fit)}` : ""
            return `${toTitleCase(product.gender)} | ${type}${fit}`
        }

        function renderProductCard(product) {
            const productId = String(product._id)
            const featured = isEnabledFlag(product.featured)
            const isNew = isEnabledFlag(product.newCollection)
            const image = getProductImage(product)

            return `
                <article class="product-card" data-product-id="${escapeHtml(productId)}">
                    <a class="product-media" href="product.html?id=${escapeHtml(productId)}" aria-label="View ${escapeHtml(product.name)}">
                        <img src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">
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

        function renderRailCard(product) {
            const id = String(product._id)
            return `
                <article class="rail-card" data-action="open-product" data-id="${escapeHtml(id)}">
                    <img src="${escapeHtml(getProductImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">
                    <div class="rail-card-info">
                        <h4>${escapeHtml(product.name)}</h4>
                        <p>${escapeHtml(getTypeLabel(product.type))} | ${escapeHtml(formatCurrency(product.price))}</p>
                    </div>
                </article>
            `
        }

        function renderSections() {
            if (!dom.sectionsHost) return

            const sectionsMarkup = config.categories
                .map((section, index) => {
                    const subcategories = normalizeSubcategories(section)
                    const activeSubcategory = getSectionSubcategory(section)
                    const sectionTitle = String(activeSubcategory?.title || section.title || "")
                    const sectionSubtitle = String(activeSubcategory?.subtitle || section.subtitle || "")
                    const items = filteredProducts
                        .filter(product => productMatchesCategory(product, section))
                        .filter(product => productMatchesSubcategory(product, activeSubcategory))

                    const subcategoryControls = subcategories.length
                        ? `
                            <div class="section-subcategory-row">
                                <span class="section-subcategory-label">Fit</span>
                                <div class="section-subcategory-chips">
                                    ${subcategories.map(subcategory => `
                                        <button
                                            type="button"
                                            class="section-subcategory-chip ${activeSubcategory?.id === subcategory.id ? "active" : ""}"
                                            data-action="set-section-subcategory"
                                            data-section-id="${escapeHtml(section.id)}"
                                            data-subcategory-id="${escapeHtml(subcategory.id)}"
                                        >${escapeHtml(subcategory.navLabel || subcategory.title || subcategory.id)}</button>
                                    `).join("")}
                                </div>
                            </div>
                        `
                        : ""

                    const content = items.length
                        ? `<div class="products-grid">${items.map(renderProductCard).join("")}</div>`
                        : `<div class="products-grid"><p class="section-empty">No products match this section right now.</p></div>`

                    return `
                        <section class="collection-section ${index % 2 === 1 ? "alt" : ""}" id="${escapeHtml(section.id)}" data-section="${escapeHtml(section.id)}">
                            <div class="section-head">
                                <div>
                                    <h2>${escapeHtml(sectionTitle)}</h2>
                                    <p>${escapeHtml(sectionSubtitle)}</p>
                                </div>
                                <span class="section-count">${items.length} items</span>
                            </div>
                            ${subcategoryControls}
                            ${content}
                        </section>
                    `
                })
                .join("")

            dom.sectionsHost.innerHTML = sectionsMarkup
            setupSectionObserver()
        }

        function renderFilterSummary() {
            if (!dom.filterSummary) return

            const total = allProducts.length
            const filtered = filteredProducts.length
            const typeName = config.quickTypes.find(type => type.value === state.type)?.label || "All"
            const searchLabel = state.search ? `"${state.search}"` : "Any"
            const featuredLabel = state.featuredOnly ? "Featured only" : "Featured: Any"
            const newLabel = state.newOnly ? "New collection only" : "New: Any"
            const fitLabel = config.categories
                .map(section => {
                    const activeSubcategory = getSectionSubcategory(section)
                    if (!activeSubcategory) return ""
                    const sectionLabel = String(section.navLabel || section.title || "").trim()
                    const subcategoryLabel = String(activeSubcategory.navLabel || activeSubcategory.title || "").trim()
                    return `${sectionLabel}: ${subcategoryLabel}`
                })
                .filter(Boolean)
                .join(", ")
            const fitSegment = fitLabel ? ` | Fit: ${fitLabel}` : ""

            dom.filterSummary.textContent = `Showing ${filtered} of ${total} | Type: ${typeName} | Search: ${searchLabel} | ${featuredLabel} | ${newLabel}${fitSegment}`
        }

        function renderRecentlyViewedRail() {
            if (!dom.recentRail || !dom.recentRailRow) return

            const recentEntries = readRecentEntries()
            const idsInOrder = recentEntries.sort((a, b) => b.viewedAt - a.viewedAt).map(entry => entry.id)

            const rows = idsInOrder
                .map(id => allProducts.find(product => String(product._id) === id))
                .filter(Boolean)
                .filter(product => product.gender === config.gender)

            const unique = dedupeById(rows).slice(0, 10)

            if (!unique.length) {
                dom.recentRail.classList.add("hidden")
                dom.recentRailRow.innerHTML = ""
                return
            }

            dom.recentRail.classList.remove("hidden")
            dom.recentRailRow.innerHTML = unique.map(renderRailCard).join("")
        }

        function renderNewCollectionRail() {
            if (!dom.newRail || !dom.newRailRow) return

            const items = allProducts
                .filter(product => isEnabledFlag(product.newCollection))
                .sort((a, b) => {
                    const aPriority = Number.parseInt(String(a.newCollectionPriority || ""), 10)
                    const bPriority = Number.parseInt(String(b.newCollectionPriority || ""), 10)
                    const aValue = Number.isNaN(aPriority) ? Number.MAX_SAFE_INTEGER : aPriority
                    const bValue = Number.isNaN(bPriority) ? Number.MAX_SAFE_INTEGER : bPriority
                    if (aValue !== bValue) return aValue - bValue
                    return getProductTimestamp(b) - getProductTimestamp(a)
                })
                .slice(0, 12)

            if (!items.length) {
                dom.newRail.classList.add("hidden")
                dom.newRailRow.innerHTML = ""
                return
            }

            dom.newRail.classList.remove("hidden")
            dom.newRailRow.innerHTML = items.map(renderRailCard).join("")
        }

        function updateCompareUi() {
            if (!dom.compareBar || !dom.compareItems) return

            if (!compareIds.length) {
                dom.compareBar.classList.remove("active")
                dom.compareItems.innerHTML = ""
            } else {
                const products = compareIds
                    .map(id => allProducts.find(product => String(product._id) === id))
                    .filter(Boolean)

                dom.compareItems.innerHTML = products
                    .map(product => `<span class="compare-pill">${escapeHtml(product.name)}</span>`)
                    .join("")

                dom.compareBar.classList.add("active")
            }

            if (dom.sectionsHost) {
                dom.sectionsHost.querySelectorAll('[data-action="compare-toggle"]').forEach(button => {
                    const id = String(button.dataset.id || "")
                    button.classList.toggle("compare-active", compareIds.includes(id))
                    button.textContent = compareIds.includes(id) ? "Compared" : "Compare"
                })
            }
        }

        function renderCompareModal() {
            if (!dom.compareBody) return

            const selectedProducts = compareIds
                .map(id => allProducts.find(product => String(product._id) === id))
                .filter(Boolean)

            if (selectedProducts.length < 2) {
                dom.compareBody.innerHTML = "<p>Select at least two products to compare.</p>"
                return
            }

            const rows = [
                { label: "Price", values: selectedProducts.map(product => formatCurrency(product.price)) },
                { label: "Type", values: selectedProducts.map(product => getTypeLabel(product.type)) },
                { label: "Fit", values: selectedProducts.map(product => product.fit ? toTitleCase(product.fit) : "-") },
                { label: "Featured", values: selectedProducts.map(product => isEnabledFlag(product.featured) ? "Yes" : "No") },
                { label: "New Collection", values: selectedProducts.map(product => isEnabledFlag(product.newCollection) ? "Yes" : "No") }
            ]

            dom.compareBody.innerHTML = `
                <div class="compare-table-wrap">
                    <table class="compare-table">
                        <thead>
                            <tr>
                                <th>Attribute</th>
                                ${selectedProducts.map(product => `
                                    <th>
                                        <div class="compare-product-title">${escapeHtml(product.name)}</div>
                                        <a class="compare-link" href="product.html?id=${escapeHtml(product._id)}">View</a>
                                    </th>
                                `).join("")}
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(row => `
                                <tr>
                                    <th>${escapeHtml(row.label)}</th>
                                    ${row.values.map(value => `<td>${escapeHtml(value)}</td>`).join("")}
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            `
        }

        function openCompareModal() {
            if (!dom.compareModal) return
            if (compareIds.length < 2) {
                toast("Select at least 2 products to compare.", "warn")
                return
            }
            renderCompareModal()
            dom.compareModal.classList.add("active")
            syncOverlayScrollLock()
        }

        function closeCompareModal() {
            if (!dom.compareModal) return
            dom.compareModal.classList.remove("active")
            syncOverlayScrollLock()
        }

        function openQuickView(productId) {
            if (!dom.quickViewModal || !dom.quickViewBody) return

            const product = allProducts.find(item => String(item._id) === String(productId))
            if (!product) return

            quickViewProductId = String(product._id)
            const compareActive = compareIds.includes(quickViewProductId)

            dom.quickViewBody.innerHTML = `
                <div class="quick-view-grid">
                    <div class="quick-view-image">
                        <img src="${escapeHtml(getProductImage(product))}" alt="${escapeHtml(product.name)}">
                    </div>
                    <div class="quick-view-meta">
                        <h4>${escapeHtml(product.name)}</h4>
                        <p>${escapeHtml(buildProductMetaLabel(product))}</p>
                        <div class="quick-view-price">${escapeHtml(formatCurrency(product.price))}</div>
                        <div class="quick-view-actions">
                            <a class="primary" href="product.html?id=${escapeHtml(product._id)}">Open Product Page</a>
                            <button type="button" data-action="quick-add-to-cart" data-id="${escapeHtml(product._id)}">Add to Cart</button>
                            <button type="button" data-action="quick-compare-toggle" data-id="${escapeHtml(product._id)}" class="${compareActive ? "primary" : ""}">
                                ${compareActive ? "Remove Compare" : "Add to Compare"}
                            </button>
                        </div>
                    </div>
                </div>
            `

            dom.quickViewModal.classList.add("active")
            syncOverlayScrollLock()
        }

        function closeQuickView() {
            if (!dom.quickViewModal) return
            dom.quickViewModal.classList.remove("active")
            quickViewProductId = null
            syncOverlayScrollLock()
        }

        function toggleCompare(productId) {
            const id = String(productId || "")
            if (!id) return

            if (compareIds.includes(id)) {
                compareIds = compareIds.filter(item => item !== id)
                updateCompareUi()
                return
            }

            if (compareIds.length >= 3) {
                toast("You can compare up to 3 products at once.", "warn")
                return
            }

            compareIds = [...compareIds, id]
            updateCompareUi()
        }

        async function addProductToCart(productId) {
            const cart = window.LuxoraCart
            if (!cart) {
                toast("Cart module is unavailable.", "warn")
                return
            }

            const product = allProducts.find(item => String(item._id) === String(productId))
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

        function applyFiltersAndSort() {
            const normalizedSearch = String(state.search || "").trim().toLowerCase()

            filteredProducts = allProducts
                .filter(product => {
                    if (state.type !== "all" && String(product.type || "") !== state.type) {
                        return false
                    }

                    if (state.featuredOnly && !isEnabledFlag(product.featured)) {
                        return false
                    }

                    if (state.newOnly && !isEnabledFlag(product.newCollection)) {
                        return false
                    }

                    if (normalizedSearch && !createSearchIndex(product).includes(normalizedSearch)) {
                        return false
                    }

                    return true
                })
                .sort((a, b) => {
                    if (state.sort === "price_asc") return Number(a.price || 0) - Number(b.price || 0)
                    if (state.sort === "price_desc") return Number(b.price || 0) - Number(a.price || 0)
                    if (state.sort === "featured") {
                        const featuredDiff = Number(isEnabledFlag(b.featured)) - Number(isEnabledFlag(a.featured))
                        if (featuredDiff !== 0) return featuredDiff
                    }
                    if (state.sort === "new_collection") {
                        const newDiff = Number(isEnabledFlag(b.newCollection)) - Number(isEnabledFlag(a.newCollection))
                        if (newDiff !== 0) return newDiff
                    }
                    return getProductTimestamp(b) - getProductTimestamp(a)
                })
        }

        function persistPreset() {
            try {
                const presetKey = `${PRESET_KEY_PREFIX}${config.key}`

                localStorage.setItem(
                    presetKey,
                    JSON.stringify({
                        ...state,
                        savedAt: Date.now()
                    })
                )

                toast("Filter preset saved for this collection.", "success")
            } catch (err) {
                toast("Unable to save preset right now.", "warn")
            }
        }

        function loadPreset() {
            try {
                const presetKey = `${PRESET_KEY_PREFIX}${config.key}`
                const raw = localStorage.getItem(presetKey)

                if (!raw) {
                    toast("No saved preset found yet.", "warn")
                    return
                }

                const preset = safeParseJson(raw, null)
                if (!preset || typeof preset !== "object") {
                    toast("Saved preset is invalid.", "warn")
                    return
                }

                state.search = String(preset.search || "")
                state.sort = SORT_KEYS.has(String(preset.sort || "")) ? preset.sort : "newest"
                state.type = String(preset.type || "all")
                state.featuredOnly = !!preset.featuredOnly
                state.newOnly = !!preset.newOnly
                state.subcategories = typeof preset.subcategories === "object" && preset.subcategories
                    ? { ...preset.subcategories }
                    : {}

                const validTypes = new Set(config.quickTypes.map(type => type.value))
                if (!validTypes.has(state.type)) state.type = "all"
                syncAllSectionSubcategories()

                renderEverything()
                toast("Preset loaded.", "success")
            } catch (err) {
                toast("Unable to load preset.", "warn")
            }
        }

        function resetFilters() {
            state.search = ""
            state.sort = "newest"
            state.type = "all"
            state.featuredOnly = false
            state.newOnly = false
            state.subcategories = {}
            syncAllSectionSubcategories()
            renderEverything()
        }

        function renderEverything() {
            hideError()
            applyFiltersAndSort()
            renderFilterSummary()
            renderCategoryCards()
            renderSections()
            renderQuickTypeChips()
            renderFlagChips()
            renderRecentlyViewedRail()
            renderNewCollectionRail()
            updateCompareUi()
            syncStateToControls()
            syncStateToUrl()
            showEmptyState(filteredProducts.length === 0)
            maybeScrollToInitialHash()
        }

        function setActiveCategoryButton(sectionId) {
            if (!dom.categoryStrip) return

            dom.categoryStrip.querySelectorAll(".category-btn").forEach(button => {
                button.classList.toggle("active", button.dataset.target === sectionId)
            })
        }

        function maybeScrollToInitialHash() {
            if (hasHandledInitialHash) return
            hasHandledInitialHash = true

            const hash = String(window.location.hash || "").replace(/^#/, "").trim().toLowerCase()
            if (!hash) return

            const alias = getHashAlias(hash)
            const targetSectionId = String(alias?.sectionId || hash).trim().toLowerCase()
            const section = document.getElementById(targetSectionId)
            if (!section) return

            if (alias?.subcategoryId) {
                const sectionConfig = getSectionById(targetSectionId)
                const subcategories = normalizeSubcategories(sectionConfig)
                const aliasSubcategory = String(alias.subcategoryId || "").trim().toLowerCase()
                const match = subcategories.find(subcategory =>
                    subcategory.id === aliasSubcategory || subcategory.fit === aliasSubcategory
                )

                if (sectionConfig && match) {
                    const key = String(sectionConfig.id || "").trim().toLowerCase()
                    if (state.subcategories[key] !== match.id) {
                        state.subcategories[key] = match.id
                        renderEverything()
                        requestAnimationFrame(() => {
                            const updatedSection = document.getElementById(targetSectionId)
                            if (!updatedSection) return
                            updatedSection.scrollIntoView({ behavior: "smooth", block: "start" })
                            setActiveCategoryButton(targetSectionId)
                        })
                        return
                    }
                }
            }

            requestAnimationFrame(() => {
                section.scrollIntoView({ behavior: "smooth", block: "start" })
                setActiveCategoryButton(targetSectionId)
            })
        }

        function setupSectionObserver() {
            if (sectionObserver) {
                sectionObserver.disconnect()
                sectionObserver = null
            }

            if (!dom.sectionsHost) return

            const sections = dom.sectionsHost.querySelectorAll("[data-section]")
            if (!sections.length) return

            sectionObserver = new IntersectionObserver(entries => {
                const visible = entries
                    .filter(entry => entry.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio)

                if (!visible.length) return

                const activeSection = visible[0].target.getAttribute("data-section")
                setActiveCategoryButton(activeSection)
            }, {
                threshold: [0.15, 0.28, 0.45],
                rootMargin: "-90px 0px -50% 0px"
            })

            sections.forEach(section => sectionObserver.observe(section))
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

        function closeFilterDrawerIfMobile() {
            if (window.innerWidth <= 900) {
                dom.body.classList.remove("filters-open")
                syncOverlayScrollLock()
            }
        }

        function toast(message, type = "info") {
            if (!dom.toastHost) return

            const node = document.createElement("div")
            node.className = `toast ${type}`
            node.textContent = message
            dom.toastHost.appendChild(node)

            setTimeout(() => {
                node.remove()
            }, 2400)
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

        async function loadData() {
            try {
                hideError()
                showEmptyState(false)
                renderSkeletons()

                const [productsResult, bannersResult, cardsResult] = await Promise.allSettled([
                    fetchJson(`/api/products?gender=${encodeURIComponent(config.gender)}`),
                    fetchJson("/api/banners"),
                    fetchJson("/api/category-cards")
                ])

                if (productsResult.status !== "fulfilled") {
                    throw productsResult.reason || new Error("Unable to load products.")
                }

                const products = productsResult.value
                const banners = bannersResult.status === "fulfilled" ? bannersResult.value : []
                const cards = cardsResult.status === "fulfilled" ? cardsResult.value : []

                allProducts = (Array.isArray(products) ? products : [])
                    .filter(isStorefrontProductVisible)
                categoryCards = Array.isArray(cards) ? cards : []

                const bannerMap = new Map(
                    (Array.isArray(banners) ? banners : [])
                        .map(banner => [String(banner?.type || "").trim(), banner])
                        .filter(([type]) => type)
                )
                const heroImages = config.bannerTypes
                    .map(type => bannerMap.get(type)?.image)
                    .filter(Boolean)

                renderHeroSlides(heroImages)

                buildHeroStats()
                renderEverything()
            } catch (err) {
                console.log("Collection page load error:", err)
                showError(err?.message || "Unable to load this collection right now.")
            }
        }

        async function handleGlobalClick(event) {
            const actionTarget = event.target.closest("[data-action]")
            if (!actionTarget) return

            const action = actionTarget.dataset.action

            if (action === "set-type") {
                state.type = String(actionTarget.dataset.value || "all")
                renderEverything()
                closeFilterDrawerIfMobile()
                return
            }

            if (action === "set-section-subcategory") {
                const sectionId = String(actionTarget.dataset.sectionId || "").trim().toLowerCase()
                const nextSubcategoryId = String(actionTarget.dataset.subcategoryId || "").trim().toLowerCase()
                const section = getSectionById(sectionId)
                const subcategories = normalizeSubcategories(section)
                if (!section || !subcategories.length) return

                const isValid = subcategories.some(subcategory => subcategory.id === nextSubcategoryId)
                if (!isValid) return

                state.subcategories[sectionId] = nextSubcategoryId
                renderEverything()
                return
            }

            if (action === "toggle-flag") {
                const flag = actionTarget.dataset.flag
                if (flag === "featured") state.featuredOnly = !state.featuredOnly
                if (flag === "new") state.newOnly = !state.newOnly
                renderEverything()
                closeFilterDrawerIfMobile()
                return
            }

            if (action === "scroll-section") {
                const sectionId = String(actionTarget.dataset.target || "")
                const section = document.getElementById(sectionId)
                if (section) {
                    section.scrollIntoView({ behavior: "smooth", block: "start" })
                    const url = new URL(window.location.href)
                    history.replaceState({}, "", `${url.pathname}${url.search}#${sectionId}`)
                }
                return
            }

            if (action === "quick-view") {
                openQuickView(String(actionTarget.dataset.id || ""))
                return
            }

            if (action === "add-to-cart" || action === "quick-add-to-cart") {
                const productId = String(actionTarget.dataset.id || "")
                if (!productId) return

                await addProductToCart(productId)
                return
            }

            if (action === "compare-toggle") {
                toggleCompare(String(actionTarget.dataset.id || ""))
                return
            }

            if (action === "quick-compare-toggle") {
                const productId = String(actionTarget.dataset.id || "")
                toggleCompare(productId)
                if (quickViewProductId && String(quickViewProductId) === productId) {
                    openQuickView(productId)
                }
                return
            }

            if (action === "open-product") {
                const productId = String(actionTarget.dataset.id || "")
                if (productId) {
                    window.location.href = `product.html?id=${productId}`
                }
            }
        }

        function bindEvents() {
            document.addEventListener("click", handleGlobalClick)

            if (dom.searchInput) {
                dom.searchInput.addEventListener("input", event => {
                    clearTimeout(searchTimer)
                    searchTimer = setTimeout(() => {
                        state.search = String(event.target.value || "").trim()
                        renderEverything()
                    }, SEARCH_DEBOUNCE_MS)
                })
            }

            if (dom.sortSelect) {
                dom.sortSelect.addEventListener("change", event => {
                    const nextSort = String(event.target.value || "newest")
                    state.sort = SORT_KEYS.has(nextSort) ? nextSort : "newest"
                    renderEverything()
                })
            }

            dom.clearFiltersBtn?.addEventListener("click", resetFilters)
            dom.emptyResetBtn?.addEventListener("click", resetFilters)
            dom.errorRetryBtn?.addEventListener("click", loadData)
            dom.savePresetBtn?.addEventListener("click", persistPreset)
            dom.loadPresetBtn?.addEventListener("click", loadPreset)
            dom.heroDots?.addEventListener("click", event => {
                const dot = event.target.closest("[data-hero-slide-index]")
                if (!dot) return

                setHeroSlide(Number(dot.dataset.heroSlideIndex || 0))
                startHeroSlider()
            })

            dom.mobileFilterToggle?.addEventListener("click", () => {
                dom.body.classList.toggle("filters-open")
                syncOverlayScrollLock()
            })

            dom.filterCloseBtn?.addEventListener("click", () => {
                dom.body.classList.remove("filters-open")
                syncOverlayScrollLock()
            })

            dom.quickViewOverlay?.addEventListener("click", closeQuickView)
            dom.quickViewClose?.addEventListener("click", closeQuickView)
            dom.compareOverlay?.addEventListener("click", closeCompareModal)
            dom.compareCloseBtn?.addEventListener("click", closeCompareModal)
            dom.compareOpenBtn?.addEventListener("click", openCompareModal)

            dom.compareClearBtn?.addEventListener("click", () => {
                compareIds = []
                updateCompareUi()
            })

            dom.backToTopBtn?.addEventListener("click", () => {
                window.scrollTo({ top: 0, behavior: "smooth" })
            })

            window.addEventListener("scroll", updateScrollUi, { passive: true })
            window.addEventListener("resize", () => {
                updateScrollUi()
                if (window.innerWidth > 900) {
                    dom.body.classList.remove("filters-open")
                }
                syncOverlayScrollLock()
            })

            window.addEventListener("keydown", event => {
                if (event.key !== "Escape") return
                closeQuickView()
                closeCompareModal()
                dom.body.classList.remove("filters-open")
                syncOverlayScrollLock()
            })

            window.addEventListener("popstate", () => {
                hydrateStateFromUrl()
                renderEverything()
            })
        }

        function renderStaticUi() {
            syncPageMeta()
            renderCategoryStrip()
            renderCategoryCards()
            renderQuickTypeChips()
            renderFlagChips()
            renderFilterSummary()
            renderSkeletons()
            updateScrollUi()
            syncOverlayScrollLock()
        }

        hydrateStateFromUrl()
        renderStaticUi()
        bindEvents()
        loadData()
    }

    window.initCollectionPage = initCollectionPage
})()
