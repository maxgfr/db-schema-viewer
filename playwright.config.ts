import { defineConfig, devices } from "@playwright/test";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 2,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: `http://127.0.0.1:43871${basePath}/`, locale: "en-US", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile", use: { ...devices["iPhone 13"], defaultBrowserType: "webkit" } },
  ],
  webServer: { command: "node scripts/serve-export.mjs", url: `http://127.0.0.1:43871${basePath}/`, reuseExistingServer: false },
});
