import { defineConfig, devices } from "@playwright/test";

/**
 * E2E suite. The PDF engine is mocked at the network boundary, so these tests
 * verify the Next.js UI and API contract without requiring Stirling-PDF.
 */
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "node node_modules/next/dist/bin/next dev -p 3100",
    url: "http://localhost:3100/dashboard",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      STIRLING_PDF_URL: "http://127.0.0.1:9", // unreachable on purpose
      STIRLING_HEALTH_TIMEOUT_MS: "1000",
      UPLOAD_BACKUP_DIR: "off",
    },
  },
});
