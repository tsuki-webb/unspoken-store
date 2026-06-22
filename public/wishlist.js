async function ensureRenderFnReady() {
    if (typeof renderHomeProductCard === "function") return true
    // wait a short while for index.js to initialize
    return new Promise(resolve => {
        let attempts = 0
        const iv = setInterval(() => {
            attempts++
            if (typeof renderHomeProductCard === "function" || attempts > 20) {
                clearInterval(iv)
                resolve(typeof renderHomeProductCard === "function")
            }
        }, 80)
    })
}

async function loadWishlistPage() {
    const container = document.getElementById("wishlistContainer")
    if (!container) return

    try {
        const localEmail = localStorage.getItem("userEmail") || ""
        const backendEmail = (window.LuxoraCart?.getUser?.() || {}).email || ""
        const userEmail = localEmail || backendEmail || ""
        const query = userEmail ? `?userEmail=${encodeURIComponent(userEmail)}` : ""
        const headers = {}
        if (userEmail) headers["x-user-email"] = userEmail

        const res = await fetch(`/api/wishlist${query}`, { credentials: "include", headers })
        if (!res.ok) {
            // if unauthenticated show empty state prompting signin
            if (res.status === 401) {
                container.innerHTML = `<p class="empty-state">Please sign in to view your wishlist.</p>`
                return
            }
            throw new Error("Failed to load wishlist")
        }
        const data = await res.json()
        if (!Array.isArray(data) || !data.length) {
            renderWishlistEmptyState(container)
            return
        }

        const ready = await ensureRenderFnReady()
        if (ready) {
            container.innerHTML = data.map(renderHomeProductCard).join("")
        } else {
            // fallback simple rendering
            container.innerHTML = data.map(p => `
                <article class="product-card">
                    <div class="home-product-media"><img src="${escapeHtml(p.images?.[0] || p.image || '')}" alt="${escapeHtml(p.name)}"></div>
                    <div class="home-product-copy">
                        <h4>${escapeHtml(p.name)}</h4>
                        <div class="home-product-footer"><span>&#8377; ${escapeHtml(p.price)}</span></div>
                    </div>
                </article>
            `).join("")
        }

        // ensure wishlist buttons reflect state
        setTimeout(() => {
            if (typeof loadUserWishlist === "function") loadUserWishlist()
        }, 120)
    } catch (err) {
        console.error("loadWishlistPage error:", err)
        container.innerHTML = `<p class="empty-state">Unable to load wishlist. Please try again later.</p>`
    }
}

function renderWishlistEmptyState(container = document.getElementById("wishlistContainer")) {
    if (!container) return

    container.innerHTML = `
        <div class="wishlist-empty">
            <p>Your wishlist is empty.</p>
            <a href="index.html#featuredProducts">Start adding items</a>
        </div>
    `
}

window.addEventListener("luxora:wishlist-updated", event => {
    const container = document.getElementById("wishlistContainer")
    if (!container) return

    const ids = new Set((event.detail?.ids || []).map(id => String(id)))

    container.querySelectorAll(".product-card[data-product-id]").forEach(card => {
        const productId = decodeURIComponent(String(card.dataset.productId || ""))
        if (!ids.has(productId)) card.remove()
    })

    if (!container.querySelector(".product-card")) {
        renderWishlistEmptyState(container)
    }
})

document.addEventListener("DOMContentLoaded", () => loadWishlistPage())
