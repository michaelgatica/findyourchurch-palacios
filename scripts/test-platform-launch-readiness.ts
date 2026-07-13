import assert from "node:assert/strict";

import { assertAdminProfile } from "@/lib/services/platform-event-admin-service";
import { getProductionConfigurationSummary } from "@/lib/services/production-config-service";
import {
  eventCategoryGroups,
  eventReportReasons,
  eventReportStatuses,
  eventStatuses,
} from "@/lib/types/events";

const previousNodeEnv = process.env.NODE_ENV;

function setProductionEnv(overrides: Record<string, string | undefined>) {
  (process.env as Record<string, string | undefined>).NODE_ENV = "production";

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function restoreNodeEnv() {
  (process.env as Record<string, string | undefined>).NODE_ENV = previousNodeEnv;
}

function run() {
  assert.ok(eventStatuses.includes("pending_review"));
  assert.ok(eventStatuses.includes("archived"));
  assert.ok(eventCategoryGroups.includes("primary_type"));
  assert.ok(eventCategoryGroups.includes("seasonal"));
  assert.ok(eventReportReasons.includes("broken_registration_link"));
  assert.ok(eventReportStatuses.includes("investigating"));
  assert.doesNotThrow(() => assertAdminProfile({ profile: { role: "admin" } }));
  assert.throws(
    () => assertAdminProfile({ profile: { role: "church_primary" } }),
    /Platform administrator access is required/,
  );

  setProductionEnv({
    NEXT_PUBLIC_SITE_URL: "http://findyourchurchpalacios.org",
    NEXT_PUBLIC_FIREBASE_API_KEY: undefined,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: undefined,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: undefined,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: undefined,
    NEXT_PUBLIC_FIREBASE_APP_ID: undefined,
    FIREBASE_PROJECT_ID: undefined,
    FIREBASE_STORAGE_BUCKET: undefined,
    EMAIL_PROVIDER: "console",
    REGISTRATION_TOKEN_SECRET: undefined,
    REGISTRATION_JOBS_CRON_SECRET: undefined,
  });
  const failingSummary = getProductionConfigurationSummary();
  assert.ok(failingSummary.failed > 0);
  assert.ok(
    failingSummary.checks.some(
      (check) => check.key === "NEXT_PUBLIC_SITE_URL" && check.status === "fail",
    ),
  );
  assert.ok(failingSummary.checks.every((check) => !check.message.includes("secret-value")));

  setProductionEnv({
    APP_ENV: "production",
    NEXT_PUBLIC_SITE_URL: "https://findyourchurchpalacios.org",
    NEXT_PUBLIC_FIREBASE_API_KEY: "configured",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "configured",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "configured",
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: "configured",
    NEXT_PUBLIC_FIREBASE_APP_ID: "configured",
    FIREBASE_PROJECT_ID: "configured",
    FIREBASE_STORAGE_BUCKET: "configured",
    EMAIL_PROVIDER: "smtp",
    EMAIL_FROM: "support@findyourchurchpalacios.org",
    ADMIN_NOTIFICATION_EMAIL: "support@findyourchurchpalacios.org",
    REGISTRATION_TOKEN_SECRET: "secret-value-that-should-not-print",
    REGISTRATION_JOBS_CRON_SECRET: "secret-value-that-should-not-print",
    SMTP_HOST: "findyourchurchpalacios.org",
    SMTP_PORT: "465",
    SMTP_USER: "support@findyourchurchpalacios.org",
    SMTP_PASSWORD: "secret-value-that-should-not-print",
  });
  const configuredSummary = getProductionConfigurationSummary();
  assert.equal(configuredSummary.failed, 0);
  assert.ok(
    configuredSummary.checks.every(
      (check) => !check.message.includes("secret-value-that-should-not-print"),
    ),
  );
  restoreNodeEnv();

  console.log(JSON.stringify({
    ok: true,
    suite: "platform-launch-readiness",
    checks: [
      "platform event statuses include moderation states",
      "category groups cover global taxonomy needs",
      "public event report reasons and statuses are available",
      "platform event administration rejects non-admin profiles",
      "production config validator fails missing critical settings",
      "production config validator rejects HTTP canonical hosts",
      "production config validator does not print secrets",
    ],
  }, null, 2));
}

run();
