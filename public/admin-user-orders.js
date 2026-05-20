let userOrders = []
let activeUserEmail = ""

const ORDER_STATUS_LABELS = {
    placed: "Placed",
    processing: "Processing",
    shipped: "Shipped",
    delivered: "Delivered",
    cancelled: "Cancelled"
}
const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS)

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

function getOrderStatusClass(status) {
    const normalized = String(status || "").trim().toLowerCase()
    return ORDER_STATUS_LABELS[normalized] ? normalized : "placed"
}

function getOrderStatusLabel(status) {
    return ORDER_STATUS_LABELS[getOrderStatusClass(status)] || "Placed"
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

function showUserOrdersFeedback(message, tone = "muted") {
    const feedback = document.getElementById("userOrdersFeedback")
    if (!feedback) return

    feedback.className = `orders-feedback ${tone}`
    feedback.textContent = message
}

function getFilters() {
    const query = String(document.getElementById("userOrderSearchInput")?.value || "").trim().toLowerCase()
    const status = String(document.getElementById("userOrderStatusFilter")?.value || "all").trim().toLowerCase()
    const source = String(document.getElementById("userOrderSourceFilter")?.value || "all").trim().toLowerCase()
    const sort = String(document.getElementById("userOrderSortSelect")?.value || "newest").trim().toLowerCase()

    return { query, status, source, sort }
}

function applyFilters(orders, filters) {
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

function renderStats(allRows, visibleRows) {
    const container = document.getElementById("userOrdersStats")
    if (!container) return

    const rows = Array.isArray(allRows) ? allRows : []
    const visible = Array.isArray(visibleRows) ? visibleRows : []

    const totalSpent = rows.reduce((sum, order) => sum + parseOrderGrandTotal(order), 0)
    const delivered = rows.filter(order => getOrderStatusClass(order?.status) === "delivered").length
    const active = rows.filter(order => ["placed", "processing", "shipped"].includes(getOrderStatusClass(order?.status))).length

    container.innerHTML = `
        <article class="orders-stat-card">
            <p>Total Orders</p>
            <strong>${rows.length}</strong>
        </article>
        <article class="orders-stat-card">
            <p>Total Spent</p>
            <strong>${escapeHtml(formatCurrencyInr(totalSpent))}</strong>
        </article>
        <article class="orders-stat-card">
            <p>Active Orders</p>
            <strong>${active}</strong>
        </article>
        <article class="orders-stat-card">
            <p>Delivered</p>
            <strong>${delivered}</strong>
        </article>
        <article class="orders-stat-card">
            <p>Filtered Result</p>
            <strong>${visible.length}</strong>
        </article>
        <article class="orders-stat-card">
            <p>User</p>
            <strong>${escapeHtml(activeUserEmail || "-")}</strong>
        </article>
    `
}

function buildStatusOptions(currentStatus) {
    const normalizedStatus = getOrderStatusClass(currentStatus)
    return ORDER_STATUSES.map(status => `
        <option value="${status}" ${normalizedStatus === status ? "selected" : ""}>
            ${escapeHtml(getOrderStatusLabel(status))}
        </option>
    `).join("")
}

function getStatusSelectId(orderId) {
    return `userOrderStatus_${String(orderId || "").replace(/[^a-zA-Z0-9_-]/g, "") || "unknown"}`
}

function renderItemsMarkup(order) {
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
    const container = document.getElementById("userOrdersList")
    if (!container) return

    const orders = Array.isArray(rows) ? rows : []
    if (!orders.length) {
        container.innerHTML = `<div class="orders-empty">No orders found for this user/filter.</div>`
        return
    }

    container.innerHTML = orders.map(order => {
        const orderId = String(order?._id || "").trim()
        const orderCode = normalizeText(order?.orderCode) || "Order"
        const createdAt = formatDateTime(order?.createdAt)
        const customerName = normalizeText(order?.customerName) || "Customer"
        const customerPhone = normalizeText(order?.customerPhone) || "-"
        const status = getOrderStatusClass(order?.status)
        const statusLabel = getOrderStatusLabel(status)
        const sourceLabel = toOrderSourceLabel(order?.source)
        const itemCount = parseOrderItemCount(order)
        const grandTotal = formatCurrencyInr(order?.grandTotal || 0)
        const subtotal = formatCurrencyInr(order?.subtotal || 0)
        const shipping = formatCurrencyInr(order?.shipping || 0)
        const tax = formatCurrencyInr(order?.tax || 0)
        const statusSelectId = getStatusSelectId(orderId)
        const encodedOrderId = encodeURIComponent(orderId)
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
                    <p><strong>Email:</strong> ${escapeHtml(activeUserEmail || "-")}</p>
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
                    ${renderItemsMarkup(order)}
                </div>

                <div class="order-actions-row">
                    <a href="admin.html#orders">Open All Orders</a>

                    <div class="order-status-editor">
                        <label for="${escapeHtml(statusSelectId)}">Update Status</label>
                        <select id="${escapeHtml(statusSelectId)}">
                            ${buildStatusOptions(status)}
                        </select>
                        <button
                            type="button"
                            onclick="updateUserOrderStatus('${encodedOrderId}', document.getElementById('${escapeHtml(statusSelectId)}')?.value, this)"
                        >
                            Save
                        </button>
                    </div>
                </div>
            </article>
        `
    }).join("")
}

function handleUserOrderFiltersChanged() {
    const filtered = applyFilters(userOrders, getFilters())
    renderStats(userOrders, filtered)
    renderOrderCards(filtered)
    showUserOrdersFeedback(`Showing ${filtered.length} of ${userOrders.length} orders for ${activeUserEmail || "this user"}.`, "muted")
}

async function updateUserOrderStatus(encodedOrderId, nextStatus, triggerButton = null) {
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

        userOrders = userOrders.map(order => {
            if (String(order?._id) !== String(orderId)) return order
            return {
                ...order,
                status: normalizedStatus
            }
        })

        handleUserOrderFiltersChanged()
        showUserOrdersFeedback(`Updated ${payload?.order?.orderCode || "order"} to ${getOrderStatusLabel(normalizedStatus)}.`, "success")
    } catch (err) {
        console.log("User order status update error:", err)
        showUserOrdersFeedback(err?.message || "Unable to update order status right now.", "error")
    } finally {
        if (button) {
            button.disabled = false
            button.textContent = initialLabel || "Save"
        }
    }
}

function exportUserOrdersCsv() {
    const filtered = applyFilters(userOrders, getFilters())
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
                escapeCsv(activeUserEmail),
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
    link.download = `luxora-user-orders-${(activeUserEmail || "user").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(href)
}

function readEmailFromQuery() {
    const params = new URLSearchParams(window.location.search)
    return normalizeText(params.get("email")).toLowerCase()
}

function hydrateHeader() {
    const title = document.getElementById("userOrdersTitle")
    const subtitle = document.getElementById("userOrdersSubtitle")

    if (title) {
        title.textContent = activeUserEmail
            ? `Orders for ${activeUserEmail}`
            : "User Orders"
    }

    if (subtitle) {
        subtitle.textContent = activeUserEmail
            ? "Complete order history for this customer, including line items and order status."
            : "No user email found. Open this page from the Users tab."
    }
}

async function loadUserOrders() {
    if (!activeUserEmail) {
        userOrders = []
        renderStats([], [])
        renderOrderCards([])
        showUserOrdersFeedback("User email is missing in the URL. Open this page from Users tab.", "error")
        return
    }

    showUserOrdersFeedback("Loading user orders...", "muted")

    try {
        const response = await fetch(`/api/orders/admin/list?userEmail=${encodeURIComponent(activeUserEmail)}&limit=400`)
        const payload = await response.json().catch(() => [])

        if (!response.ok) {
            throw new Error(payload?.error || "Unable to load user orders")
        }

        userOrders = Array.isArray(payload) ? payload : []
        handleUserOrderFiltersChanged()
    } catch (err) {
        console.log("User orders load error:", err)
        userOrders = []
        renderStats([], [])
        renderOrderCards([])
        showUserOrdersFeedback(err?.message || "Unable to load user orders right now.", "error")
    }
}

function initUserOrdersPage() {
    activeUserEmail = readEmailFromQuery()
    hydrateHeader()
    loadUserOrders()
}

window.loadUserOrders = loadUserOrders
window.handleUserOrderFiltersChanged = handleUserOrderFiltersChanged
window.exportUserOrdersCsv = exportUserOrdersCsv
window.updateUserOrderStatus = updateUserOrderStatus

initUserOrdersPage()
