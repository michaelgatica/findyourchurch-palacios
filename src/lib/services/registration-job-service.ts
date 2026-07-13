import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames } from "@/lib/firebase/firestore";
import { hashRegistrationSecret } from "@/lib/registration-utils";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import { getEventByIdFromFirebase } from "@/lib/repositories/firebase-event-repository";
import {
  cancelPendingRegistrationJobsForEvent,
  claimRegistrationJob,
  completeRegistrationJob,
  failRegistrationJob,
  listDueRegistrationJobs,
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
import {
  sendEventCancellationToRegistrant,
  sendEventReminderToRegistrant,
} from "@/lib/services/registration-notification-service";
import type { EventRegistrationConfigurationRecord, RegistrationJobType, RegistrationScheduledJobRecord } from "@/lib/types/registrations";

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
    payload: input.payload ?? {},
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
  await Promise.all(jobs.map(saveRegistrationScheduledJob));
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
    const snapshot = await firestore.collection(collectionName).where("eventId", "==", eventId).get();
    for (let index = 0; index < snapshot.docs.length; index += 400) {
      const batch = firestore.batch();
      snapshot.docs.slice(index, index + 400).forEach((documentSnapshot) => batch.delete(documentSnapshot.ref));
      await batch.commit();
    }
    deletedRecords += snapshot.size;
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

async function processJob(job: RegistrationScheduledJobRecord) {
  if (job.type === "export_cleanup") {
    await Promise.all([
      cleanupExpiredRegistrationExports(),
      cleanupExpiredRegistrationAccessTokens(),
    ]);
    return;
  }
  if (!job.eventId || !job.churchId) throw new Error("Scheduled event job is missing event ownership.");
  const event = await getEventByIdFromFirebase(job.eventId);
  if (!event || event.churchId !== job.churchId) throw new Error("Scheduled event ownership could not be verified.");
  const actorUserId = typeof job.payload.actorUserId === "string" ? job.payload.actorUserId : "";

  if (job.type === "event_cancellation_notice") {
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
    return;
  }

  if (job.type === "event_reminder_notice") {
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
      return;
    }
    await sendEventReminderToRegistrant({ event, registration });
    return;
  }

  if (job.type === "registration_retention_cleanup") {
    await cleanupEventRegistrationData(job.eventId, job.churchId);
    return;
  }
  if (job.type === "event_reminder") {
    if (event.status !== "published" && event.status !== "unlisted") return;
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
    await Promise.all(reminderJobs.map(saveRegistrationScheduledJob));
    return;
  }
  if (job.type === "daily_digest") {
    if (!event.contactEmail) return;
    const counters = await getRegistrationCounters(job.eventId, job.churchId);
    await sendTransactionalEmail({
      to: event.contactEmail,
      subject: `Daily registration summary for ${event.title}`,
      body: [`Confirmed registrations: ${counters.confirmed}`, `Confirmed attendees: ${counters.confirmedAttendees}`, `Waitlisted registrations: ${counters.waitlisted}`, "", "Sensitive registration answers are not included in this digest."].join("\n"),
      relatedEntityType: "event",
      relatedEntityId: job.eventId,
    });
    const configuration = await getRegistrationConfiguration(job.eventId);
    if (configuration?.organizerDailyDigestEmail && new Date(event.startsAt).getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      await saveRegistrationScheduledJob(createRegistrationScheduledJobRecord({ eventId: job.eventId, churchId: job.churchId, type: "daily_digest", scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), payload: job.payload }));
    }
    return;
  }
  if ((job.type === "registration_closing_report" || job.type === "pre_event_report") && event.contactEmail && actorUserId) {
    const configuration = await getRegistrationConfiguration(job.eventId);
    const formats = configuration?.scheduledReportFormats?.length
      ? configuration.scheduledReportFormats
      : ["pdf" as const];
    await emailRegistrationExport({ eventId: job.eventId, churchId: job.churchId, actorUserId, recipients: [event.contactEmail], formats, reportType: "roster", selectedFieldIds: [], includeSensitive: false, orientation: "landscape" });
  }
}

export async function processRegistrationJobs(options: { dryRun?: boolean } = {}) {
  const dueJobs = await listDueRegistrationJobs();
  const summary = { due: dueJobs.length, completed: 0, failed: 0, skipped: 0, dryRun: options.dryRun ?? false };
  if (options.dryRun) return { ...summary, jobs: dueJobs.map((job) => ({ id: job.id, type: job.type, scheduledFor: job.scheduledFor })) };

  for (const dueJob of dueJobs) {
    const job = await claimRegistrationJob(dueJob.id);
    if (!job) { summary.skipped += 1; continue; }
    try {
      await processJob(job);
      await completeRegistrationJob(job.id);
      summary.completed += 1;
    } catch (error) {
      await failRegistrationJob(job.id, error instanceof Error ? error.message : String(error));
      summary.failed += 1;
    }
  }
  return summary;
}
