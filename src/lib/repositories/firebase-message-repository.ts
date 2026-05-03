import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  firestoreCollectionNames,
  stripUndefinedDeep,
} from "@/lib/firebase/firestore";
import type { CreateMessageInput, MessageRecord } from "@/lib/types/directory";

export async function createMessageInFirebase(input: CreateMessageInput) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const createdAt = new Date().toISOString();
  const record: MessageRecord = {
    id: randomUUID(),
    churchId: input.churchId,
    submissionId: input.submissionId,
    claimRequestId: input.claimRequestId,
    updateRequestId: input.updateRequestId,
    senderId: input.senderId,
    senderType: input.senderType,
    messageBody: input.messageBody,
    isInternal: input.isInternal ?? false,
    createdAt,
  };

  await firestore
    .collection(firestoreCollectionNames.messages)
    .doc(record.id)
    .set(stripUndefinedDeep(record));

  return record;
}

export async function listMessagesForChurch(churchId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.messages)
    .where("churchId", "==", churchId)
    .get();

  return snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as MessageRecord)
    .sort((leftMessage, rightMessage) => leftMessage.createdAt.localeCompare(rightMessage.createdAt));
}

export async function listMessagesForSubmission(submissionId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.messages)
    .where("submissionId", "==", submissionId)
    .get();

  return snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as MessageRecord)
    .sort((leftMessage, rightMessage) => leftMessage.createdAt.localeCompare(rightMessage.createdAt));
}

export async function listMessagesForClaimRequest(claimRequestId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.messages)
    .where("claimRequestId", "==", claimRequestId)
    .get();

  return snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as MessageRecord)
    .sort((leftMessage, rightMessage) => leftMessage.createdAt.localeCompare(rightMessage.createdAt));
}

export async function listMessagesForUpdateRequest(updateRequestId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.messages)
    .where("updateRequestId", "==", updateRequestId)
    .get();

  return snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as MessageRecord)
    .sort((leftMessage, rightMessage) => leftMessage.createdAt.localeCompare(rightMessage.createdAt));
}
