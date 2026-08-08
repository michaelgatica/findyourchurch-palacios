import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  firestoreCollectionNames,
  stripUndefinedDeep,
  toIsoString,
} from "@/lib/firebase/firestore";
import type {
  ChurchUpdateAiReview,
  ChurchUpdateAiReviewRecord,
} from "@/lib/types/directory";

function normalizeAiReviewRecord(record: ChurchUpdateAiReviewRecord) {
  return {
    ...record,
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(record.updatedAt) ?? new Date().toISOString(),
    requestedAt: toIsoString(record.requestedAt) ?? undefined,
    reviewedAt: toIsoString(record.reviewedAt) ?? undefined,
    notificationSentAt: toIsoString(record.notificationSentAt) ?? undefined,
  };
}

export async function queueChurchUpdateAiReviewInFirebase(input: {
  updateRequestId: string;
  churchId: string;
  mode: ChurchUpdateAiReview["mode"];
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const now = new Date().toISOString();
  const record: ChurchUpdateAiReviewRecord = {
    id: input.updateRequestId,
    updateRequestId: input.updateRequestId,
    churchId: input.churchId,
    status: "queued",
    mode: input.mode,
    requestedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  await firestore
    .collection(firestoreCollectionNames.churchUpdateAiReviews)
    .doc(record.id)
    .set(stripUndefinedDeep(record));

  return record;
}

export async function getChurchUpdateAiReviewByUpdateRequestId(updateRequestId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.churchUpdateAiReviews)
    .doc(updateRequestId)
    .get();

  return snapshot.exists
    ? normalizeAiReviewRecord(snapshot.data() as ChurchUpdateAiReviewRecord)
    : null;
}

export async function updateChurchUpdateAiReviewInFirebase(
  updateRequestId: string,
  changes: Partial<ChurchUpdateAiReview>,
) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  await firestore
    .collection(firestoreCollectionNames.churchUpdateAiReviews)
    .doc(updateRequestId)
    .set(
      stripUndefinedDeep({
        ...changes,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true },
    );
}

/** Claims an advisory review without modifying the representative-readable request. */
export async function claimQueuedChurchUpdateAiReviewInFirebase(updateRequestId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const documentReference = firestore
    .collection(firestoreCollectionNames.churchUpdateAiReviews)
    .doc(updateRequestId);

  return firestore.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(documentReference);

    if (!snapshot.exists) {
      return null;
    }

    const record = normalizeAiReviewRecord(snapshot.data() as ChurchUpdateAiReviewRecord);

    if (record.status !== "queued") {
      return null;
    }

    const claimedReview = {
      ...record,
      status: "processing" as const,
    };

    transaction.set(
      documentReference,
      stripUndefinedDeep({
        status: claimedReview.status,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true },
    );

    return claimedReview;
  });
}
