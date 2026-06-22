const { test, expect } = require("@playwright/test")

test("home auth and mobile pages smoke", async ({ page }) => {
    const errors = []
    page.on("pageerror", error => errors.push(error.message))
    page.on("console", message => {
        if (message.type() === "error") errors.push(message.text())
    })

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto("http://localhost:3000/", { waitUntil: "domcontentloaded" })

    const signIn = page.locator("#signinBtn")
    if (await signIn.isVisible()) {
        await signIn.click()
    } else {
        await page.locator(".profile-circle").click()
    }

    await page.locator("[data-auth-mode-btn='signup']").click()
    await expect(page.locator("body")).not.toContainText("Style Lane")
    await expect(page.locator("body")).not.toContainText("Fit Mood")

    await page.locator("[data-auth-method-btn='signup-phone']").click()
    await page.locator("#signupOtpPhone").fill("+12345678901")

    const panel = await page.locator(".auth-panel").boundingBox()
    expect(panel.width).toBeLessThanOrEqual(390)

    for (const path of ["/cart.html", "/men.html", "/women.html", "/unisex.html", "/wishlist.html"]) {
        await page.goto(`http://localhost:3000${path}`, { waitUntil: "domcontentloaded" })
        await expect(page.locator("body")).toBeVisible()
    }

    expect(errors.filter(Boolean).slice(0, 3)).toEqual([])
})
