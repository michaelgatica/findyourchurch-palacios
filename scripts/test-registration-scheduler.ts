import assert from "node:assert/strict";

import { createRegistrationScheduledJobRecord } from "@/lib/services/registration-job-service";
import { getPublicRegistrationStatus } from "@/lib/services/public-registration-service";
import { isRegistrationStatusTransitionAllowed } from "@/lib/services/registration-management-service";
import { getDefaultRegistrationConfiguration } from "@/lib/validation/registration";
import type { EventRecord } from "@/lib/types/events";

async function run() {
  const scheduledFor = "2030-09-10T12:00:00.000Z";
  const baseJob = {
    eventId: "event-one",
    churchId: "church-one",
    type: "event_reminder_notice" as const,
    scheduledFor,
    idempotencySuffix: "parent-job:registration-one",
    payload: { registrationId: "registration-one" },
  };
  const firstJob = createRegistrationScheduledJobRecord(baseJob);
  const duplicateJob = createRegistrationScheduledJobRecord(baseJob);
  const secondRegistrantJob = createRegistrationScheduledJobRecord({
    ...baseJob,
    idempotencySuffix: "parent-job:registration-two",
    payload: { registrationId: "registration-two" },
  });
  assert.equal(firstJob.id, duplicateJob.id);
  assert.equal(firstJob.idempotencyKey, duplicateJob.idempotencyKey);
  assert.notEqual(firstJob.id, secondRegistrantJob.id);
  assert.equal(firstJob.status, "pending");
  assert.equal(firstJob.attempts, 0);

  const configuration = getDefaultRegistrationConfiguration({
    eventId: "event-one",
    churchId: "church-one",
    mode: "internal_custom",
    actorUserId: "user-one",
    capacity: 10,
  });
  const event = {
    status: "published",
    startsAt: "2030-09-10T14:00:00.000Z",
    endsAt: "2030-09-10T16:00:00.000Z",
  } as EventRecord;
  const baseStatusInput = {
    event,
    configuration,
    confirmedCapacityUsed: 0,
    waitlistCapacityUsed: 0,
    now: Date.parse("2030-09-01T12:00:00.000Z"),
  };
  assert.equal(getPublicRegistrationStatus(baseStatusInput), "open");
  assert.equal(getPublicRegistrationStatus({
    ...baseStatusInput,
    configuration: { ...configuration, opensAt: "2030-09-02T12:00:00.000Z" },
  }), "not_yet_open");
  assert.equal(getPublicRegistrationStatus({
    ...baseStatusInput,
    configuration: { ...configuration, closesAt: "2030-08-31T12:00:00.000Z" },
  }), "closed");
  assert.equal(getPublicRegistrationStatus({
    ...baseStatusInput,
    confirmedCapacityUsed: 9,
  }), "almost_full");
  assert.equal(getPublicRegistrationStatus({
    ...baseStatusInput,
    confirmedCapacityUsed: 10,
  }), "full");
  assert.equal(getPublicRegistrationStatus({
    ...baseStatusInput,
    configuration: { ...configuration, waitlistEnabled: true, waitlistCapacity: 2 },
    confirmedCapacityUsed: 10,
  }), "waitlist_available");
  assert.equal(getPublicRegistrationStatus({
    ...baseStatusInput,
    configuration: { ...configuration, waitlistEnabled: true, waitlistCapacity: 2 },
    confirmedCapacityUsed: 10,
    waitlistCapacityUsed: 2,
  }), "waitlist_full");
  assert.equal(getPublicRegistrationStatus({
    ...baseStatusInput,
    event: { ...event, status: "cancelled" },
  }), "event_cancelled");
  assert.equal(getPublicRegistrationStatus({
    ...baseStatusInput,
    now: Date.parse("2030-09-11T12:00:00.000Z"),
  }), "event_completed");

  assert.equal(isRegistrationStatusTransitionAllowed("confirmed", "checked_in"), true);
  assert.equal(isRegistrationStatusTransitionAllowed("waitlisted", "confirmed"), true);
  assert.equal(isRegistrationStatusTransitionAllowed("cancelled", "confirmed"), false);
  assert.equal(isRegistrationStatusTransitionAllowed("attended", "waitlisted"), false);

  console.log(JSON.stringify({
    ok: true,
    suite: "registration-scheduler",
    deterministicJobId: firstJob.id,
    registrationStatusesChecked: 9,
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
