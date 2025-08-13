import { expect, test } from "@test/index";
import { chromium } from "playwright-extra";
import stealth from "puppeteer-extra-plugin-stealth";

test.skip(!process.env.GOOGLE_TEST_EMAIL || !process.env.GOOGLE_TEST_PASSWORD, "Google OAuth not configured");

chromium.use(stealth());

const baseURL = "https://test.flexile.dev:3101";
const username = process.env.GOOGLE_TEST_EMAIL ?? "";
const password = process.env.GOOGLE_TEST_PASSWORD ?? "";

test.skip("google oauth login", async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-web-security",
      "--disable-infobars",
      "--disable-extensions",
      "--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36", // Real user-agent
    ],
    viewport: { width: 1280 + Math.floor(Math.random() * 100), height: 720 + Math.floor(Math.random() * 100) },
  });
  const page = await browser.newPage();

  await page.goto(`${baseURL}/login`);
  await page.getByRole("button", { name: "Log in with Google" }).click();

  await page.fill("#identifierId", username);
  await page.locator("#identifierNext >> button").click();
  await page.getByText("Try again").click();
  await page.fill('#password >> input[type="password"]', password);
  await page.locator("button >> nth=1").click();

  await page.waitForURL(baseURL);

  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();

  await browser.close();
});
