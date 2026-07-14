import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  createSlug,
  firestoreCollectionNames,
  stripUndefinedDeep,
} from "@/lib/firebase/firestore";
import type {
  EventDocument,
  EventRecord,
  EventStatus,
  PublicEventRecord,
} from "@/lib/types/events";
import { communityHubLimits } from "@/lib/community-hub-limits";

function clampPublicQueryLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), 1), communityHubLimits.sitemapEvents);
}

function mapEventDocumentToEventRecord(eventDocument: EventDocument): EventRecord {
  return {
    ...eventDocument,
    wasPublished: eventDocument.wasPublished ?? Boolean(eventDocument.publishedAt),
  };
}

function mapPublicEventDocumentToEventRecord(eventDocument: PublicEventRecord): EventRecord {
  return {
    ...eventDocument,
    createdByUserId: null,
    createdByName: null,
    lastEditedByUserId: null,
    lastEditedByName: null,
    isRecurring: false,
    recurrenceRule: null,
    recurrenceExceptions: [],
    coHostDescription: null,
    createdAt: eventDocument.publishedAt,
    archivedAt: null,
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

function publicEventsCollection() {
  return getFirestoreOrThrow().collection(firestoreCollectionNames.publicEvents);
}

export function createPublicEventRecord(event: EventRecord): PublicEventRecord | null {
  if (
    !event.wasPublished ||
    !event.publishedAt ||
    (event.status !== "published" && event.status !== "unlisted" && event.status !== "cancelled")
  ) {
    return null;
  }

  return stripUndefinedDeep({
    id: event.id,
    churchId: event.churchId,
    churchName: event.churchName,
    churchSlug: event.churchSlug,
    churchRoutePath: event.churchRoutePath ?? null,
    title: event.title,
    slug: event.slug,
    summary: event.summary,
    description: event.description,
    primaryType: event.primaryType,
    audienceTags: event.audienceTags,
    customTags: event.customTags,
    status: event.status,
    visibility: event.visibility,
    wasPublished: true,
    isFeatured: event.isFeatured,
    flyerImage: event.flyerImage ?? null,
    additionalImages: event.additionalImages,
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? null,
    allDay: event.allDay,
    timeZone: event.timeZone,
    locationMode: event.locationMode,
    venueName: event.venueName ?? null,
    address: event.address ?? null,
    onlineUrl: event.onlineUrl ?? null,
    mapUrl: event.mapUrl ?? null,
    hostMinistry: event.hostMinistry ?? null,
    contactName: event.contactName ?? null,
    contactPhone: event.contactPhone ?? null,
    contactEmail: event.contactEmail ?? null,
    languages: event.languages,
    accessibilityDetails: event.accessibilityDetails ?? null,
    childcareProvided: event.childcareProvided,
    mealProvided: event.mealProvided,
    mealDetails: event.mealDetails ?? null,
    costStatus: event.costStatus,
    costDetails: event.costDetails ?? null,
    informationUrl: event.informationUrl ?? null,
    additionalInstructions: event.additionalInstructions ?? null,
    registration: {
      mode: event.registration.mode,
      opensAt: event.registration.opensAt ?? null,
      closesAt: event.registration.closesAt ?? null,
      capacity: event.registration.capacity ?? null,
      waitlistEnabled: event.registration.waitlistEnabled,
      externalRegistrationUrl: event.registration.externalRegistrationUrl ?? null,
      externalRegistrationLabel: event.registration.externalRegistrationLabel ?? null,
      setupEnabled: event.registration.setupEnabled ?? false,
    },
    cancellationMessage: event.cancellationMessage ?? null,
    publishedAt: event.publishedAt,
    updatedAt: event.updatedAt,
    cancelledAt: event.cancelledAt ?? null,
  });
}

export async function syncPublicEventFromFirebase(event: EventRecord) {
  const publicEvent = createPublicEventRecord(event);
  const reference = publicEventsCollection().doc(event.id);

  if (!publicEvent) {
    await reference.delete();
    return null;
  }

  await reference.set(publicEvent);
  return publicEvent;
}

export async function getUpcomingPublishedEventsFromFirebase(limit = 12) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const now = new Date().toISOString();
  const snapshot = await firestore
    .collection(firestoreCollectionNames.publicEvents)
    .where("status", "==", "published")
    .where("visibility", "==", "public")
    .where("wasPublished", "==", true)
    .where("startsAt", ">=", now)
    .orderBy("startsAt", "asc")
    .limit(clampPublicQueryLimit(limit))
    .get();

  return snapshot.docs.map((documentSnapshot) =>
    mapPublicEventDocumentToEventRecord(documentSnapshot.data() as PublicEventRecord),
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

  const snapshot = await query
    .orderBy("startsAt", "desc")
    .limit(Math.min(Math.max(input.limit ?? 25, 1), 100))
    .get();

  return snapshot.docs.map((documentSnapshot) =>
    mapPublicEventDocumentToEventRecord(documentSnapshot.data() as PublicEventRecord),
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
    .collection(firestoreCollectionNames.publicEvents)
    .where("churchId", "==", churchId)
    .where("status", "==", "published")
    .where("visibility", "==", "public")
    .where("wasPublished", "==", true)
    .where("startsAt", ">=", now)
    .orderBy("startsAt", "asc")
    .limit(clampPublicQueryLimit(limit))
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
    .collection(firestoreCollectionNames.publicEvents)
    .where("slug", "==", eventSlug)
    .limit(1)
    .get();
  const eventDocument = snapshot.docs[0]?.data() as PublicEventRecord | undefined;

  if (
    !eventDocument ||
    (eventDocument.status !== "published" &&
      eventDocument.status !== "unlisted" &&
      eventDocument.status !== "cancelled")
  ) {
    return null;
  }

  return mapPublicEventDocumentToEventRecord(eventDocument);
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
  const firestore = getFirestoreOrThrow();
  const batch = firestore.batch();
  batch.delete(eventsCollection().doc(eventId));
  batch.delete(publicEventsCollection().doc(eventId));
  await batch.commit();
}
