import nextEnv from "@next/env";
import { devices } from "@playwright/test";
import { defineConfig } from "next/experimental/testmode/playwright.js";

process.env.NODE_ENV = "test";
nextEnv.loadEnvConfig(process.cwd());

/*
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 4,
  reporter: process.env.CI ? [["list"], ["html"]] : "list",
  use: {
    baseURL: "https://test.flexile.dev:3101",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    contextOptions: {
      ignoreHTTPSErrors: true,
    },
    locale: "en-US",
  },
  expect: { timeout: 30000, toPass: { timeout: 30000 } },
  timeout: process.env.CI ? 30000 : 120000,
  projects: [
    {
      name: "setup",
      testMatch: /global\.setup\.ts/u,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1920, height: 1080 },
      },
      dependencies: ["setup"],
      testMatch: "tests/**/*.spec.ts",
    },
  ],
  tsconfig: "./e2e/tsconfig.json",
  webServer: {
    command: "bin/test_server",
    url: "https://test.flexile.dev:3101",
    reuseExistingServer: !process.env.CI,
    ignoreHTTPSErrors: true,
    stdout: "pipe",
    stderr: "pipe",
  },
});
