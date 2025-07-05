// @ts-nocheck
import { defineConfig, devices } from "@playwright/test"

export default defineConfig({
  testDir: "test/e2e",
  timeout: 30_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
}) 