import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";

import {
  acceptanceAccounts,
  assertNoHorizontalOverflow,
  cleanupProductionAcceptanceFixture,
  firestoreDocumentId,
  firestoreString,
  lookupAuthUsers,
  openProductionPage,
  productionBaseUrl,
  promoteUserToTemporaryAdministrator,
  queryFirestoreDocuments,
} from "./helpers";

const session = process.env.PRODUCTION_ACCEPTANCE_SESSION?.trim();
const password = process.env.PRODUCTION_QA_PASSWORD?.trim();
const appCheckDebugToken = process.env.PRODUCTION_APP_CHECK_DEBUG_TOKEN?.trim();
expect(session, "A unique production acceptance session marker is required.").toBeTruthy();
expect(password, "A disposable QA password must be supplied in process memory.").toBeTruthy();
expect(
  appCheckDebugToken,
  "A temporary Firebase App Check debug token must be supplied in process memory.",
).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);

const safeSession = session!.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const churchName = `Faith Harbor Acceptance Church ${session}`;
const churchSlug = `faith-harbor-acceptance-${safeSession}`;
const eventTitle = `Community Hope Night ${session}`;
const evidenceRoot = path.join(
  process.env.TEMP ?? process.env.TMP ?? ".",
  "find-your-church-production-acceptance",
  "evidence",
  safeSession,
);

let administratorContext: BrowserContext | null = null;
let primaryContext: BrowserContext | null = null;
let editorContext: BrowserContext | null = null;
let churchProfilePath = "";
let eventId = "";
let eventPublicPath = "";

async function createAcceptanceContext(browser: Browser) {
  const context = await browser.newContext({ baseURL: productionBaseUrl });
  await context.addInitScript((token) => {
    (
      globalThis as typeof globalThis & {
        FIREBASE_APPCHECK_DEBUG_TOKEN?: string;
      }
    ).FIREBASE_APPCHECK_DEBUG_TOKEN = token;
  }, appCheckDebugToken!);
  return context;
}

function collectPageFailures(page: Page) {
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !/favicon\.ico/i.test(message.text())) {
      failures.push(`console:${message.text()}`);
    }
  });
  return () => expect(failures, "Unexpected browser errors were recorded.").toEqual([]);
}

async function signIn(page: Page, area: "portal" | "admin", email: string) {
  await openProductionPage(page, `/${area}/login`);
  await page.locator('input[name="email"]').fill(email);
  const passwordInput = page.locator('input[name="password"]');
  await passwordInput.fill(password!);
  await page.getByRole("button", { name: area === "admin" ? "Sign in to admin" : "Sign in to portal" }).click();
  await passwordInput.fill("").catch(() => undefined);
  await expect(page).toHaveURL(new RegExp(`/${area}(?:$|\\?)`), { timeout: 45_000 });
}

async function createPortalAccount(page: Page, email: string, name: string) {
  await openProductionPage(page, "/portal/login");
  await page.getByRole("button", { name: "Create account" }).click();
  await page.locator('input[name="name"]').fill(name);
  await page.locator('input[name="phone"]').fill("361-555-0147");
  await page.locator('input[name="email"]').fill(email);
  const passwordInput = page.locator('input[name="password"]');
  const confirmationInput = page.locator('input[name="passwordConfirmation"]');
  await passwordInput.fill(password!);
  await confirmationInput.fill(password!);
  await page.getByRole("button", { name: "Create account and continue" }).click();
  await Promise.all([
    passwordInput.fill("").catch(() => undefined),
    confirmationInput.fill("").catch(() => undefined),
  ]);
  await expect(page).toHaveURL(/\/portal(?:$|\?)/, { timeout: 45_000 });
}

async function verifyAccessibility(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const blocking = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(
    blocking.map((violation) => ({ id: violation.id, impact: violation.impact })),
    `${label} has critical or serious accessibility violations.`,
  ).toEqual([]);
}

async function capture(page: Page, filename: string, viewport: { width: number; height: number }) {
  await page.setViewportSize(viewport);
  await assertNoHorizontalOverflow(page, filename);
  await page.screenshot({ path: path.join(evidenceRoot, filename), fullPage: true });
}

async function openAdminCard(page: Page, path: string, heading: string) {
  await openProductionPage(page, path);
  const card = page.locator(".admin-card-list__item", {
    has: page.getByRole("heading", { name: heading, exact: true }),
  });
  await expect(card).toBeVisible();
  await card.getByRole("link").last().click();
}

async function expectStoredSubmissionMessage(
  request: APIRequestContext,
  submissionId: string,
  messageBody: string,
) {
  await expect
    .poll(
      async () => {
        const messages = await queryFirestoreDocuments(
          request,
          "messages",
          "submissionId",
          submissionId,
        );
        return messages.some((message) => firestoreString(message, "messageBody") === messageBody);
      },
      { timeout: 45_000 },
    )
    .toBe(true);
}

async function fillChurchSubmission(page: Page) {
  await openProductionPage(page, "/submit");
  await page.locator('[name="churchName"]').fill(churchName);
  await page.locator('[name="denomination"]').selectOption("Non-denominational");
  await page.locator('[name="customShareSlug"]').fill(churchSlug);
  await page.locator('[name="churchDescription"]').fill(
    "A completely fictitious church created only for controlled production acceptance testing of the Find Your Church platform.",
  );
  const serviceRows = page.locator(".service-time-row");
  await serviceRows.nth(0).locator('[name="serviceTimeTitle"]').selectOption({ index: 1 });
  await serviceRows.nth(0).locator('[name="serviceTimeDay"]').selectOption("Sunday");
  await serviceRows.nth(0).locator('[name="serviceTimeStart"]').selectOption({ index: 5 });
  await serviceRows.nth(0).locator('[name="serviceTimeNotes"]').fill("Nursery and welcome team available");
  await serviceRows.nth(1).locator('[name="serviceTimeTitle"]').selectOption({ index: 2 });
  await serviceRows.nth(1).locator('[name="serviceTimeDay"]').selectOption("Wednesday");
  await serviceRows.nth(1).locator('[name="serviceTimeStart"]').selectOption({ index: 12 });
  await serviceRows.nth(1).locator('[name="serviceTimeNotes"]').fill("Fictitious midweek gathering");
  await page.locator('[name="clergyName"]').fill("Pastor Test Shepherd");
  await page.locator('[name="specificAffiliation"]').fill("Fictitious Acceptance Fellowship");
  await page.locator('[name="additionalLeaders"]').fill("Minister Test One\nDeacon Test Two");
  await page.locator('[name="statementOfFaith"]').fill("Jesus Christ is Lord. This text is fictitious acceptance-test content.");

  await page.locator('[name="addressLine1"]').fill("100 Test Harbor Lane");
  await page.locator('[name="addressLine2"]').fill("Acceptance Suite");
  await page.locator('[name="city"]').fill("Palacios");
  await page.locator('[name="stateCode"]').fill("TX");
  await page.locator('[name="postalCode"]').fill("77465");
  await page.locator('[name="hasMailingAddress"]').check();
  await page.locator('[name="mailingAddressLine1"]').fill("PO Box 100");
  await page.locator('[name="mailingAddressLine2"]').fill("Acceptance Mail");
  await page.locator('[name="mailingCity"]').fill("Palacios");
  await page.locator('[name="mailingStateCode"]').fill("TX");
  await page.locator('[name="mailingPostalCode"]').fill("77465");
  await page.locator('[name="phone"]').fill("361-555-0112");
  await page.locator('[name="email"]').fill(acceptanceAccounts.primaryRepresentative);
  await page.locator('[name="websiteUrl"]').fill("https://example.org/fictitious-church");
  await page.locator('[name="facebookUrl"]').fill("https://www.facebook.com/example");
  await page.locator('[name="youtubeUrl"]').fill("https://www.youtube.com/@example");
  await page.locator('[name="instagramUrl"]').fill("https://www.instagram.com/example");

  await page.locator('[name="worshipStyle"]').selectOption({ index: 1 });
  await page.locator('[name="languagesOffered"]').fill("English, Spanish");
  await page.locator('[name="onlineGivingUrl"]').fill("https://example.org/fictitious-giving");
  await page.locator('[name="ministryTags"]').fill("Prayer, Youth, Community Care, Missions");
  await page.locator('[name="visitorParkingDetails"]').fill("Fictitious visitor spaces are marked by the east entrance.");
  await page.locator('[name="firstTimeVisitorNotes"]').fill("A fictitious greeter will meet first-time visitors in the lobby.");
  await page.locator('[name="accessibilityDetails"]').fill("Fictitious step-free entrance, accessible restroom, and listening assistance.");
  for (const name of [
    "childrenMinistryAvailable",
    "youthMinistryAvailable",
    "nurseryCareAvailable",
    "spanishServiceAvailable",
    "livestreamAvailable",
    "wheelchairAccessible",
  ]) {
    await page.locator(`[name="${name}"]`).check();
  }

  await page.locator('[name="primaryContactName"]').fill("Faith Harbor Test Owner");
  await page.locator('[name="primaryContactEmail"]').fill(acceptanceAccounts.primaryRepresentative);
  await page.locator('[name="primaryContactRole"]').fill("Authorized Test Representative");
  await page.locator('[name="primaryContactPhone"]').fill("361-555-0188");
  await page.locator('[name="churchLogo"]').setInputFiles(
    path.join(process.cwd(), "public", "assets", "logos", "find-your-church-palacios-512.png"),
  );
  await page.locator('[name="churchPhotos"]').setInputFiles([
    path.join(process.cwd(), "public", "assets", "imagery", "palacios-church-community-hero.webp"),
    path.join(process.cwd(), "public", "assets", "logos", "find-your-church-palacios-landscape.png"),
    path.join(process.cwd(), "public", "assets", "logos", "el-roi-digital-landscape.png"),
  ]);
  await page.locator('[name="communicationConsent"]').check();
  await page.locator('[name="termsAccepted"]').check();
  await page.locator('[name="followUpEmailOptIn"]').check();

  expect(
    await page.locator("form.submission-form").evaluate((form: HTMLFormElement) => form.checkValidity()),
    "The completed church submission should satisfy browser validation.",
  ).toBe(true);
  await page.getByRole("button", { name: "Submit Church Listing" }).click();
  await expect(page).toHaveURL(/\/submit\/confirmation/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/received|thank/i);
}

async function createClaim(page: Page) {
  await openProductionPage(page, `${churchProfilePath}/claim`);
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.locator('[name="authName"]').fill("Faith Harbor Test Owner");
  await page.locator('[name="authPhone"]').fill("361-555-0188");
  await page.locator('[name="authEmail"]').fill(acceptanceAccounts.primaryRepresentative);
  const passwordInput = page.locator('[name="authPassword"]');
  const confirmationInput = page.locator('[name="authPasswordConfirmation"]');
  await passwordInput.fill(password!);
  await confirmationInput.fill(password!);
  await page.getByRole("button", { name: "Create account and continue" }).click();
  await Promise.all([
    passwordInput.fill("").catch(() => undefined),
    confirmationInput.fill("").catch(() => undefined),
  ]);
  await expect(page.getByRole("heading", { name: new RegExp(`Tell us who should manage ${churchName}`) })).toBeVisible({ timeout: 45_000 });
  await page.locator('[name="requesterPhone"]').fill("361-555-0188");
  await page.locator('[name="requesterRoleTitle"]').selectOption("Authorized Representative");
  await page.locator('[name="authorizationExplanation"]').fill(
    "I am the authorized fictitious primary owner for this controlled production acceptance test.",
  );
  await page.locator('[name="verifierName"]').fill("Test Board Chair");
  await page.locator('[name="verifierRoleTitle"]').fill("Fictitious Board Chair");
  await page.locator('[name="verifierPhone"]').fill("361-555-0199");
  await page.locator('[name="communicationConsent"]').check();
  await page.locator('[name="termsAccepted"]').check();
  await page.locator('[name="followUpEmailOptIn"]').check();
  await page.getByRole("button", { name: "Submit claim request" }).click();
  await expect(page).toHaveURL(/\/claim\/confirmation/, { timeout: 45_000 });
}

async function fillAndSaveEvent(page: Page) {
  await openProductionPage(page, "/portal/events/new");
  const future = new Date(Date.now() + 9 * 86_400_000);
  const date = future.toISOString().slice(0, 10);
  await page.locator('[name="title"]').fill(eventTitle);
  await page.locator('[name="hostMinistry"]').fill("Acceptance Outreach Ministry");
  await page.locator('[name="summary"]').fill("A fictitious public event used for a controlled production acceptance test.");
  await page
    .locator('textarea[name="description"]')
    .fill("This fictitious event verifies publishing, registration, email, exports, check-in, administration, responsive design, and cleanup.");
  await page.locator('[name="primaryType"]').selectOption("fellowship-or-social-gathering");
  await page.locator('[name="audienceTags"]').evaluateAll((boxes: HTMLInputElement[]) => boxes.forEach((box) => { box.checked = true; }));
  await page.locator('[name="customTags"]').fill("Acceptance, Community, Prayer, Outreach");
  await page.locator('[name="languages"]').fill("English, Spanish");
  await page.locator('[name="contactName"]').fill("Faith Harbor Test Owner");
  await page.locator('[name="contactEmail"]').fill(acceptanceAccounts.primaryRepresentative);
  await page.locator('[name="contactPhone"]').fill("361-555-0188");
  await page.locator('[name="startDate"]').fill(date);
  await page.locator('[name="startTime"]').fill("18:00");
  await page.locator('[name="endDate"]').fill(date);
  await page.locator('[name="endTime"]').fill("20:30");
  await page.locator('[name="locationMode"]').selectOption("hybrid");
  await page.locator('[name="venueName"]').fill(`${churchName} Fellowship Hall`);
  await page.locator('[name="addressLine2"]').fill("Fictitious Fellowship Hall");
  await page.locator('[name="onlineUrl"]').fill("https://example.org/fictitious-stream");
  await page.locator('[name="mapUrl"]').fill("https://maps.google.com/?q=Palacios+TX");
  await page.locator('[name="accessibilityDetails"]').fill("Step-free route, accessible restroom, and quiet seating are available for this fictitious event.");
  await page.locator('[name="costStatus"]').selectOption("donation_requested");
  await page.locator('[name="costDetails"]').fill("No charge; optional fictitious donation.");
  await page.locator('[name="informationUrl"]').fill("https://www.elroidigital.org/donate.html");
  await page.locator('[name="capacity"]').fill("1");
  await page.locator('[name="childcareProvided"]').check();
  await page.locator('[name="mealProvided"]').check();
  await page.locator('[name="mealDetails"]').fill("Fictitious refreshments; no real food is served.");
  await page.locator('[name="additionalInstructions"]').fill("Bring only fictional test information. This event does not exist.");
  await page.locator('[name="visibility"]').selectOption("public");
  await page.locator('[name="registrationMode"]').selectOption("simple_rsvp");
  await page.locator('[name="flyer"]').setInputFiles(
    path.join(process.cwd(), "public", "assets", "logos", "find-your-church-palacios-512.png"),
  );
  await page.locator('[name="flyerAlt"]').fill(`Fictitious flyer for ${eventTitle}`);
  await page.locator('button[name="intent"][value="save_draft"]').click();
  await expect(page).toHaveURL(/\/portal\/events\/[^/]+\/edit\?success=event-saved/, { timeout: 60_000 });
  eventId = page.url().match(/\/portal\/events\/([^/]+)\/edit/)?.[1] ?? "";
  expect(eventId, "The event ID could not be captured from the edit URL.").toBeTruthy();
  const publicHref = await page.getByRole("link", { name: "Open public event page" }).getAttribute("href");
  expect(publicHref).toBeTruthy();
  eventPublicPath = publicHref!;
}

async function activateRegistration(page: Page) {
  await openProductionPage(page, `/portal/events/${eventId}/registration/form`);
  await expect(page).toHaveURL(new RegExp(`/portal/events/${eventId}/registration/form`));
  await expect(page.getByRole("heading", { level: 1, name: eventTitle })).toBeVisible();
  await page.locator('select[name="mode"]').selectOption("simple_rsvp");
  await page.locator('input[name="capacity"]').fill("1");
  await page.locator('select[name="capacityUnit"]').selectOption("registrations");
  await page.locator('input[name="maximumAttendeesPerRegistration"]').fill("4");
  await page.locator('input[name="waitlistCapacity"]').fill("5");
  for (const name of [
    "waitlistEnabled",
    "automaticWaitlistPromotion",
    "showCapacityStatus",
    "allowRegistrantEditing",
    "allowRegistrantCancellation",
    "confirmationEmailEnabled",
    "reminderEmailEnabled",
    "organizerNewRegistrationEmail",
    "organizerDailyDigestEmail",
    "registrationClosingReportEnabled",
    "preEventReportEnabled",
  ]) {
    await page.locator(`input[name="${name}"]`).check();
  }
  await page.locator('input[name="scheduledReportFormats"][value="xlsx"]').check();
  await page.locator('textarea[name="successMessage"]').fill("Your fictitious acceptance registration is complete.");
  await page.locator('textarea[name="closedMessage"]').fill("This fictitious acceptance registration is closed.");
  await page.locator('textarea[name="waitlistMessage"]').fill("You are on the fictitious acceptance waitlist.");
  await page.locator('textarea[name="consentText"]').fill("By submitting, you confirm that all information is fictitious acceptance-test data.");
  await page.locator('input[name="retentionDays"]').fill("30");
  await page.locator('button[name="intent"][value="activate"]').click();
  await expect(page).toHaveURL(new RegExp(`/portal/events/${eventId}/registration\\?success=Registration`), { timeout: 60_000 });
}

async function submitRsvp(browser: Browser, name: string) {
  const context = await createAcceptanceContext(browser);
  const page = await context.newPage();
  await openProductionPage(page, `${eventPublicPath}/register`);
  await expect(page).toHaveURL(new RegExp(`${eventPublicPath}/register`));
  await expect(page.getByRole("heading", { level: 1, name: eventTitle })).toBeVisible();
  const form = page.locator("form.registration-public-form");
  await expect(form).toBeVisible();
  await form.getByLabel(/^Contact name/).fill(name);
  await form.getByLabel(/^Number attending/).fill("1");
  await form.getByLabel(/^Email/).fill(acceptanceAccounts.registrant);
  await form.getByLabel(/^Phone/).fill("361-555-0166");
  await form.getByLabel(/^Notes/).fill(`Fictitious registration for acceptance session ${session}`);
  await form.getByRole("button", { name: "Submit registration" }).click();
  await expect(page.getByRole("heading", { name: /registration is complete|waitlist/i })).toBeVisible({ timeout: 60_000 });
  const manageHref = await page.getByRole("link", { name: "Manage registration" }).getAttribute("href");
  expect(manageHref).toBeTruthy();
  return { context, page, manageHref: manageHref! };
}

test.describe.serial("real production acceptance workflow", () => {
  test.beforeAll(async () => {
    await mkdir(evidenceRoot, { recursive: true });
  });

  test.afterAll(async ({ request }) => {
    await Promise.allSettled([
      administratorContext?.close(),
      primaryContext?.close(),
      editorContext?.close(),
    ]);
    await cleanupProductionAcceptanceFixture(request, {
      churchSlug,
      emails: Object.values(acceptanceAccounts),
    });
  });

  test("public production baseline and disposable administrator bootstrap", async ({ browser, request }) => {
    const existing = await lookupAuthUsers(request, Object.values(acceptanceAccounts));
    expect(existing, "Approved acceptance aliases must be unused before the run starts.").toEqual([]);

    const publicContext = await createAcceptanceContext(browser);
    const page = await publicContext.newPage();
    const assertNoFailures = collectPageFailures(page);
    await openProductionPage(page, "/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await verifyAccessibility(page, "production homepage");
    await capture(page, "01-homepage-desktop.png", { width: 1366, height: 900 });
    await capture(page, "02-homepage-mobile.png", { width: 375, height: 812 });
    assertNoFailures();

    await createPortalAccount(page, acceptanceAccounts.administrator, "Production Acceptance Administrator");
    const authUsers = await lookupAuthUsers(request, [acceptanceAccounts.administrator]);
    expect(authUsers).toHaveLength(1);
    await promoteUserToTemporaryAdministrator(request, authUsers[0].localId);
    await publicContext.close();

    administratorContext = await createAcceptanceContext(browser);
    const adminPage = await administratorContext.newPage();
    await signIn(adminPage, "admin", acceptanceAccounts.administrator);
    await expect(adminPage.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(adminPage.getByRole("navigation", { name: "Admin" })).toBeVisible();
    await capture(adminPage, "03-admin-dashboard-desktop.png", { width: 1366, height: 900 });
    await capture(adminPage, "04-admin-dashboard-mobile.png", { width: 375, height: 812 });
  });

  test("complete church submission, administrator review, and public publication", async ({ browser, request }) => {
    const publicContext = await createAcceptanceContext(browser);
    const page = await publicContext.newPage();
    await fillChurchSubmission(page);
    await publicContext.close();

    const adminPage = await administratorContext!.newPage();
    await openAdminCard(adminPage, "/admin/submissions?status=pending_review", churchName);
    await expect(adminPage.getByRole("heading", { level: 1, name: churchName })).toBeVisible();
    const submissionId = adminPage.url().match(/\/admin\/submissions\/([^/?]+)/)?.[1] ?? "";
    expect(submissionId, "The submission ID could not be captured from the admin URL.").toBeTruthy();
    const internalNote = `Controlled production acceptance session ${session}`;
    await adminPage.getByLabel("Internal note").fill(internalNote);
    await adminPage.getByRole("button", { name: "Save note" }).click();
    await expectStoredSubmissionMessage(request, submissionId, internalNote);
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await expect(
      adminPage.getByText(internalNote, { exact: true }).first(),
    ).toBeVisible();
    const publicMessage = `Your fictitious listing passed intake review for acceptance session ${session}.`;
    await adminPage.getByLabel("Public message").fill(publicMessage);
    await adminPage.getByRole("button", { name: "Send message" }).click();
    await expectStoredSubmissionMessage(request, submissionId, publicMessage);
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await expect(adminPage.getByText(publicMessage, { exact: true }).first()).toBeVisible();
    await adminPage.getByLabel("Optional admin note").fill("Approved during a controlled production acceptance test.");
    await adminPage.getByRole("button", { name: "Approve and publish" }).click();
    await expect(adminPage.getByText("approved", { exact: true }).first()).toBeVisible({ timeout: 60_000 });
    const profileHref = await adminPage.getByRole("link", { name: "Open public profile" }).getAttribute("href");
    expect(profileHref).toBeTruthy();
    churchProfilePath = profileHref!;
    await capture(adminPage, "05-approved-submission-admin.png", { width: 1366, height: 900 });
    await adminPage.close();

    const churches = await queryFirestoreDocuments(
      request,
      "churches",
      "customShareSlug",
      churchSlug,
    );
    expect(churches).toHaveLength(1);
    const profileContext = await createAcceptanceContext(browser);
    const publicPage = await profileContext.newPage();
    await openProductionPage(publicPage, churchProfilePath);
    await expect(publicPage.getByRole("heading", { level: 1, name: churchName })).toBeVisible();
    await expect(publicPage.getByText("Spanish service", { exact: true }).first()).toBeVisible();
    await verifyAccessibility(publicPage, "published acceptance church profile");
    await capture(publicPage, "06-church-profile-desktop.png", { width: 1366, height: 900 });
    await capture(publicPage, "07-church-profile-mobile.png", { width: 375, height: 812 });
    await profileContext.close();
  });

  test("claim request, administrator approval, and primary-owner access", async ({ browser, request }) => {
    primaryContext = await createAcceptanceContext(browser);
    const claimPage = await primaryContext.newPage();
    await createClaim(claimPage);
    await claimPage.close();

    const claims = await queryFirestoreDocuments(request, "churchClaimRequests", "requesterEmail", acceptanceAccounts.primaryRepresentative);
    expect(claims).toHaveLength(1);
    const adminPage = await administratorContext!.newPage();
    await openAdminCard(adminPage, "/admin/claims?status=pending_review", "Faith Harbor Test Owner");
    await expect(adminPage.getByText(churchName, { exact: true }).first()).toBeVisible();
    await adminPage.getByLabel("Internal note").fill(`Claim evidence reviewed for ${session}.`);
    await adminPage.getByRole("button", { name: "Save note" }).click();
    await adminPage.getByLabel("Public message").fill(`Your fictitious claim is ready for approval for ${session}.`);
    await adminPage.getByRole("button", { name: "Send message" }).click();
    await adminPage.getByRole("button", { name: "Approve claim" }).click();
    await expect
      .poll(
        async () => {
          const currentClaims = await queryFirestoreDocuments(
            request,
            "churchClaimRequests",
            "requesterEmail",
            acceptanceAccounts.primaryRepresentative,
          );
          return currentClaims.some((claim) => firestoreString(claim, "status") === "approved");
        },
        { timeout: 60_000 },
      )
      .toBe(true);
    await adminPage.reload({ waitUntil: "domcontentloaded" });
    await expect(adminPage.getByText("approved", { exact: true }).first()).toBeVisible();
    await capture(adminPage, "08-approved-claim-admin.png", { width: 1366, height: 900 });
    await adminPage.close();

    const portalPage = await primaryContext.newPage();
    await openProductionPage(portalPage, "/portal");
    await expect(portalPage.getByRole("heading", { level: 1 })).toHaveCount(1);
    await expect(portalPage.getByText(churchName, { exact: true }).first()).toBeVisible();
    await expect(portalPage.getByRole("link", { name: "Team", exact: true })).toBeVisible();
    await capture(portalPage, "09-primary-portal-desktop.png", { width: 1366, height: 900 });
    await capture(portalPage, "10-primary-portal-mobile.png", { width: 375, height: 812 });
    await portalPage.close();
  });

  test("primary owner invites an editor and the editor receives intended access", async ({ browser }) => {
    const primaryPage = await primaryContext!.newPage();
    await openProductionPage(primaryPage, "/portal/team");
    await primaryPage.getByLabel("Editor name").fill("Faith Harbor Test Editor");
    await primaryPage.getByLabel("Editor email").fill(acceptanceAccounts.editor);
    await primaryPage.getByLabel("Editor phone").fill("361-555-0177");
    await primaryPage.getByLabel("Role / title").fill("Communications Director");
    await primaryPage.getByRole("button", { name: "Invite editor" }).click();
    await expect(primaryPage).toHaveURL(/\/portal\/team\?success=editor-invited/);
    await expect(primaryPage.getByText(/editor \/ invited/i).first()).toBeVisible();
    await capture(primaryPage, "11-team-invitation-desktop.png", { width: 1366, height: 900 });
    await primaryPage.close();

    editorContext = await createAcceptanceContext(browser);
    const editorPage = await editorContext.newPage();
    await createPortalAccount(editorPage, acceptanceAccounts.editor, "Faith Harbor Test Editor");
    await expect(editorPage.getByText(churchName, { exact: true }).first()).toBeVisible();
    await openProductionPage(editorPage, "/portal/team");
    await expect(editorPage.getByText(/editor \/ active/i).first()).toBeVisible();
    await expect(editorPage.getByText("Only the primary owner can invite an editor for this church.")).toBeVisible();
    await openProductionPage(editorPage, "/admin/events");
    await expect(editorPage.getByRole("heading", { name: "This account does not have admin access" })).toBeVisible();
    await capture(editorPage, "12-editor-portal-mobile.png", { width: 375, height: 812 });
    await editorPage.close();
  });

  test("event creation, flyer, custom registration configuration, and editor update", async () => {
    const primaryPage = await primaryContext!.newPage();
    await fillAndSaveEvent(primaryPage);
    await activateRegistration(primaryPage);
    await openProductionPage(primaryPage, `/portal/events/${eventId}/edit`);
    await primaryPage.getByRole("button", { name: "Publish event" }).click();
    await expect(primaryPage).toHaveURL(/success=event-published/, { timeout: 60_000 });
    await openProductionPage(primaryPage, eventPublicPath);
    await expect(primaryPage.getByRole("heading", { level: 1, name: eventTitle })).toBeVisible();
    await expect(primaryPage.getByRole("img", { name: `Fictitious flyer for ${eventTitle}` })).toBeVisible();
    await expect(primaryPage.getByRole("link", { name: /register/i })).toBeVisible();
    await verifyAccessibility(primaryPage, "published acceptance event");
    await capture(primaryPage, "13-event-desktop.png", { width: 1366, height: 900 });
    await capture(primaryPage, "14-event-mobile.png", { width: 375, height: 812 });
    await primaryPage.close();

    const editorPage = await editorContext!.newPage();
    await openProductionPage(editorPage, `/portal/events/${eventId}/edit`);
    await editorPage.locator('[name="additionalInstructions"]').fill("Updated successfully by the authorized fictitious editor.");
    await editorPage.getByRole("button", { name: "Save changes" }).click();
    await expect(editorPage).toHaveURL(/success=event-saved/, { timeout: 60_000 });
    await expect(editorPage.locator('[name="additionalInstructions"]')).toHaveValue(/authorized fictitious editor/);
    await editorPage.close();
  });

  test("registration, waitlist, cancellation promotion, check-in, exports, and report email", async ({ browser }) => {
    const first = await submitRsvp(browser, `Confirmed Acceptance Registrant ${session}`);
    await expect(first.page.getByText(/confirmed|complete/i).first()).toBeVisible();
    const second = await submitRsvp(browser, `Waitlist Acceptance Registrant ${session}`);
    await expect(second.page.getByText(/waitlist/i).first()).toBeVisible();
    await capture(second.page, "15-waitlist-confirmation-mobile.png", { width: 375, height: 812 });

    await openProductionPage(first.page, first.manageHref);
    await first.page.getByRole("button", { name: "Cancel this registration" }).click();
    await expect(first.page.getByRole("status")).toContainText("Registration cancelled.");
    await first.context.close();
    await second.context.close();

    const primaryPage = await primaryContext!.newPage();
    await openProductionPage(primaryPage, `/portal/events/${eventId}/registration`);
    await expect(
      primaryPage.getByText(`Waitlist Acceptance Registrant ${session}`, { exact: true }).first(),
    ).toBeVisible();
    await expect(primaryPage.getByRole("table")).toBeVisible();
    await capture(primaryPage, "16-registration-dashboard-desktop.png", { width: 1366, height: 900 });
    await openProductionPage(primaryPage, `/portal/events/${eventId}/check-in`);
    const checkIn = primaryPage.getByRole("button", { name: "Check in" }).first();
    await checkIn.click();
    await expect(primaryPage.getByRole("button", { name: "Undo check-in" }).first()).toBeVisible({ timeout: 45_000 });
    await capture(primaryPage, "17-check-in-mobile.png", { width: 375, height: 812 });

    for (const report of [
      { format: "pdf", extension: ".pdf", signature: "%PDF" },
      { format: "xlsx", extension: ".xlsx", signature: "PK" },
    ]) {
      await openProductionPage(primaryPage, `/portal/events/${eventId}/exports`);
      await primaryPage.locator("form.registration-export-form").first().getByLabel("Format").selectOption(report.format);
      const downloadPromise = primaryPage.waitForEvent("download");
      await primaryPage.getByRole("button", { name: "Create secure download" }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(new RegExp(`${report.extension.replace(".", "\\.")}$`, "i"));
      const savedPath = path.join(evidenceRoot, `acceptance-report${report.extension}`);
      await download.saveAs(savedPath);
      expect((await stat(savedPath)).size).toBeGreaterThan(500);
      expect((await readFile(savedPath)).subarray(0, report.signature.length).toString()).toBe(report.signature);
    }

    await openProductionPage(primaryPage, `/portal/events/${eventId}/exports`);
    const emailForm = primaryPage.locator("form.registration-export-form").nth(1);
    await emailForm.getByLabel("Recipients").fill(acceptanceAccounts.primaryRepresentative);
    await emailForm.getByLabel("Excel workbook").check();
    await emailForm.getByLabel("Short message").fill(`Controlled branded report email for acceptance session ${session}.`);
    await emailForm.getByRole("button", { name: "Email report" }).click();
    await expect(primaryPage).toHaveURL(/success=Report(?:\+|%20)email(?:\+|%20)sent/, { timeout: 60_000 });
    await expect(primaryPage.getByRole("status")).toContainText(/sent|email/i, { timeout: 60_000 });
    await primaryPage.close();
  });

  test("platform administrator event controls and operations remain functional", async () => {
    const adminPage = await administratorContext!.newPage();
    await openProductionPage(adminPage, "/admin/events");
    await adminPage.getByLabel("Search events").fill(eventTitle);
    await adminPage.getByRole("button", { name: "Filter events" }).click();
    await expect(adminPage.getByRole("heading", { name: eventTitle })).toBeVisible();
    const lockNote = adminPage.getByLabel(new RegExp(`Editing lock note for ${eventTitle}`));
    await lockNote.fill(`Acceptance lock ${session}`);
    await adminPage.getByRole("button", { name: "Lock editing" }).click();
    await expect(adminPage.getByRole("button", { name: "Unlock editing" })).toBeVisible({ timeout: 45_000 });
    await lockNote.fill(`Acceptance unlock ${session}`);
    await adminPage.getByRole("button", { name: "Unlock editing" }).click();
    await expect(adminPage.getByRole("button", { name: "Lock editing" })).toBeVisible({ timeout: 45_000 });

    for (const route of ["/admin/churches", "/admin/claims", "/admin/submissions", "/admin/event-reports", "/admin/event-categories", "/admin/ops"]) {
      await openProductionPage(adminPage, route);
      const pageHeading = adminPage.getByRole("heading", { level: 1 });
      await expect(pageHeading).toHaveCount(1);
      await expect(pageHeading).toBeVisible();
    }
    await capture(adminPage, "18-operations-admin-desktop.png", { width: 1366, height: 900 });
    await capture(adminPage, "19-operations-admin-mobile.png", { width: 375, height: 812 });
    await adminPage.close();
  });

  test("supported administrator cleanup controls run before exact fixture removal", async () => {
    const primaryPage = await primaryContext!.newPage();
    await openProductionPage(primaryPage, "/portal/events");
    const eventRow = primaryPage.locator(".event-admin-row", {
      has: primaryPage.getByRole("heading", { name: eventTitle, exact: true }),
    });
    await eventRow.getByRole("button", { name: "Archive" }).click();
    await expect(primaryPage.getByText("archived", { exact: true }).first()).toBeVisible({ timeout: 45_000 });
    await primaryPage.close();

    const adminPage = await administratorContext!.newPage();
    await openProductionPage(adminPage, "/admin/churches");
    const churchCard = adminPage.locator(".admin-card-list__item", {
      has: adminPage.getByText(churchName, { exact: true }),
    });
    await churchCard.getByRole("link", { name: /representative/i }).click();
    const editorCard = adminPage.locator(".timeline-item", {
      has: adminPage.getByText(acceptanceAccounts.editor, { exact: true }),
    });
    await editorCard.getByRole("button", { name: /suspend/i }).click();
    await expect(editorCard.getByText(/suspended/i)).toBeVisible({ timeout: 45_000 });
    await adminPage.close();
  });
});
