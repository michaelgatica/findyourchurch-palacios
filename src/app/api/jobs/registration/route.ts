import { randomUUID } from "crypto";

import { NextResponse } from "next/server";

import { getApplicationEnvironment } from "@/lib/app-environment";
import { validateRegistrationJobRequest } from "@/lib/services/registration-job-request-service";
import { processRegistrationJobs } from "@/lib/services/registration-job-service";

export async function POST(request: Request) {
  const validation = validateRegistrationJobRequest({
    method: request.method,
    configuredSecret: process.env.REGISTRATION_JOBS_CRON_SECRET,
    providedSecret: request.headers.get("x-cron-secret"),
    configuredEnvironment: getApplicationEnvironment(),
    providedEnvironment: request.headers.get("x-fyc-environment"),
    contentLength: request.headers.get("content-length"),
    transferEncoding: request.headers.get("transfer-encoding"),
  });
  if (!validation.ok) {
    return NextResponse.json(
      { error: validation.error },
      { status: validation.status, headers: validation.status === 405 ? { Allow: "POST" } : undefined },
    );
  }

  const result = await processRegistrationJobs({ correlationId: randomUUID() });
  const status = result.overlapSkipped ? 202 : result.terminalFailed > 0 ? 500 : 200;
  return NextResponse.json(result, { status });
}

function methodNotAllowed() {
  return NextResponse.json(
    { error: "Method not allowed." },
    { status: 405, headers: { Allow: "POST" } },
  );
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
