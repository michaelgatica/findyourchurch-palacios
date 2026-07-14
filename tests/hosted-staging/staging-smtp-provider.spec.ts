import { expect, test } from "@playwright/test";

import {
  authenticateContext,
  openHostedPage,
  stagingAccounts,
} from "./helpers";

const approvedTemplates = [
  "Registration confirmation",
  "Waitlist confirmation",
  "Event reminder",
  "New registration notification",
  "PDF registration report",
  "XLSX registration report",
  "Scheduled registration digest",
] as const;

test.describe("controlled staging SMTP provider delivery", () => {
  test.skip(
    process.env.ALLOW_STAGING_EMAIL_SEND !== "true",
    "Set ALLOW_STAGING_EMAIL_SEND=true only for an owner-approved provider certification run.",
  );

  test("sends the approved fictitious template set through hosted staging", async ({ context, page }) => {
    await authenticateContext(context, stagingAccounts.platformAdmin);
    await openHostedPage(page, "/admin/ops");

    await expect(page.getByText("Provider: smtp", { exact: true })).toBeVisible();
    await expect(page.getByText("Status: ready", { exact: true })).toBeVisible();

    for (const label of approvedTemplates) {
      const card = page.locator(".admin-card-list__item").filter({
        has: page.getByRole("heading", { level: 2, name: label, exact: true }),
      });
      const responsePromise = page.waitForResponse((response) =>
        response.url().endsWith("/admin/ops") && response.request().method() === "POST",
      );
      await card.getByRole("button", { name: "Send approved test" }).click();
      const response = await responsePromise;
      expect(response.status(), `${label} returned HTTP ${response.status()}.`).toBeLessThan(400);
      await expect(card.getByRole("button", { name: "Send approved test" })).toBeEnabled();
    }

    await expect(page.getByText("staging_email_test_sent", { exact: true }).first()).toBeVisible();
    console.log(JSON.stringify({
      ok: true,
      suite: "staging-smtp-provider",
      templatesSent: [...approvedTemplates],
      recipientGuard: "single approved staging recipient",
    }));
  });
});
