const params = new URLSearchParams(window.location.search)
const id = params.get("id")
const RECENTLY_VIEWED_KEY = "luxora_recently_viewed_v1"
let currentProduct = null

const INR_SYMBOL = String.fromCharCode(8377)
const STOREFRONT_ALLOWED_TYPES_BY_GENDER = {
    men: new Set(["tshirt", "shirt", "short", "sweatpant"]),
    women: new Set(["tshirt", "top", "sweatpant"]),
    unisex: new Set(["tshirt"])
}

function escapeHtml(value = "") {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
}

function isStorefrontProductVisible(product) {
    const gender = String(product?.gender || "").trim().toLowerCase()
    const type = String(product?.type || "").trim().toLowerCase()
    const allowed = STOREFRONT_ALLOWED_TYPES_BY_GENDER[gender]
    if (!allowed) return true
    return allowed.has(type)
}

function formatCurrency(value) {
    const number = Number(value || 0)
    return `${INR_SYMBOL} ${number.toLocaleString("en-IN")}`
}

function getProductImages(product) {
    if (Array.isArray(product.images) && product.images.length > 0) {
        return product.images
    }

    if (product.image) {
        return [product.image]
    }

    return ["https://via.placeholder.com/400"]
}

function toTitleCase(value) {
    return String(value || "")
        .split(" ")
        .filter(Boolean)
        .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join(" ")
}

function getTypeLabel(type) {
    if (type === "tshirt") return "T-Shirt"
    if (type === "top") return "Top"
    if (type === "shirt") return "Shirt"
    if (type === "short") return "Short"
    if (type === "sweatpant") return "Sweatpants"
    return toTitleCase(type)
}

function renderProductMeta(product) {
    const metaEl = document.getElementById("productMeta")

    if (!metaEl) return

    const chips = [
        toTitleCase(product.gender),
        getTypeLabel(product.type)
    ]

    if (product.type === "tshirt" && product.fit) {
        chips.push(toTitleCase(product.fit))
    }

    metaEl.innerHTML = chips
        .filter(Boolean)
        .map(chip => `<span class="meta-chip">${chip}</span>`)
        .join("")
}

function renderMainProduct(product) {
    document.title = `${product.name} | Product`
    document.getElementById("productName").innerText = product.name
    document.getElementById("productPrice").innerText = formatCurrency(product.price)

    renderProductMeta(product)

    const mainImage = document.getElementById("mainImage")
    const thumbContainer = document.getElementById("thumbnailList")

    const images = getProductImages(product)

    mainImage.src = images[0]

    thumbContainer.innerHTML = images.map((img, index) => `
        <button
            type="button"
            class="thumbnail-btn ${index === 0 ? "active" : ""}"
            data-image-src="${encodeURIComponent(String(img || ""))}"
            aria-label="View product image ${index + 1}"
        >
            <img src="${escapeHtml(img)}" alt="${escapeHtml(product.name)} thumbnail ${index + 1}" loading="lazy" decoding="async">
        </button>
    `).join("")

    thumbContainer.querySelectorAll(".thumbnail-btn").forEach(button => {
        button.addEventListener("click", () => {
            changeImage(decodeURIComponent(button.dataset.imageSrc || ""), button)
        })
    })

    document.getElementById("detailsContent").innerHTML = `
        <p><b>Material & Care:</b><br>${escapeHtml(product.material || "")}<br>${escapeHtml(product.care || "")}</p>
        <p><b>Country of Origin:</b> ${escapeHtml(product.countryOfOrigin || "India")}</p>
        <p><b>Manufactured & Sold By:</b><br>${escapeHtml(product.manufacturedBy || "")}</p>
        <p>${escapeHtml(product.address || "")}</p>
        <p>${escapeHtml(product.customerCare || "")}</p>
    `

    document.getElementById("descContent").innerText =
        product.description || "Premium quality product"

    document.getElementById("artistContent").innerText =
        product.artistDetails || "-"
}

function pickUnique(candidates, usedIds, limit) {
    const picks = []

    for (const product of candidates) {
        const productId = String(product._id)

        if (usedIds.has(productId)) continue

        usedIds.add(productId)
        picks.push(product)

        if (picks.length >= limit) break
    }

    return picks
}

function renderRelatedCard(product) {
    return `
        <article class="related-card" onclick="goToProduct('${encodeURIComponent(String(product._id || ""))}')">
            <img src="${escapeHtml(product.images?.[0] || product.image || "")}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">
            <h4>${escapeHtml(product.name)}</h4>
            <div class="meta">
                <span>${escapeHtml(getTypeLabel(product.type))}</span>
                <b>${escapeHtml(formatCurrency(product.price))}</b>
            </div>
        </article>
    `
}

function renderRelatedSection(title, subtitle, products) {
    if (!products.length) return ""

    return `
        <div class="related-group">
            <div class="related-group-header">
                <h3 class="related-group-title">${title}</h3>
                <p class="related-group-subtitle">${subtitle}</p>
            </div>
            <div class="related-row">
                ${products.map(renderRelatedCard).join("")}
            </div>
        </div>
    `
}

function loadRelated(currentProduct, allProducts) {
    const container = document.getElementById("relatedSections")

    if (!container) return

    const others = allProducts.filter(p => String(p._id) !== String(currentProduct._id))
    const sameStyle = others.filter(p =>
        p.gender === currentProduct.gender &&
        p.type === currentProduct.type &&
        (currentProduct.type !== "tshirt" || p.fit === currentProduct.fit)
    )

    const sameType = others.filter(p =>
        p.type === currentProduct.type
    )

    const sameGender = others.filter(p =>
        p.gender === currentProduct.gender
    )

    const fresh = [...others].sort((a, b) =>
        new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    )

    const usedIds = new Set()

    const sections = [
        {
            title: "More In This Style",
            subtitle: "Closest match to your current selection",
            items: pickUnique(sameStyle, usedIds, 6)
        },
        {
            title: "Same Category Picks",
            subtitle: "More options in this product category",
            items: pickUnique(sameType, usedIds, 6)
        },
        {
            title: `From ${toTitleCase(currentProduct.gender)} Collection`,
            subtitle: "Curated alternatives from the same collection",
            items: pickUnique(sameGender, usedIds, 6)
        },
        {
            title: "Fresh Drops",
            subtitle: "New arrivals you may want to check next",
            items: pickUnique(fresh, usedIds, 6)
        }
    ].filter(section => section.items.length > 0)

    if (!sections.length) {
        container.innerHTML = "<p style='opacity:0.68;margin:0;'>More products are coming soon.</p>"
        return
    }

    container.innerHTML = sections
        .map(section => renderRelatedSection(section.title, section.subtitle, section.items))
        .join("")
}

function persistRecentlyViewed(product) {
    try {
        if (!product?._id) return

        const raw = localStorage.getItem(RECENTLY_VIEWED_KEY)
        const parsed = JSON.parse(raw || "[]")
        const existing = Array.isArray(parsed) ? parsed : []

        const next = [
            {
                id: String(product._id),
                viewedAt: Date.now()
            },
            ...existing.filter(item => String(item?.id || "") !== String(product._id))
        ].slice(0, 30)

        localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next))
    } catch (err) {
        console.log("Recently viewed persist error:", err)
    }
}

async function loadProduct() {
    try {
        if (!id) {
            console.error("Product id missing in URL")
            return
        }

        const res = await fetch("/api/products")
        const products = await res.json()
        const visibleProducts = (Array.isArray(products) ? products : [])
            .filter(isStorefrontProductVisible)

        const product = visibleProducts.find(x => String(x._id) === String(id))

        if (!product) {
            console.error("Product not found")
            return
        }

        currentProduct = product
        renderMainProduct(product)
        persistRecentlyViewed(product)
        loadRelated(product, visibleProducts)
        bindCartActions()

    } catch (err) {
        console.log("Product page load error:", err)
    }
}

function changeImage(src, el) {
    const main = document.getElementById("mainImage")

    main.style.opacity = 0

    setTimeout(() => {
        main.src = src
        main.style.opacity = 1
    }, 150)

    document.querySelectorAll(".thumbnail-btn")
        .forEach(button => button.classList.remove("active"))

    el.classList.add("active")
}

function setupAccordion() {
    const titles = document.querySelectorAll(".acc-title")

    titles.forEach((title, index) => {
        const content = title.nextElementSibling

        if (index === 0 && content) {
            content.style.display = "block"
            title.setAttribute("aria-expanded", "true")
        }

        title.addEventListener("click", () => {
            const isOpen = content.style.display === "block"
            content.style.display = isOpen ? "none" : "block"
            title.setAttribute("aria-expanded", isOpen ? "false" : "true")
        })
    })
}

function setupSizes() {
    const sizeButtons = [...document.querySelectorAll(".size-buttons button")]

    sizeButtons.forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".size-buttons button")
                .forEach(b => b.classList.remove("active"))

            btn.classList.add("active")
        }
    })

    const defaultButton = sizeButtons.find(btn =>
        String(btn.textContent || "").trim().toUpperCase() === "M"
    ) || sizeButtons[0]

    if (defaultButton) {
        defaultButton.classList.add("active")
    }
}

function goToProduct(productId) {
    window.location.href = `/product.html?id=${decodeURIComponent(String(productId || ""))}`
}

function showToast(message) {
    const toast = document.getElementById("productToast")
    if (!toast) return

    toast.textContent = message
    toast.classList.add("show")

    clearTimeout(showToast._timer)
    showToast._timer = setTimeout(() => {
        toast.classList.remove("show")
    }, 2000)
}

function getSelectedSize() {
    const active = document.querySelector(".size-buttons button.active")
    const label = String(active?.textContent || "M").trim().toUpperCase()
    return ["XS", "S", "M", "L", "XL"].includes(label) ? label : "M"
}

function getSelectedQuantity() {
    const quantitySelect = document.getElementById("quantitySelect")
    const parsed = Number.parseInt(String(quantitySelect?.value || "1"), 10)

    if (Number.isNaN(parsed)) return 1
    if (parsed < 1) return 1
    if (parsed > 20) return 20
    return parsed
}

function setCartButtonsLoading(isLoading) {
    const addBtn = document.getElementById("addCartBtn")
    const buyBtn = document.getElementById("buyNowBtn")

    if (addBtn) {
        addBtn.disabled = isLoading
        addBtn.classList.toggle("loading", isLoading)
    }

    if (buyBtn) {
        buyBtn.disabled = isLoading
        buyBtn.classList.toggle("loading", isLoading)
    }
}

async function addCurrentProductToCart({ redirectToCart = false } = {}) {
    if (!currentProduct?._id) return
    if (!window.LuxoraCart?.addItem) {
        showToast("Cart is unavailable right now")
        return
    }

    try {
        setCartButtonsLoading(true)

        await window.LuxoraCart.addItem({
            productId: currentProduct._id,
            quantity: getSelectedQuantity(),
            size: getSelectedSize()
        })

        if (redirectToCart) {
            window.location.href = "cart.html"
            return
        }

        showToast("Added to cart")
    } catch (err) {
        if (String(err?.message || "") === "signin-required") {
            showToast("Sign in to add products to cart")
            return
        }

        console.log("Add to cart error:", err)
        showToast("Unable to add to cart right now")
    } finally {
        setCartButtonsLoading(false)
    }
}

function bindCartActions() {
    const addBtn = document.getElementById("addCartBtn")
    const buyBtn = document.getElementById("buyNowBtn")

    if (addBtn && !addBtn.dataset.bound) {
        addBtn.dataset.bound = "1"
        addBtn.addEventListener("click", () => {
            addCurrentProductToCart({ redirectToCart: false })
        })
    }

    if (buyBtn && !buyBtn.dataset.bound) {
        buyBtn.dataset.bound = "1"
        buyBtn.addEventListener("click", () => {
            addCurrentProductToCart({ redirectToCart: true })
        })
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadProduct()
    setupAccordion()
    setupSizes()
})
