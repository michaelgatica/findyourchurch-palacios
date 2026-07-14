import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

const stagingUrl = "https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app";
const configuredUrl = (process.env.STAGING_BASE_URL ?? stagingUrl).replace(/\/+$/, "");

if (configuredUrl !== stagingUrl || configuredUrl.includes("findyourchurchpalacios.org")) {
  throw new Error("Hosted browser QA may run only against the dedicated staging URL.");
}

const outputRoot = path.join(process.env.TEMP ?? process.env.TMP ?? ".", "find-your-church-staging-playwright");

export default defineConfig({
  testDir: "./tests/hosted-staging",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  outputDir: path.join(outputRoot, "artifacts"),
  reporter: [["line"]],
  use: {
    baseURL: configuredUrl,
    colorScheme: "light",
    locale: "en-US",
    timezoneId: "America/Chicago",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    video: "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "edge",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
});
