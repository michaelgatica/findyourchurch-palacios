import { config as loadEnv } from "dotenv";

import { processRegistrationJobs } from "@/lib/services/registration-job-service";

loadEnv({ path: ".env.local" });

const dryRun = process.argv.includes("--dry-run");
const confirm = process.argv.includes("--confirm");

if (!dryRun && !confirm) {
  throw new Error("Use --dry-run to preview due registration jobs or --confirm to process them.");
}

processRegistrationJobs({ dryRun })
  .then((summary) => console.log(JSON.stringify(summary, null, 2)))
  .catch((error) => {
    console.error("Registration job processing failed.", error);
    process.exitCode = 1;
  });
