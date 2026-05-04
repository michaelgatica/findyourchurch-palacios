import { config as loadEnv } from "dotenv";

import { processAnnualListingVerifications } from "@/lib/services/listing-verification-service";

loadEnv({
  path: ".env.local",
});

const dryRun = process.argv.includes("--dry-run");
const confirmRun = process.argv.includes("--confirm");

async function run() {
  if (!dryRun && !confirmRun) {
    throw new Error(
      "Refusing to process listing verifications without --dry-run or --confirm. Preview the changes first, then rerun with --confirm when you are ready to send emails or archive listings.",
    );
  }

  console.log(
    dryRun
      ? "Running annual listing verification in dry-run mode."
      : "Running annual listing verification in confirm mode.",
  );

  const summary = await processAnnualListingVerifications({
    dryRun,
  });

  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  console.error("Failed to process annual listing verifications.", error);
  process.exitCode = 1;
});
