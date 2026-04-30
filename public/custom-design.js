(function customDesignPageBootstrap() {
    const form = document.getElementById("customDesignForm")
    if (!form) return

    const messageEl = document.getElementById("customDesignMessage")
    const submitBtn = document.getElementById("customDesignSubmitBtn")
    const termsCheck = document.getElementById("orderTermsCheck")

    const targetGenderSelect = document.getElementById("targetGenderSelect")
    const tshirtFitSelect = document.getElementById("tshirtFitSelect")
    const baseColorInput = document.getElementById("baseColorInput")
    const baseColorSwatches = Array.from(document.querySelectorAll("#baseColorSwatches .color-swatch"))
    const savePresetBtn = document.getElementById("savePresetBtn")
    const presetNote = document.getElementById("presetNote")

    const printSideInputs = Array.from(form.querySelectorAll("input[name='printSides']"))
    const frontPlacementSelect = form.querySelector("select[name='frontPlacement']")
    const backPlacementSelect = form.querySelector("select[name='backPlacement']")
    const frontPlacementField = form.querySelector("select[name='frontPlacement']")?.closest("label")
    const backPlacementField = document.getElementById("backPlacementField")
    const backDesignField = document.getElementById("backDesignField")

    const frontDesignInput = document.getElementById("frontDesignInput")
    const backDesignInput = document.getElementById("backDesignInput")
    const referenceDesignsInput = document.getElementById("referenceDesignsInput")
    const filePreviewList = document.getElementById("filePreviewList")

    const sizeInputs = Array.from(form.querySelectorAll(".size-input"))
    const quantityInput = document.getElementById("quantityInput")
    const totalQuantityValue = document.getElementById("totalQuantityValue")

    const summaryFit = document.getElementById("summaryFit")
    const summaryColor = document.getElementById("summaryColor")
    const summaryPrimarySize = document.getElementById("summaryPrimarySize")
    const summarySides = document.getElementById("summarySides")
    const summaryQuantity = document.getElementById("summaryQuantity")

    const previewFrontCard = document.getElementById("previewFrontCard")
    const previewBackCard = document.getElementById("previewBackCard")
    const previewFrontState = document.getElementById("previewFrontState")
    const previewBackState = document.getElementById("previewBackState")
    const previewFrontCanvas = document.getElementById("previewFrontCanvas")
    const previewBackCanvas = document.getElementById("previewBackCanvas")
    const previewFrontDesignLayer = previewFrontCanvas?.querySelector(".tshirt-design-layer")
    const previewBackDesignLayer = previewBackCanvas?.querySelector(".tshirt-design-layer")
    const previewFrontDesignImage = document.getElementById("previewFrontDesignImage")
    const previewBackDesignImage = document.getElementById("previewBackDesignImage")
    const previewFrontDesignPlaceholder = document.getElementById("previewFrontDesignPlaceholder")
    const previewBackDesignPlaceholder = document.getElementById("previewBackDesignPlaceholder")
    const previewFrontFitBadge = document.getElementById("previewFrontFitBadge")
    const previewBackFitBadge = document.getElementById("previewBackFitBadge")
    const previewFrontSizeBadge = document.getElementById("previewFrontSizeBadge")
    const previewBackSizeBadge = document.getElementById("previewBackSizeBadge")

    const previewMetaFit = document.getElementById("previewMetaFit")
    const previewMetaColor = document.getElementById("previewMetaColor")
    const previewMetaSides = document.getElementById("previewMetaSides")
    const previewMetaSize = document.getElementById("previewMetaSize")
    const previewMetaQty = document.getElementById("previewMetaQty")

    const designPreviewState = {
        front: { url: "", signature: "" },
        back: { url: "", signature: "" }
    }

    const COLOR_HEX_BY_NAME = {
        black: "#111111",
        white: "#f4f4f4",
        navy: "#1f2b4d",
        charcoal: "#2f3438",
        beige: "#d4c3a4",
        olive: "#5d6a41",
        maroon: "#6a2230",
        sky: "#8cb7de",
        mint: "#8bc9b0",
        lavender: "#b4addf"
    }

    const FRONT_PLACEMENT_CONFIG = {
        "center-chest": { left: "50%", top: "44%", width: "58%", height: "50%", radius: "8px" },
        "left-chest": { left: "34%", top: "35%", width: "32%", height: "24%", radius: "8px" },
        "full-front": { left: "50%", top: "49%", width: "82%", height: "74%", radius: "10px" },
        "neck-label": { left: "50%", top: "17%", width: "26%", height: "14%", radius: "6px" },
        custom: { left: "50%", top: "46%", width: "62%", height: "56%", radius: "10px" }
    }

    const BACK_PLACEMENT_CONFIG = {
        "upper-back": { left: "50%", top: "30%", width: "58%", height: "28%", radius: "8px" },
        "full-back": { left: "50%", top: "49%", width: "84%", height: "75%", radius: "10px" },
        "neck-label": { left: "50%", top: "15%", width: "24%", height: "14%", radius: "6px" },
        custom: { left: "50%", top: "46%", width: "62%", height: "58%", radius: "10px" }
    }

    function normalizeText(value) {
        return String(value || "").trim()
    }

    function normalizeLower(value) {
        return normalizeText(value).toLowerCase()
    }

    function toTitleCase(value) {
        return normalizeText(value)
            .split(" ")
            .filter(Boolean)
            .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
            .join(" ")
    }

    function formatFileSize(bytes) {
        const size = Number(bytes || 0)
        if (size < 1024 * 1024) {
            return `${Math.max(1, Math.round(size / 1024))} KB`
        }
        return `${(size / (1024 * 1024)).toFixed(2)} MB`
    }

    function getSelectedPrintSides() {
        const selected = printSideInputs.find(input => input.checked)
        return String(selected?.value || "front")
    }

    function getPrintSidesLabel(value) {
        if (value === "both") return "Front + Back"
        if (value === "back") return "Back Only"
        return "Front Only"
    }

    function normalizePlacement(side, value) {
        const normalized = normalizeLower(value)

        if (side === "front") {
            return FRONT_PLACEMENT_CONFIG[normalized] ? normalized : "center-chest"
        }

        return BACK_PLACEMENT_CONFIG[normalized] ? normalized : "upper-back"
    }

    function getPlacementConfig(side, value) {
        const key = normalizePlacement(side, value)
        return side === "front"
            ? FRONT_PLACEMENT_CONFIG[key]
            : BACK_PLACEMENT_CONFIG[key]
    }

    function toCssUnit(value, fallback) {
        if (value === undefined || value === null || value === "") return fallback
        if (typeof value === "number") return `${value}px`
        return String(value)
    }

    function applyPlacementToLayer(layer, config) {
        if (!layer || !config) return

        layer.style.left = toCssUnit(config.left, "50%")
        layer.style.top = toCssUnit(config.top, "45%")
        layer.style.width = toCssUnit(config.width, "58%")
        layer.style.height = toCssUnit(config.height, "50%")
        layer.style.borderRadius = toCssUnit(config.radius, "8px")
    }

    function getCurrentColorLabel() {
        const inputColor = normalizeText(baseColorInput?.value)
        if (inputColor) return toTitleCase(inputColor)

        const activeColor = baseColorSwatches.find(button => button.classList.contains("active"))?.dataset?.color
        return normalizeText(activeColor) || "Black"
    }

    function resolveColorHex(value) {
        const raw = normalizeText(value)
        if (!raw) return "#111111"

        if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) {
            return raw
        }

        const mapped = COLOR_HEX_BY_NAME[normalizeLower(raw)]
        if (mapped) return mapped

        return "#111111"
    }

    function getContrastTextColor(hex) {
        const sanitized = normalizeText(hex).replace("#", "")
        if (sanitized.length !== 6) return "#ffffff"

        const r = Number.parseInt(sanitized.slice(0, 2), 16)
        const g = Number.parseInt(sanitized.slice(2, 4), 16)
        const b = Number.parseInt(sanitized.slice(4, 6), 16)

        if ([r, g, b].some(channel => Number.isNaN(channel))) {
            return "#ffffff"
        }

        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        return luminance > 0.62 ? "#1a1a1a" : "#ffffff"
    }

    function setActiveColorSwatch(colorLabel) {
        const requested = normalizeLower(colorLabel)
        let hasActive = false

        baseColorSwatches.forEach(button => {
            const swatchColor = normalizeLower(button.dataset.color)
            const isActive = requested && swatchColor === requested
            button.classList.toggle("active", isActive)
            if (isActive) hasActive = true
        })

        if (!hasActive && !requested && baseColorSwatches[0]) {
            baseColorSwatches[0].classList.add("active")
        }
    }

    function parseSizeBreakdown() {
        const valueByName = Object.fromEntries(
            sizeInputs.map(input => [String(input.name || ""), input.value])
        )

        const parseQty = raw => {
            const parsed = Number.parseInt(String(raw ?? "0"), 10)
            if (Number.isNaN(parsed) || parsed < 0) return 0
            return parsed
        }

        return {
            xs: parseQty(valueByName.sizeXs),
            s: parseQty(valueByName.sizeS),
            m: parseQty(valueByName.sizeM),
            l: parseQty(valueByName.sizeL),
            xl: parseQty(valueByName.sizeXl),
            xxl: parseQty(valueByName.sizeXxl),
            xxxl: parseQty(valueByName.sizeXxxl)
        }
    }

    function getTotalQuantity(sizeBreakdown) {
        return Object.values(sizeBreakdown).reduce((sum, qty) => sum + Number(qty || 0), 0)
    }

    function getPrimarySize(sizeBreakdown) {
        const ordered = [
            ["XS", sizeBreakdown.xs],
            ["S", sizeBreakdown.s],
            ["M", sizeBreakdown.m],
            ["L", sizeBreakdown.l],
            ["XL", sizeBreakdown.xl],
            ["XXL", sizeBreakdown.xxl],
            ["XXXL", sizeBreakdown.xxxl]
        ]

        let winner = "M"
        let winnerQty = 0

        ordered.forEach(([size, qty]) => {
            if (Number(qty || 0) > winnerQty) {
                winner = size
                winnerQty = Number(qty || 0)
            }
        })

        return winner
    }

    function getFileSignature(file) {
        if (!file) return ""
        return `${file.name || "file"}::${file.size || 0}::${file.lastModified || 0}`
    }

    function revokeDesignPreview(side) {
        const bucket = designPreviewState[side]
        if (!bucket) return
        if (bucket.url) {
            URL.revokeObjectURL(bucket.url)
        }
        bucket.url = ""
        bucket.signature = ""
    }

    function setDesignImageForSide(side, file) {
        const imageEl = side === "front" ? previewFrontDesignImage : previewBackDesignImage
        const placeholderEl = side === "front" ? previewFrontDesignPlaceholder : previewBackDesignPlaceholder
        const state = designPreviewState[side]

        if (!imageEl || !placeholderEl || !state) return

        if (!file) {
            revokeDesignPreview(side)
            imageEl.removeAttribute("src")
            imageEl.classList.add("hidden")
            placeholderEl.classList.remove("hidden")
            return
        }

        const nextSignature = getFileSignature(file)
        if (state.signature !== nextSignature) {
            if (state.url) {
                URL.revokeObjectURL(state.url)
            }
            state.url = URL.createObjectURL(file)
            state.signature = nextSignature
        }

        imageEl.src = state.url
        imageEl.classList.remove("hidden")
        placeholderEl.classList.add("hidden")
    }

    function setDesignPlaceholder(side, text) {
        const placeholderEl = side === "front" ? previewFrontDesignPlaceholder : previewBackDesignPlaceholder
        const imageEl = side === "front" ? previewFrontDesignImage : previewBackDesignImage

        if (!placeholderEl || !imageEl) return

        placeholderEl.textContent = text
        placeholderEl.classList.remove("hidden")
        imageEl.classList.add("hidden")
    }

    function resolveDesignSourceForSide(side, sidesValue) {
        const frontFile = frontDesignInput?.files?.[0] || null
        const backFile = backDesignInput?.files?.[0] || null
        const referenceFile = referenceDesignsInput?.files?.[0] || null

        if (side === "front") {
            if (frontFile) return { file: frontFile, source: "front" }
            if (referenceFile) return { file: referenceFile, source: "reference" }
            if (sidesValue !== "front" && backFile) return { file: backFile, source: "back-fallback" }
            return { file: null, source: "none" }
        }

        if (backFile) return { file: backFile, source: "back" }
        if (referenceFile) return { file: referenceFile, source: "reference" }
        if (sidesValue !== "back" && frontFile) return { file: frontFile, source: "front-fallback" }
        return { file: null, source: "none" }
    }

    function updateSideStates(sidesValue) {
        const frontActive = sidesValue !== "back"
        const backActive = sidesValue !== "front"

        previewFrontCard?.classList.toggle("inactive", !frontActive)
        previewBackCard?.classList.toggle("inactive", !backActive)

        if (previewFrontState) {
            previewFrontState.textContent = frontActive ? "Selected" : "Not Selected"
        }

        if (previewBackState) {
            previewBackState.textContent = backActive ? "Selected" : "Not Selected"
        }

        return { frontActive, backActive }
    }

    function updateDesignPreview(sidesValue) {
        const { frontActive, backActive } = updateSideStates(sidesValue)
        const frontSource = resolveDesignSourceForSide("front", sidesValue)
        const backSource = resolveDesignSourceForSide("back", sidesValue)

        if (!frontActive) {
            setDesignImageForSide("front", null)
            setDesignPlaceholder("front", "Not selected")
        } else if (frontSource.file) {
            setDesignImageForSide("front", frontSource.file)
        } else {
            setDesignImageForSide("front", null)
            setDesignPlaceholder("front", "Upload front design")
        }

        if (!backActive) {
            setDesignImageForSide("back", null)
            setDesignPlaceholder("back", "Not selected")
        } else if (backSource.file) {
            setDesignImageForSide("back", backSource.file)
        } else {
            setDesignImageForSide("back", null)
            setDesignPlaceholder("back", "Upload back design")
        }
    }

    function updatePreview(fitLabel, colorLabel, primarySize, totalQuantity, sidesValue) {
        const normalizedFit = fitLabel === "Regular" ? "Regular" : "Oversized"
        const colorHex = resolveColorHex(colorLabel)
        const textColor = getContrastTextColor(colorHex)
        const frontPlacementConfig = getPlacementConfig("front", frontPlacementSelect?.value)
        const backPlacementConfig = getPlacementConfig("back", backPlacementSelect?.value)

        ;[previewFrontCanvas, previewBackCanvas].forEach(canvas => {
            if (!canvas) return
            canvas.style.setProperty("--tee-color", colorHex)
            canvas.style.setProperty("--tee-text", textColor)
        })

        applyPlacementToLayer(previewFrontDesignLayer, frontPlacementConfig)
        applyPlacementToLayer(previewBackDesignLayer, backPlacementConfig)

        if (previewFrontFitBadge) previewFrontFitBadge.textContent = normalizedFit.toUpperCase()
        if (previewBackFitBadge) previewBackFitBadge.textContent = normalizedFit.toUpperCase()
        if (previewFrontSizeBadge) previewFrontSizeBadge.textContent = primarySize
        if (previewBackSizeBadge) previewBackSizeBadge.textContent = primarySize

        if (previewMetaFit) previewMetaFit.textContent = normalizedFit
        if (previewMetaColor) previewMetaColor.textContent = colorLabel
        if (previewMetaSides) previewMetaSides.textContent = getPrintSidesLabel(sidesValue)
        if (previewMetaSize) previewMetaSize.textContent = primarySize
        if (previewMetaQty) previewMetaQty.textContent = String(totalQuantity)

        updateDesignPreview(sidesValue)
    }

    function updateSummary() {
        const fitValue = normalizeText(tshirtFitSelect?.value || "oversized")
        const fitLabel = fitValue === "regular" ? "Regular" : "Oversized"

        if (summaryFit) {
            summaryFit.textContent = fitLabel
        }

        const colorLabel = getCurrentColorLabel()
        if (summaryColor) {
            summaryColor.textContent = colorLabel
        }

        const sidesValue = getSelectedPrintSides()
        if (summarySides) {
            summarySides.textContent = getPrintSidesLabel(sidesValue)
        }

        const sizeBreakdown = parseSizeBreakdown()
        const total = getTotalQuantity(sizeBreakdown)
        const primarySize = getPrimarySize(sizeBreakdown)

        if (quantityInput) quantityInput.value = String(total)
        if (totalQuantityValue) totalQuantityValue.textContent = String(total)
        if (summaryQuantity) summaryQuantity.textContent = String(total)
        if (summaryPrimarySize) summaryPrimarySize.textContent = primarySize

        updatePreview(fitLabel, colorLabel, primarySize, total, sidesValue)
    }

    function updatePrintSideFields() {
        const selected = getSelectedPrintSides()
        const isFrontVisible = selected !== "back"
        const isBackVisible = selected !== "front"

        if (frontPlacementField) {
            frontPlacementField.classList.toggle("hidden", !isFrontVisible)
            const select = frontPlacementField.querySelector("select")
            if (select) {
                select.disabled = !isFrontVisible
            }
        }

        if (backPlacementField) {
            backPlacementField.classList.toggle("hidden", !isBackVisible)
            const select = backPlacementField.querySelector("select")
            if (select) {
                select.disabled = !isBackVisible
            }
        }

        if (frontDesignInput) {
            frontDesignInput.disabled = !isFrontVisible
        }

        if (backDesignField) {
            backDesignField.classList.toggle("hidden", !isBackVisible)
        }

        if (backDesignInput) {
            backDesignInput.disabled = !isBackVisible
        }

        updateSummary()
        renderFilePreview()
    }

    function renderFilePreview() {
        if (!filePreviewList) return

        const rows = []
        const selectedSides = getSelectedPrintSides()

        if (frontDesignInput?.files?.length && selectedSides !== "back") {
            const file = frontDesignInput.files[0]
            rows.push({
                label: "Front",
                name: file.name,
                size: formatFileSize(file.size)
            })
        }

        if (backDesignInput?.files?.length && selectedSides !== "front") {
            const file = backDesignInput.files[0]
            rows.push({
                label: "Back",
                name: file.name,
                size: formatFileSize(file.size)
            })
        }

        if (referenceDesignsInput?.files?.length) {
            Array.from(referenceDesignsInput.files).forEach(file => {
                rows.push({
                    label: "Reference",
                    name: file.name,
                    size: formatFileSize(file.size)
                })
            })
        }

        if (!rows.length) {
            filePreviewList.innerHTML = ""
            return
        }

        filePreviewList.innerHTML = rows.map(row => `
            <div class="file-preview-item">
                <strong>${row.label}</strong>
                <span>${row.name} (${row.size})</span>
            </div>
        `).join("")
    }

    function showMessage(text, type = "success") {
        if (!messageEl) return
        messageEl.textContent = text
        messageEl.classList.remove("hidden", "success", "error")
        messageEl.classList.add(type)
    }

    function hideMessage() {
        if (!messageEl) return
        messageEl.textContent = ""
        messageEl.classList.add("hidden")
        messageEl.classList.remove("success", "error")
    }

    function hasAtLeastOneDesignFile() {
        const sides = getSelectedPrintSides()
        const hasFront = frontDesignInput?.files?.length > 0
        const hasBack = backDesignInput?.files?.length > 0
        const hasRefs = referenceDesignsInput?.files?.length > 0

        if (sides === "front") {
            return hasFront || hasRefs
        }

        if (sides === "back") {
            return hasBack || hasRefs
        }

        return hasFront || hasBack || hasRefs
    }

    function applyQueryPrefill() {
        const params = new URLSearchParams(window.location.search)
        const requestedFit = normalizeText(params.get("fit")).toLowerCase()
        const requestedGender = normalizeText(params.get("gender")).toLowerCase()
        const requestedColor = normalizeText(params.get("color"))
        const requestedFrontPlacement = normalizeText(params.get("frontPlacement")).toLowerCase()
        const requestedBackPlacement = normalizeText(params.get("backPlacement")).toLowerCase()

        if (requestedFit && (requestedFit === "oversized" || requestedFit === "regular") && tshirtFitSelect) {
            tshirtFitSelect.value = requestedFit
        }

        if (requestedGender && (requestedGender === "men" || requestedGender === "women" || requestedGender === "unisex") && targetGenderSelect) {
            targetGenderSelect.value = requestedGender
        }

        if (requestedColor && baseColorInput) {
            baseColorInput.value = toTitleCase(requestedColor)
            setActiveColorSwatch(baseColorInput.value)
        }

        if (frontPlacementSelect && requestedFrontPlacement) {
            const hasFront = Array.from(frontPlacementSelect.options)
                .some(option => normalizeLower(option.value) === requestedFrontPlacement)

            if (hasFront) {
                frontPlacementSelect.value = requestedFrontPlacement
            }
        }

        if (backPlacementSelect && requestedBackPlacement) {
            const hasBack = Array.from(backPlacementSelect.options)
                .some(option => normalizeLower(option.value) === requestedBackPlacement)

            if (hasBack) {
                backPlacementSelect.value = requestedBackPlacement
            }
        }
    }

    function resetFormState() {
        form.reset()

        if (printSideInputs.length) {
            printSideInputs[0].checked = true
        }

        if (baseColorInput) {
            baseColorInput.value = "Black"
        }

        setActiveColorSwatch("Black")
        applyQueryPrefill()
        updatePrintSideFields()
        updateSummary()
        renderFilePreview()
    }

    function buildPresetPayload() {
        const sizeBreakdown = parseSizeBreakdown()
        const totalQuantity = getTotalQuantity(sizeBreakdown)
        const primarySize = getPrimarySize(sizeBreakdown)
        const targetGender = normalizeText(targetGenderSelect?.value || "unisex").toLowerCase()
        const tshirtFit = normalizeText(tshirtFitSelect?.value || "oversized").toLowerCase()
        const baseColor = getCurrentColorLabel()
        const printSides = getSelectedPrintSides()
        const frontPlacement = normalizePlacement("front", frontPlacementSelect?.value)
        const backPlacement = normalizePlacement("back", backPlacementSelect?.value)

        return {
            presetName: `${toTitleCase(targetGender)} ${toTitleCase(tshirtFit)} Tee - ${baseColor}`,
            targetGender,
            tshirtFit,
            baseColor,
            printSides,
            frontPlacement,
            backPlacement,
            primarySize,
            quantity: totalQuantity > 0 ? totalQuantity : 1,
            sizeBreakdown
        }
    }

    function persistPresetLocally(userEmail, presetPayload) {
        const storageKey = `luxora_custom_tshirt_presets_${normalizeLower(userEmail) || "guest"}`
        const signature = [
            presetPayload.targetGender,
            presetPayload.tshirtFit,
            normalizeLower(presetPayload.baseColor),
            presetPayload.printSides,
            presetPayload.frontPlacement,
            presetPayload.backPlacement,
            presetPayload.primarySize,
            JSON.stringify(presetPayload.sizeBreakdown || {})
        ].join("::")

        const nextPreset = {
            ...presetPayload,
            signature,
            savedAt: Date.now()
        }

        try {
            const existing = JSON.parse(localStorage.getItem(storageKey) || "[]")
            const rows = Array.isArray(existing) ? existing : []

            const deduped = [nextPreset, ...rows.filter(row => String(row?.signature || "") !== signature)]
                .slice(0, 20)

            localStorage.setItem(storageKey, JSON.stringify(deduped))
        } catch (err) {
            console.log("Preset local save failed:", err)
        }
    }

    function updatePresetNote() {
        if (!presetNote) return

        const userEmail = window.LuxoraCart?.getUserEmail?.() || ""
        if (!userEmail) {
            presetNote.textContent = "Sign in to save preset to your account cart and use it later."
            return
        }

        presetNote.textContent = `Preset will be saved for ${userEmail} and added to cart instantly.`
    }

    async function savePresetAndAddToCart() {
        hideMessage()
        updateSummary()

        const totalQuantity = Number.parseInt(String(quantityInput?.value || "0"), 10)
        if (Number.isNaN(totalQuantity) || totalQuantity < 1) {
            showMessage("Add at least one size quantity before saving your preset.", "error")
            return
        }

        if (!window.LuxoraCart?.addCustomPreset) {
            showMessage("Cart module is unavailable right now. Please try again.", "error")
            return
        }

        const initialButtonLabel = savePresetBtn?.textContent || "Save Preset + Add to Cart"
        const presetPayload = buildPresetPayload()
        const userEmail = window.LuxoraCart?.getUserEmail?.() || ""

        try {
            if (savePresetBtn) {
                savePresetBtn.disabled = true
                savePresetBtn.textContent = "Saving..."
            }

            const cartPayload = await window.LuxoraCart.addCustomPreset(presetPayload)
            persistPresetLocally(userEmail, presetPayload)

            const nextCount = Number(cartPayload?.itemCount || 0)
            showMessage(
                `Preset saved and added to cart successfully. Cart now has ${nextCount} item${nextCount === 1 ? "" : "s"}.`,
                "success"
            )
        } catch (err) {
            if (String(err?.message || "") === "signin-required") {
                showMessage("Please sign in first to save this preset and add it to cart.", "error")
            } else {
                showMessage(err?.message || "Unable to save preset right now. Please try again.", "error")
            }
        } finally {
            if (savePresetBtn) {
                savePresetBtn.disabled = false
                savePresetBtn.textContent = initialButtonLabel
            }
        }
    }

    printSideInputs.forEach(input => {
        input.addEventListener("change", updatePrintSideFields)
    })

    if (tshirtFitSelect) {
        tshirtFitSelect.addEventListener("change", updateSummary)
    }

    frontPlacementSelect?.addEventListener("change", updateSummary)
    backPlacementSelect?.addEventListener("change", updateSummary)

    if (baseColorInput) {
        baseColorInput.addEventListener("input", () => {
            setActiveColorSwatch(baseColorInput.value)
            updateSummary()
        })
    }

    baseColorSwatches.forEach(button => {
        button.addEventListener("click", () => {
            const color = normalizeText(button.dataset.color || "Black")
            if (baseColorInput) {
                baseColorInput.value = color
            }
            setActiveColorSwatch(color)
            updateSummary()
        })
    })

    sizeInputs.forEach(input => {
        input.addEventListener("input", updateSummary)
    })

    ;[frontDesignInput, backDesignInput, referenceDesignsInput].forEach(input => {
        input?.addEventListener("change", () => {
            renderFilePreview()
            updateSummary()
        })
    })

    savePresetBtn?.addEventListener("click", savePresetAndAddToCart)

    form.addEventListener("submit", async event => {
        event.preventDefault()
        hideMessage()
        updateSummary()

        if (!form.reportValidity()) {
            return
        }

        const totalQuantity = Number.parseInt(String(quantityInput?.value || "0"), 10)
        if (Number.isNaN(totalQuantity) || totalQuantity < 1) {
            showMessage("Please add size quantities before submitting your request.", "error")
            return
        }

        if (!hasAtLeastOneDesignFile()) {
            showMessage("Upload at least one design file for your selected print side.", "error")
            return
        }

        if (!termsCheck?.checked) {
            showMessage("Please confirm the terms before submitting.", "error")
            return
        }

        const initialButtonLabel = submitBtn?.textContent || "Submit"

        try {
            if (submitBtn) {
                submitBtn.disabled = true
                submitBtn.textContent = "Submitting..."
            }

            const formData = new FormData(form)
            const response = await fetch("/api/custom-designs", {
                method: "POST",
                body: formData
            })

            const payload = await response.json().catch(() => ({}))

            if (!response.ok) {
                showMessage(payload?.error || "Unable to submit your custom request right now.", "error")
                return
            }

            const requestCode = normalizeText(payload?.request?.requestCode)
            const successMessage = requestCode
                ? `Request submitted successfully. Your reference code is ${requestCode}.`
                : "Request submitted successfully. Our team will contact you soon."

            showMessage(successMessage, "success")
            resetFormState()
            window.scrollTo({ top: 0, behavior: "smooth" })
        } catch (err) {
            console.log("Custom design submit error:", err)
            showMessage("Unable to submit your request right now. Please try again.", "error")
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false
                submitBtn.textContent = initialButtonLabel
            }
        }
    })

    applyQueryPrefill()
    setActiveColorSwatch(getCurrentColorLabel())
    updatePrintSideFields()
    updateSummary()
    renderFilePreview()
    const sessionRefresh = window.LuxoraCart?.refreshSession?.({ silent: true })
    if (sessionRefresh && typeof sessionRefresh.then === "function") {
        sessionRefresh.finally(() => {
            updatePresetNote()
            window.LuxoraCart?.refreshCartCount()
        })
    } else {
        updatePresetNote()
        window.LuxoraCart?.refreshCartCount()
    }

    window.addEventListener("storage", event => {
        if (event.key !== "userEmail") return
        updatePresetNote()
    })

    window.addEventListener("beforeunload", () => {
        revokeDesignPreview("front")
        revokeDesignPreview("back")
    })
})()
