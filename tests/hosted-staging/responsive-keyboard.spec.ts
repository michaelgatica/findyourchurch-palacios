import { expect, test } from "@playwright/test";

import {
  assertNoPageOverflow,
  authenticateContext,
  collectPageErrors,
  openHostedPage,
  stagingAccounts,
} from "./helpers";

const viewports = [
  { label: "320px phone", width: 320, height: 720 },
  { label: "375px phone", width: 375, height: 812 },
  { label: "430px phone", width: 430, height: 932 },
  { label: "768px portrait", width: 768, height: 1024 },
  { label: "1024px landscape", width: 1024, height: 768 },
  { label: "1366px laptop", width: 1366, height: 768 },
  { label: "1920px desktop", width: 1920, height: 1080 },
] as const;

const responsivePublicRoutes = [
  "/",
  "/events",
  "/events/staging-published-family-night",
  "/events/staging-published-family-night/register",
] as const;

for (const viewport of viewports) {
  test.describe(`${viewport.label} responsive public layout`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    for (const route of responsivePublicRoutes) {
      test(`${route} has no page overflow`, async ({ page }) => {
        await openHostedPage(page, route);
        await assertNoPageOverflow(page, `${viewport.label} ${route}`);
      });
    }
  });
}

test.describe("keyboard navigation", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("skip link and mobile navigation work without a mouse", async ({ page }, testInfo) => {
    const assertNoPageErrors = collectPageErrors(page);
    await openHostedPage(page, "/");
    const skipLink = page.locator(".skip-link");
    if (testInfo.project.name === "webkit") {
      // Playwright WebKit follows Safari's default preference that skips links during Tab navigation.
      // Explicit focus still verifies that the skip link is exposed and keyboard-operable.
      await skipLink.focus();
    } else {
      await page.keyboard.press("Tab");
    }
    await expect(skipLink).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();

    const menuButton = page.locator('button[aria-controls="primary-navigation"]');
    await menuButton.focus();
    await page.keyboard.press("Enter");
    await expect(menuButton).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeVisible();
    assertNoPageErrors();
  });

  test("account menu supports arrow keys, Escape, and focus return", async ({ page }) => {
    await openHostedPage(page, "/");
    const accountButton = page.getByRole("button", { name: "Sign in" }).filter({ visible: true });
    await accountButton.focus();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Church portal sign in" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Admin sign in" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(accountButton).toBeFocused();
    await expect(accountButton).toHaveAttribute("aria-expanded", "false");
  });

  test("registration validation focuses the first invalid field and repeating controls are labeled", async ({ page }) => {
    await openHostedPage(page, "/events/staging-published-family-night/register");
    const addAttendee = page.getByRole("button", { name: "Add attendee" });
    await expect(addAttendee).toBeVisible();
    await addAttendee.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("group", { name: "Attendee 1" })).toBeVisible();
    await page.getByRole("button", { name: "Submit registration" }).click();
    await expect(page.getByLabel(/^Full name/)).toBeFocused();
  });
});

test.describe("authenticated responsive layouts", () => {
  test.use({ viewport: { width: 320, height: 720 }, storageState: { cookies: [], origins: [] } });

  test("representative registration, builder, check-in, and export surfaces do not overflow", async ({ context, page }) => {
    await authenticateContext(context, stagingAccounts.churchA);
    for (const route of [
      "/portal/events/staging-qa-event-published/registration",
      "/portal/events/staging-qa-event-published/registration/form",
      "/portal/events/staging-qa-event-published/check-in",
      "/portal/events/staging-qa-event-published/exports",
    ]) {
      await openHostedPage(page, route);
      await assertNoPageOverflow(page, `320px ${route}`);
    }
  });

  test("platform administration does not overflow", async ({ context, page }) => {
    await authenticateContext(context, stagingAccounts.platformAdmin);
    for (const route of ["/admin/events", "/admin/event-reports", "/admin/event-categories", "/admin/ops"]) {
      await openHostedPage(page, route);
      await assertNoPageOverflow(page, `320px ${route}`);
    }
  });
});

test("content reflows at 200% zoom", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await openHostedPage(page, "/events/staging-published-family-night/register");
  await page.evaluate(() => { document.documentElement.style.zoom = "2"; });
  await assertNoPageOverflow(page, "registration form at 200% zoom");
});
