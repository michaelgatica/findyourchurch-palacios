import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  firestoreCollectionNames,
  stripUndefinedDeep,
  toIsoString,
} from "@/lib/firebase/firestore";
import type {
  ChurchClaimRequestRecord,
  ChurchClaimRequestStatus,
  CreateChurchClaimRequestInput,
} from "@/lib/types/directory";

export async function createChurchClaimRequestInFirebase(
  input: CreateChurchClaimRequestInput,
) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const claimRequestId = randomUUID();
  const createdAt = new Date().toISOString();
  const record: ChurchClaimRequestRecord = {
    id: claimRequestId,
    churchId: input.churchId,
    requesterUserId: input.requesterUserId,
    requesterName: input.requesterName,
    requesterEmail: input.requesterEmail,
    requesterPhone: input.requesterPhone,
    requesterRoleTitle: input.requesterRoleTitle,
    authorizationExplanation: input.authorizationExplanation,
    verifierName: input.verifierName,
    verifierRoleTitle: input.verifierRoleTitle,
    verifierPhone: input.verifierPhone,
    relationshipToChurch: input.authorizationExplanation,
    proofOrExplanation: input.authorizationExplanation,
    communicationConsentAcceptedAt: createdAt,
    termsAcceptedAt: createdAt,
    followUpEmailOptIn: input.followUpEmailOptIn,
    status: "pending_review",
    createdAt,
    updatedAt: createdAt,
  };

  await firestore
    .collection(firestoreCollectionNames.churchClaimRequests)
    .doc(claimRequestId)
    .set(stripUndefinedDeep(record));

  return record;
}

export async function getChurchClaimRequestById(claimRequestId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const documentSnapshot = await firestore
    .collection(firestoreCollectionNames.churchClaimRequests)
    .doc(claimRequestId)
    .get();

  if (!documentSnapshot.exists) {
    return null;
  }

  const data = documentSnapshot.data() as ChurchClaimRequestRecord;

  return {
    ...data,
    createdAt: toIsoString(data.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(data.updatedAt) ?? new Date().toISOString(),
    reviewedAt: toIsoString(data.reviewedAt),
  };
}

export async function listChurchClaimRequestsForChurch(churchId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.churchClaimRequests)
    .where("churchId", "==", churchId)
    .get();

  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as ChurchClaimRequestRecord);
}

export async function listChurchClaimRequests(options?: {
  status?: ChurchClaimRequestRecord["status"];
  limit?: number;
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  let query: FirebaseFirestore.Query = firestore.collection(
    firestoreCollectionNames.churchClaimRequests,
  );

  if (options?.status) {
    query = query.where("status", "==", options.status);
  }

  const snapshot = await query.get();
  const claimRequests = snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as ChurchClaimRequestRecord)
    .map((claimRequest) => ({
      ...claimRequest,
      createdAt: toIsoString(claimRequest.createdAt) ?? new Date().toISOString(),
      updatedAt: toIsoString(claimRequest.updatedAt) ?? new Date().toISOString(),
      reviewedAt: toIsoString(claimRequest.reviewedAt),
    }))
    .sort((leftClaimRequest, rightClaimRequest) =>
      rightClaimRequest.createdAt.localeCompare(leftClaimRequest.createdAt),
    );

  if (options?.limit) {
    return claimRequests.slice(0, options.limit);
  }

  return claimRequests;
}

export async function updateChurchClaimRequestStatus(
  claimRequestId: string,
  status: ChurchClaimRequestStatus,
  options?: {
    adminMessage?: string;
    reviewedBy?: string;
  },
) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const reviewedAt = new Date().toISOString();

  await firestore
    .collection(firestoreCollectionNames.churchClaimRequests)
    .doc(claimRequestId)
    .set(
      stripUndefinedDeep({
        status,
        adminMessage: options?.adminMessage,
        reviewedBy: options?.reviewedBy,
        reviewedAt,
        updatedAt: reviewedAt,
      }),
      { merge: true },
    );
}
