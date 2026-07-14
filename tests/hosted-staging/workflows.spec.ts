import path from "node:path";
import { mkdir } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import {
  auditAccessibility,
  authenticateContext,
  collectPageErrors,
  openHostedPage,
  stagingAccounts,
} from "./helpers";

const webkitAccessControlErrors = [/ due to access control checks\.$/];

test.describe("public browser workflows", () => {
  test("directory, calendar filtering, details, flyers, custom fields, and cancellation work", async ({ page }, testInfo) => {
    const assertNoPageErrors = collectPageErrors(
      page,
      testInfo.project.name === "webkit" ? webkitAccessControlErrors : [],
    );

    await openHostedPage(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    await openHostedPage(page, "/churches");
    await expect(page.getByRole("heading", { name: /find churches near you/i })).toBeVisible();
    await expect(page.locator(".directory-map__canvas")).toBeVisible();

    await openHostedPage(page, "/events");
    await expect(page.getByText("Staging Draft Community Meal", { exact: true })).toHaveCount(0);
    await expect(page.getByText("Staging Unlisted Volunteer Training", { exact: true })).toHaveCount(0);
    const keyword = page.getByLabel("Keyword");
    await keyword.fill("Staging Published Family Night");
    await expect(page.getByRole("link", { name: "Staging Published Family Night" })).toBeVisible();
    await expect(page.getByRole("img", { name: "Fictitious staging event flyer placeholder" })).toBeVisible();
    await page.getByRole("button", { name: "Reset filters" }).click();

    await openHostedPage(page, "/events/staging-published-family-night");
    await expect(page.getByRole("heading", { name: "Staging Published Family Night" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Register for this event" })).toBeVisible();

    await openHostedPage(page, "/events/staging-unlisted-volunteer-training");
    await expect(page.getByRole("heading", { name: "Staging Unlisted Volunteer Training" })).toBeVisible();
    await openHostedPage(page, "/events/staging-unlisted-volunteer-training/register");
    await expect(page.getByRole("button", { name: "Add attendee" })).toBeVisible();

    await openHostedPage(page, "/events/staging-cancelled-outreach");
    await expect(page.getByText("This event has been cancelled.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /register/i })).toHaveCount(0);
    assertNoPageErrors();
  });

  test("registration, repeating participant, confirmation, management, and cancellation work", async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const assertNoPageErrors = collectPageErrors(page);
    const approvedEmailRecipient = process.env.FYC_STAGING_APPROVED_EMAIL_RECIPIENT?.trim();
    expect(
      approvedEmailRecipient,
      "The approved staging email recipient must be loaded into process memory.",
    ).toBeTruthy();
    await openHostedPage(page, "/events/staging-published-family-night/register");

    const uniqueLabel = `${testInfo.project.name}-${Date.now()}`;
    await page.getByLabel(/^Full name/).fill(`Staging Browser QA ${uniqueLabel}`);
    await page.getByLabel(/^Email/).fill(approvedEmailRecipient!);
    await page.getByLabel(/^Number attending/).fill("2");
    await page.getByRole("button", { name: "Add attendee" }).click();
    await page.getByLabel(/^Participant name/).fill("Fictitious Attendee");
    await page.waitForTimeout(1_000);
    const invalidControls = await page.locator("form.registration-public-form :invalid").evaluateAll(
      (controls) => controls.map((control) => ({
        id: control.id,
        name: control.getAttribute("name"),
        type: control.getAttribute("type"),
      })),
    );
    expect(invalidControls, `Registration form had invalid controls: ${JSON.stringify(invalidControls)}`).toEqual([]);
    await page.getByRole("button", { name: "Submit registration" }).click();

    await expect(page.getByRole("heading", { name: "Your registration is complete" })).toBeVisible({ timeout: 30_000 });
    const manageLink = page.getByRole("link", { name: "Manage registration" });
    await expect(manageLink).toBeVisible();
    await manageLink.click();
    await expect(page.getByRole("heading", { level: 1, name: "Staging Published Family Night" })).toBeVisible();
    await auditAccessibility(page, testInfo, `${testInfo.project.name} registration management`);
    await page.getByRole("button", { name: "Cancel this registration" }).click();
    await expect(page.getByRole("status")).toContainText("Registration cancelled.");
    await expect(page.getByText("cancelled", { exact: true })).toBeVisible();
    assertNoPageErrors();
  });
});

test.describe("church representative browser workflows", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("Church A can operate its portal controls and cannot access Church B administration", async ({ context, page }, testInfo) => {
    test.setTimeout(300_000);
    const assertNoPageErrors = collectPageErrors(
      page,
      testInfo.project.name === "firefox"
        ? [/^Connection closed\.$/, /^Minified React error #419;/]
        : testInfo.project.name === "webkit"
          ? webkitAccessControlErrors
          : [],
    );
    await authenticateContext(context, stagingAccounts.churchA);

    await openHostedPage(page, "/portal/events");
    await expect(page.getByRole("heading", { name: /Events for Staging Test Church 1/i })).toBeVisible();
    await page.getByLabel("Search events").fill("Family Night");
    await page.getByRole("button", { name: "Apply filters" }).click();
    await expect(page.getByRole("heading", { name: "Staging Published Family Night" })).toBeVisible();

    await openHostedPage(page, "/portal/events/new");
    await expect(page.getByRole("heading", { name: /Create an event/ })).toBeVisible();
    await expect(page.getByLabel("Flyer upload")).toHaveAttribute("accept", "image/jpeg,image/png,image/webp");
    await expect(page.getByRole("button", { name: "Save draft" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Publish event" })).toBeVisible();

    const workflowLabel = `${testInfo.project.name}-${Date.now()}`;
    const workflowTitle = `Staging Browser QA Event ${workflowLabel}`;
    await page.getByLabel(/^Event title/).fill(workflowTitle);
    await page.getByLabel(/^Short summary/).fill("Fictitious event created only for hosted staging browser QA.");
    await page.getByLabel(/^Full description/).fill("This fictitious event verifies draft, flyer upload, and publication in hosted staging.");
    await page.getByLabel(/^Primary event type/).selectOption("fellowship-or-social-gathering");
    await page.getByLabel("Flyer upload").setInputFiles(
      path.join(process.cwd(), "public", "assets", "logos", "find-your-church-palacios-512.png"),
    );
    await page.getByLabel("Flyer alt text").fill(`Fictitious flyer for ${workflowTitle}`);
    expect(await page.locator("form.event-editor-form").evaluate((form: HTMLFormElement) => form.checkValidity())).toBe(true);
    await page.locator('button[name="intent"][value="save_draft"]').click();
    await expect(page).toHaveURL(/\/portal\/events\/[^/]+\/edit\?success=event-saved/, { timeout: 45_000 });
    const editUrl = page.url();
    const publicHref = await page.getByRole("link", { name: "Open public event page" }).getAttribute("href");
    expect(publicHref).toBeTruthy();

    await page.goto(publicHref!, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /couldn't find that church page/i })).toBeVisible();
    await expect(page.getByText(workflowTitle, { exact: true })).toHaveCount(0);

    await page.goto(editUrl, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Publish event" }).click();
    await expect(page).toHaveURL(/success=event-published/, { timeout: 45_000 });
    await page.goto(publicHref!, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { level: 1, name: workflowTitle })).toBeVisible();
    await openHostedPage(page, "/events");
    await page.getByLabel("Keyword").fill(workflowTitle);
    await expect(page.getByRole("img", { name: `Fictitious flyer for ${workflowTitle}` })).toBeVisible();

    await openHostedPage(page, "/portal/events/staging-qa-event-published/edit");
    await expect(page.getByRole("heading", { level: 1, name: "Staging Published Family Night" })).toBeVisible();
    await expect(page.getByLabel("Flyer alt text")).toHaveValue(/fictitious staging event flyer/i);

    await openHostedPage(page, "/portal/events/staging-qa-event-published/registration/form");
    await expect(page.getByRole("button", { name: /Move Full name down/i })).toBeEnabled();
    await page.getByRole("button", { name: /Add field to Contact information/i }).click();
    const conditionalSource = page.getByLabel("Show when field").last();
    await conditionalSource.selectOption({ index: 1 });
    await expect(page.getByLabel("Condition").last()).toBeVisible();
    await page.getByRole("button", { name: "Preview exact form" }).click();
    await expect(page.getByRole("button", { name: "Close preview" })).toBeVisible();

    await openHostedPage(page, "/portal/events/staging-qa-event-published/registration");
    await expect(page.getByRole("table")).toBeVisible();
    await page.getByRole("combobox", { name: "Status", exact: true }).selectOption("confirmed");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByRole("link", { name: "Open" }).first()).toBeVisible();

    await openHostedPage(page, "/portal/events/staging-qa-event-published/registration/staging-qa-registration-staging-qa-event-published-1");
    await expect(page.getByText("FYC-99F2E4E2586C", { exact: true })).toBeVisible();

    await openHostedPage(page, "/portal/events/staging-qa-event-published/check-in");
    const checkInButton = page.getByRole("button", { name: /^(Check in|Undo check-in)$/ }).first();
    const initialCheckInLabel = (await checkInButton.textContent())?.trim();
    expect(initialCheckInLabel).toMatch(/^(Check in|Undo check-in)$/);
    await checkInButton.focus();
    await expect(checkInButton).toBeFocused();
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/check-in")),
      checkInButton.click(),
    ]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(checkInButton).not.toHaveText(initialCheckInLabel!);
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/check-in")),
      checkInButton.click(),
    ]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(checkInButton).toHaveText(initialCheckInLabel!);

    for (const report of [
      { format: "pdf", extension: ".pdf" },
      { format: "xlsx", extension: ".xlsx" },
    ]) {
      await openHostedPage(page, "/portal/events/staging-qa-event-published/exports");
      await page.getByLabel("Format").selectOption(report.format);
      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: "Create secure download" }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(new RegExp(`${report.extension.replace(".", "\\.")}$`, "i"));
      expect(await download.failure()).toBeNull();
      await download.delete();
    }

    await page.goto("/portal/events/staging-qa-event-unlisted/edit", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /couldn't find that church page/i })).toBeVisible();
    await expect(page.getByText("Staging Unlisted Volunteer Training", { exact: true })).toHaveCount(0);
    assertNoPageErrors();
  });

  test("Church B and the limited event manager receive only their intended access", async ({ browser }) => {
    const churchBContext = await browser.newContext();
    const managerContext = await browser.newContext();
    try {
      await authenticateContext(churchBContext, stagingAccounts.churchB);
      const churchBPage = await churchBContext.newPage();
      await openHostedPage(churchBPage, "/portal/events");
      await expect(churchBPage.getByRole("heading", { name: /Events for Staging Test Church 2/i })).toBeVisible();
      await expect(churchBPage.getByText("Staging Published Family Night", { exact: true })).toHaveCount(0);

      await authenticateContext(managerContext, stagingAccounts.eventManager);
      const managerPage = await managerContext.newPage();
      await openHostedPage(managerPage, "/portal/events");
      await expect(managerPage.getByRole("heading", { name: /Events for Staging Test Church 1/i })).toBeVisible();
      await managerPage.goto("/admin/events", { waitUntil: "domcontentloaded" });
      await expect(managerPage).toHaveURL(/\/admin\/events/);
      await expect(managerPage.getByRole("heading", { name: "This account does not have admin access" })).toBeVisible();
    } finally {
      await churchBContext.close();
      await managerContext.close();
    }
  });
});

test.describe("platform administrator browser workflows", () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test("admin filtering, lock controls, moderation, categories, and operations are usable", async ({ context, page }, testInfo) => {
    test.setTimeout(120_000);
    const assertNoPageErrors = collectPageErrors(
      page,
      testInfo.project.name === "webkit" ? webkitAccessControlErrors : [],
    );
    await authenticateContext(context, stagingAccounts.platformAdmin);

    await openHostedPage(page, "/admin/events");
    await page.getByLabel("Search events").fill("Staging Published Family Night");
    await page.getByRole("button", { name: "Filter events" }).click();
    await expect(page.getByRole("heading", { name: "Staging Published Family Night" })).toBeVisible();
    const lockButton = page.getByRole("button", { name: /^(Lock editing|Unlock editing)$/ });
    const initialLockLabel = (await lockButton.textContent())?.trim();
    expect(initialLockLabel).toMatch(/^(Lock editing|Unlock editing)$/);
    const lockNote = page.getByLabel(/Editing lock note for Staging Published Family Night/);
    await lockNote.fill("Fictitious browser QA lock toggle");
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/admin/events")),
      lockButton.click(),
    ]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(lockButton).not.toHaveText(initialLockLabel!);
    await lockNote.fill("Restore browser QA lock state");
    await Promise.all([
      page.waitForResponse((response) => response.request().method() === "POST" && response.url().includes("/admin/events")),
      lockButton.click(),
    ]);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(lockButton).toHaveText(initialLockLabel!);

    await openHostedPage(page, "/admin/event-reports");
    await expect(page.getByRole("heading", { name: "Public event reports" })).toBeVisible();
    await expect(page.getByLabel(/Status for report about/)).toBeVisible();

    await openHostedPage(page, "/admin/event-categories");
    await expect(page.getByRole("heading", { name: /categor/i })).toBeVisible();
    await expect(page.getByLabel("Public category label")).toBeVisible();

    await openHostedPage(page, "/admin/ops");
    await expect(page.getByRole("heading", { name: "Operations and configuration checks" })).toBeVisible();
    await expect(page.getByText("Environment: staging", { exact: true })).toBeVisible();
    assertNoPageErrors();
  });
});

test("capture non-secret public and portal responsive evidence", async ({ browserName, context, page }) => {
  test.skip(browserName !== "chromium", "Evidence is captured once with the Chromium engine.");
  const evidenceRoot = path.join(
    process.env.TEMP ?? process.env.TMP ?? ".",
    "find-your-church-staging-playwright",
    "evidence",
  );
  await mkdir(evidenceRoot, { recursive: true });

  await page.setViewportSize({ width: 1366, height: 768 });
  await openHostedPage(page, "/events");
  await page.screenshot({ path: path.join(evidenceRoot, "events-1366-chromium.png"), fullPage: true });

  await authenticateContext(context, stagingAccounts.churchA);
  await page.setViewportSize({ width: 375, height: 812 });
  await openHostedPage(page, "/portal/events/staging-qa-event-published/check-in");
  await page.screenshot({ path: path.join(evidenceRoot, "check-in-375-chromium.png"), fullPage: true });
});
