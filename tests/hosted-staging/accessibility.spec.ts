import { expect, test } from "@playwright/test";

import {
  administratorRoutes,
  auditAccessibility,
  authenticateContext,
  openHostedPage,
  publicRoutes,
  representativeRoutes,
  stagingAccounts,
} from "./helpers";

test.describe("hosted public accessibility", () => {
  for (const route of publicRoutes) {
    test(`${route.label} has no critical or serious violations`, async ({ page }, testInfo) => {
      await openHostedPage(page, route.path);
      await auditAccessibility(page, testInfo, route.label);
    });
  }
});

test.describe("hosted church representative accessibility", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ context }) => {
    await authenticateContext(context, stagingAccounts.churchA);
  });

  for (const route of representativeRoutes) {
    test(`${route.label} has no critical or serious violations`, async ({ page }, testInfo) => {
      await openHostedPage(page, route.path);
      await expect(page).toHaveURL(new RegExp(route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      await auditAccessibility(page, testInfo, route.label);
    });
  }
});

test.describe("hosted platform administrator accessibility", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test.beforeEach(async ({ context }) => {
    await authenticateContext(context, stagingAccounts.platformAdmin);
  });

  for (const route of administratorRoutes) {
    test(`${route.label} has no critical or serious violations`, async ({ page }, testInfo) => {
      await openHostedPage(page, route.path);
      await expect(page).toHaveURL(new RegExp(route.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      await auditAccessibility(page, testInfo, route.label);
    });
  }
});
