import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames, stripUndefinedDeep } from "@/lib/firebase/firestore";
import type { EventExportRecord } from "@/lib/types/registrations";

function collection() {
  const firestore = getFirebaseAdminFirestore();
  if (!firestore) throw new Error("Firebase Firestore is not configured.");
  return firestore.collection(firestoreCollectionNames.eventExports);
}

export async function saveEventExportRecord(record: EventExportRecord) {
  await collection().doc(record.id).set(stripUndefinedDeep(record));
  return record;
}

export async function getEventExportRecord(exportId: string) {
  const snapshot = await collection().doc(exportId).get();
  return snapshot.exists ? snapshot.data() as EventExportRecord : null;
}

export async function updateEventExportRecord(exportId: string, updates: Partial<EventExportRecord>) {
  await collection().doc(exportId).update(stripUndefinedDeep(updates));
  return getEventExportRecord(exportId);
}

export async function listExpiredEventExports(now = new Date().toISOString(), limit = 100) {
  const snapshot = await collection()
    .where("expiresAt", "<=", now)
    .limit(Math.min(Math.max(limit, 1), 100))
    .get();
  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as EventExportRecord);
}

export async function deleteEventExportRecord(exportId: string) {
  await collection().doc(exportId).delete();
}
