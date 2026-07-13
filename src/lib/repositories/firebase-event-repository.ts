import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames } from "@/lib/firebase/firestore";
import type { EventDocument, EventRecord } from "@/lib/types/events";

function mapEventDocumentToEventRecord(eventDocument: EventDocument): EventRecord {
  return {
    ...eventDocument,
  };
}

export async function getUpcomingPublishedEventsFromFirebase(limit = 12) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const now = new Date().toISOString();
  const snapshot = await firestore
    .collection(firestoreCollectionNames.events)
    .where("status", "==", "published")
    .where("startsAt", ">=", now)
    .orderBy("startsAt", "asc")
    .limit(limit)
    .get();

  return snapshot.docs.map((documentSnapshot) =>
    mapEventDocumentToEventRecord(documentSnapshot.data() as EventDocument),
  );
}

export async function getUpcomingPublishedEventsForChurchFromFirebase(
  churchId: string,
  limit = 6,
) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const now = new Date().toISOString();
  const snapshot = await firestore
    .collection(firestoreCollectionNames.events)
    .where("churchId", "==", churchId)
    .where("status", "==", "published")
    .where("startsAt", ">=", now)
    .orderBy("startsAt", "asc")
    .limit(limit)
    .get();

  return snapshot.docs.map((documentSnapshot) =>
    mapEventDocumentToEventRecord(documentSnapshot.data() as EventDocument),
  );
}

export async function getPublicEventBySlugFromFirebase(eventSlug: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.events)
    .where("slug", "==", eventSlug)
    .limit(1)
    .get();
  const eventDocument = snapshot.docs[0]?.data() as EventDocument | undefined;

  if (
    !eventDocument ||
    (eventDocument.status !== "published" && eventDocument.status !== "unlisted")
  ) {
    return null;
  }

  return mapEventDocumentToEventRecord(eventDocument);
}
