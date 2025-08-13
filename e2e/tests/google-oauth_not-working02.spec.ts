import jwt from "jsonwebtoken";
import { expect, test } from "next/experimental/testmode/playwright.js";

test.skip(!process.env.GOOGLE_TEST_EMAIL || !process.env.GOOGLE_TEST_PASSWORD, "Google OAuth not configured");

test("google oauth login", async ({ page, next }) => {
  await page.route("https://accounts.google.com/o/oauth2/v2/auth*", async (route) => {
    const url = new URL(route.request().url());
    const redirectUri = url.searchParams.get("redirect_uri");
    const state = url.searchParams.get("state");
    const callback = new URL(
      `${redirectUri}?${new URLSearchParams({
        state,
        code: "fake-code",
      })}`,
    );

    await route.fulfill({
      status: 302,
      headers: {
        Location: callback.toString(),
      },
    });
  });

  // next-auth v4 using opendid-client v5 which using node:http to send request
  next.onFetch((request) => {
    console.log("-----------------------------next.onFetch", request);

    if (request.url === "https://oauth2.googleapis.com/token") {
      return new Response(
        JSON.stringify({
          access_token: "mock-access-token",
          expires_in: 3600,
          id_token: jwt.sign(
            {
              sub: "mock-google-user-id",
              email: "test@example.com",
              name: "Test User",
              iat: Math.floor(Date.now() / 1000),
              exp: Math.floor(Date.now() / 1000) + 3600,
              aud: "mock-client-id",
              iss: "https://accounts.google.com",
            },
            "secret",
            { algorithm: "HS256" },
          ),
          scope: "openid email profile",
          token_type: "Bearer",
        }),
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    return "continue";
  });

  await page.goto("/login");
  await page.getByRole("button", { name: "Log in with Google" }).click();

  await page.waitForURL("invoices");
  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
});
