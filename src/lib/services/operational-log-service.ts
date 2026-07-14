import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames, stripUndefinedDeep } from "@/lib/firebase/firestore";

export type OperationalEventSeverity = "info" | "warning" | "error";

export interface CreateOperationalEventInput {
  type: string;
  severity: OperationalEventSeverity;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  correlationId?: string;
  summary: string;
  metadata?: Record<string, string | number | boolean | null>;
}

export async function createOperationalEvent(input: CreateOperationalEventInput) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const record = stripUndefinedDeep({
    id: randomUUID(),
    type: input.type,
    severity: input.severity,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    actorId: input.actorId ?? null,
    correlationId: input.correlationId ?? null,
    summary: input.summary,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  });

  await firestore.collection(firestoreCollectionNames.operationalEvents).doc(record.id).set(record);
  return record;
}

export async function listRecentOperationalEvents(limit = 25) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.operationalEvents)
    .orderBy("createdAt", "desc")
    .limit(Math.min(Math.max(limit, 1), 100))
    .get();

  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data());
}
