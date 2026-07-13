import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  createSlug,
  firestoreCollectionNames,
  stripUndefinedDeep,
} from "@/lib/firebase/firestore";
import type { EventDocument, EventRecord, EventStatus } from "@/lib/types/events";

function mapEventDocumentToEventRecord(eventDocument: EventDocument): EventRecord {
  return {
    ...eventDocument,
  };
}

function getFirestoreOrThrow() {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  return firestore;
}

function eventsCollection() {
  return getFirestoreOrThrow().collection(firestoreCollectionNames.events);
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
    .where("visibility", "==", "public")
    .where("startsAt", ">=", now)
    .orderBy("startsAt", "asc")
    .limit(limit)
    .get();

  return snapshot.docs.map((documentSnapshot) =>
    mapEventDocumentToEventRecord(documentSnapshot.data() as EventDocument),
  );
}

export async function listEventsForChurchFromFirebase(input: {
  churchId: string;
  status?: EventStatus | "all";
  limit?: number;
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  let query: FirebaseFirestore.Query = firestore
    .collection(firestoreCollectionNames.events)
    .where("churchId", "==", input.churchId);

  if (input.status && input.status !== "all") {
    query = query.where("status", "==", input.status);
  }

  const snapshot = await query.orderBy("startsAt", "desc").limit(input.limit ?? 25).get();

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
    .where("visibility", "==", "public")
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
    (eventDocument.status !== "published" &&
      eventDocument.status !== "unlisted" &&
      eventDocument.status !== "cancelled")
  ) {
    return null;
  }

  return mapEventDocumentToEventRecord(eventDocument);
}

export async function getEventByIdFromFirebase(eventId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const documentSnapshot = await firestore
    .collection(firestoreCollectionNames.events)
    .doc(eventId)
    .get();

  if (!documentSnapshot.exists) {
    return null;
  }

  return mapEventDocumentToEventRecord(documentSnapshot.data() as EventDocument);
}

export async function getEventBySlugFromFirebase(eventSlug: string) {
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
  return eventDocument ? mapEventDocumentToEventRecord(eventDocument) : null;
}

export async function createUniqueEventSlugFromFirebase(input: {
  title: string;
  eventId?: string;
}) {
  const baseSlug = createSlug(input.title).slice(0, 80) || "event";
  let candidateSlug = baseSlug;
  let suffix = 2;

  while (true) {
    const existingEvent = await getEventBySlugFromFirebase(candidateSlug);

    if (!existingEvent || existingEvent.id === input.eventId) {
      return candidateSlug;
    }

    candidateSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function saveEventToFirebase(event: EventRecord) {
  const collection = eventsCollection();
  const eventToSave: EventDocument = stripUndefinedDeep(event);

  await collection.doc(event.id).set(eventToSave);
  return mapEventDocumentToEventRecord(eventToSave);
}

export async function updateEventInFirebase(eventId: string, updates: Partial<EventRecord>) {
  const collection = eventsCollection();
  const updatedAt = new Date().toISOString();
  const updatePayload = stripUndefinedDeep({
    ...updates,
    updatedAt,
  });

  await collection.doc(eventId).update(updatePayload);
  const updatedEvent = await getEventByIdFromFirebase(eventId);

  if (!updatedEvent) {
    throw new Error("The event could not be found after updating.");
  }

  return updatedEvent;
}

export async function deleteEventFromFirebase(eventId: string) {
  await eventsCollection().doc(eventId).delete();
}
