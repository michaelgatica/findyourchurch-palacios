import assert from "node:assert/strict";

const baseUrl = "https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app";

async function run() {
  const apiKey = process.env.FYC_STAGING_FIREBASE_API_KEY?.trim();
  const password = process.env.FYC_STAGING_QA_PASSWORD?.trim();
  assert.ok(apiKey, "The staging Firebase API key must be supplied in process memory.");
  assert.ok(password, "The staging QA password must be supplied in process memory.");

  const signInResponse = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "staging-qa-admin@staging.findyourchurch.test",
        password,
        returnSecureToken: true,
      }),
    },
  );
  assert.equal(signInResponse.status, 200, "The staging platform administrator could not sign in.");
  const signIn = await signInResponse.json() as { idToken?: string };
  assert.ok(signIn.idToken);

  const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
    },
    body: JSON.stringify({ idToken: signIn.idToken }),
    redirect: "manual",
  });
  assert.equal(sessionResponse.status, 200);
  const cookieHeader = sessionResponse.headers.get("set-cookie");
  assert.ok(cookieHeader, "The hosted session endpoint did not return a cookie.");
  const sessionCookie = cookieHeader.split(";", 1)[0];

  const operationsResponse = await fetch(`${baseUrl}/admin/ops`, {
    headers: { Cookie: sessionCookie },
    redirect: "manual",
  });
  const html = await operationsResponse.text();
  assert.equal(operationsResponse.status, 200);
  assert.equal(html.includes("STAGING"), true);
  assert.equal(html.includes("Authorized transactional email tests"), true);
  assert.equal(html.includes("Status:"), true);
  assert.equal(html.includes("blocked"), true);
  assert.equal(html.includes("Registration confirmation"), true);
  assert.equal(html.includes("Combined registration report"), true);
  assert.equal(html.includes("Scheduled registration digest"), true);
  assert.equal(html.includes("disabled"), true);
  assert.equal(html.includes("registration_scheduler_completed"), true);

  console.log(JSON.stringify({
    ok: true,
    suite: "staging-admin-ops",
    url: `${baseUrl}/admin/ops`,
    platformAdministratorAuthenticated: true,
    stagingBannerVisible: true,
    smtpStatus: "blocked",
    emailTemplateCatalogVisible: true,
    sendControlsDisabled: true,
    schedulerOperationalEventsVisible: true,
  }, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
