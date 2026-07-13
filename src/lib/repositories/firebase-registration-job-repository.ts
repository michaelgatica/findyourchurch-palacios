import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames, stripUndefinedDeep } from "@/lib/firebase/firestore";
import type { RegistrationScheduledJobRecord } from "@/lib/types/registrations";

function collection() {
  const firestore = getFirebaseAdminFirestore();
  if (!firestore) throw new Error("Firebase Firestore is not configured.");
  return firestore.collection(firestoreCollectionNames.eventScheduledJobs);
}

export async function saveRegistrationScheduledJob(job: RegistrationScheduledJobRecord) {
  const reference = collection().doc(job.id);
  return reference.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists) {
      const existing = snapshot.data() as RegistrationScheduledJobRecord;
      if (existing.status !== "pending") {
        return existing;
      }
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
    }));
  await batch.commit();
}

export async function listDueRegistrationJobs(now = new Date().toISOString(), limit = 25) {
  const snapshot = await collection()
    .where("status", "==", "pending")
    .where("scheduledFor", "<=", now)
    .orderBy("scheduledFor", "asc")
    .limit(limit)
    .get();
  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as RegistrationScheduledJobRecord);
}

export async function claimRegistrationJob(jobId: string) {
  const reference = collection().doc(jobId);
  return reference.firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists) return null;
    const job = snapshot.data() as RegistrationScheduledJobRecord;
    if (job.status !== "pending") return null;
    const claimed = { ...job, status: "processing" as const, attempts: job.attempts + 1, updatedAt: new Date().toISOString() };
    transaction.set(reference, claimed);
    return claimed;
  });
}

export async function completeRegistrationJob(jobId: string) {
  await collection().doc(jobId).update({ status: "completed", completedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), errorMessage: null });
}

export async function failRegistrationJob(jobId: string, errorMessage: string) {
  await collection().doc(jobId).update({ status: "failed", updatedAt: new Date().toISOString(), errorMessage: errorMessage.slice(0, 500) });
}
