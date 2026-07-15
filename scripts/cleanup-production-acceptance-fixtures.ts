import { execFileSync } from "node:child_process";

import { request } from "@playwright/test";

import {
  acceptanceAccounts,
  cleanupProductionAcceptanceFixture,
  productionBaseUrl,
  productionProjectId,
} from "../tests/production-acceptance/helpers";

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

async function main() {
  requireExactEnvironment("ALLOW_PRODUCTION_ACCEPTANCE_TEST", "true");
  requireExactEnvironment("PRODUCTION_FIREBASE_PROJECT_ID", productionProjectId);
  requireExactEnvironment("PRODUCTION_BASE_URL", productionBaseUrl);

  const sessions = process.argv.slice(2);
  if (sessions.length === 0 || sessions.some((session) => !/^\d{14}$/.test(session))) {
    throw new Error("Supply one or more exact 14-digit production acceptance session markers.");
  }

  process.env.PRODUCTION_OAUTH_ACCESS_TOKEN = getOAuthAccessToken();
  const api = await request.newContext({ baseURL: productionBaseUrl });
  try {
    for (const session of sessions) {
      await cleanupProductionAcceptanceFixture(api, {
        churchSlug: `faith-harbor-acceptance-${session.toLowerCase()}`,
        emails: Object.values(acceptanceAccounts),
      });
      console.log(`Verified exact production acceptance cleanup for session ${session}.`);
    }
  } finally {
    await api.dispose();
    delete process.env.PRODUCTION_OAUTH_ACCESS_TOKEN;
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : "Unknown production acceptance cleanup failure.";
  console.error(message);
  process.exitCode = 1;
});
