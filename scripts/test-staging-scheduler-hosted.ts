import assert from "node:assert/strict";

const stagingProjectId = "findyourchurch-staging-2026";
const defaultBaseUrl =
  "https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app";

function assertSafeStagingUrl(baseUrl: string) {
  const url = new URL(baseUrl);
  assert.equal(url.protocol, "https:");
  assert.equal(url.hostname.includes(stagingProjectId), true);
  assert.equal(url.hostname.includes("findyourchurchpalacios.org"), false);
}

async function schedulerRequest(input: {
  endpoint: string;
  secret?: string;
  environment?: string;
  method?: string;
  body?: string;
  cookie?: string;
}) {
  const headers = new Headers({
    "user-agent": "FindYourChurch-Staging-Scheduler-Smoke/1.0",
  });
  if (input.secret) headers.set("x-cron-secret", input.secret);
  if (input.environment) headers.set("x-fyc-environment", input.environment);
  if (input.cookie) headers.set("cookie", input.cookie);
  if (input.body) headers.set("content-type", "application/json");
  return fetch(input.endpoint, {
    method: input.method ?? "POST",
    headers,
    body: input.body,
    redirect: "manual",
  });
}

async function run() {
  const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || defaultBaseUrl).replace(/\/+$/, "");
  const schedulerSecret = process.env.REGISTRATION_JOBS_CRON_SECRET?.trim();
  assertSafeStagingUrl(baseUrl);
  assert.ok(schedulerSecret, "REGISTRATION_JOBS_CRON_SECRET must be supplied in process memory.");
  const endpoint = `${baseUrl}/api/jobs/registration`;

  const missing = await schedulerRequest({ endpoint, environment: "staging" });
  const invalid = await schedulerRequest({ endpoint, secret: "invalid-staging-secret", environment: "staging" });
  const publicSession = await schedulerRequest({ endpoint, environment: "staging", cookie: "fyc_session=public-user" });
  const representativeSession = await schedulerRequest({ endpoint, environment: "staging", cookie: "fyc_session=church-representative" });
  const missingEnvironment = await schedulerRequest({ endpoint, secret: schedulerSecret });
  const invalidEnvironment = await schedulerRequest({ endpoint, secret: schedulerSecret, environment: "production" });
  const bodyRejected = await schedulerRequest({ endpoint, secret: schedulerSecret, environment: "staging", body: "{}" });
  const getRejected = await schedulerRequest({ endpoint, method: "GET" });

  assert.equal(missing.status, 401);
  assert.equal(invalid.status, 401);
  assert.equal(publicSession.status, 401);
  assert.equal(representativeSession.status, 401);
  assert.equal(missingEnvironment.status, 400);
  assert.equal(invalidEnvironment.status, 400);
  assert.equal(bodyRejected.status, 413);
  assert.equal(getRejected.status, 405);

  const valid = await schedulerRequest({ endpoint, secret: schedulerSecret, environment: "staging" });
  assert.equal([200, 202].includes(valid.status), true, `Valid scheduler request returned ${valid.status}.`);
  const validResult = await valid.json() as { runId?: string; overlapSkipped?: boolean };
  assert.equal(Boolean(validResult.runId), true);

  const homepage = await fetch(baseUrl);
  const homepageHtml = await homepage.text();
  const scriptPaths = Array.from(
    new Set(
      [...homepageHtml.matchAll(/<script[^>]+src=["']([^"']+)["']/g)]
        .map((match) => new URL(match[1], `${baseUrl}/`).toString())
        .filter((url) => url.includes("/_next/static/")),
    ),
  );
  const bundleBodies = await Promise.all(
    scriptPaths.map(async (url) => (await fetch(url)).text()),
  );
  assert.equal(bundleBodies.some((body) => body.includes(schedulerSecret)), false);

  console.log(JSON.stringify({
    ok: true,
    suite: "staging-scheduler-hosted",
    endpoint,
    statuses: {
      missingAuthentication: missing.status,
      invalidAuthentication: invalid.status,
      publicSessionWithoutSecret: publicSession.status,
      representativeSessionWithoutSecret: representativeSession.status,
      missingEnvironmentMarker: missingEnvironment.status,
      invalidEnvironmentMarker: invalidEnvironment.status,
      requestBodyRejected: bodyRejected.status,
      unexpectedMethodRejected: getRejected.status,
      validAuthentication: valid.status,
    },
    correlationIdRecorded: Boolean(validResult.runId),
    overlapSkipped: Boolean(validResult.overlapSkipped),
    clientBundlesScanned: bundleBodies.length,
    secretFoundInClientBundle: false,
  }, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
