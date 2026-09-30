import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },
  fullyParallel: false,
  retries: 0,
  reporter: [["list"]],
  snapshotPathTemplate: "tests/e2e/__screenshots__/{testFilePath}/{arg}{ext}",
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: "ar-KW",
    timezoneId: "Asia/Kuwait",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
