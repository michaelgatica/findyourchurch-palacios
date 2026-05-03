import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  firestoreCollectionNames,
  stripUndefinedDeep,
  toIsoString,
} from "@/lib/firebase/firestore";
import type {
  ChurchListingDraft,
  ChurchUpdateRequestRecord,
  ChurchUpdateRequestStatus,
} from "@/lib/types/directory";

function normalizeUpdateRequestRecord(record: ChurchUpdateRequestRecord) {
  return {
    ...record,
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(record.updatedAt) ?? new Date().toISOString(),
    approvedAt: toIsoString(record.approvedAt),
    deniedAt: toIsoString(record.deniedAt),
    requestedChangesAt: toIsoString(record.requestedChangesAt),
  };
}

export async function createChurchUpdateRequestInFirebase(input: {
  churchId: string;
  submittedByUserId: string;
  submittedByRepresentativeId: string;
  proposedChanges: ChurchListingDraft;
  status?: ChurchUpdateRequestStatus;
  source?: ChurchUpdateRequestRecord["source"];
  autoPublished?: boolean;
  reviewedBy?: string;
  approvedAt?: string | null;
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const now = new Date().toISOString();
  const record: ChurchUpdateRequestRecord = {
    id: randomUUID(),
    churchId: input.churchId,
    submittedByUserId: input.submittedByUserId,
    submittedByRepresentativeId: input.submittedByRepresentativeId,
    proposedChanges: input.proposedChanges,
    status: input.status ?? "pending_review",
    adminMessage: undefined,
    internalNotes: [],
    createdAt: now,
    updatedAt: now,
    approvedAt: input.approvedAt ?? null,
    deniedAt: null,
    requestedChangesAt: null,
    reviewedBy: input.reviewedBy,
    source: input.source ?? "church_portal",
    autoPublished: input.autoPublished ?? false,
  };

  await firestore
    .collection(firestoreCollectionNames.churchUpdateRequests)
    .doc(record.id)
    .set(stripUndefinedDeep(record));

  return record;
}

export async function getChurchUpdateRequestById(updateRequestId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const documentSnapshot = await firestore
    .collection(firestoreCollectionNames.churchUpdateRequests)
    .doc(updateRequestId)
    .get();

  if (!documentSnapshot.exists) {
    return null;
  }

  return normalizeUpdateRequestRecord(documentSnapshot.data() as ChurchUpdateRequestRecord);
}

export async function listChurchUpdateRequests(options?: {
  churchId?: string;
  status?: ChurchUpdateRequestStatus;
  submittedByUserId?: string;
  limit?: number;
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  let query: FirebaseFirestore.Query = firestore.collection(
    firestoreCollectionNames.churchUpdateRequests,
  );

  if (options?.churchId) {
    query = query.where("churchId", "==", options.churchId);
  }

  if (options?.status) {
    query = query.where("status", "==", options.status);
  }

  if (options?.submittedByUserId) {
    query = query.where("submittedByUserId", "==", options.submittedByUserId);
  }

  const snapshot = await query.get();
  const updateRequests = snapshot.docs
    .map((documentSnapshot) =>
      normalizeUpdateRequestRecord(documentSnapshot.data() as ChurchUpdateRequestRecord),
    )
    .sort((leftRequest, rightRequest) =>
      rightRequest.createdAt.localeCompare(leftRequest.createdAt),
    );

  if (options?.limit) {
    return updateRequests.slice(0, options.limit);
  }

  return updateRequests;
}

export async function updateChurchUpdateRequestInFirebase(
  updateRequestId: string,
  changes: Partial<ChurchUpdateRequestRecord>,
) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  await firestore
    .collection(firestoreCollectionNames.churchUpdateRequests)
    .doc(updateRequestId)
    .set(
      stripUndefinedDeep({
        ...changes,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true },
    );
}
