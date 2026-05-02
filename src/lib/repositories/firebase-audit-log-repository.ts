import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  firestoreCollectionNames,
  stripUndefinedDeep,
} from "@/lib/firebase/firestore";
import type { AuditLogRecord, CreateAuditLogInput } from "@/lib/types/directory";

export async function createAuditLogInFirebase(input: CreateAuditLogInput) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const record: AuditLogRecord = {
    id: randomUUID(),
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    actorId: input.actorId,
    actorType: input.actorType,
    before: input.before,
    after: input.after,
    note: input.note,
    createdAt: new Date().toISOString(),
  };

  await firestore
    .collection(firestoreCollectionNames.auditLogs)
    .doc(record.id)
    .set(stripUndefinedDeep(record));

  return record;
}

export async function listAuditLogsForEntity(entityType: string, entityId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.auditLogs)
    .where("entityType", "==", entityType)
    .where("entityId", "==", entityId)
    .get();

  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as AuditLogRecord);
}
