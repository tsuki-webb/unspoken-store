(function cartPageBootstrap() {
    const INR_SYMBOL = String.fromCharCode(8377)
    const TAX_RATE = 0.05
    const CHECKOUT_STORAGE_KEY = "luxoraCheckoutProfileV1"
    const ALLOWED_PAYMENT_METHODS = new Set(["cod", "upi", "card", "netbanking"])
    const DEFAULT_CHECKOUT_OPTIONS = {
        currency: "INR",
        paymentOptions: []
    }

    const state = {
        cart: null,
        recommendations: [],
        checkoutOptions: { ...DEFAULT_CHECKOUT_OPTIONS },
        checkoutSubmitting: false
    }

    const dom = {
        subhead: document.getElementById("cartSubhead"),
        clearCartBtn: document.getElementById("clearCartBtn"),
        infoBanner: document.getElementById("cartInfoBanner"),
        emptyState: document.getElementById("cartEmptyState"),
        cartList: document.getElementById("cartList"),
        recommendedSection: document.getElementById("recommendedSection"),
        recommendedGrid: document.getElementById("recommendedGrid"),
        summaryItems: document.getElementById("summaryItems"),
        summarySubtotal: document.getElementById("summarySubtotal"),
        summaryShipping: document.getElementById("summaryShipping"),
        summaryTax: document.getElementById("summaryTax"),
        summaryGrandTotal: document.getElementById("summaryGrandTotal"),
        shippingHint: document.getElementById("shippingHint"),
        shippingProgressValue: document.getElementById("shippingProgressValue"),
        checkoutBtn: document.getElementById("checkoutBtn"),
        toast: document.getElementById("cartToast"),
        checkoutModal: document.getElementById("checkoutModal"),
        checkoutCloseBtn: document.getElementById("checkoutCloseBtn"),
        checkoutCancelBtn: document.getElementById("checkoutCancelBtn"),
        checkoutForm: document.getElementById("checkoutForm"),
        checkoutSubmitBtn: document.getElementById("checkoutSubmitBtn"),
        checkoutFeedback: document.getElementById("checkoutFeedback"),
        checkoutSubtitle: document.getElementById("checkoutSubtitle"),
        checkoutSummaryItems: document.getElementById("checkoutSummaryItems"),
        checkoutReviewItems: document.getElementById("checkoutReviewItems"),
        checkoutReviewSubtotal: document.getElementById("checkoutReviewSubtotal"),
        checkoutReviewShipping: document.getElementById("checkoutReviewShipping"),
        checkoutReviewTax: document.getElementById("checkoutReviewTax"),
        checkoutReviewTotal: document.getElementById("checkoutReviewTotal"),
        checkoutCustomerName: document.getElementById("checkoutCustomerName"),
        checkoutCustomerPhone: document.getElementById("checkoutCustomerPhone"),
        checkoutCustomerEmail: document.getElementById("checkoutCustomerEmail"),
        checkoutLine1: document.getElementById("checkoutLine1"),
        checkoutLine2: document.getElementById("checkoutLine2"),
        checkoutCity: document.getElementById("checkoutCity"),
        checkoutState: document.getElementById("checkoutState"),
        checkoutPostalCode: document.getElementById("checkoutPostalCode"),
        checkoutCountry: document.getElementById("checkoutCountry"),
        checkoutLandmark: document.getElementById("checkoutLandmark"),
        checkoutNotes: document.getElementById("checkoutNotes"),
        paymentMethods: document.getElementById("paymentMethods")
    }

    function formatCurrency(value) {
        const number = Number(value || 0)
        return `${INR_SYMBOL} ${number.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`
    }

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
    }

    function normalizeText(value) {
        return String(value || "").trim()
    }

    function normalizeLower(value) {
        return normalizeText(value).toLowerCase()
    }

    function normalizePhone(value) {
        const trimmed = normalizeText(value)
        if (!trimmed) return ""

        const hasPlus = trimmed.startsWith("+")
        const digits = trimmed.replace(/[^0-9]/g, "")
        if (!digits) return ""
        return hasPlus ? `+${digits}` : digits
    }

    function isValidPhone(value) {
        const digits = String(value || "").replace(/[^0-9]/g, "")
        return digits.length >= 10 && digits.length <= 15
    }

    function isValidPostalCode(value) {
        return /^[A-Za-z0-9][A-Za-z0-9\-\s]{3,9}$/.test(normalizeText(value))
    }

    function getSizeOptions(selected) {
        return ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]
            .map(size => `<option value="${size}" ${selected === size ? "selected" : ""}>${size}</option>`)
            .join("")
    }

    function getProductMeta(item) {
        if (item.itemType === "custom-preset") {
            const fit = String(item.customPreset?.tshirtFit || item.fit || "").toUpperCase()
            const color = String(item.customPreset?.baseColor || "Black")
            const gender = String(item.customPreset?.targetGender || item.gender || "UNISEX").toUpperCase()
            return `${gender} | CUSTOM T-SHIRT${fit ? ` | ${fit}` : ""} | ${color}`
        }

        const parts = []
        if (item.gender) parts.push(item.gender)
        if (item.type) parts.push(item.type)
        if (item.fit) parts.push(item.fit)
        return parts.length ? parts.join(" | ").toUpperCase() : "STORE ESSENTIAL"
    }

    function showToast(message) {
        if (!dom.toast) return
        dom.toast.textContent = message
        dom.toast.classList.add("show")

        clearTimeout(showToast._timer)
        showToast._timer = setTimeout(() => {
            dom.toast.classList.remove("show")
        }, 2600)
    }

    function setCheckoutFeedback(message, tone = "") {
        if (!dom.checkoutFeedback) return
        dom.checkoutFeedback.textContent = message
        dom.checkoutFeedback.className = `checkout-feedback ${tone}`.trim()
    }

    function renderSummary(cart) {
        dom.summaryItems.textContent = String(cart?.itemCount || 0)
        dom.summarySubtotal.textContent = formatCurrency(cart?.subtotal || 0)
        dom.summaryShipping.textContent = formatCurrency(cart?.shipping || 0)
        dom.summaryTax.textContent = formatCurrency(cart?.tax || 0)
        dom.summaryGrandTotal.textContent = formatCurrency(cart?.grandTotal || 0)

        const freeThreshold = Number(cart?.freeShippingThreshold || 1999)
        const subtotal = Number(cart?.subtotal || 0)
        const remaining = Math.max(freeThreshold - subtotal, 0)

        const progress = freeThreshold > 0
            ? Math.min((subtotal / freeThreshold) * 100, 100)
            : 0

        if (dom.shippingProgressValue) {
            dom.shippingProgressValue.style.width = `${Math.max(0, progress)}%`
        }

        if (!cart?.itemCount) {
            dom.shippingHint.textContent = "Add products to unlock free shipping."
        } else if (remaining <= 0) {
            dom.shippingHint.textContent = "Free shipping unlocked for this cart."
        } else {
            dom.shippingHint.textContent = `${formatCurrency(remaining)} away from free shipping.`
        }
    }

    function renderBanner(cart, userEmail) {
        if (!dom.infoBanner) return

        if (!userEmail) {
            dom.infoBanner.classList.remove("hidden")
            dom.infoBanner.innerHTML = `
                Sign in to save your cart to your account and access it anytime.
                <a href="index.html" style="margin-left:6px;font-weight:700;color:#2b2419;">Sign In</a>
            `
            return
        }

        const itemCount = Number(cart?.itemCount || 0)
        const taxRateLabel = Math.round(TAX_RATE * 100)

        dom.infoBanner.classList.remove("hidden")
        dom.infoBanner.innerHTML = itemCount
            ? `Cart synced for <b>${escapeHtml(userEmail)}</b>. Taxes are estimated at ${taxRateLabel}% until checkout.`
            : `Your cart is saved for <b>${escapeHtml(userEmail)}</b>. Start adding your favorite products.`
    }

    function renderEmptyState(show) {
        dom.emptyState.classList.toggle("hidden", !show)
    }

    function renderCartList(cart) {
        const items = Array.isArray(cart?.items) ? cart.items : []

        if (!items.length) {
            dom.cartList.innerHTML = ""
            renderEmptyState(true)
            return
        }

        renderEmptyState(false)

        dom.cartList.innerHTML = items.map(item => `
            <article class="cart-item" data-item-id="${escapeHtml(item.itemId)}">
                <img src="${escapeHtml(item.image || "https://via.placeholder.com/300x380?text=THE+UNSPOKEN+STORE")}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async">
                <div>
                    <h3>${escapeHtml(item.name)}</h3>
                    <p>${escapeHtml(getProductMeta(item))}</p>
                    <p class="item-price">${escapeHtml(formatCurrency(item.unitPrice))} each</p>
                    <div class="item-controls">
                        <label>
                            Size
                            <select data-role="size" ${item.itemType === "custom-preset" ? "disabled" : ""}>
                                ${getSizeOptions(item.size)}
                            </select>
                        </label>
                        <label>
                            Qty
                            <span class="qty-wrap">
                                ${item.itemType === "custom-preset"
                ? "<button type=\"button\" disabled aria-label=\"Quantity locked\">-</button>"
                : "<button type=\"button\" data-action=\"qty-minus\" aria-label=\"Decrease quantity\">-</button>"}
                                <span data-role="qty-value">${item.quantity}</span>
                                ${item.itemType === "custom-preset"
                ? "<button type=\"button\" disabled aria-label=\"Quantity locked\">+</button>"
                : "<button type=\"button\" data-action=\"qty-plus\" aria-label=\"Increase quantity\">+</button>"}
                            </span>
                        </label>
                    </div>
                </div>
                <div class="item-side">
                    <div class="line-total">${escapeHtml(formatCurrency(item.lineTotal))}</div>
                    <button type="button" class="remove-btn" data-action="remove-item">Remove</button>
                </div>
            </article>
        `).join("")
    }

    function renderRecommendations() {
        if (!dom.recommendedGrid || !dom.recommendedSection) return

        const rows = Array.isArray(state.recommendations) ? state.recommendations : []
        if (!rows.length) {
            dom.recommendedSection.classList.add("hidden")
            dom.recommendedGrid.innerHTML = ""
            return
        }

        dom.recommendedSection.classList.remove("hidden")
        dom.recommendedGrid.innerHTML = rows.map(product => `
            <article class="recommended-card">
                <img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async">
                <div class="recommended-info">
                    <h3>${escapeHtml(product.name)}</h3>
                    <p>${escapeHtml(product.meta)}</p>
                    <p><strong>${escapeHtml(formatCurrency(product.price))}</strong></p>
                    <div class="recommended-actions">
                        <a href="product.html?id=${escapeHtml(product.id)}">View</a>
                        <button type="button" class="primary" data-action="rec-add" data-id="${escapeHtml(product.id)}">Add</button>
                    </div>
                </div>
            </article>
        `).join("")
    }

    function renderCheckoutSummary() {
        const items = Array.isArray(state.cart?.items) ? state.cart.items : []

        if (dom.checkoutSummaryItems) {
            if (!items.length) {
                dom.checkoutSummaryItems.innerHTML = "<p class=\"payment-helper\">No items in cart.</p>"
            } else {
                dom.checkoutSummaryItems.innerHTML = items.map(item => `
                    <article class="checkout-summary-item">
                        <img src="${escapeHtml(item.image || "https://via.placeholder.com/140x170?text=ITEM")}" alt="${escapeHtml(item.name)}" loading="lazy" decoding="async">
                        <div>
                            <strong>${escapeHtml(item.name)}</strong>
                            <p>Size ${escapeHtml(item.size || "M")} | Qty ${escapeHtml(String(item.quantity || 1))}</p>
                        </div>
                        <strong>${escapeHtml(formatCurrency(item.lineTotal || 0))}</strong>
                    </article>
                `).join("")
            }
        }

        if (dom.checkoutReviewItems) dom.checkoutReviewItems.textContent = String(state.cart?.itemCount || 0)
        if (dom.checkoutReviewSubtotal) dom.checkoutReviewSubtotal.textContent = formatCurrency(state.cart?.subtotal || 0)
        if (dom.checkoutReviewShipping) dom.checkoutReviewShipping.textContent = formatCurrency(state.cart?.shipping || 0)
        if (dom.checkoutReviewTax) dom.checkoutReviewTax.textContent = formatCurrency(state.cart?.tax || 0)
        if (dom.checkoutReviewTotal) dom.checkoutReviewTotal.textContent = formatCurrency(state.cart?.grandTotal || 0)
    }

    function syncUi() {
        const cart = state.cart || {}
        const userEmail = window.LuxoraCart?.getUserEmail?.() || ""
        const itemCount = Number(cart.itemCount || 0)

        dom.subhead.textContent = userEmail
            ? `${itemCount} item${itemCount === 1 ? "" : "s"} saved in your cart`
            : "Sign in to keep a cart unique to your account"

        dom.clearCartBtn.classList.toggle("hidden", !itemCount)
        dom.checkoutBtn.disabled = !itemCount
        renderBanner(cart, userEmail)
        renderSummary(cart)
        renderCartList(cart)
        renderRecommendations()
        renderCheckoutSummary()
    }

    function setButtonsDisabled(isDisabled) {
        dom.clearCartBtn.disabled = isDisabled
        dom.checkoutBtn.disabled = isDisabled || !(state.cart?.itemCount > 0)
    }

    async function loadCheckoutOptions() {
        const userEmail = window.LuxoraCart?.getUserEmail?.() || ""
        if (!userEmail) {
            state.checkoutOptions = { ...DEFAULT_CHECKOUT_OPTIONS }
            return
        }

        try {
            const response = await fetch("/api/orders/checkout/options", {
                credentials: "same-origin",
                headers: {
                    ...(userEmail ? { "x-user-email": userEmail } : {})
                }
            })

            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(payload?.error || "Unable to fetch checkout options")
            }

            state.checkoutOptions = payload?.checkout && typeof payload.checkout === "object"
                ? payload.checkout
                : { ...DEFAULT_CHECKOUT_OPTIONS }
        } catch (err) {
            console.log("Checkout options load error:", err)
            state.checkoutOptions = { ...DEFAULT_CHECKOUT_OPTIONS }
        }
    }

    async function refreshCart() {
        if (!window.LuxoraCart) return

        try {
            state.cart = await window.LuxoraCart.getCart()
        } catch (err) {
            console.log("Cart load error:", err)
            showToast("Unable to load your cart right now")
            state.cart = {
                items: [],
                itemCount: 0,
                subtotal: 0,
                shipping: 0,
                tax: 0,
                grandTotal: 0,
                freeShippingThreshold: 1999
            }
        }

        await Promise.all([loadRecommendations(), loadCheckoutOptions()])
        syncUi()
    }

    async function loadRecommendations() {
        try {
            const response = await fetch("/api/products")
            const products = await response.json()
            const rows = Array.isArray(products) ? products : []
            const inCart = new Set((state.cart?.items || []).map(item => String(item.productId)))

            state.recommendations = rows
                .filter(product => !inCart.has(String(product._id)))
                .sort((a, b) => {
                    const aFeatured = Number(!!a.featured)
                    const bFeatured = Number(!!b.featured)
                    if (bFeatured !== aFeatured) return bFeatured - aFeatured
                    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
                })
                .slice(0, 8)
                .map(product => {
                    const image = Array.isArray(product.images) && product.images.length
                        ? product.images[0]
                        : (product.image || "")

                    const fit = product.fit ? ` | ${String(product.fit).toUpperCase()}` : ""

                    return {
                        id: String(product._id),
                        name: String(product.name || "Store Product"),
                        image: String(image || "https://via.placeholder.com/300x380?text=PRODUCT"),
                        price: Number(product.price || 0),
                        meta: `${String(product.gender || "").toUpperCase()} | ${String(product.type || "").toUpperCase()}${fit}`
                    }
                })
        } catch (err) {
            console.log("Recommendations load error:", err)
            state.recommendations = []
        }
    }

    function findItemById(itemId) {
        return (state.cart?.items || []).find(item => String(item.itemId) === String(itemId))
    }

    async function handleCartListClick(event) {
        const actionTarget = event.target.closest("[data-action]")
        if (!actionTarget) return

        const itemNode = actionTarget.closest("[data-item-id]")
        const itemId = String(itemNode?.dataset?.itemId || "")
        if (!itemId) return

        const item = findItemById(itemId)
        if (!item) return

        try {
            setButtonsDisabled(true)

            if (actionTarget.dataset.action === "remove-item") {
                state.cart = await window.LuxoraCart.removeItem(itemId)
                showToast("Item removed")
            }

            if (actionTarget.dataset.action === "qty-minus") {
                const next = Math.max(1, Number(item.quantity || 1) - 1)
                state.cart = await window.LuxoraCart.updateItem(itemId, { quantity: next })
            }

            if (actionTarget.dataset.action === "qty-plus") {
                const next = Math.min(20, Number(item.quantity || 1) + 1)
                state.cart = await window.LuxoraCart.updateItem(itemId, { quantity: next })
            }
        } catch (err) {
            if (String(err?.message || "") === "signin-required") {
                showToast("Sign in required")
            } else {
                showToast("Unable to update cart")
            }
        } finally {
            setButtonsDisabled(false)
            await loadRecommendations()
            syncUi()
        }
    }

    async function handleSizeChange(event) {
        const select = event.target.closest("select[data-role='size']")
        if (!select || select.disabled) return

        const itemNode = select.closest("[data-item-id]")
        const itemId = String(itemNode?.dataset?.itemId || "")
        if (!itemId) return

        try {
            setButtonsDisabled(true)
            state.cart = await window.LuxoraCart.updateItem(itemId, { size: select.value })
            showToast("Size updated")
        } catch (err) {
            showToast("Unable to update size")
        } finally {
            setButtonsDisabled(false)
            await loadRecommendations()
            syncUi()
        }
    }

    async function handleRecommendationClick(event) {
        const button = event.target.closest("[data-action='rec-add']")
        if (!button) return

        const productId = String(button.dataset.id || "")
        if (!productId) return

        try {
            button.disabled = true
            state.cart = await window.LuxoraCart.addItem({
                productId,
                quantity: 1,
                size: "M"
            })
            showToast("Added to cart")
        } catch (err) {
            if (String(err?.message || "") === "signin-required") {
                showToast("Sign in to add products")
            } else {
                showToast("Unable to add product")
            }
        } finally {
            button.disabled = false
            await loadRecommendations()
            syncUi()
        }
    }

    async function clearCart() {
        try {
            setButtonsDisabled(true)
            state.cart = await window.LuxoraCart.clearCart()
            showToast("Cart cleared")
        } catch (err) {
            showToast("Unable to clear cart")
        } finally {
            setButtonsDisabled(false)
            await loadRecommendations()
            syncUi()
        }
    }

    function getSelectedPaymentMethod() {
        const checked = dom.paymentMethods?.querySelector("input[name='paymentMethod']:checked")
        const method = normalizeLower(checked?.value || "cod")
        return ALLOWED_PAYMENT_METHODS.has(method) ? method : "cod"
    }

    function setSelectedPaymentMethod(method) {
        const target = normalizeLower(method || "cod")
        const safeMethod = ALLOWED_PAYMENT_METHODS.has(target) ? target : "cod"
        const input = dom.paymentMethods?.querySelector(`input[name='paymentMethod'][value='${safeMethod}']`)
        if (input) input.checked = true
    }

    function updatePaymentMethodUi() {
        const method = getSelectedPaymentMethod()

        dom.paymentMethods?.querySelectorAll(".payment-option").forEach(option => {
            const radio = option.querySelector("input[name='paymentMethod']")
            option.classList.toggle("active", normalizeLower(radio?.value) === method)
        })

        if (dom.checkoutSubmitBtn) {
            dom.checkoutSubmitBtn.textContent = method === "cod"
                ? "Place Order"
                : "Pay & Place Order"
        }

        const subtitleParts = ["Fill your delivery details and choose a payment option."]
        if (method !== "cod") {
            subtitleParts.push("Your payment details are entered only in a secure payment window.")
        }
        if (dom.checkoutSubtitle) {
            dom.checkoutSubtitle.textContent = subtitleParts.join(" ")
        }
    }

    function readCheckoutProfile() {
        try {
            const raw = localStorage.getItem(CHECKOUT_STORAGE_KEY)
            if (!raw) return {}
            const parsed = JSON.parse(raw)
            return parsed && typeof parsed === "object" ? parsed : {}
        } catch (err) {
            return {}
        }
    }

    function saveCheckoutProfile(payload, paymentMethod) {
        try {
            const safe = {
                customerName: normalizeText(payload?.customerName),
                customerPhone: normalizePhone(payload?.customerPhone),
                shippingAddress: {
                    line1: normalizeText(payload?.shippingAddress?.line1),
                    line2: normalizeText(payload?.shippingAddress?.line2),
                    city: normalizeText(payload?.shippingAddress?.city),
                    state: normalizeText(payload?.shippingAddress?.state),
                    postalCode: normalizeText(payload?.shippingAddress?.postalCode),
                    country: normalizeText(payload?.shippingAddress?.country),
                    landmark: normalizeText(payload?.shippingAddress?.landmark)
                },
                paymentMethod: normalizeLower(paymentMethod || "cod")
            }

            localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(safe))
        } catch (err) {
            console.log("Checkout profile save error:", err)
        }
    }

    function prefillCheckoutForm() {
        const profile = readCheckoutProfile()
        const localEmail = window.LuxoraCart?.getUserEmail?.() || localStorage.getItem("userEmail") || ""
        const localName =
            window.LuxoraCart?.getUser?.()?.name ||
            localStorage.getItem("userName") ||
            String(localEmail || "").split("@")[0] ||
            ""

        if (dom.checkoutCustomerName) dom.checkoutCustomerName.value = normalizeText(profile.customerName) || normalizeText(localName)
        if (dom.checkoutCustomerPhone) dom.checkoutCustomerPhone.value = normalizeText(profile.customerPhone)
        if (dom.checkoutCustomerEmail) dom.checkoutCustomerEmail.value = normalizeText(localEmail)
        if (dom.checkoutLine1) dom.checkoutLine1.value = normalizeText(profile.shippingAddress?.line1)
        if (dom.checkoutLine2) dom.checkoutLine2.value = normalizeText(profile.shippingAddress?.line2)
        if (dom.checkoutCity) dom.checkoutCity.value = normalizeText(profile.shippingAddress?.city)
        if (dom.checkoutState) dom.checkoutState.value = normalizeText(profile.shippingAddress?.state)
        if (dom.checkoutPostalCode) dom.checkoutPostalCode.value = normalizeText(profile.shippingAddress?.postalCode)
        if (dom.checkoutCountry) dom.checkoutCountry.value = normalizeText(profile.shippingAddress?.country || "India")
        if (dom.checkoutLandmark) dom.checkoutLandmark.value = normalizeText(profile.shippingAddress?.landmark)
        if (dom.checkoutNotes) dom.checkoutNotes.value = ""

        setSelectedPaymentMethod(profile.paymentMethod || "cod")
        setCheckoutFeedback("")
        updatePaymentMethodUi()
        renderCheckoutSummary()
    }

    function setCheckoutBusy(isBusy) {
        state.checkoutSubmitting = !!isBusy
        if (dom.checkoutSubmitBtn) dom.checkoutSubmitBtn.disabled = state.checkoutSubmitting
        if (dom.checkoutCancelBtn) dom.checkoutCancelBtn.disabled = state.checkoutSubmitting
        if (dom.checkoutCloseBtn) dom.checkoutCloseBtn.disabled = state.checkoutSubmitting
    }

    function isCheckoutOpen() {
        return dom.checkoutModal && !dom.checkoutModal.classList.contains("hidden")
    }

    function openCheckoutModal() {
        if (!dom.checkoutModal) return
        dom.checkoutModal.classList.remove("hidden")
        dom.checkoutModal.setAttribute("aria-hidden", "false")
        document.body.classList.add("checkout-open")
    }

    function closeCheckoutModal() {
        if (!dom.checkoutModal || state.checkoutSubmitting) return
        dom.checkoutModal.classList.add("hidden")
        dom.checkoutModal.setAttribute("aria-hidden", "true")
        document.body.classList.remove("checkout-open")
    }

    async function beginCheckout() {
        if (!(state.cart?.itemCount > 0)) {
            showToast("Your cart is empty")
            return
        }

        let userEmail = window.LuxoraCart?.getUserEmail?.() || ""
        if (!userEmail && window.LuxoraCart?.ensureSignedIn) {
            try {
                userEmail = await window.LuxoraCart.ensureSignedIn()
            } catch (err) {
                showToast("Sign in before checkout")
                return
            }
        }

        await loadCheckoutOptions()
        prefillCheckoutForm()
        openCheckoutModal()
    }

    function collectCheckoutPayload() {
        const customerName = normalizeText(dom.checkoutCustomerName?.value)
        const customerPhone = normalizePhone(dom.checkoutCustomerPhone?.value)
        const paymentMethod = getSelectedPaymentMethod()

        const payload = {
            customerName,
            customerPhone,
            shippingAddress: {
                recipientName: customerName,
                phone: customerPhone,
                line1: normalizeText(dom.checkoutLine1?.value),
                line2: normalizeText(dom.checkoutLine2?.value),
                landmark: normalizeText(dom.checkoutLandmark?.value),
                city: normalizeText(dom.checkoutCity?.value),
                state: normalizeText(dom.checkoutState?.value),
                postalCode: normalizeText(dom.checkoutPostalCode?.value),
                country: normalizeText(dom.checkoutCountry?.value || "India")
            },
            notes: normalizeText(dom.checkoutNotes?.value),
            clearCart: true,
            payment: {
                method: paymentMethod
            }
        }

        return payload
    }

    function validateCheckoutPayload(payload) {
        if (!normalizeText(payload?.customerName) || payload.customerName.length < 2) {
            return "Please enter your full name."
        }

        if (!isValidPhone(payload?.customerPhone)) {
            return "Please enter a valid phone number."
        }

        if (!normalizeText(payload?.shippingAddress?.line1)) {
            return "Address line 1 is required."
        }

        if (!normalizeText(payload?.shippingAddress?.city)) {
            return "City is required."
        }

        if (!normalizeText(payload?.shippingAddress?.state)) {
            return "State is required."
        }

        if (!isValidPostalCode(payload?.shippingAddress?.postalCode)) {
            return "Please enter a valid postal code."
        }

        if (!normalizeText(payload?.shippingAddress?.country)) {
            return "Country is required."
        }

        const method = normalizeLower(payload?.payment?.method)
        if (!ALLOWED_PAYMENT_METHODS.has(method)) {
            return "Please select a valid payment method."
        }

        return ""
    }

    async function submitCheckout(event) {
        event.preventDefault()
        if (state.checkoutSubmitting) return

        const payload = collectCheckoutPayload()
        const validationMessage = validateCheckoutPayload(payload)
        if (validationMessage) {
            setCheckoutFeedback(validationMessage)
            return
        }

        let userEmail = window.LuxoraCart?.getUserEmail?.() || ""
        if (!userEmail && window.LuxoraCart?.ensureSignedIn) {
            try {
                userEmail = await window.LuxoraCart.ensureSignedIn()
            } catch (err) {
                setCheckoutFeedback("Sign in before placing your order.")
                return
            }
        }

        try {
            setCheckoutBusy(true)
            setCheckoutFeedback("Submitting your order...", "success")

            const response = await fetch("/api/orders/checkout", {
                method: "POST",
                credentials: "same-origin",
                headers: {
                    "Content-Type": "application/json",
                    ...(userEmail ? { "x-user-email": userEmail } : {})
                },
                body: JSON.stringify(payload)
            })

            const responsePayload = await response.json().catch(() => ({}))
            if (!response.ok || !responsePayload?.success) {
                throw new Error(responsePayload?.error || responsePayload?.message || "Unable to place order right now")
            }

            saveCheckoutProfile(payload, payload?.payment?.method)
            try {
                state.cart = await window.LuxoraCart.getCart()
            } catch (cartRefreshErr) {
                state.cart = responsePayload?.cart || state.cart
            }

            const orderCode = normalizeText(responsePayload?.order?.orderCode)
            const paymentStatus = normalizeLower(responsePayload?.order?.payment?.status)

            closeCheckoutModal()
            setCheckoutFeedback("")

            if (paymentStatus === "pending") {
                showToast(orderCode
                    ? `Order ${orderCode} placed. Complete payment securely.`
                    : "Order placed. Complete payment securely.")
            } else {
                showToast(orderCode
                    ? `Order placed: ${orderCode}`
                    : "Order placed successfully")
            }

            await loadRecommendations()
            syncUi()
        } catch (err) {
            console.log("Checkout submit error:", err)
            setCheckoutFeedback(err?.message || "Unable to place order right now.")
        } finally {
            setCheckoutBusy(false)
        }
    }

    function bindEvents() {
        dom.cartList?.addEventListener("click", handleCartListClick)
        dom.cartList?.addEventListener("change", handleSizeChange)
        dom.recommendedGrid?.addEventListener("click", handleRecommendationClick)

        dom.clearCartBtn?.addEventListener("click", () => {
            if (!(state.cart?.itemCount > 0)) return

            const shouldClear = window.confirm("Remove all items from cart?")
            if (shouldClear) {
                clearCart()
            }
        })

        dom.checkoutBtn?.addEventListener("click", () => {
            beginCheckout()
        })

        dom.checkoutCloseBtn?.addEventListener("click", closeCheckoutModal)
        dom.checkoutCancelBtn?.addEventListener("click", closeCheckoutModal)

        dom.checkoutModal?.addEventListener("click", event => {
            if (event.target === dom.checkoutModal) {
                closeCheckoutModal()
            }
        })

        dom.paymentMethods?.addEventListener("change", updatePaymentMethodUi)
        dom.checkoutForm?.addEventListener("submit", submitCheckout)

        window.addEventListener("keydown", event => {
            if (event.key === "Escape" && isCheckoutOpen()) {
                closeCheckoutModal()
            }
        })

        window.addEventListener("luxora:cart-updated", event => {
            const payload = event?.detail
            if (!payload || typeof payload !== "object") return
            state.cart = payload
            loadRecommendations().then(syncUi)
        })
    }

    bindEvents()
    refreshCart()
})()
