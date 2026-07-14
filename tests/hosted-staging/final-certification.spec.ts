import { expect, test } from "@playwright/test";

import {
  authenticateContext,
  collectPageErrors,
  openHostedPage,
  stagingAccounts,
} from "./helpers";

const webkitAccessControlErrors = [/ due to access control checks\.$/];

test.describe("existing website hosted staging regression", () => {
  test("public directory, legacy routes, forms, policies, and donation guard remain intact", async ({ page }, testInfo) => {
    const assertNoPageErrors = collectPageErrors(
      page,
      testInfo.project.name === "webkit" ? webkitAccessControlErrors : [],
    );

    await openHostedPage(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.locator("#main-content").getByRole("link", { name: "Browse Churches", exact: true }),
    ).toBeVisible();
    await expect(page.locator('script[src*="zeffy.com"]')).toHaveCount(0);
    await expect(page.locator('a[href*="zeffy.com"]')).toHaveCount(0);

    await openHostedPage(page, "/churches");
    await expect(page.getByText("3 churches found", { exact: true })).toBeVisible();
    await page.getByLabel("Search by keyword").fill("Staging Test Church 2");
    await expect(page.getByText("1 church found", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { level: 3, name: "Staging Test Church 2" })).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("3 churches found", { exact: true })).toBeVisible();

    await openHostedPage(page, "/tx/palacios/staging-test-church-1");
    await expect(page.getByRole("heading", { level: 1, name: "Staging Test Church 1" })).toBeVisible();

    const legacyProfileResponse = await page.goto("/churches/staging-test-church-1", {
      waitUntil: "domcontentloaded",
    });
    expect(legacyProfileResponse?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/tx\/palacios\/staging-test-church-1$/);
    await expect(page.getByRole("heading", { level: 1, name: "Staging Test Church 1" })).toBeVisible();

    const legacyClaimResponse = await page.goto("/churches/staging-test-church-1/claim", {
      waitUntil: "domcontentloaded",
    });
    expect(legacyClaimResponse?.status()).toBeLessThan(400);
    await expect(page).toHaveURL(/\/tx\/palacios\/staging-test-church-1\/claim$/);
    await expect(
      page.getByRole("heading", { level: 1, name: "Request listing access for Staging Test Church 1" }),
    ).toBeVisible();

    await openHostedPage(page, "/submit");
    await expect(page.getByRole("heading", { level: 1, name: /Share a church listing/ })).toBeVisible();
    await expect(page.getByLabel("Church name")).toBeVisible();

    await openHostedPage(page, "/contact");
    await expect(page.getByRole("heading", { level: 1, name: "Questions, corrections, or support" })).toBeVisible();

    await openHostedPage(page, "/privacy");
    await expect(page.getByRole("heading", { level: 1, name: "Privacy overview" })).toBeVisible();
    await openHostedPage(page, "/terms");
    await expect(page.getByRole("heading", { level: 1, name: "Terms and Conditions" })).toBeVisible();

    assertNoPageErrors();
  });

  test("mobile navigation remains usable", async ({ page }) => {
    const assertNoPageErrors = collectPageErrors(page);
    await page.setViewportSize({ width: 375, height: 812 });
    await openHostedPage(page, "/");
    const menuButton = page.locator(".site-header__menu-button");
    await expect(menuButton).toBeVisible();
    await menuButton.click();
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "About", exact: true })
      .click();
    await expect(page).toHaveURL(/\/about$/);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    assertNoPageErrors();
  });
});

test.describe("existing authenticated website regression", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("representative account and church listing tools remain usable", async ({ context, page }, testInfo) => {
    const assertNoPageErrors = collectPageErrors(
      page,
      testInfo.project.name === "webkit" ? webkitAccessControlErrors : [],
    );
    await authenticateContext(context, stagingAccounts.churchA);

    await openHostedPage(page, "/portal");
    await expect(page.getByRole("link", { name: "Edit listing", exact: true })).toBeVisible();

    await openHostedPage(page, "/account");
    await expect(page.getByRole("heading", { level: 1, name: "Manage your account details" })).toBeVisible();
    const name = page.getByLabel(/^Name/);
    const existingName = await name.inputValue();
    expect(existingName.trim()).not.toBe("");
    await name.fill(existingName);
    await page.getByRole("button", { name: "Save profile" }).click();
    await expect(page).toHaveURL(/\/account\?success=profile-updated$/);
    await expect(page.getByText("Your profile has been updated.", { exact: true })).toBeVisible();

    await openHostedPage(page, "/portal/church/edit");
    await expect(page.getByRole("heading", { level: 1, name: "Update church information" })).toBeVisible();
    await expect(page.getByLabel("Church name")).toHaveValue("Staging Test Church 1");
    await expect(page.getByRole("button", { name: "Save church listing changes" })).toBeEnabled();
    assertNoPageErrors();
  });

  test("existing platform administration remains available", async ({ context, page }) => {
    const assertNoPageErrors = collectPageErrors(page);
    await authenticateContext(context, stagingAccounts.platformAdmin);

    await openHostedPage(page, "/admin");
    await expect(
      page.getByRole("navigation", { name: "Admin" }).getByRole("link", { name: "Churches" }),
    ).toBeVisible();
    await openHostedPage(page, "/admin/churches");
    await expect(page.getByRole("heading", { level: 1, name: "Church records in Firestore" })).toBeVisible();
    await expect(page.getByText("Staging Test Church 1", { exact: true })).toBeVisible();
    assertNoPageErrors();
  });
});
