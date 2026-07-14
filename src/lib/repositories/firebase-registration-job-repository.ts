import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames, stripUndefinedDeep } from "@/lib/firebase/firestore";
import {
  canClaimRegistrationJob,
  getRegistrationJobRetryDelayMs,
  isRegistrationJobLeaseExpired,
  registrationJobLeaseDurationMs,
  registrationJobMaximumAttempts,
  registrationJobRunLeaseDurationMs,
} from "@/lib/services/registration-job-policy";
import type { RegistrationScheduledJobRecord } from "@/lib/types/registrations";
import { getRetentionExpiration, operationalRecordRetentionDays } from "@/lib/retention-policy";

function jobRetentionExpiration(from = new Date()) {
  return getRetentionExpiration(operationalRecordRetentionDays.eventScheduledJobs, from);
}

function collection() {
  const firestore = getFirebaseAdminFirestore();
  if (!firestore) throw new Error("Firebase Firestore is not configured.");
  return firestore.collection(firestoreCollectionNames.eventScheduledJobs);
}

function lockCollection() {
  const firestore = getFirebaseAdminFirestore();
  if (!firestore) throw new Error("Firebase Firestore is not configured.");
  return firestore.collection(firestoreCollectionNames.operationalLocks);
}

export async function saveRegistrationScheduledJob(job: RegistrationScheduledJobRecord) {
  const reference = collection().doc(job.id);
  return reference.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists) {
      return snapshot.data() as RegistrationScheduledJobRecord;
    }
    transaction.set(reference, stripUndefinedDeep(job));
    return job;
  });
}

export async function cancelPendingRegistrationJobsForEvent(eventId: string) {
  const snapshot = await collection().where("eventId", "==", eventId).where("status", "==", "pending").get();
  const firestore = collection().firestore;
  const batch = firestore.batch();
  snapshot.docs
    .filter((documentSnapshot) => documentSnapshot.data().type !== "event_cancellation_notice")
    .forEach((documentSnapshot) => batch.update(documentSnapshot.ref, {
      status: "completed",
      completedAt: new Date().toISOString(),
      errorMessage: "Replaced by updated registration settings.",
      retentionExpiresAt: jobRetentionExpiration(),
    }));
  await batch.commit();
}

export async function listDueRegistrationJobs(now = new Date().toISOString(), limit = 25) {
  const [pendingSnapshot, processingSnapshot] = await Promise.all([
    collection()
      .where("status", "==", "pending")
      .where("scheduledFor", "<=", now)
      .orderBy("scheduledFor", "asc")
      .limit(limit)
      .get(),
    collection()
      .where("status", "==", "processing")
      .limit(limit)
      .get(),
  ]);
  const nowMs = Date.parse(now);
  const due = pendingSnapshot.docs.map(
    (documentSnapshot) => documentSnapshot.data() as RegistrationScheduledJobRecord,
  );
  const stale = processingSnapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as RegistrationScheduledJobRecord)
    .filter((job) => isRegistrationJobLeaseExpired(job, nowMs));

  return [...due, ...stale]
    .sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor))
    .slice(0, limit);
}

export async function claimRegistrationJob(
  jobId: string,
  runId: string,
  now = new Date(),
) {
  const reference = collection().doc(jobId);
  return reference.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return null;
    const job = snapshot.data() as RegistrationScheduledJobRecord;
    if (!canClaimRegistrationJob(job, now.getTime())) return null;
    const maximumAttempts = job.maxAttempts ?? registrationJobMaximumAttempts;
    if (job.attempts >= maximumAttempts) return null;
    const nowIso = now.toISOString();
    const claimed = {
      ...job,
      status: "processing" as const,
      attempts: job.attempts + 1,
      maxAttempts: maximumAttempts,
      correlationId: runId,
      leaseOwnerId: runId,
      leaseExpiresAt: new Date(now.getTime() + registrationJobLeaseDurationMs).toISOString(),
      lastAttemptAt: nowIso,
      nextAttemptAt: null,
      updatedAt: nowIso,
    };
    transaction.set(reference, claimed);
    return claimed;
  });
}

export async function completeRegistrationJob(jobId: string, runId: string) {
  const reference = collection().doc(jobId);
  return reference.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return false;
    const job = snapshot.data() as RegistrationScheduledJobRecord;
    if (job.status !== "processing" || job.leaseOwnerId !== runId) return false;
    const now = new Date().toISOString();
    transaction.update(reference, {
      status: "completed",
      completedAt: now,
      updatedAt: now,
      errorMessage: null,
      leaseOwnerId: null,
      leaseExpiresAt: null,
      retentionExpiresAt: jobRetentionExpiration(new Date(now)),
      nextAttemptAt: null,
    });
    return true;
  });
}

export async function listRecentRegistrationJobs(limit = 20) {
  const firestore = getFirebaseAdminFirestore();
  if (!firestore) return [];
  const snapshot = await firestore
    .collection(firestoreCollectionNames.eventScheduledJobs)
    .orderBy("updatedAt", "desc")
    .limit(Math.min(Math.max(limit, 1), 100))
    .get();
  return snapshot.docs.map(
    (documentSnapshot) => documentSnapshot.data() as RegistrationScheduledJobRecord,
  );
}

export async function markRegistrationJobDeliveryCompleted(
  jobId: string,
  runId: string,
  now = new Date(),
) {
  const reference = collection().doc(jobId);
  return reference.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return false;
    const job = snapshot.data() as RegistrationScheduledJobRecord;
    if (job.status !== "processing" || job.leaseOwnerId !== runId) return false;
    transaction.update(reference, {
      deliveryCompletedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    return true;
  });
}

export async function failRegistrationJob(
  jobId: string,
  runId: string,
  errorMessage: string,
  now = new Date(),
) {
  const reference = collection().doc(jobId);
  return reference.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return null;
    const job = snapshot.data() as RegistrationScheduledJobRecord;
    if (job.status !== "processing" || job.leaseOwnerId !== runId) return null;

    const maximumAttempts = job.maxAttempts ?? registrationJobMaximumAttempts;
    const retryScheduled = job.attempts < maximumAttempts;
    const nextAttemptAt = retryScheduled
      ? new Date(now.getTime() + getRegistrationJobRetryDelayMs(job.attempts)).toISOString()
      : null;
    const nowIso = now.toISOString();
    transaction.update(reference, {
      status: retryScheduled ? "pending" : "failed",
      scheduledFor: nextAttemptAt ?? job.scheduledFor,
      nextAttemptAt,
      lastFailedAt: nowIso,
      updatedAt: nowIso,
      errorMessage: errorMessage.slice(0, 500),
      leaseOwnerId: null,
      leaseExpiresAt: null,
      ...(!retryScheduled ? { retentionExpiresAt: jobRetentionExpiration(now) } : {}),
    });
    return {
      attempts: job.attempts,
      maximumAttempts,
      retryScheduled,
      terminal: !retryScheduled,
      nextAttemptAt,
    };
  });
}

export async function acquireRegistrationJobRunLease(
  runId: string,
  now = new Date(),
  leaseDurationMs = registrationJobRunLeaseDurationMs,
) {
  const reference = lockCollection().doc("registration-job-dispatcher");
  return reference.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const existing = snapshot.exists
      ? snapshot.data() as { ownerId?: string | null; expiresAt?: string | null }
      : null;
    const active = existing?.ownerId && existing.expiresAt && Date.parse(existing.expiresAt) > now.getTime();
    if (active && existing.ownerId !== runId) return false;

    transaction.set(reference, {
      ownerId: runId,
      acquiredAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + leaseDurationMs).toISOString(),
      releasedAt: null,
    }, { merge: true });
    return true;
  });
}

export async function releaseRegistrationJobRunLease(runId: string, now = new Date()) {
  const reference = lockCollection().doc("registration-job-dispatcher");
  return reference.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists || snapshot.data()?.ownerId !== runId) return false;
    const nowIso = now.toISOString();
    transaction.update(reference, {
      ownerId: null,
      expiresAt: nowIso,
      releasedAt: nowIso,
    });
    return true;
  });
}
