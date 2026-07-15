import { execFileSync, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const productionProjectId = "findyourchurch-24562";
const productionProjectNumber = "443706380375";
const productionAppId = "1:443706380375:web:e2f1c184b87865e003d312";
const productionBaseUrl = "https://findyourchurchpalacios.org";
const debugTokenParent = `projects/${productionProjectNumber}/apps/${productionAppId}`;
const commandProcessor = process.env.ComSpec ?? "cmd.exe";

function requireExactEnvironment(name: string, expected: string) {
  if (process.env[name] !== expected) {
    throw new Error(`${name} must exactly match the guarded production acceptance value.`);
  }
}

function getOAuthAccessToken() {
  return execFileSync(commandProcessor, ["/d", "/s", "/c", "gcloud auth print-access-token"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  }).trim();
}

async function firebaseAppCheckRequest(
  path: string,
  init: RequestInit,
  accessToken = getOAuthAccessToken(),
) {
  const response = await fetch(`https://firebaseappcheck.googleapis.com/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "x-goog-user-project": productionProjectId,
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw new Error(`Firebase App Check request failed with HTTP ${response.status}.`);
  }

  return response;
}

async function main() {
  requireExactEnvironment("ALLOW_PRODUCTION_ACCEPTANCE_TEST", "true");
  requireExactEnvironment("PRODUCTION_FIREBASE_PROJECT_ID", productionProjectId);
  requireExactEnvironment("PRODUCTION_BASE_URL", productionBaseUrl);

  const session = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const debugToken = randomUUID();
  const qaPassword = `${randomUUID()}aA1!`;
  const oauthAccessToken = getOAuthAccessToken();
  let debugTokenName = "";

  try {
    const staleResponse = await firebaseAppCheckRequest(
      `${debugTokenParent}/debugTokens`,
      { method: "GET" },
      oauthAccessToken,
    );
    const stalePayload = (await staleResponse.json()) as {
      debugTokens?: Array<{ displayName?: string; name?: string }>;
    };
    const staleTokens = (stalePayload.debugTokens ?? []).filter(
      (token) => token.displayName?.startsWith("Production acceptance ") && token.name,
    );
    for (const token of staleTokens) {
      await firebaseAppCheckRequest(token.name!, { method: "DELETE" }, oauthAccessToken);
    }
    if (staleTokens.length > 0) {
      console.log(`Revoked ${staleTokens.length} stale production acceptance App Check token(s).`);
    }

    const createResponse = await firebaseAppCheckRequest(
      `${debugTokenParent}/debugTokens`,
      {
        method: "POST",
        body: JSON.stringify({
          displayName: `Production acceptance ${session}`,
          token: debugToken,
        }),
      },
      oauthAccessToken,
    );
    const created = (await createResponse.json()) as { name?: string };
    if (!created.name?.startsWith(`${debugTokenParent}/debugTokens/`)) {
      throw new Error("Firebase App Check did not return the expected debug-token resource name.");
    }
    debugTokenName = created.name;
    console.log(`Registered temporary App Check acceptance token for session ${session}.`);

    const result = spawnSync(
      commandProcessor,
      ["/d", "/s", "/c", "npx playwright test --config=playwright.production-acceptance.config.ts"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PRODUCTION_ACCEPTANCE_SESSION: session,
          PRODUCTION_APP_CHECK_DEBUG_TOKEN: debugToken,
          PRODUCTION_OAUTH_ACCESS_TOKEN: oauthAccessToken,
          PRODUCTION_QA_PASSWORD: qaPassword,
          PLAYWRIGHT_NO_COPY_PROMPT: "1",
        },
        stdio: "inherit",
        windowsHide: true,
      },
    );

    if (result.error) {
      throw result.error;
    }
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
    }
  } finally {
    if (debugTokenName) {
      await firebaseAppCheckRequest(debugTokenName, { method: "DELETE" });
      console.log(`Revoked temporary App Check acceptance token for session ${session}.`);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown guarded acceptance failure.";
  console.error(message);
  process.exitCode = 1;
});
