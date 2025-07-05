// @ts-nocheck
import { test, expect } from "@playwright/test"

test("index document then chat", async ({ request, page }) => {
  // 1. Index a simple document via API
  const docRes = await request.post("/api/documents", {
    data: {
      content: "Playwright is a Node library to automate Chromium browsers.",
      provider: "surus",
      dimension: 768,
    },
  })
  expect(docRes.ok()).toBeTruthy()

  // 2. Open chat page and send question
  await page.goto("/chat")
  await page.fill("input[placeholder='Escribí tu mensaje...']", "¿Qué es Playwright?")
  await page.keyboard.press("Enter")

  // 3. Wait for assistant response to show
  await page.waitForSelector("text=Playwright", { timeout: 15000 })

  // 4. Click bubble and verify sources panel appears
  await page.locator("text=Playwright").last().click()
  await page.waitForSelector("text=Fuentes", { timeout: 5000 })
}) 