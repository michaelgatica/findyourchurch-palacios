import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Page, type TestInfo } from "@playwright/test";

export const stagingBaseUrl =
  "https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app";

export const stagingAccounts = {
  platformAdmin: "staging-qa-admin@staging.findyourchurch.test",
  churchA: "staging-qa-rep-user-1@staging.findyourchurch.test",
  churchB: "staging-qa-rep-user-2@staging.findyourchurch.test",
  churchC: "staging-qa-rep-user-3@staging.findyourchurch.test",
  eventManager: "staging-qa-event-manager@staging.findyourchurch.test",
} as const;

export const publicRoutes = [
  { label: "Homepage", path: "/" },
  { label: "Church representative sign in", path: "/portal/login" },
  { label: "Platform administrator sign in", path: "/admin/login" },
  { label: "Church directory", path: "/churches" },
  { label: "Church profile", path: "/tx/palacios/staging-test-church-1" },
  { label: "Community events", path: "/events" },
  { label: "Published event", path: "/events/staging-published-family-night" },
  { label: "Cancelled event", path: "/events/staging-cancelled-outreach" },
  { label: "Registration form", path: "/events/staging-published-family-night/register" },
  {
    label: "Registration confirmation",
    path: "/events/staging-published-family-night/register/confirmation?confirmation=FYC-99F2E4E2586C",
  },
] as const;

export const representativeRoutes = [
  { label: "Portal events dashboard", path: "/portal/events" },
  { label: "Event creation", path: "/portal/events/new" },
  { label: "Event editing", path: "/portal/events/staging-qa-event-published/edit" },
  {
    label: "Registration form builder",
    path: "/portal/events/staging-qa-event-published/registration/form",
  },
  {
    label: "Registration dashboard",
    path: "/portal/events/staging-qa-event-published/registration",
  },
  {
    label: "Registration detail",
    path: "/portal/events/staging-qa-event-published/registration/staging-qa-registration-staging-qa-event-published-1",
  },
  { label: "Mobile check-in", path: "/portal/events/staging-qa-event-published/check-in" },
] as const;

export const administratorRoutes = [
  { label: "Platform events", path: "/admin/events" },
  { label: "Event-report moderation", path: "/admin/event-reports" },
  { label: "Category management", path: "/admin/event-categories" },
  { label: "Operations readiness", path: "/admin/ops" },
] as const;

export async function openHostedPage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `${path} did not return a response.`).not.toBeNull();
  expect(response!.status(), `${path} returned HTTP ${response!.status()}.`).toBeLessThan(400);
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Application error|Unhandled Runtime Error/i);
}

export async function authenticateContext(context: BrowserContext, email: string) {
  const apiKey = process.env.FYC_STAGING_FIREBASE_API_KEY?.trim();
  const password = process.env.FYC_STAGING_QA_PASSWORD?.trim();
  expect(apiKey, "The staging Firebase API key must be supplied in process memory.").toBeTruthy();
  expect(password, "The staging QA password must be supplied in process memory.").toBeTruthy();

  const identityResponse = await context.request.post(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey!)}`,
    { data: { email, password, returnSecureToken: true } },
  );
  expect(identityResponse.status(), `The fictitious staging account ${email} could not authenticate.`).toBe(200);
  const identity = await identityResponse.json() as { idToken?: string };
  expect(identity.idToken).toBeTruthy();

  const sessionResponse = await context.request.post(`${stagingBaseUrl}/api/auth/session`, {
    data: { idToken: identity.idToken },
    headers: { Origin: stagingBaseUrl },
  });
  expect(sessionResponse.status(), "The hosted staging session endpoint rejected the QA account.").toBe(200);
}

export async function auditAccessibility(page: Page, testInfo: TestInfo, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  const violations = results.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    help: violation.help,
    nodes: violation.nodes.map((node) => ({ target: node.target, summary: node.failureSummary })),
  }));
  await testInfo.attach(`${label.replaceAll(/[^a-z0-9]+/gi, "-").toLowerCase()}-axe.json`, {
    body: Buffer.from(JSON.stringify(violations, null, 2)),
    contentType: "application/json",
  });

  const blocking = violations.filter((violation) =>
    violation.impact === "critical" || violation.impact === "serious",
  );
  if (violations.length > 0) {
    console.log(
      `[axe] ${label}: ${violations.map((violation) => `${violation.impact ?? "unknown"}:${violation.id}`).join(", ")}`,
    );
  }
  expect(blocking, `${label} has critical or serious axe violations:\n${JSON.stringify(blocking, null, 2)}`).toEqual([]);
  return violations;
}

export function collectPageErrors(page: Page, ignoredMessages: readonly RegExp[] = []) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return () => {
    const actionableErrors = errors.filter(
      (message) => !ignoredMessages.some((pattern) => pattern.test(message)),
    );
    expect(
      actionableErrors,
      `Unexpected browser page errors: ${JSON.stringify(actionableErrors)}`,
    ).toEqual([]);
  };
}

export async function assertNoPageOverflow(page: Page, label: string) {
  const result = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const pageOverflow = document.documentElement.scrollWidth - viewportWidth;
    const offenders = Array.from(document.querySelectorAll<HTMLElement>("body *"))
      .filter((element) => {
        const style = getComputedStyle(element);
        if (style.position === "fixed" || style.position === "absolute") return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.right > viewportWidth + 2 || rect.left < -2);
      })
      .slice(0, 10)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className.toString().slice(0, 120),
        width: Math.round(element.getBoundingClientRect().width),
        right: Math.round(element.getBoundingClientRect().right),
      }));
    return { viewportWidth, pageOverflow, offenders };
  });
  expect(result.pageOverflow, `${label} horizontally overflows by ${result.pageOverflow}px: ${JSON.stringify(result.offenders)}`).toBeLessThanOrEqual(2);
}
