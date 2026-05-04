import { NextResponse } from "next/server";

import { isProductionEnvironment } from "@/lib/firebase/config";
import { processAnnualListingVerifications } from "@/lib/services/listing-verification-service";

function getConfiguredCronSecret() {
  const configuredSecret = process.env.LISTING_VERIFICATION_CRON_SECRET?.trim();
  return configuredSecret ? configuredSecret : null;
}

function readProvidedSecret(request: Request) {
  return request.headers.get("x-cron-secret")?.trim() ?? null;
}

export async function POST(request: Request) {
  const configuredSecret = getConfiguredCronSecret();
  const providedSecret = readProvidedSecret(request);

  if (configuredSecret && providedSecret !== configuredSecret) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      { status: 401 },
    );
  }

  if (!configuredSecret && isProductionEnvironment()) {
    return NextResponse.json(
      {
        error:
          "LISTING_VERIFICATION_CRON_SECRET must be configured before the production verification job can run.",
      },
      { status: 500 },
    );
  }

  const summary = await processAnnualListingVerifications();

  return NextResponse.json(summary);
}
