(function () {
    const DEFAULT_FOOTER = {
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

    function escapeHtml(value) {
        return String(value || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;")
    }

    function safeHref(value) {
        const href = String(value || "#").trim()
        if (/^\s*javascript:/i.test(href)) return "#"
        return href || "#"
    }

    function asArray(value, fallback) {
        return Array.isArray(value) ? value : fallback
    }

    function mergeFooter(settings) {
        const data = settings && typeof settings === "object" ? settings : {}
        return {
            ...DEFAULT_FOOTER,
            ...data,
            linkSections: asArray(data.linkSections, DEFAULT_FOOTER.linkSections),
            featureRows: asArray(data.featureRows, DEFAULT_FOOTER.featureRows),
            appButtons: asArray(data.appButtons, DEFAULT_FOOTER.appButtons),
            socialLinks: asArray(data.socialLinks, DEFAULT_FOOTER.socialLinks),
            paymentItems: asArray(data.paymentItems, DEFAULT_FOOTER.paymentItems),
            shippingItems: asArray(data.shippingItems, DEFAULT_FOOTER.shippingItems)
        }
    }

    function renderLinkSections(sections) {
        return sections.map(section => {
            const items = Array.isArray(section.items) ? section.items : []
            return `
                <nav class="site-footer-group" aria-label="${escapeHtml(section.title)}">
                    <h3>${escapeHtml(section.title)}</h3>
                    ${items.map(item => `<a href="${escapeHtml(safeHref(item.href))}">${escapeHtml(item.label)}</a>`).join("")}
                </nav>
            `
        }).join("")
    }

    function renderFeatureRows(rows) {
        return rows.map(item => {
            const content = `
                <span class="site-footer-feature-icon">${escapeHtml(item.icon || "✓")}</span>
                <span>${escapeHtml(item.label)}</span>
            `
            return item.href
                ? `<a class="site-footer-feature" href="${escapeHtml(safeHref(item.href))}">${content}</a>`
                : `<p class="site-footer-feature">${content}</p>`
        }).join("")
    }

    function renderSocials(links) {
        return links.map(link => {
            const imageMarkup = link.imageUrl
                ? `<img src="${escapeHtml(link.imageUrl)}" alt="${escapeHtml(link.label || "Social link")}">`
                : `<span>${escapeHtml(link.icon || String(link.label || "?").slice(0, 2))}</span>`

            return `
                <a class="site-footer-social-link" href="${escapeHtml(safeHref(link.href))}" aria-label="${escapeHtml(link.label)}">
                    ${imageMarkup}
                </a>
            `
        }).join("")
    }

    function renderPills(items) {
        return items.map(item => `<span>${escapeHtml(item)}</span>`).join("")
    }

    function renderFooter(settings) {
        const footer = mergeFooter(settings)
        return `
            <footer class="site-footer" id="footerContact">
                <div class="site-footer-topbar">${escapeHtml(footer.homegrownText)}</div>
                <div class="site-footer-customer-line">
                    ${escapeHtml(footer.headlineBefore)}
                    <strong>${escapeHtml(footer.headlineStrong)}</strong>
                    ${escapeHtml(footer.headlineAfter)}
                </div>

                <div class="site-footer-main">
                    <section class="site-footer-brand" aria-label="Brand">
                        <span class="site-footer-kicker">Unspoken Store</span>
                        <h2>${escapeHtml(footer.brandTitle)}</h2>
                        <p>${escapeHtml(footer.brandDescription)}</p>
                        <div class="site-footer-features">
                            ${renderFeatureRows(footer.featureRows)}
                        </div>
                    </section>

                    <div class="site-footer-links">
                        ${renderLinkSections(footer.linkSections)}
                    </div>

                    <section class="site-footer-app-social" aria-label="Social links">
                        <div class="site-footer-social-row">
                            <span>Follow Us:</span>
                            ${renderSocials(footer.socialLinks)}
                        </div>
                    </section>

                    <details class="site-footer-info">
                        <summary>${escapeHtml(footer.infoTitle)}</summary>
                        <p>${escapeHtml(footer.infoBody)}</p>
                    </details>

                    <div class="site-footer-partners">
                        <p><strong>${escapeHtml(footer.paymentText)}:</strong></p>
                        <div class="site-footer-pill-row">${renderPills(footer.paymentItems)}</div>
                        <p><strong>${escapeHtml(footer.shippingText)}:</strong></p>
                        <div class="site-footer-pill-row">${renderPills(footer.shippingItems)}</div>
                    </div>
                </div>

                <div class="site-footer-bottom">${escapeHtml(footer.copyrightText)}</div>
            </footer>
        `
    }

    async function loadFooter() {
        try {
            const response = await fetch("/api/footer", { cache: "no-store" })
            if (!response.ok) throw new Error("Footer request failed")
            return await response.json()
        } catch (err) {
            console.log("Footer load error:", err)
            return DEFAULT_FOOTER
        }
    }

    async function initFooter() {
        const target = document.querySelector("[data-site-footer]")
        const existingOldFooter = document.querySelector(".footer, .collection-footer")
        const host = target || existingOldFooter || document.createElement("div")

        if (!target && !existingOldFooter) {
            document.body.appendChild(host)
        }

        const settings = await loadFooter()
        host.outerHTML = renderFooter(settings)
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initFooter)
    } else {
        initFooter()
    }

    window.addEventListener("storage", event => {
        if (event.key === "unspoken_footer_refresh") {
            initFooter()
        }
    })
})()
