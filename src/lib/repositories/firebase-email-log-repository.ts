import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames, stripUndefinedDeep } from "@/lib/firebase/firestore";
import type { EmailLogRecord } from "@/lib/types/directory";

export async function createEmailLogInFirebase(input: {
  to: string;
  from?: string;
  subject: string;
  bodyPreview: string;
  status: string;
  provider?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const record: EmailLogRecord = {
    id: randomUUID(),
    to: input.to,
    from: input.from,
    subject: input.subject,
    bodyPreview: input.bodyPreview,
    status: input.status,
    provider: input.provider,
    relatedEntityType: input.relatedEntityType,
    relatedEntityId: input.relatedEntityId,
    createdAt: new Date().toISOString(),
  };

  await firestore
    .collection(firestoreCollectionNames.emailLogs)
    .doc(record.id)
    .set(stripUndefinedDeep(record));

  return record;
}

export async function listEmailLogsForEntity(relatedEntityType: string, relatedEntityId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.emailLogs)
    .where("relatedEntityType", "==", relatedEntityType)
    .where("relatedEntityId", "==", relatedEntityId)
    .get();

  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as EmailLogRecord);
}
