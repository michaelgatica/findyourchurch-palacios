import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const productionUrl = "https://findyourchurchpalacios.org";
const productionProjectId = "findyourchurch-24562";
const configuredUrl = (process.env.PRODUCTION_BASE_URL ?? productionUrl).replace(/\/+$/, "");

if (
  process.env.ALLOW_PRODUCTION_ACCEPTANCE_TEST !== "true" ||
  process.env.PRODUCTION_FIREBASE_PROJECT_ID !== productionProjectId ||
  configuredUrl !== productionUrl
) {
  throw new Error(
    "Production acceptance testing requires the exact URL, project ID, and explicit one-run authorization guard.",
  );
}

const outputRoot = path.join(
  process.env.TEMP ?? process.env.TMP ?? ".",
  "find-your-church-production-acceptance",
);

export default defineConfig({
  testDir: "./tests/production-acceptance",
  fullyParallel: false,
  workers: 1,
  timeout: 300_000,
  expect: { timeout: 30_000 },
  outputDir: path.join(outputRoot, "artifacts"),
  reporter: [["line"]],
  use: {
    actionTimeout: 45_000,
    baseURL: configuredUrl,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "America/Chicago",
    screenshot: "off",
    trace: "off",
    video: "off",
  },
  projects: [
    {
      name: "chromium-production-acceptance",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
