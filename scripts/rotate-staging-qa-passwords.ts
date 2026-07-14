import { config as loadEnv } from "dotenv";

import { assertSafeNonProductionTarget } from "@/lib/app-environment";
import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { getStagingOAuthAuth, verifyStagingOAuthTarget } from "./staging-oauth-rest";

loadEnv({ path: ".env.staging.local" });

const stagingQaUsers = [
  "staging-qa-admin",
  "staging-qa-rep-user-1",
  "staging-qa-rep-user-2",
  "staging-qa-rep-user-3",
  "staging-qa-event-manager",
] as const;

async function main() {
  const target = assertSafeNonProductionTarget("Staging QA password rotation");
  const password = process.env.STAGING_TEST_USER_PASSWORD;

  if (target.environment !== "staging") {
    throw new Error("QA password rotation requires APP_ENV=staging.");
  }
  if (!password || password.length < 16) {
    throw new Error("Set STAGING_TEST_USER_PASSWORD to at least 16 characters.");
  }

  await verifyStagingOAuthTarget();
  const auth = await getStagingOAuthAuth() ?? getFirebaseAdminAuth();
  if (!auth) {
    throw new Error("Firebase Admin Authentication is not available for staging password rotation.");
  }

  for (const uid of stagingQaUsers) {
    await verifyStagingOAuthTarget();
    await auth.updateUser(uid, { password });
  }

  console.log(JSON.stringify({
    ok: true,
    projectId: target.projectIds[0],
    updatedUserCount: stagingQaUsers.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
