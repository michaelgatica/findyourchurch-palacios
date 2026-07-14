import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames } from "@/lib/firebase/firestore";
import { hashRegistrationSecret } from "@/lib/registration-utils";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import { getEventByIdFromFirebase } from "@/lib/repositories/firebase-event-repository";
import {
  acquireRegistrationJobRunLease,
  cancelPendingRegistrationJobsForEvent,
  claimRegistrationJob,
  completeRegistrationJob,
  failRegistrationJob,
  listDueRegistrationJobs,
  markRegistrationJobDeliveryCompleted,
  releaseRegistrationJobRunLease,
  saveRegistrationScheduledJob,
} from "@/lib/repositories/firebase-registration-job-repository";
import {
  getRegistrationConfiguration,
  getRegistrationCounters,
  getRegistrationById,
  cleanupExpiredRegistrationAccessTokens,
  listAllRegistrationsForEvent,
} from "@/lib/repositories/firebase-registration-repository";
import { cleanupExpiredRegistrationExports, emailRegistrationExport } from "@/lib/services/registration-export-service";
import { sendTransactionalEmail } from "@/lib/services/email-service";
import { createOperationalEvent } from "@/lib/services/operational-log-service";
import {
  sendEventCancellationToRegistrant,
  sendEventReminderToRegistrant,
} from "@/lib/services/registration-notification-service";
import type { EventRegistrationConfigurationRecord, RegistrationJobType, RegistrationScheduledJobRecord } from "@/lib/types/registrations";
import { communityHubLimits } from "@/lib/community-hub-limits";

async function runInBoundedBatches<T>(
  values: T[],
  operation: (value: T) => Promise<unknown>,
) {
  for (let index = 0; index < values.length; index += communityHubLimits.schedulerBatchSize) {
    await Promise.all(
      values
        .slice(index, index + communityHubLimits.schedulerBatchSize)
        .map(operation),
    );
  }
}

export function createRegistrationScheduledJobRecord(input: {
  eventId?: string | null;
  churchId?: string | null;
  type: RegistrationJobType;
  scheduledFor: string;
  payload?: Record<string, unknown>;
  idempotencySuffix?: string;
}): RegistrationScheduledJobRecord {
  const idempotencyKey = `${input.type}:${input.eventId ?? "global"}:${input.scheduledFor}:${input.idempotencySuffix ?? "default"}`;
  const now = new Date().toISOString();
  return {
    id: hashRegistrationSecret(idempotencyKey),
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
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    errorMessage: null,
  };
}

export async function scheduleEventCancellationNotifications(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
  cancelledAt: string;
}) {
  const registrations = await listAllRegistrationsForEvent(input.eventId);
  const recipients = registrations.filter(
    (registration) =>
      registration.status !== "cancelled" && Boolean(registration.contactEmail),
  );
  const jobs = recipients.map((registration) =>
    createRegistrationScheduledJobRecord({
      eventId: input.eventId,
      churchId: input.churchId,
      type: "event_cancellation_notice",
      scheduledFor: input.cancelledAt,
      idempotencySuffix: registration.id,
      payload: {
        actorUserId: input.actorUserId,
        registrationId: registration.id,
      },
    }),
  );
  await runInBoundedBatches(jobs, saveRegistrationScheduledJob);
  return jobs.length;
}

export async function scheduleRegistrationJobs(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
  configuration: EventRegistrationConfigurationRecord;
  eventStartsAt: string;
  eventEndsAt?: string | null;
}) {
  await cancelPendingRegistrationJobsForEvent(input.eventId);
  const jobs: RegistrationScheduledJobRecord[] = [];
  const eventStart = new Date(input.eventStartsAt).getTime();
  const eventEnd = new Date(input.eventEndsAt ?? input.eventStartsAt).getTime();
  const payload = { actorUserId: input.actorUserId };
  const settingsVersion = input.configuration.updatedAt;

  if (input.configuration.registrationClosingReportEnabled && input.configuration.closesAt) {
    jobs.push(createRegistrationScheduledJobRecord({ eventId: input.eventId, churchId: input.churchId, type: "registration_closing_report", scheduledFor: input.configuration.closesAt, payload, idempotencySuffix: settingsVersion }));
  }
  if (input.configuration.preEventReportEnabled && eventStart > Date.now() + 24 * 60 * 60 * 1000) {
    jobs.push(createRegistrationScheduledJobRecord({ eventId: input.eventId, churchId: input.churchId, type: "pre_event_report", scheduledFor: new Date(eventStart - 24 * 60 * 60 * 1000).toISOString(), payload, idempotencySuffix: settingsVersion }));
  }
  if (eventStart > Date.now() + 24 * 60 * 60 * 1000) {
    if (input.configuration.reminderEmailEnabled) {
      jobs.push(createRegistrationScheduledJobRecord({ eventId: input.eventId, churchId: input.churchId, type: "event_reminder", scheduledFor: new Date(eventStart - 24 * 60 * 60 * 1000).toISOString(), payload, idempotencySuffix: settingsVersion }));
    }
  }
  if (input.configuration.organizerDailyDigestEmail) {
    jobs.push(createRegistrationScheduledJobRecord({ eventId: input.eventId, churchId: input.churchId, type: "daily_digest", scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), payload, idempotencySuffix: settingsVersion }));
  }
  jobs.push(createRegistrationScheduledJobRecord({ eventId: input.eventId, churchId: input.churchId, type: "registration_retention_cleanup", scheduledFor: new Date(eventEnd + input.configuration.retentionDays * 24 * 60 * 60 * 1000).toISOString(), payload, idempotencySuffix: settingsVersion }));
  jobs.push(createRegistrationScheduledJobRecord({ type: "export_cleanup", scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() }));

  await Promise.all(jobs.map(saveRegistrationScheduledJob));
  return jobs;
}

async function cleanupEventRegistrationData(eventId: string, churchId: string) {
  const firestore = getFirebaseAdminFirestore();
  if (!firestore) throw new Error("Firebase Firestore is not configured.");
  const configuration = await getRegistrationConfiguration(eventId);
  const event = await getEventByIdFromFirebase(eventId);
  if (!configuration || !event || event.churchId !== churchId) throw new Error("Event retention settings could not be verified.");
  const retentionDate = new Date(event.endsAt ?? event.startsAt).getTime() + configuration.retentionDays * 24 * 60 * 60 * 1000;
  if (Date.now() < retentionDate) throw new Error("Registration data is not yet eligible for retention cleanup.");

  const collectionNames = [
    firestoreCollectionNames.eventRegistrations,
    firestoreCollectionNames.eventRegistrationTokens,
    firestoreCollectionNames.eventRegistrationConfirmations,
    firestoreCollectionNames.eventRegistrationIdempotency,
    firestoreCollectionNames.eventRegistrationRateLimits,
  ];
  let deletedRecords = 0;
  for (const collectionName of collectionNames) {
    while (true) {
      const snapshot = await firestore
        .collection(collectionName)
        .where("eventId", "==", eventId)
        .limit(communityHubLimits.cleanupBatchSize)
        .get();
      if (snapshot.empty) break;
      const batch = firestore.batch();
      snapshot.docs.forEach((documentSnapshot) => batch.delete(documentSnapshot.ref));
      await batch.commit();
      deletedRecords += snapshot.size;
    }
  }
  await firestore.collection(firestoreCollectionNames.eventRegistrationCounters).doc(eventId).delete();
  await createAuditLogInFirebase({
    entityType: "event",
    entityId: eventId,
    action: "registration_retention_cleanup_completed",
    actorType: "system",
    after: { churchId, deletedRecords, retentionDays: configuration.retentionDays },
    note: "Registration personal data removed after the configured retention period. Form definitions and minimal audit history remain.",
  });
  return deletedRecords;
}

type RegistrationJobOutcome = Record<string, string | number | boolean | null>;

async function processJob(job: RegistrationScheduledJobRecord, runId: string): Promise<RegistrationJobOutcome> {
  if (job.type === "export_cleanup") {
    const [exportsDeleted, tokensDeleted] = await Promise.all([
      cleanupExpiredRegistrationExports(),
      cleanupExpiredRegistrationAccessTokens(),
    ]);
    return { exportsDeleted, tokensDeleted };
  }
  if (!job.eventId || !job.churchId) throw new Error("Scheduled event job is missing event ownership.");
  const event = await getEventByIdFromFirebase(job.eventId);
  if (!event || event.churchId !== job.churchId) throw new Error("Scheduled event ownership could not be verified.");
  const actorUserId = typeof job.payload.actorUserId === "string" ? job.payload.actorUserId : "";

  if (job.type === "event_cancellation_notice") {
    if (job.deliveryCompletedAt) return { duplicateDeliverySuppressed: true };
    const registrationId = typeof job.payload.registrationId === "string"
      ? job.payload.registrationId
      : "";
    const registration = registrationId
      ? await getRegistrationById(registrationId)
      : null;
    if (
      !registration ||
      registration.eventId !== job.eventId ||
      registration.churchId !== job.churchId
    ) {
      throw new Error("The cancellation-notice registration could not be verified.");
    }
    await sendEventCancellationToRegistrant({ event, registration });
    await markRegistrationJobDeliveryCompleted(job.id, runId);
    return { deliveryRecorded: true };
  }

  if (job.type === "event_reminder_notice") {
    if (job.deliveryCompletedAt) return { duplicateDeliverySuppressed: true };
    const registrationId = typeof job.payload.registrationId === "string"
      ? job.payload.registrationId
      : "";
    const registration = registrationId ? await getRegistrationById(registrationId) : null;
    if (
      !registration ||
      registration.eventId !== job.eventId ||
      registration.churchId !== job.churchId ||
      !["confirmed", "checked_in"].includes(registration.status)
    ) {
      return { skippedIneligibleRegistration: true };
    }
    await sendEventReminderToRegistrant({ event, registration });
    await markRegistrationJobDeliveryCompleted(job.id, runId);
    return { deliveryRecorded: true };
  }

  if (job.type === "registration_retention_cleanup") {
    const recordsDeleted = await cleanupEventRegistrationData(job.eventId, job.churchId);
    return { recordsDeleted };
  }
  if (job.type === "event_reminder") {
    if (event.status !== "published" && event.status !== "unlisted") {
      return { skippedInactiveEvent: true };
    }
    const registrations = await listAllRegistrationsForEvent(job.eventId);
    const reminderJobs = registrations
      .filter((registration) =>
        ["confirmed", "checked_in"].includes(registration.status) &&
        Boolean(registration.contactEmail),
      )
      .map((registration) => createRegistrationScheduledJobRecord({
        eventId: job.eventId,
        churchId: job.churchId,
        type: "event_reminder_notice",
        scheduledFor: job.scheduledFor,
        idempotencySuffix: `${job.id}:${registration.id}`,
        payload: { ...job.payload, registrationId: registration.id },
      }));
    await runInBoundedBatches(reminderJobs, saveRegistrationScheduledJob);
    return { reminderJobsSelected: reminderJobs.length };
  }
  if (job.type === "daily_digest") {
    if (!event.contactEmail) return { skippedMissingRecipient: true };
    const counters = await getRegistrationCounters(job.eventId, job.churchId);
    if (!job.deliveryCompletedAt) {
      await sendTransactionalEmail({
        to: event.contactEmail,
        subject: `Daily registration summary for ${event.title}`,
        body: [`Confirmed registrations: ${counters.confirmed}`, `Confirmed attendees: ${counters.confirmedAttendees}`, `Waitlisted registrations: ${counters.waitlisted}`, "", "Sensitive registration answers are not included in this digest."].join("\n"),
        relatedEntityType: "event",
        relatedEntityId: job.eventId,
      });
    }
    const configuration = await getRegistrationConfiguration(job.eventId);
    if (configuration?.organizerDailyDigestEmail && new Date(event.startsAt).getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      const nextScheduledFor = new Date(Date.parse(job.scheduledFor) + 24 * 60 * 60 * 1000).toISOString();
      await saveRegistrationScheduledJob(createRegistrationScheduledJobRecord({ eventId: job.eventId, churchId: job.churchId, type: "daily_digest", scheduledFor: nextScheduledFor, payload: job.payload }));
    }
    if (!job.deliveryCompletedAt) await markRegistrationJobDeliveryCompleted(job.id, runId);
    return {
      deliveryRecorded: true,
      duplicateDeliverySuppressed: Boolean(job.deliveryCompletedAt),
      confirmedRegistrations: counters.confirmed,
      waitlistedRegistrations: counters.waitlisted,
    };
  }
  if ((job.type === "registration_closing_report" || job.type === "pre_event_report") && event.contactEmail && actorUserId) {
    if (job.deliveryCompletedAt) return { duplicateDeliverySuppressed: true };
    const configuration = await getRegistrationConfiguration(job.eventId);
    const formats = configuration?.scheduledReportFormats?.length
      ? configuration.scheduledReportFormats
      : ["pdf" as const];
    await emailRegistrationExport({ eventId: job.eventId, churchId: job.churchId, actorUserId, recipients: [event.contactEmail], formats, reportType: "roster", selectedFieldIds: [], includeSensitive: false, orientation: "landscape" });
    await markRegistrationJobDeliveryCompleted(job.id, runId);
    return { deliveryRecorded: true, attachmentCount: formats.length };
  }
  return { skippedMissingRecipientOrActor: true };
}

function getSafeJobErrorMessage(error: unknown) {
  const original = error instanceof Error ? error.message : String(error);
  const secrets = [
    process.env.REGISTRATION_JOBS_CRON_SECRET,
    process.env.SMTP_PASSWORD,
    process.env.SMTP_USER,
  ].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return secrets
    .reduce((message, secret) => message.replaceAll(secret, "[redacted]"), original)
    .replace(/[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+/g, "[redacted email]")
    .slice(0, 500);
}

async function logRegistrationJobEvent(input: Parameters<typeof createOperationalEvent>[0]) {
  try {
    await createOperationalEvent(input);
  } catch {
    console.warn("Registration scheduler operational logging failed; details were omitted.");
  }
}

export async function processRegistrationJobs(options: { dryRun?: boolean; correlationId?: string } = {}) {
  const runId = options.correlationId?.trim() || randomUUID();
  const dryRun = options.dryRun ?? false;
  const dueJobs = await listDueRegistrationJobs();
  const summary = {
    runId,
    due: dueJobs.length,
    completed: 0,
    failed: 0,
    retryScheduled: 0,
    terminalFailed: 0,
    skipped: 0,
    overlapSkipped: false,
    dryRun,
    jobs: [] as Array<{
      id: string;
      type: RegistrationJobType;
      status: string;
      attempts: number;
      outcome?: RegistrationJobOutcome;
    }>,
  };
  if (dryRun) {
    return {
      ...summary,
      jobs: dueJobs.map((job) => ({
        id: job.id,
        type: job.type,
        status: job.status,
        attempts: job.attempts,
      })),
    };
  }

  const acquiredLease = await acquireRegistrationJobRunLease(runId);
  if (!acquiredLease) {
    summary.overlapSkipped = true;
    await logRegistrationJobEvent({
      type: "registration_scheduler_overlap_skipped",
      severity: "warning",
      correlationId: runId,
      summary: "A registration scheduler run was skipped because another run held the lease.",
    });
    return summary;
  }

  await logRegistrationJobEvent({
    type: "registration_scheduler_started",
    severity: "info",
    correlationId: runId,
    summary: "The registration scheduler started.",
    metadata: { dueJobs: dueJobs.length },
  });

  try {
    for (const dueJob of dueJobs) {
      const job = await claimRegistrationJob(dueJob.id, runId);
      if (!job) {
        summary.skipped += 1;
        continue;
      }
      try {
        const outcome = await processJob(job, runId);
        const completed = await completeRegistrationJob(job.id, runId);
        if (!completed) {
          summary.skipped += 1;
          continue;
        }
        summary.completed += 1;
        summary.jobs.push({ id: job.id, type: job.type, status: "completed", attempts: job.attempts, outcome });
        await logRegistrationJobEvent({
          type: "registration_scheduler_job_completed",
          severity: "info",
          entityType: "registrationScheduledJob",
          entityId: job.id,
          correlationId: runId,
          summary: "A registration scheduler job completed.",
          metadata: { jobType: job.type, attempts: job.attempts, ...outcome },
        });
      } catch (error) {
        const safeError = getSafeJobErrorMessage(error);
        const failure = await failRegistrationJob(job.id, runId, safeError);
        summary.failed += 1;
        if (failure?.retryScheduled) summary.retryScheduled += 1;
        if (failure?.terminal) summary.terminalFailed += 1;
        summary.jobs.push({ id: job.id, type: job.type, status: failure?.retryScheduled ? "retry_scheduled" : "failed", attempts: job.attempts });
        await logRegistrationJobEvent({
          type: "registration_scheduler_job_failed",
          severity: failure?.terminal ? "error" : "warning",
          entityType: "registrationScheduledJob",
          entityId: job.id,
          correlationId: runId,
          summary: failure?.retryScheduled
            ? "A registration scheduler job failed and a retry was scheduled."
            : "A registration scheduler job reached its retry limit.",
          metadata: {
            jobType: job.type,
            attempts: job.attempts,
            retryScheduled: Boolean(failure?.retryScheduled),
            error: safeError,
          },
        });
      }
    }
  } finally {
    await releaseRegistrationJobRunLease(runId);
  }

  await logRegistrationJobEvent({
    type: "registration_scheduler_completed",
    severity: summary.terminalFailed > 0 ? "error" : summary.failed > 0 ? "warning" : "info",
    correlationId: runId,
    summary: "The registration scheduler run completed.",
    metadata: {
      due: summary.due,
      completed: summary.completed,
      failed: summary.failed,
      retryScheduled: summary.retryScheduled,
      terminalFailed: summary.terminalFailed,
      skipped: summary.skipped,
    },
  });
  return summary;
}
