(function ordersPageBootstrap() {
    const ORDER_STATUS_LABELS = {
        placed: "Placed",
        processing: "Processing",
        shipped: "Shipped",
        delivered: "Delivered",
        cancelled: "Cancelled"
    }

    const PAYMENT_STATUS_LABELS = {
        unpaid: "Unpaid",
        pending: "Pending",
        paid: "Paid",
        failed: "Failed",
        refunded: "Refunded",
        "cod-pending": "COD Pending"
    }

    const PAYMENT_METHOD_LABELS = {
        cod: "Cash on Delivery",
        upi: "UPI",
        card: "Card",
        netbanking: "Net Banking",
        razorpay: "Razorpay"
    }

    const state = {
        orders: [],
        loading: false,
        userEmail: ""
    }

    const dom = {
        subtitle: document.getElementById("ordersSubtitle"),
        stats: document.getElementById("ordersStats"),
        list: document.getElementById("ordersList"),
        feedback: document.getElementById("ordersFeedback"),
        refreshBtn: document.getElementById("refreshOrdersBtn"),
        searchInput: document.getElementById("orderSearchInput"),
        statusFilter: document.getElementById("orderStatusFilter"),
        paymentFilter: document.getElementById("paymentStatusFilter")
    }

    function escapeHtml(value = "") {
        return String(value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;")
    }

    function normalizeText(value = "") {
        return String(value || "").trim()
    }

    function normalizeLower(value = "") {
        return normalizeText(value).toLowerCase()
    }

    function formatCurrency(value) {
        return `₹ ${Number(value || 0).toLocaleString("en-IN")}`
    }

    function formatDate(value) {
        const date = new Date(value || "")
        if (Number.isNaN(date.getTime())) return "-"

        return date.toLocaleString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
    }

    function getOrderStatus(order) {
        const status = normalizeLower(order?.status || "placed")
        return ORDER_STATUS_LABELS[status] ? status : "placed"
    }

    function getPaymentStatus(order) {
        const status = normalizeLower(order?.payment?.status || "unpaid")
        return PAYMENT_STATUS_LABELS[status] ? status : "unpaid"
    }

    function getPaymentMethod(order) {
        const method = normalizeLower(order?.payment?.method || "cod")
        return PAYMENT_METHOD_LABELS[method] || method.toUpperCase() || "Payment"
    }

    function getFilters() {
        return {
            query: normalizeLower(dom.searchInput?.value || ""),
            status: normalizeLower(dom.statusFilter?.value || "all"),
            payment: normalizeLower(dom.paymentFilter?.value || "all")
        }
    }

    function getOrderSearchText(order) {
        const itemText = Array.isArray(order?.items)
            ? order.items.map(item => `${item?.name || ""} ${item?.size || ""}`).join(" ")
            : ""

        return normalizeLower([
            order?.orderCode,
            order?.customerName,
            order?.payment?.reference,
            order?.payment?.transactionId,
            itemText
        ].join(" "))
    }

    function getFilteredOrders() {
        const filters = getFilters()

        return state.orders.filter(order => {
            if (filters.status !== "all" && getOrderStatus(order) !== filters.status) return false
            if (filters.payment !== "all" && getPaymentStatus(order) !== filters.payment) return false
            if (filters.query && !getOrderSearchText(order).includes(filters.query)) return false
            return true
        })
    }

    function renderStats(filteredOrders) {
        if (!dom.stats) return

        const allOrders = state.orders
        const paidCount = allOrders.filter(order => getPaymentStatus(order) === "paid").length
        const activeCount = allOrders.filter(order => ["placed", "processing", "shipped"].includes(getOrderStatus(order))).length
        const totalSpent = allOrders
            .filter(order => getPaymentStatus(order) === "paid" || getPaymentStatus(order) === "cod-pending")
            .reduce((sum, order) => sum + Number(order?.grandTotal || 0), 0)

        dom.stats.innerHTML = [
            ["Total Orders", allOrders.length],
            ["Showing", filteredOrders.length],
            ["Active", activeCount],
            ["Paid", paidCount],
            ["Order Value", formatCurrency(totalSpent)]
        ].map(([label, value]) => `
            <article class="orders-stat-card">
                <span>${escapeHtml(label)}</span>
                <strong>${escapeHtml(value)}</strong>
            </article>
        `).join("")
    }

    function renderItems(order) {
        const items = Array.isArray(order?.items) ? order.items : []
        if (!items.length) {
            return '<p class="orders-item-empty">No items found for this order.</p>'
        }

        return items.slice(0, 4).map(item => {
            const image = normalizeText(item?.image)
            const name = normalizeText(item?.name || "Product")
            const size = normalizeText(item?.size || "M")
            const quantity = Number(item?.quantity || 1)
            const lineTotal = Number(item?.lineTotal || 0)

            return `
                <article class="orders-item">
                    <div class="orders-item-image ${image ? "has-image" : ""}">
                        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(name)}" loading="lazy" decoding="async">` : ""}
                    </div>
                    <div>
                        <h3>${escapeHtml(name)}</h3>
                        <p>Size ${escapeHtml(size)} · Qty ${escapeHtml(quantity)}</p>
                    </div>
                    <strong>${escapeHtml(formatCurrency(lineTotal))}</strong>
                </article>
            `
        }).join("") + (items.length > 4 ? `<p class="orders-more">+${items.length - 4} more item${items.length - 4 === 1 ? "" : "s"}</p>` : "")
    }

    function renderOrderCard(order) {
        const status = getOrderStatus(order)
        const paymentStatus = getPaymentStatus(order)
        const orderCode = normalizeText(order?.orderCode || "Order")
        const address = order?.shippingAddress && typeof order.shippingAddress === "object"
            ? order.shippingAddress
            : {}
        const addressText = [
            address?.line1,
            address?.line2,
            address?.city,
            address?.state,
            address?.postalCode
        ].map(normalizeText).filter(Boolean).join(", ")

        return `
            <article class="order-card">
                <div class="order-card-head">
                    <div>
                        <p class="order-date">${escapeHtml(formatDate(order?.createdAt))}</p>
                        <h2>${escapeHtml(orderCode)}</h2>
                    </div>
                    <div class="order-badges">
                        <span class="status-badge status-${escapeHtml(status)}">${escapeHtml(ORDER_STATUS_LABELS[status])}</span>
                        <span class="payment-badge payment-${escapeHtml(paymentStatus)}">${escapeHtml(PAYMENT_STATUS_LABELS[paymentStatus])}</span>
                    </div>
                </div>

                <div class="order-meta-grid">
                    <p><span>Total</span><strong>${escapeHtml(formatCurrency(order?.grandTotal))}</strong></p>
                    <p><span>Payment</span><strong>${escapeHtml(getPaymentMethod(order))}</strong></p>
                    <p><span>Items</span><strong>${escapeHtml(order?.itemCount || 0)}</strong></p>
                    <p><span>Reference</span><strong>${escapeHtml(order?.payment?.reference || order?.payment?.gatewayPaymentId || "-")}</strong></p>
                </div>

                <div class="orders-items">${renderItems(order)}</div>

                <div class="order-card-footer">
                    <p>${escapeHtml(addressText || "Delivery address saved with this order.")}</p>
                    <a href="cart.html">Shop Again</a>
                </div>
            </article>
        `
    }

    function renderOrders() {
        const filteredOrders = getFilteredOrders()
        renderStats(filteredOrders)

        if (!dom.list) return

        if (state.loading) {
            dom.list.innerHTML = `
                <div class="orders-empty">
                    <strong>Loading your orders...</strong>
                    <p>Pulling your latest checkout history.</p>
                </div>
            `
            return
        }

        if (!state.orders.length) {
            dom.list.innerHTML = `
                <div class="orders-empty">
                    <strong>No orders yet</strong>
                    <p>Your confirmed checkouts will appear here after you place an order.</p>
                    <a href="index.html#featuredProducts">Start Shopping</a>
                </div>
            `
            return
        }

        if (!filteredOrders.length) {
            dom.list.innerHTML = `
                <div class="orders-empty">
                    <strong>No matching orders</strong>
                    <p>Try clearing your search or changing the filters.</p>
                </div>
            `
            return
        }

        dom.list.innerHTML = filteredOrders.map(renderOrderCard).join("")
    }

    function setFeedback(message = "", tone = "") {
        if (!dom.feedback) return
        dom.feedback.textContent = message
        dom.feedback.className = `orders-feedback ${tone}`.trim()
    }

    async function requireSignedInUser() {
        const session = await window.LuxoraCart?.refreshSession?.({ silent: true })
        const email = normalizeLower(session?.user?.email || window.LuxoraCart?.getUserEmail?.())

        if (email) return email

        const next = encodeURIComponent("/orders.html")
        window.location.href = `index.html?signin=1&next=${next}`
        throw new Error("signin-required")
    }

    async function loadOrders() {
        if (state.loading) return

        try {
            state.loading = true
            dom.refreshBtn?.setAttribute("disabled", "disabled")
            setFeedback("Loading your orders...", "muted")
            renderOrders()

            const userEmail = await requireSignedInUser()
            state.userEmail = userEmail
            if (dom.subtitle) {
                dom.subtitle.textContent = `Signed in as ${userEmail}. Track payments, delivery status, and order items here.`
            }

            const response = await fetch("/api/orders", {
                credentials: "same-origin",
                headers: {
                    "x-user-email": userEmail
                }
            })
            const payload = await response.json().catch(() => [])

            if (!response.ok) {
                throw new Error(payload?.error || payload?.message || "Unable to load orders.")
            }

            state.orders = Array.isArray(payload) ? payload : []
            setFeedback(state.orders.length ? `Showing ${state.orders.length} order${state.orders.length === 1 ? "" : "s"}.` : "", "success")
        } catch (err) {
            if (String(err?.message || "") !== "signin-required") {
                console.log("Orders load error:", err)
                setFeedback(err?.message || "Unable to load orders right now.", "error")
            }
        } finally {
            state.loading = false
            dom.refreshBtn?.removeAttribute("disabled")
            renderOrders()
        }
    }

    function bindEvents() {
        dom.refreshBtn?.addEventListener("click", loadOrders)
        dom.searchInput?.addEventListener("input", renderOrders)
        dom.statusFilter?.addEventListener("change", renderOrders)
        dom.paymentFilter?.addEventListener("change", renderOrders)
    }

    window.addEventListener("load", async () => {
        bindEvents()
        await window.LuxoraCart?.refreshCartCount?.()
        await loadOrders()
    })
})()
