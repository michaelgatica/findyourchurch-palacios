import assert from "node:assert/strict";

import {
  assertSafeNonProductionTarget,
  getApplicationEnvironment,
  getNonProductionEnvironmentLabel,
} from "@/lib/app-environment";

const previousEnv = { ...process.env };

function restoreEnv() {
  for (const key of Object.keys(process.env)) {
    if (!(key in previousEnv)) {
      delete process.env[key];
    }
  }

  for (const [key, value] of Object.entries(previousEnv)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function setEnv(values: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function run() {
  setEnv({
    APP_ENV: "staging",
    NEXT_PUBLIC_APP_ENV: "staging",
    FIREBASE_PROJECT_ID: "demo-find-your-church-staging",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-find-your-church-staging",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  });
  assert.equal(getApplicationEnvironment(), "staging");
  assert.equal(getNonProductionEnvironmentLabel(), "STAGING");
  assert.doesNotThrow(() => assertSafeNonProductionTarget("staging validation test"));

  setEnv({ APP_ENV: "production" });
  assert.throws(
    () => assertSafeNonProductionTarget("staging validation test"),
    /production/,
  );

  setEnv({
    APP_ENV: "staging",
    FIREBASE_PROJECT_ID: "findyourchurch-24562",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "findyourchurch-24562",
    NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
  });
  assert.throws(
    () => assertSafeNonProductionTarget("staging validation test"),
    /production Firebase project/,
  );

  setEnv({
    APP_ENV: "staging",
    FIREBASE_PROJECT_ID: "demo-find-your-church-staging",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-find-your-church-staging",
    NEXT_PUBLIC_SITE_URL: "https://findyourchurchpalacios.org",
  });
  assert.throws(
    () => assertSafeNonProductionTarget("staging validation test"),
    /production site URL/,
  );

  restoreEnv();

  console.log(JSON.stringify({
    ok: true,
    suite: "staging-validation",
    checks: [
      "APP_ENV staging is recognized",
      "admin nonproduction label is available",
      "staging guard allows nonproduction project",
      "staging guard rejects production APP_ENV",
      "staging guard rejects known production Firebase project",
      "staging guard rejects production canonical host",
    ],
  }, null, 2));
}

run();
