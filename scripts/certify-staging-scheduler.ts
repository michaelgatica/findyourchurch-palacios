import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";

import { config as loadEnv } from "dotenv";

import { FirestoreRestClient, type FirestoreRestDocument } from "./lib/firestore-rest";

loadEnv({ path: ".env.staging.local" });

const stagingProjectId = "findyourchurch-staging-2026";
const stagingDatabaseId = "findyourchurchpal";
const stagingBucket = "findyourchurch-staging-2026.firebasestorage.app";
const baseUrl = "https://community-hub-staging--findyourchurch-staging-2026.us-central1.hosted.app";
const endpoint = `${baseUrl}/api/jobs/registration`;
const collections = {
  churches: "churches",
  churchRepresentatives: "churchRepresentatives",
  events: "events",
  eventRegistrationConfigurations: "eventRegistrationConfigurations",
  eventRegistrations: "eventRegistrations",
  eventRegistrationCounters: "eventRegistrationCounters",
  eventRegistrationTokens: "eventRegistrationTokens",
  eventRegistrationConfirmations: "eventRegistrationConfirmations",
  eventRegistrationIdempotency: "eventRegistrationIdempotency",
  eventRegistrationRateLimits: "eventRegistrationRateLimits",
  eventExports: "eventExports",
  eventScheduledJobs: "eventScheduledJobs",
  emailLogs: "emailLogs",
  operationalEvents: "operationalEvents",
} as const;

interface SchedulerResult {
  runId: string;
  due: number;
  completed: number;
  failed: number;
  retryScheduled: number;
  terminalFailed: number;
  skipped: number;
  overlapSkipped: boolean;
}

function createJobRecord(input: {
  eventId?: string | null;
  churchId?: string | null;
  type: string;
  scheduledFor: string;
  payload?: Record<string, unknown>;
  idempotencySuffix?: string;
}) {
  const idempotencyKey = `${input.type}:${input.eventId ?? "global"}:${input.scheduledFor}:${input.idempotencySuffix ?? "default"}`;
  const timestamp = new Date().toISOString();
  return {
    id: createHash("sha256").update(idempotencyKey).digest("hex"),
    eventId: input.eventId ?? null,
    churchId: input.churchId ?? null,
    type: input.type,
    status: "pending",
    scheduledFor: input.scheduledFor,
    idempotencyKey,
    attempts: 0,
    maxAttempts: 3,
    payload: input.payload ?? {},
    correlationId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    errorMessage: null,
  };
}

async function invokeScheduler(secret: string) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "x-cron-secret": secret,
      "x-fyc-environment": "staging",
      "user-agent": "FindYourChurch-Staging-Scheduler-Certification/1.0",
    },
  });
  const result = await response.json() as SchedulerResult;
  assert.equal([200, 202].includes(response.status), true, `Scheduler returned HTTP ${response.status}.`);
  assert.equal(Boolean(result.runId), true);
  return result;
}

async function countEmailLogs(client: FirestoreRestClient, entityIds: string[]) {
  const results = await Promise.all(
    entityIds.map((entityId) => client.query(collections.emailLogs, [{ field: "relatedEntityId", value: entityId }])),
  );
  return new Set(results.flat().map((document) => document.name)).size;
}

async function deleteDocuments(client: FirestoreRestClient, documents: FirestoreRestDocument[]) {
  await Promise.all(documents.map((document) => client.delete(
    document.name.split("/").at(-2) ?? "",
    document.id,
  )));
}

async function run() {
  assert.equal(process.env.APP_ENV, "staging");
  assert.equal(process.env.NEXT_PUBLIC_APP_ENV, "staging");
  assert.equal(process.env.FIREBASE_PROJECT_ID, stagingProjectId);
  assert.equal(process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, stagingProjectId);
  assert.equal(process.env.FIREBASE_DATABASE_ID, stagingDatabaseId);
  assert.notEqual(process.env.FIREBASE_PROJECT_ID, "findyourchurch-24562");
  assert.equal(new URL(baseUrl).hostname.includes(stagingProjectId), true);

  const schedulerSecret = process.env.REGISTRATION_JOBS_CRON_SECRET?.trim();
  const cloudAccessToken = process.env.FYC_STAGING_GCLOUD_ACCESS_TOKEN?.trim();
  assert.ok(schedulerSecret, "The scheduler secret must be supplied in process memory.");
  assert.ok(cloudAccessToken, "A staging Google Cloud access token must be supplied in process memory.");
  const firestore = new FirestoreRestClient(stagingProjectId, stagingDatabaseId, cloudAccessToken);

  const suffix = randomUUID().slice(0, 8);
  const activeEventId = `scheduler-cert-active-${suffix}`;
  const retentionEventId = `scheduler-cert-retention-${suffix}`;
  const activeRegistrationId = `scheduler-cert-registration-${suffix}`;
  const retentionRegistrationId = `scheduler-cert-retention-registration-${suffix}`;
  const expiredTokenId = `scheduler-cert-expired-token-${suffix}`;
  const expiredExportId = `scheduler-cert-expired-export-${suffix}`;
  const dueAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const createdAt = new Date().toISOString();
  const retentionFixtureCollections = [
    collections.eventRegistrationTokens,
    collections.eventRegistrationConfirmations,
    collections.eventRegistrationIdempotency,
    collections.eventRegistrationRateLimits,
  ] as const;
  const createdJobIds: string[] = [];

  const seedEvents = await firestore.query(collections.events, [
    { field: "slug", value: "staging-published-family-night" },
  ], 1);
  assert.equal(seedEvents.length, 1, "The staging seed event is required.");
  const seedEvent = seedEvents[0]!.data;
  const churchId = String(seedEvent.churchId);
  const churches = await firestore.query(collections.churches, [], 10);
  const otherChurch = churches.find((church) => church.id !== churchId);
  assert.ok(otherChurch, "A second fictitious staging church is required.");
  const representatives = await firestore.query(collections.churchRepresentatives, [
    { field: "churchId", value: churchId },
    { field: "status", value: "active" },
  ], 1);
  assert.equal(representatives.length, 1, "A staging Church A representative is required.");
  const actorUserId = String(representatives[0]!.data.userId);
  const seedConfiguration = await firestore.get(
    collections.eventRegistrationConfigurations,
    seedEvents[0]!.id,
  );
  assert.ok(seedConfiguration, "The staging registration configuration is required.");

  const activeEvent = {
    ...seedEvent,
    id: activeEventId,
    slug: activeEventId,
    title: "Scheduler Certification Event",
    contactEmail: "scheduler-certification@example.test",
    startsAt: "2030-09-10T23:00:00.000Z",
    endsAt: "2030-09-11T01:00:00.000Z",
    timeZone: "America/Chicago",
    status: "published",
    cancellationMessage: null,
    createdAt,
    updatedAt: createdAt,
  };
  const activeConfiguration = {
    ...seedConfiguration.data,
    eventId: activeEventId,
    churchId,
    organizerDailyDigestEmail: false,
    reminderEmailEnabled: true,
    registrationClosingReportEnabled: true,
    preEventReportEnabled: true,
    scheduledReportFormats: ["pdf", "xlsx"],
    activeFormVersionId: null,
    updatedAt: createdAt,
  };
  const activeRegistration = {
    id: activeRegistrationId,
    eventId: activeEventId,
    churchId,
    formVersionId: "scheduler-certification-form",
    formVersion: 1,
    formTitle: "Scheduler certification",
    confirmationNumber: `SC-${suffix}`,
    status: "confirmed",
    contactName: "Scheduler Test Registrant",
    contactNameNormalized: "scheduler test registrant",
    contactSearchPrefixes: ["s", "sc"],
    contactEmail: "scheduler-registrant@example.test",
    attendeeCount: 2,
    capacityUnits: 2,
    answers: {},
    answerLabels: {},
    source: "public",
    idempotencyKeyHash: `scheduler-certification-${suffix}`,
    submittedAt: createdAt,
    updatedAt: createdAt,
    cancelledAt: null,
  };
  const counters = {
    eventId: activeEventId,
    churchId,
    submitted: 1,
    confirmed: 1,
    waitlisted: 0,
    cancelled: 0,
    checkedIn: 0,
    attended: 0,
    noShow: 0,
    confirmedAttendees: 2,
    waitlistedAttendees: 0,
    updatedAt: createdAt,
  };
  const retentionEvent = {
    ...activeEvent,
    id: retentionEventId,
    slug: retentionEventId,
    title: "Scheduler Retention Certification Event",
    startsAt: "2020-01-01T18:00:00.000Z",
    endsAt: "2020-01-01T20:00:00.000Z",
    status: "completed",
  };
  const retentionConfiguration = {
    ...activeConfiguration,
    eventId: retentionEventId,
    retentionDays: 1,
  };
  const retentionRegistration = {
    ...activeRegistration,
    id: retentionRegistrationId,
    eventId: retentionEventId,
    confirmationNumber: `RT-${suffix}`,
  };

  try {
    await Promise.all([
      firestore.set(collections.events, activeEventId, activeEvent),
      firestore.set(collections.eventRegistrationConfigurations, activeEventId, activeConfiguration),
      firestore.set(collections.eventRegistrations, activeRegistrationId, activeRegistration),
      firestore.set(collections.eventRegistrationCounters, activeEventId, counters),
      firestore.set(collections.events, retentionEventId, retentionEvent),
      firestore.set(collections.eventRegistrationConfigurations, retentionEventId, retentionConfiguration),
      firestore.set(collections.eventRegistrations, retentionRegistrationId, retentionRegistration),
      firestore.set(collections.eventRegistrationCounters, retentionEventId, { ...counters, eventId: retentionEventId }),
      ...retentionFixtureCollections.map((collection) => firestore.set(collection, `${retentionEventId}-${collection}`, {
        id: `${retentionEventId}-${collection}`,
        eventId: retentionEventId,
        churchId,
        createdAt,
        expiresAt: "2020-01-02T00:00:00.000Z",
      })),
      firestore.set(collections.eventRegistrationTokens, expiredTokenId, {
        id: expiredTokenId,
        registrationId: activeRegistrationId,
        eventId: activeEventId,
        churchId,
        tokenHash: expiredTokenId,
        createdAt: "2020-01-01T00:00:00.000Z",
        expiresAt: "2020-01-02T00:00:00.000Z",
        revokedAt: null,
      }),
      firestore.set(collections.eventExports, expiredExportId, {
        id: expiredExportId,
        eventId: activeEventId,
        churchId,
        requestedByUserId: actorUserId,
        format: "pdf",
        reportType: "roster",
        storagePath: `private/events/${activeEventId}/exports/nonexistent-${suffix}.pdf`,
        contentType: "application/pdf",
        fileName: `expired-scheduler-certification-${suffix}.pdf`,
        createdAt: "2020-01-01T00:00:00.000Z",
        expiresAt: "2020-01-02T00:00:00.000Z",
        downloadedAt: null,
        emailedAt: null,
        correlationId: suffix,
      }),
    ]);

    const jobs = [
      createJobRecord({ eventId: activeEventId, churchId, type: "daily_digest", scheduledFor: dueAt, idempotencySuffix: suffix }),
      createJobRecord({ eventId: activeEventId, churchId, type: "event_reminder", scheduledFor: dueAt, idempotencySuffix: suffix }),
      createJobRecord({ eventId: activeEventId, churchId, type: "registration_closing_report", scheduledFor: dueAt, idempotencySuffix: suffix, payload: { actorUserId } }),
      createJobRecord({ type: "export_cleanup", scheduledFor: dueAt, idempotencySuffix: suffix }),
      createJobRecord({ eventId: retentionEventId, churchId, type: "registration_retention_cleanup", scheduledFor: dueAt, idempotencySuffix: suffix }),
      createJobRecord({ eventId: activeEventId, churchId: otherChurch.id, type: "daily_digest", scheduledFor: dueAt, idempotencySuffix: `cross-church-${suffix}` }),
    ];
    await Promise.all(jobs.map((job) => firestore.set(collections.eventScheduledJobs, job.id, job)));
    createdJobIds.push(...jobs.map((job) => job.id));
    const [digestJob, reminderJob, reportJob, cleanupJob, retentionJob, failureJob] = jobs;

    const competingRuns = await Promise.all(
      Array.from({ length: 4 }, () => invokeScheduler(schedulerSecret)),
    );
    const firstRun = competingRuns.find((result) => result.completed >= 5);
    const overlapRun = competingRuns.find((result) => result.overlapSkipped);
    assert.ok(firstRun, "One competing scheduler request must process the due jobs.");
    assert.ok(overlapRun, "One competing scheduler request must be rejected by the run lease.");
    assert.equal(firstRun.completed >= 5, true);
    assert.equal(firstRun.failed >= 1, true);
    assert.equal(firstRun.retryScheduled >= 1, true);
    for (const job of [digestJob, reminderJob, reportJob, cleanupJob, retentionJob]) {
      const snapshot = await firestore.get(collections.eventScheduledJobs, job.id);
      assert.equal(snapshot?.data.status, "completed", `${job.type} did not complete.`);
      assert.equal(Boolean(snapshot?.data.correlationId), true);
      assert.equal(snapshot?.data.attempts, 1);
    }
    const failedSnapshot = await firestore.get(collections.eventScheduledJobs, failureJob.id);
    assert.equal(failedSnapshot?.data.status, "pending");
    assert.equal(failedSnapshot?.data.attempts, 1);
    assert.equal(Boolean(failedSnapshot?.data.nextAttemptAt), true);
    assert.equal(await firestore.get(collections.eventRegistrationTokens, expiredTokenId), null);
    assert.equal(await firestore.get(collections.eventExports, expiredExportId), null);
    assert.equal(await firestore.get(collections.eventRegistrations, retentionRegistrationId), null);

    const secondRun = await invokeScheduler(schedulerSecret);
    assert.equal(secondRun.completed >= 1, true, "The generated reminder notice did not run.");
    const reminderJobs = await firestore.query(collections.eventScheduledJobs, [{ field: "eventId", value: activeEventId }]);
    const reminderNotice = reminderJobs.find((document) => document.data.type === "event_reminder_notice");
    assert.ok(reminderNotice, "The reminder fan-out job was not created.");
    assert.equal(reminderNotice.data.status, "completed");
    assert.equal(Boolean(reminderNotice.data.deliveryCompletedAt), true);

    const emailLogsBeforeDuplicateRun = await countEmailLogs(firestore, [activeEventId, activeRegistrationId]);
    const duplicateRun = await invokeScheduler(schedulerSecret);
    const emailLogsAfterDuplicateRun = await countEmailLogs(firestore, [activeEventId, activeRegistrationId]);
    assert.equal(duplicateRun.completed, 0);
    assert.equal(emailLogsAfterDuplicateRun, emailLogsBeforeDuplicateRun);

    await firestore.update(collections.eventScheduledJobs, failureJob.id, {
      churchId,
      scheduledFor: new Date(Date.now() - 1000).toISOString(),
      nextAttemptAt: new Date(Date.now() - 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const retryRun = await invokeScheduler(schedulerSecret);
    assert.equal(retryRun.completed >= 1, true);
    const recovered = await firestore.get(collections.eventScheduledJobs, failureJob.id);
    assert.equal(recovered?.data.status, "completed");
    assert.equal(recovered?.data.attempts, 2);
    assert.equal(Boolean(recovered?.data.deliveryCompletedAt), true);

    const runIds = [...competingRuns.map((result) => result.runId), secondRun.runId, duplicateRun.runId, retryRun.runId];
    const operationalLogs = (await Promise.all(runIds.map((runId) => firestore.query(
      collections.operationalEvents,
      [{ field: "correlationId", value: runId }],
    )))).flat();
    const operationalTypes = operationalLogs.map((document) => document.data.type);
    assert.equal(operationalTypes.includes("registration_scheduler_started"), true);
    assert.equal(operationalTypes.includes("registration_scheduler_completed"), true);
    assert.equal(operationalTypes.includes("registration_scheduler_job_failed"), true);
    assert.equal(
      operationalLogs.some((document) => /allergy|medical|emergency contact/i.test(JSON.stringify(document.data))),
      false,
    );

    const reportExports = await firestore.query(collections.eventExports, [{ field: "eventId", value: activeEventId }]);
    assert.equal(reportExports.some((document) => document.data.format === "pdf"), true);
    assert.equal(reportExports.some((document) => document.data.format === "xlsx"), true);

    console.log(JSON.stringify({
      ok: true,
      suite: "staging-scheduler-certification",
      endpoint,
      timeZone: activeEvent.timeZone,
      firstRun: { runId: firstRun.runId, completed: firstRun.completed, failed: firstRun.failed, retryScheduled: firstRun.retryScheduled },
      overlapRun: { runId: overlapRun.runId, overlapSkipped: overlapRun.overlapSkipped },
      reminderRun: { runId: secondRun.runId, completed: secondRun.completed },
      duplicateRun: { runId: duplicateRun.runId, completed: duplicateRun.completed, duplicateEmails: 0 },
      retryRun: { runId: retryRun.runId, completed: retryRun.completed, attempts: recovered?.data.attempts },
      jobsVerified: ["daily_digest", "event_reminder", "event_reminder_notice", "registration_closing_report", "export_cleanup", "registration_retention_cleanup"],
      expiredTokenCleanup: true,
      crossChurchIsolation: true,
      operationalLogging: true,
    }, null, 2));
  } finally {
    const [activeJobs, retentionJobs, activeExports] = await Promise.all([
      firestore.query(collections.eventScheduledJobs, [{ field: "eventId", value: activeEventId }]),
      firestore.query(collections.eventScheduledJobs, [{ field: "eventId", value: retentionEventId }]),
      firestore.query(collections.eventExports, [{ field: "eventId", value: activeEventId }]),
    ]);
    for (const exportDocument of activeExports) {
      const storagePath = typeof exportDocument.data.storagePath === "string"
        ? exportDocument.data.storagePath
        : "";
      if (storagePath) await firestore.deleteStorageObject(stagingBucket, storagePath);
    }
    await Promise.all([
      deleteDocuments(firestore, [...activeJobs, ...retentionJobs, ...activeExports]),
      ...createdJobIds.map((jobId) => firestore.delete(collections.eventScheduledJobs, jobId)),
      firestore.delete(collections.events, activeEventId),
      firestore.delete(collections.events, retentionEventId),
      firestore.delete(collections.eventRegistrationConfigurations, activeEventId),
      firestore.delete(collections.eventRegistrationConfigurations, retentionEventId),
      firestore.delete(collections.eventRegistrations, activeRegistrationId),
      firestore.delete(collections.eventRegistrations, retentionRegistrationId),
      firestore.delete(collections.eventRegistrationCounters, activeEventId),
      firestore.delete(collections.eventRegistrationCounters, retentionEventId),
      firestore.delete(collections.eventRegistrationTokens, expiredTokenId),
      firestore.delete(collections.eventExports, expiredExportId),
      ...retentionFixtureCollections.map((collection) => firestore.delete(collection, `${retentionEventId}-${collection}`)),
    ]);
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exitCode = 1;
});
