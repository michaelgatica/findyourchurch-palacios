import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  firestoreCollectionNames,
  stripUndefinedDeep,
  toIsoString,
} from "@/lib/firebase/firestore";
import type {
  OwnershipTransferRequestRecord,
  OwnershipTransferRequestStatus,
} from "@/lib/types/directory";

function normalizeOwnershipTransferRequest(record: OwnershipTransferRequestRecord) {
  return {
    ...record,
    createdAt: toIsoString(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(record.updatedAt) ?? new Date().toISOString(),
    approvedAt: toIsoString(record.approvedAt),
    deniedAt: toIsoString(record.deniedAt),
  };
}

export async function createOwnershipTransferRequestInFirebase(input: {
  churchId: string;
  requestedByUserId: string;
  requestedByRepresentativeId: string;
  currentOwnerRepresentativeId: string;
  newOwnerName: string;
  newOwnerEmail: string;
  newOwnerPhone?: string;
  newOwnerRoleTitle: string;
  reasonMessage: string;
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const now = new Date().toISOString();
  const record: OwnershipTransferRequestRecord = {
    id: randomUUID(),
    churchId: input.churchId,
    requestedByUserId: input.requestedByUserId,
    requestedByRepresentativeId: input.requestedByRepresentativeId,
    currentOwnerRepresentativeId: input.currentOwnerRepresentativeId,
    newOwnerName: input.newOwnerName,
    newOwnerEmail: input.newOwnerEmail,
    newOwnerPhone: input.newOwnerPhone,
    newOwnerRoleTitle: input.newOwnerRoleTitle,
    reasonMessage: input.reasonMessage,
    status: "pending_review",
    adminMessage: undefined,
    createdAt: now,
    updatedAt: now,
    approvedAt: null,
    deniedAt: null,
    reviewedBy: undefined,
  };

  await firestore
    .collection(firestoreCollectionNames.ownershipTransferRequests)
    .doc(record.id)
    .set(stripUndefinedDeep(record));

  return record;
}

export async function getOwnershipTransferRequestById(transferRequestId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const documentSnapshot = await firestore
    .collection(firestoreCollectionNames.ownershipTransferRequests)
    .doc(transferRequestId)
    .get();

  if (!documentSnapshot.exists) {
    return null;
  }

  return normalizeOwnershipTransferRequest(
    documentSnapshot.data() as OwnershipTransferRequestRecord,
  );
}

export async function listOwnershipTransferRequests(options?: {
  churchId?: string;
  status?: OwnershipTransferRequestStatus;
  requestedByUserId?: string;
  limit?: number;
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  let query: FirebaseFirestore.Query = firestore.collection(
    firestoreCollectionNames.ownershipTransferRequests,
  );

  if (options?.churchId) {
    query = query.where("churchId", "==", options.churchId);
  }

  if (options?.status) {
    query = query.where("status", "==", options.status);
  }

  if (options?.requestedByUserId) {
    query = query.where("requestedByUserId", "==", options.requestedByUserId);
  }

  const snapshot = await query.get();
  const transferRequests = snapshot.docs
    .map((documentSnapshot) =>
      normalizeOwnershipTransferRequest(
        documentSnapshot.data() as OwnershipTransferRequestRecord,
      ),
    )
    .sort((leftRequest, rightRequest) =>
      rightRequest.createdAt.localeCompare(leftRequest.createdAt),
    );

  if (options?.limit) {
    return transferRequests.slice(0, options.limit);
  }

  return transferRequests;
}

export async function updateOwnershipTransferRequestInFirebase(
  transferRequestId: string,
  changes: Partial<OwnershipTransferRequestRecord>,
) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  await firestore
    .collection(firestoreCollectionNames.ownershipTransferRequests)
    .doc(transferRequestId)
    .set(
      stripUndefinedDeep({
        ...changes,
        updatedAt: new Date().toISOString(),
      }),
      { merge: true },
    );
}
