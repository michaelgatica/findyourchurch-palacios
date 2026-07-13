import { NextResponse } from "next/server";

import { isProductionEnvironment } from "@/lib/firebase/config";
import { processRegistrationJobs } from "@/lib/services/registration-job-service";

export async function POST(request: Request) {
  const configuredSecret = process.env.REGISTRATION_JOBS_CRON_SECRET?.trim();
  const providedSecret = request.headers.get("x-cron-secret")?.trim();
  if (configuredSecret && configuredSecret !== providedSecret) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!configuredSecret && isProductionEnvironment()) return NextResponse.json({ error: "REGISTRATION_JOBS_CRON_SECRET must be configured." }, { status: 500 });
  return NextResponse.json(await processRegistrationJobs());
}
