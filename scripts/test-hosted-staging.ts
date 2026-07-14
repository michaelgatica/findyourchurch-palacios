import assert from "node:assert/strict";

const stagingProjectId = "findyourchurch-staging-2026";
const defaultBaseUrl =
  "https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app";
const allowedStagingHostnames = new Set([
  new URL(defaultBaseUrl).hostname,
  `${stagingProjectId}.web.app`,
  `${stagingProjectId}.firebaseapp.com`,
]);

function getArgument(prefix: string) {
  const argument = process.argv.find((value) => value.startsWith(prefix));
  return argument?.slice(prefix.length).trim() || undefined;
}

function normalizeBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function assertSafeStagingUrl(value: string) {
  const url = new URL(value);

  assert.equal(url.protocol, "https:", "Hosted staging smoke tests require HTTPS.");
  assert.equal(allowedStagingHostnames.has(url.hostname), true, "Refusing an unknown staging host.");
  assert.equal(
    ["findyourchurchpalacios.org", "www.findyourchurchpalacios.org"].includes(url.hostname),
    false,
    "Refusing to run hosted staging smoke tests against the production hostname.",
  );
}

async function fetchPage(baseUrl: string, pathname: string, expectedStatus = 200) {
  const url = new URL(pathname, `${baseUrl}/`);
  const response = await fetch(url, {
    redirect: "manual",
    headers: {
      "user-agent": "FindYourChurch-Hosted-Staging-Smoke/1.0",
    },
  });
  const body = await response.text();

  assert.equal(
    response.status,
    expectedStatus,
    `${url.toString()} returned ${response.status}; expected ${expectedStatus}.`,
  );

  return { body, url: url.toString() };
}

function assertIncludes(body: string, value: string, context: string) {
  assert.equal(body.includes(value), true, `${context} did not include ${JSON.stringify(value)}.`);
}

function assertExcludes(body: string, value: string, context: string) {
  assert.equal(body.includes(value), false, `${context} unexpectedly included ${JSON.stringify(value)}.`);
}

async function run() {
  const baseUrl = normalizeBaseUrl(
    getArgument("--base-url=") ?? process.env.NEXT_PUBLIC_SITE_URL ?? defaultBaseUrl,
  );
  const expectedStorageFlyerAlt = getArgument("--expected-storage-flyer-alt=");
  assertSafeStagingUrl(baseUrl);

  const homepage = await fetchPage(baseUrl, "/");
  assertIncludes(homepage.body, "Find Your Church", "Homepage");
  assertIncludes(homepage.body, `${baseUrl}/`, "Homepage canonical metadata");

  const directory = await fetchPage(baseUrl, "/churches");
  assertIncludes(directory.body, "Staging Test Church 1", "Church directory");

  const events = await fetchPage(baseUrl, "/events");
  assertIncludes(events.body, "Staging Published Family Night", "Community events listing");
  assertExcludes(events.body, "Staging Draft Community Meal", "Community events listing");
  assertExcludes(events.body, "Staging Unlisted Volunteer Training", "Community events listing");
  assertExcludes(events.body, "Staging Cancelled Outreach", "Community events listing");

  const published = await fetchPage(baseUrl, "/events/staging-published-family-night");
  assertIncludes(published.body, "Staging Published Family Night", "Published event detail");
  assertIncludes(
    published.body,
    `${baseUrl}/events/staging-published-family-night`,
    "Published event canonical metadata",
  );

  const draft = await fetchPage(baseUrl, "/events/staging-draft-community-meal");
  assertIncludes(draft.body, "Page Not Found", "Draft event direct route");

  const unlisted = await fetchPage(baseUrl, "/events/staging-unlisted-volunteer-training");
  assertIncludes(unlisted.body, "Staging Unlisted Volunteer Training", "Unlisted event direct route");

  const cancelled = await fetchPage(baseUrl, "/events/staging-cancelled-outreach");
  assertIncludes(cancelled.body, "This event has been cancelled", "Cancelled event detail");

  const missingFlyer = await fetchPage(baseUrl, "/events/staging-full-capacity-workshop");
  assertIncludes(missingFlyer.body, "Staging Full Capacity Workshop", "Missing-flyer event detail");

  const checks = [
    "homepage loads with staging canonical metadata",
    "church directory loads",
    "published events list and open",
    "draft event remains private",
    "unlisted event is absent from listings and opens directly",
    "cancelled event displays its cancellation state",
    "missing-flyer event renders its content",
  ];

  if (expectedStorageFlyerAlt) {
    assertIncludes(events.body, expectedStorageFlyerAlt, "Community events Storage flyer");
    assertIncludes(
      events.body,
      `${stagingProjectId}.firebasestorage.app`,
      "Community events Storage flyer URL",
    );
    checks.push("staging Storage flyer is present in the public listing");
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        suite: "hosted-staging",
        baseUrl,
        checks,
      },
      null,
      2,
    ),
  );
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
