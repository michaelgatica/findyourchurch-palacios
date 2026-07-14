import assert from "node:assert/strict";

import {
  canClaimRegistrationJob,
  getRegistrationJobRetryDelayMs,
  isRegistrationJobLeaseExpired,
} from "@/lib/services/registration-job-policy";
import { validateRegistrationJobRequest } from "@/lib/services/registration-job-request-service";

const configuredSecret = "staging-scheduler-secret-with-sufficient-entropy";
const baseRequest = {
  method: "POST",
  configuredSecret,
  configuredEnvironment: "staging",
  providedEnvironment: "staging",
  contentLength: "0",
};

function run() {
  assert.deepEqual(
    validateRegistrationJobRequest({ ...baseRequest, providedSecret: null }),
    { ok: false, status: 401, error: "Unauthorized." },
  );
  assert.deepEqual(
    validateRegistrationJobRequest({ ...baseRequest, providedSecret: "incorrect" }),
    { ok: false, status: 401, error: "Unauthorized." },
  );
  assert.deepEqual(
    validateRegistrationJobRequest({ ...baseRequest, configuredSecret: null, providedSecret: configuredSecret }),
    { ok: false, status: 503, error: "Registration scheduler authentication is not configured." },
  );
  assert.deepEqual(
    validateRegistrationJobRequest({ ...baseRequest, providedSecret: configuredSecret }),
    { ok: true },
  );
  assert.equal(
    validateRegistrationJobRequest({ ...baseRequest, providedSecret: configuredSecret, providedEnvironment: "production" }).ok,
    false,
  );
  assert.equal(
    validateRegistrationJobRequest({ ...baseRequest, providedSecret: configuredSecret, method: "GET" }).ok,
    false,
  );
  const oversized = validateRegistrationJobRequest({
    ...baseRequest,
    providedSecret: configuredSecret,
    contentLength: "1",
  });
  assert.deepEqual(oversized, { ok: false, status: 413, error: "Scheduler requests must not include a body." });
  assert.equal(
    validateRegistrationJobRequest({
      ...baseRequest,
      providedSecret: configuredSecret,
      transferEncoding: "chunked",
    }).ok,
    false,
  );

  assert.equal(getRegistrationJobRetryDelayMs(1), 60_000);
  assert.equal(getRegistrationJobRetryDelayMs(2), 120_000);
  assert.equal(getRegistrationJobRetryDelayMs(10), 900_000);

  const now = Date.parse("2030-01-01T12:00:00.000Z");
  assert.equal(isRegistrationJobLeaseExpired({ leaseExpiresAt: "2030-01-01T11:59:59.000Z" }, now), true);
  assert.equal(isRegistrationJobLeaseExpired({ leaseExpiresAt: "2030-01-01T12:10:00.000Z" }, now), false);
  assert.equal(canClaimRegistrationJob({ status: "pending", scheduledFor: "2030-01-01T11:00:00.000Z" }, now), true);
  assert.equal(canClaimRegistrationJob({ status: "pending", scheduledFor: "2030-01-01T13:00:00.000Z" }, now), false);
  assert.equal(canClaimRegistrationJob({
    status: "processing",
    scheduledFor: "2030-01-01T11:00:00.000Z",
    leaseExpiresAt: "2030-01-01T11:59:59.000Z",
  }, now), true);
  assert.equal(canClaimRegistrationJob({
    status: "processing",
    scheduledFor: "2030-01-01T11:00:00.000Z",
    leaseExpiresAt: "2030-01-01T12:10:00.000Z",
  }, now), false);

  console.log(JSON.stringify({
    ok: true,
    suite: "registration-scheduler-security",
    authenticationCases: 7,
    requestValidationCases: 3,
    retryPolicyCases: 3,
    leasePolicyCases: 6,
  }, null, 2));
}

run();
