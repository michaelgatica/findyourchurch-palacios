import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  firestoreCollectionNames,
  stripUndefinedDeep,
} from "@/lib/firebase/firestore";
import type { AuditLogRecord, CreateAuditLogInput } from "@/lib/types/directory";
import { getRetentionExpiration, operationalRecordRetentionDays } from "@/lib/retention-policy";

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
    actorRole: input.actorRole,
    before: input.before,
    after: input.after,
    note: input.note,
    createdAt: new Date().toISOString(),
  };

  await firestore
    .collection(firestoreCollectionNames.auditLogs)
    .doc(record.id)
    .set({
      ...stripUndefinedDeep(record),
      retentionExpiresAt: getRetentionExpiration(operationalRecordRetentionDays.auditLogs),
    });

  return record;
}

export async function listRecentAuditLogs(limit = 20) {
  const firestore = getFirebaseAdminFirestore();
  if (!firestore) return [];
  const snapshot = await firestore
    .collection(firestoreCollectionNames.auditLogs)
    .orderBy("createdAt", "desc")
    .limit(Math.min(Math.max(limit, 1), 100))
    .get();
  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as AuditLogRecord);
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
    .limit(100)
    .get();

  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as AuditLogRecord);
}
