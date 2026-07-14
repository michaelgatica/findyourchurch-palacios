import { readFile } from "node:fs/promises";

import ExcelJS from "exceljs";
import { PDFDocument } from "pdf-lib";
import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

import {
  authenticateContext,
  openHostedPage,
  stagingAccounts,
  stagingBaseUrl,
} from "./helpers";

const stagingProjectId = "findyourchurch-staging-2026";
const stagingDatabaseId = "findyourchurchpal";
const loadEventId = "staging-qa-event-full";

interface PageMetric {
  label: string;
  path: string;
  status: number;
  responseStartMs: number;
  domContentLoadedMs: number;
  loadMs: number;
  resources: number;
  scripts: number;
  images: number;
  transferBytes: number;
  scriptTransferBytes: number;
  imageTransferBytes: number;
  usedHeapBytes: number | null;
}

async function measurePage(page: Page, label: string, path: string): Promise<PageMetric> {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response).not.toBeNull();
  expect(response!.status()).toBeLessThan(400);
  await page.waitForLoadState("load");
  await expect(page.locator("body")).not.toContainText(/Application error|Unhandled Runtime Error/i);
  const metric = await page.evaluate(({ label: pageLabel, path: pagePath, status }) => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;
    const resources = performance.getEntriesByType("resource") as PerformanceResourceTiming[];
    const scripts = resources.filter((entry) => entry.initiatorType === "script");
    const images = resources.filter((entry) => entry.initiatorType === "img");
    const transfer = (entries: PerformanceResourceTiming[]) =>
      entries.reduce((sum, entry) => sum + (entry.transferSize || entry.encodedBodySize || 0), 0);
    const memory = performance as Performance & { memory?: { usedJSHeapSize?: number } };
    return {
      label: pageLabel,
      path: pagePath,
      status,
      responseStartMs: Math.round(navigation.responseStart),
      domContentLoadedMs: Math.round(navigation.domContentLoadedEventEnd),
      loadMs: Math.round(navigation.loadEventEnd),
      resources: resources.length,
      scripts: scripts.length,
      images: images.length,
      transferBytes: transfer(resources),
      scriptTransferBytes: transfer(scripts),
      imageTransferBytes: transfer(images),
      usedHeapBytes: memory.memory?.usedJSHeapSize ?? null,
    };
  }, { label, path, status: response!.status() });

  expect(metric.responseStartMs, `${label} initial response exceeded 10 seconds.`).toBeLessThan(10_000);
  expect(metric.domContentLoadedMs, `${label} DOMContentLoaded exceeded 15 seconds.`).toBeLessThan(15_000);
  expect(metric.loadMs, `${label} load event exceeded 20 seconds.`).toBeLessThan(20_000);
  expect(metric.resources, `${label} issued an unexpectedly high number of requests.`).toBeLessThan(150);
  return metric;
}

async function aggregateCount(
  request: APIRequestContext,
  collectionId: string,
  field?: { name: string; value: string },
) {
  const oauthToken = process.env.FYC_STAGING_FIRESTORE_OAUTH_TOKEN?.trim();
  expect(oauthToken, "A staging-only Firestore OAuth token must be supplied in process memory.").toBeTruthy();
  const structuredQuery: Record<string, unknown> = { from: [{ collectionId }] };
  if (field) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: field.name },
        op: "EQUAL",
        value: { stringValue: field.value },
      },
    };
  }
  const response = await request.post(
    `https://firestore.googleapis.com/v1/projects/${stagingProjectId}/databases/${stagingDatabaseId}/documents:runAggregationQuery`,
    {
      headers: { Authorization: `Bearer ${oauthToken}` },
      data: {
        structuredAggregationQuery: {
          structuredQuery,
          aggregations: [{ alias: "count", count: {} }],
        },
      },
    },
  );
  expect(response.status()).toBe(200);
  const body = await response.json() as Array<{
    result?: { aggregateFields?: { count?: { integerValue?: string } } };
  }>;
  return Number(body[0]?.result?.aggregateFields?.count?.integerValue ?? "0");
}

async function assertStagingMetadata(page: Page, path: string) {
  await openHostedPage(page, path);
  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical).toBeTruthy();
  expect(new URL(canonical!, stagingBaseUrl).origin).toBe(stagingBaseUrl);
  expect(canonical).not.toContain("findyourchurchpalacios.org");
  const robotsValues = await page
    .locator('meta[name="robots"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("content") ?? ""));
  expect(robotsValues.some((value) => value.toLowerCase().includes("noindex"))).toBe(true);
  const openGraphUrls = await page
    .locator('meta[property="og:url"]')
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("content") ?? ""));
  const openGraphUrl = openGraphUrls.find(Boolean);
  expect(openGraphUrl).toBeTruthy();
  expect(new URL(openGraphUrl!, stagingBaseUrl).origin).toBe(stagingBaseUrl);
  return { canonical, openGraphUrl, title: await page.title() };
}

test("public pages stay practical with the large hosted staging dataset", async ({ page }) => {
  test.setTimeout(180_000);
  const metrics: PageMetric[] = [];
  for (const route of [
    ["Homepage", "/"],
    ["Church directory", "/churches"],
    ["Community events", "/events"],
    ["Event detail", "/events/staging-published-family-night"],
    ["Church profile", "/tx/palacios/staging-test-church-1"],
  ] as const) {
    metrics.push(await measurePage(page, route[0], route[1]));
  }

  await openHostedPage(page, "/events");
  await expect(page.locator(".event-card")).toHaveCount(60);
  await page.getByLabel("Keyword").fill("Staging Load Event 1");
  await expect(page.getByRole("link", { name: "Staging Load Event 1", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).click();
  const eventFilterSelects = page.locator(".events-filter-panel select");
  await eventFilterSelects.nth(0).selectOption("staging-qa-church-a");
  await expect(page.locator(".event-card").first()).toBeVisible();
  await eventFilterSelects.nth(2).selectOption({ label: "Community Service or Volunteer Opportunity" });
  await expect(page.locator(".event-card").first()).toBeVisible();
  const fromDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const throughDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  await page.locator('.events-filter-panel input[type="date"]').nth(0).fill(fromDate);
  await page.locator('.events-filter-panel input[type="date"]').nth(1).fill(throughDate);
  await expect(page.locator(".directory-results__count")).toBeVisible();

  console.log(`[performance] public ${JSON.stringify(metrics)}`);
});

test("Firestore staging totals and public visibility constraints are verified read-only", async ({ request }) => {
  const [churches, events, publicEvents, registrations, loadRegistrations] = await Promise.all([
    aggregateCount(request, "churches"),
    aggregateCount(request, "events"),
    aggregateCount(request, "publicEvents"),
    aggregateCount(request, "eventRegistrations"),
    aggregateCount(request, "eventRegistrations", { name: "eventId", value: loadEventId }),
  ]);
  expect(churches).toBeGreaterThanOrEqual(3);
  expect(events).toBeGreaterThanOrEqual(100);
  expect(publicEvents).toBeGreaterThanOrEqual(100);
  expect(registrations).toBeGreaterThanOrEqual(500);
  expect(loadRegistrations).toBe(500);
  console.log(`[dataset] ${JSON.stringify({ churches, events, publicEvents, registrations, loadRegistrations })}`);
});

test("registration, check-in, portal, and admin collections remain paginated", async ({ browser }) => {
  test.setTimeout(180_000);
  const churchContext = await browser.newContext();
  const adminContext = await browser.newContext();
  try {
    await authenticateContext(churchContext, stagingAccounts.churchC);
    const churchPage = await churchContext.newPage();
    const registrationMetric = await measurePage(
      churchPage,
      "Registration dashboard with 500 records",
      `/portal/events/${loadEventId}/registration`,
    );
    await expect(churchPage.locator("tbody tr")).toHaveCount(25);
    const firstRegistration = await churchPage.locator("tbody tr").first().textContent();
    await Promise.all([
      churchPage.waitForURL(/(?:\?|&)cursor=/),
      churchPage.getByRole("link", { name: "Next page" }).click(),
    ]);
    await expect(churchPage.locator("tbody tr")).toHaveCount(25);
    await expect(churchPage.locator("tbody tr").first()).not.toContainText(firstRegistration ?? "missing");
    await churchPage.goto(`/portal/events/${loadEventId}/registration?search=Staging%20Registrant%20499`, { waitUntil: "domcontentloaded" });
    await expect(churchPage.locator("tbody tr")).toHaveCount(1);
    await expect(churchPage.locator("tbody")).toContainText("Staging Registrant 499");
    await churchPage.goto(`/portal/events/${loadEventId}/registration?status=waitlisted`, { waitUntil: "domcontentloaded" });
    expect(await churchPage.locator("tbody tr").count()).toBeLessThanOrEqual(25);
    await churchPage.goto(`/portal/events/${loadEventId}/check-in`, { waitUntil: "domcontentloaded" });
    expect(await churchPage.locator(".check-in-card").count()).toBeLessThanOrEqual(25);
    await churchPage.goto(`/portal/events`, { waitUntil: "domcontentloaded" });
    expect(await churchPage.locator(".event-admin-row").count()).toBeLessThanOrEqual(50);

    await authenticateContext(adminContext, stagingAccounts.platformAdmin);
    const adminPage = await adminContext.newPage();
    const adminMetric = await measurePage(adminPage, "Platform event administration", "/admin/events");
    await expect(adminPage.locator(".admin-card-list__item")).toHaveCount(50);
    await expect(adminPage.getByRole("link", { name: "Next page" })).toBeVisible();
    await adminPage.getByRole("link", { name: "Next page" }).click();
    expect(await adminPage.locator(".admin-card-list__item").count()).toBeLessThanOrEqual(50);
    await openHostedPage(adminPage, "/admin/event-reports");
    expect(await adminPage.locator(".admin-card-list__item").count()).toBeLessThanOrEqual(50);
    await openHostedPage(adminPage, "/admin/event-categories");
    await openHostedPage(adminPage, "/admin/ops");

    console.log(`[performance] authenticated ${JSON.stringify({ registrationMetric, adminMetric })}`);
  } finally {
    await churchContext.close();
    await adminContext.close();
  }
});

test("PDF and XLSX exports handle 500 registrations within supported limits", async ({ browser }) => {
  test.setTimeout(600_000);
  const context = await browser.newContext({ acceptDownloads: true });
  const results: Array<Record<string, unknown>> = [];
  try {
    await authenticateContext(context, stagingAccounts.churchC);
    const page = await context.newPage();

    for (const reportType of ["roster", "sign_in", "check_in"] as const) {
      for (const orientation of ["portrait", "landscape"] as const) {
        await openHostedPage(page, `/portal/events/${loadEventId}/exports`);
        const downloadForm = page.locator("form.registration-export-form").first();
        await downloadForm.getByLabel("Format").selectOption("pdf");
        await downloadForm.getByLabel("PDF layout").selectOption(reportType);
        await downloadForm.getByLabel("Orientation").selectOption(orientation);
        const startedAt = Date.now();
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("button", { name: "Create secure download" }).click();
        const download = await downloadPromise;
        const downloadPath = await download.path();
        expect(downloadPath).toBeTruthy();
        const buffer = await readFile(downloadPath!);
        const pdf = await PDFDocument.load(new Uint8Array(buffer));
        expect(pdf.getPageCount()).toBeGreaterThan(1);
        expect(buffer.byteLength).toBeLessThanOrEqual(10 * 1024 * 1024);
        results.push({ format: "pdf", reportType, orientation, milliseconds: Date.now() - startedAt, bytes: buffer.byteLength, pages: pdf.getPageCount() });
        await download.delete();
      }
    }

    await openHostedPage(page, `/portal/events/${loadEventId}/exports`);
    await page.locator("form.registration-export-form").first().getByLabel("Format").selectOption("xlsx");
    const workbookStartedAt = Date.now();
    const workbookDownloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Create secure download" }).click();
    const workbookDownload = await workbookDownloadPromise;
    const workbookPath = await workbookDownload.path();
    expect(workbookPath).toBeTruthy();
    const workbookBuffer = await readFile(workbookPath!);
    expect(workbookBuffer.byteLength).toBeLessThanOrEqual(10 * 1024 * 1024);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(workbookBuffer as never);
    expect(workbook.getWorksheet("Registrations")?.rowCount).toBe(501);
    expect(workbook.getWorksheet("Participants")?.rowCount).toBe(833);
    expect(workbook.getWorksheet("Answer Summary")).toBeTruthy();
    const summary = workbook.getWorksheet("Event Summary")!;
    const summaryValues = new Map<string, unknown>();
    summary.eachRow((row) => summaryValues.set(String(row.getCell(1).value), row.getCell(2).value));
    expect(summaryValues.get("Confirmed registrations")).toBe(478);
    expect(summaryValues.get("Waitlist total")).toBe(21);
    expect(summaryValues.get("Cancelled total")).toBe(1);
    const registrations = workbook.getWorksheet("Registrations")!;
    const headerValues = registrations.getRow(1).values;
    const formulaColumn = Array.isArray(headerValues)
      ? headerValues.findIndex((value) => String(value) === "Formula injection probe")
      : Object.values(headerValues ?? {}).findIndex(
          (value) => String(value) === "Formula injection probe",
        );
    expect(formulaColumn).toBeGreaterThan(0);
    for (let row = 2; row <= 5; row += 1) {
      expect(String(registrations.getRow(row).getCell(formulaColumn).value)).toMatch(/^'/);
    }
    results.push({ format: "xlsx", milliseconds: Date.now() - workbookStartedAt, bytes: workbookBuffer.byteLength, rows: registrations.rowCount, participantRows: workbook.getWorksheet("Participants")?.rowCount, sheets: workbook.worksheets.map((sheet) => sheet.name) });
    await workbookDownload.delete();
    console.log(`[exports] ${JSON.stringify(results)}`);
  } finally {
    await context.close();
  }
});

test("metadata, robots, sitemap, structured data, sharing, and calendars stay staging-safe", async ({ browser, page, request }) => {
  test.setTimeout(180_000);
  for (const path of [
    "/",
    "/churches",
    "/tx/palacios/staging-test-church-1",
    "/events",
    "/events/staging-published-family-night",
    "/events/staging-cancelled-outreach",
    "/events/staging-past-public-gathering",
    "/events/staging-unlisted-volunteer-training",
    "/events/staging-published-family-night/register",
    "/events/staging-published-family-night/register/confirmation?confirmation=private-test-token",
  ]) {
    const result = await assertStagingMetadata(page, path);
    expect(result.title.length).toBeGreaterThan(0);
  }

  await openHostedPage(page, "/events/staging-published-family-night");
  const structuredData = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "{}") as Record<string, unknown>;
  expect(structuredData["@type"]).toBe("Event");
  expect(structuredData.url).toBe(`${stagingBaseUrl}/events/staging-published-family-night`);
  expect(String((structuredData.image as string[])[0])).not.toContain(`${stagingBaseUrl}/https://`);
  await openHostedPage(page, "/events/staging-cancelled-outreach");
  const cancelledData = JSON.parse(await page.locator('script[type="application/ld+json"]').textContent() ?? "{}") as Record<string, unknown>;
  expect(cancelledData.eventStatus).toBe("https://schema.org/EventCancelled");
  await openHostedPage(page, "/events/staging-unlisted-volunteer-training");
  await expect(page.locator('script[type="application/ld+json"]')).toHaveCount(0);

  const calendarResponse = await request.get(`${stagingBaseUrl}/events/staging-published-family-night/calendar.ics`);
  expect(calendarResponse.status()).toBe(200);
  expect(calendarResponse.headers()["content-type"]).toContain("text/calendar");
  const calendarBody = await calendarResponse.text();
  expect(calendarBody).toContain("X-WR-TIMEZONE:America/Chicago");
  expect(calendarBody).toContain(`URL:${stagingBaseUrl}/events/staging-published-family-night`);
  expect(calendarBody).toContain("LOCATION:123 Staging Event Lane\\, Palacios\\, TX 77465");
  const cancelledCalendar = await request.get(`${stagingBaseUrl}/events/staging-cancelled-outreach/calendar.ics`);
  expect(await cancelledCalendar.text()).toContain("STATUS:CANCELLED");
  await openHostedPage(page, "/events/staging-published-family-night");
  const googleCalendarHref = await page.getByRole("link", { name: "Add to Google Calendar" }).getAttribute("href");
  const googleCalendar = new URL(googleCalendarHref!);
  expect(googleCalendar.searchParams.get("dates")).toBeTruthy();
  expect(googleCalendar.searchParams.get("details")).toContain(`${stagingBaseUrl}/events/staging-published-family-night`);
  expect(googleCalendar.searchParams.get("location")).toContain("123 Staging Event Lane");

  const robotsResponse = await request.get(`${stagingBaseUrl}/robots.txt`);
  const robotsBody = await robotsResponse.text();
  expect(robotsBody).toContain("Disallow: /");
  const sitemapResponse = await request.get(`${stagingBaseUrl}/sitemap.xml`);
  expect(sitemapResponse.status()).toBe(200);
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain(`${stagingBaseUrl}/tx/palacios/staging-test-church-1`);
  expect(sitemap).toContain(`${stagingBaseUrl}/events/staging-published-family-night`);
  expect(sitemap).toContain(`${stagingBaseUrl}/events/staging-load-event-100`);
  for (const excluded of [
    "staging-draft-community-meal",
    "staging-pending-review-event",
    "staging-unlisted-volunteer-training",
    "staging-cancelled-outreach",
    "staging-past-public-gathering",
    "/register",
    "/confirmation",
    "/registrations/",
    "/portal/",
    "/admin/",
    "private-test-token",
  ]) {
    expect(sitemap).not.toContain(excluded);
  }

  const portalContext = await browser.newContext();
  const adminContext = await browser.newContext();
  try {
    await authenticateContext(portalContext, stagingAccounts.churchA);
    await assertStagingMetadata(await portalContext.newPage(), "/portal/events");
    await authenticateContext(adminContext, stagingAccounts.platformAdmin);
    await assertStagingMetadata(await adminContext.newPage(), "/admin/events");
  } finally {
    await portalContext.close();
    await adminContext.close();
  }

  for (const secretLikeValue of ["private-test-token", "staging-email-preview-invalid-token"]) {
    expect(sitemap).not.toContain(secretLikeValue);
    expect(calendarBody).not.toContain(secretLikeValue);
    expect(JSON.stringify(structuredData)).not.toContain(secretLikeValue);
  }
});
