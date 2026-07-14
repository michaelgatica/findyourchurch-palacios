import { expect, test } from "@playwright/test";

import { openHostedPage, stagingAccounts } from "./helpers";

test("staging admin sign-in obtains a reCAPTCHA Enterprise App Check token", async ({ page }) => {
  const password = process.env.FYC_STAGING_QA_PASSWORD?.trim();
  expect(password, "The staging QA password must be supplied in process memory.").toBeTruthy();

  let providerScriptLoaded = false;
  const exchangeStatuses: number[] = [];
  const appCheckRequests = new Set<string>();
  const safeConsoleMessages: string[] = [];
  page.on("console", (message) => {
    if (/App Check/i.test(message.text())) {
      safeConsoleMessages.push(message.text().slice(0, 200));
    }
  });
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/recaptcha|firebaseappcheck|googleapis/i.test(url.hostname + url.pathname)) {
      appCheckRequests.add(`${url.hostname}${url.pathname}`);
    }
  });
  page.on("response", (response) => {
    const url = response.url();
    if (/recaptcha\/enterprise\.js/i.test(url)) {
      providerScriptLoaded = true;
    }
    if (/firebaseappcheck\.googleapis\.com\/.*exchangeRecaptchaEnterpriseToken/i.test(url)) {
      exchangeStatuses.push(response.status());
    }
  });

  await openHostedPage(page, "/admin/login");
  await page.getByLabel(/Email address/).fill(stagingAccounts.platformAdmin);
  await page.getByLabel(/Password/).fill(password!);
  await page.getByRole("button", { name: "Sign in to admin" }).click();
  await expect(page).toHaveURL(/\/admin(?:\/|$)/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(5_000);
  console.log(JSON.stringify({
    diagnostic: "staging-app-check-network",
    providerScriptLoaded,
    exchangeStatuses,
    requestPaths: [...appCheckRequests],
    safeConsoleMessages,
  }));
  await expect.poll(() => exchangeStatuses.length, { timeout: 15_000 }).toBeGreaterThan(0);

  expect(providerScriptLoaded).toBe(true);
  expect(exchangeStatuses.every((status) => status >= 200 && status < 300)).toBe(true);
  console.log(JSON.stringify({
    ok: true,
    suite: "staging-app-check",
    provider: "reCAPTCHA Enterprise",
    providerScriptLoaded,
    tokenExchangeStatuses: exchangeStatuses,
    authenticatedAdminWorkflowPassed: true,
    enforcementMode: "monitor",
  }));
});
