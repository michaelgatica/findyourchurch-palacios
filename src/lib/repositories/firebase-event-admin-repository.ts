import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { communityHubLimits } from "@/lib/community-hub-limits";
import {
  createSlug,
  firestoreCollectionNames,
  stripUndefinedDeep,
} from "@/lib/firebase/firestore";
import type {
  EventCategoryGroup,
  EventCategoryRecord,
  EventReportRecord,
  EventReportStatus,
  EventStatus,
} from "@/lib/types/events";

function firestoreOrThrow() {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  return firestore;
}

export interface AdminEventListFilters {
  keyword?: string;
  status?: EventStatus | "all";
  churchId?: string;
  city?: string;
  primaryType?: string;
  audienceTag?: string;
  registrationMode?: string;
  sort?: "startsAt_desc" | "startsAt_asc" | "updatedAt_desc" | "createdAt_desc";
  limit?: number;
  cursor?: string;
}

function matchesAdminEventLocalFilters(
  event: FirebaseFirestore.DocumentData,
  filters: AdminEventListFilters,
) {
  if (filters.keyword) {
    const normalizedKeyword = filters.keyword.trim().toLowerCase();
    const searchableValue = [
      event.title,
      event.summary,
      event.churchName,
      event.primaryType,
      ...(Array.isArray(event.audienceTags) ? event.audienceTags : []),
    ]
      .join(" ")
      .toLowerCase();

    if (!searchableValue.includes(normalizedKeyword)) return false;
  }

  if (filters.city) {
    const normalizedCity = filters.city.trim().toLowerCase();
    if (!String(event.address?.city ?? "").toLowerCase().includes(normalizedCity)) return false;
  }

  if (filters.registrationMode && event.registration?.mode !== filters.registrationMode) {
    return false;
  }

  return true;
}

export async function listAdminEventsFromFirebase(filters: AdminEventListFilters = {}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return { events: [], nextCursor: null };
  }

  let query: FirebaseFirestore.Query = firestore.collection(firestoreCollectionNames.events);

  if (filters.status && filters.status !== "all") {
    query = query.where("status", "==", filters.status);
  }

  if (filters.churchId) {
    query = query.where("churchId", "==", filters.churchId);
  }

  if (filters.primaryType) {
    query = query.where("primaryType", "==", filters.primaryType);
  }

  if (filters.audienceTag) {
    query = query.where("audienceTags", "array-contains", filters.audienceTag);
  }

  const sort = filters.sort ?? "startsAt_desc";
  if (sort === "startsAt_asc") query = query.orderBy("startsAt", "asc");
  if (sort === "startsAt_desc") query = query.orderBy("startsAt", "desc");
  if (sort === "updatedAt_desc") query = query.orderBy("updatedAt", "desc");
  if (sort === "createdAt_desc") query = query.orderBy("createdAt", "desc");

  if (filters.cursor) {
    const cursorSnapshot = await firestore
      .collection(firestoreCollectionNames.events)
      .doc(filters.cursor)
      .get();
    if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
  }

  const pageSize = Math.min(Math.max(filters.limit ?? 50, 1), 100);
  const hasLocalFilters = Boolean(filters.keyword || filters.city || filters.registrationMode);
  if (!hasLocalFilters) {
    const snapshot = await query.limit(pageSize + 1).get();
    const pageDocuments = snapshot.docs.slice(0, pageSize);
    return {
      events: pageDocuments.map((documentSnapshot) => documentSnapshot.data()),
      nextCursor: snapshot.docs.length > pageSize ? pageDocuments.at(-1)?.id ?? null : null,
    };
  }

  const matchingDocuments: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let scannedDocuments = 0;
  let lastScannedDocument: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let sourceExhausted = false;
  let scanQuery = query;

  while (
    matchingDocuments.length <= pageSize &&
    scannedDocuments < communityHubLimits.adminEventSearchScan
  ) {
    const batchSize = Math.min(
      pageSize,
      communityHubLimits.adminEventSearchScan - scannedDocuments,
    );
    const snapshot = await scanQuery.limit(batchSize).get();
    if (snapshot.empty) {
      sourceExhausted = true;
      break;
    }

    scannedDocuments += snapshot.docs.length;
    for (const documentSnapshot of snapshot.docs) {
      lastScannedDocument = documentSnapshot;
      if (matchesAdminEventLocalFilters(documentSnapshot.data(), filters)) {
        matchingDocuments.push(documentSnapshot);
        if (matchingDocuments.length > pageSize) break;
      }
    }

    if (matchingDocuments.length > pageSize) break;
    if (snapshot.docs.length < batchSize) {
      sourceExhausted = true;
      break;
    }
    scanQuery = query.startAfter(snapshot.docs.at(-1)!);
  }

  const pageDocuments = matchingDocuments.slice(0, pageSize);
  const nextCursor = matchingDocuments.length > pageSize
    ? pageDocuments.at(-1)?.id ?? null
    : !sourceExhausted && scannedDocuments >= communityHubLimits.adminEventSearchScan
      ? lastScannedDocument?.id ?? null
      : null;

  return {
    events: pageDocuments.map((documentSnapshot) => documentSnapshot.data()),
    nextCursor,
  };
}

export async function listEventCategoriesFromFirebase(group?: EventCategoryGroup | "all") {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  let query: FirebaseFirestore.Query = firestore.collection(firestoreCollectionNames.eventCategories);

  if (group && group !== "all") {
    query = query.where("group", "==", group);
  }

  const snapshot = await query.orderBy("sortOrder", "asc").limit(250).get();
  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as EventCategoryRecord);
}

export async function upsertEventCategoryInFirebase(input: {
  id?: string;
  key?: string;
  group: EventCategoryGroup;
  label: string;
  description?: string | null;
  icon?: string | null;
  sortOrder: number;
  isActive: boolean;
  isPrimary: boolean;
  actorUserId: string;
}) {
  const firestore = firestoreOrThrow();
  const now = new Date().toISOString();
  const id = input.id || randomUUID();
  const existing = input.id
    ? await firestore.collection(firestoreCollectionNames.eventCategories).doc(input.id).get()
    : null;
  const existingData = existing?.exists ? (existing.data() as EventCategoryRecord) : null;
  const key = existingData?.key ?? input.key ?? createSlug(input.label);
  const record: EventCategoryRecord = {
    id,
    key,
    group: input.group,
    label: input.label,
    description: input.description ?? null,
    icon: input.icon ?? null,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
    isPrimary: input.isPrimary,
    isSystem: existingData?.isSystem ?? false,
    createdAt: existingData?.createdAt ?? now,
    updatedAt: now,
    updatedByUserId: input.actorUserId,
  };

  await firestore.collection(firestoreCollectionNames.eventCategories).doc(id).set(stripUndefinedDeep(record));
  return record;
}

export async function createEventReportInFirebase(report: Omit<EventReportRecord, "id" | "createdAt" | "updatedAt" | "status">) {
  const firestore = firestoreOrThrow();
  const now = new Date().toISOString();
  const record: EventReportRecord = {
    ...report,
    id: randomUUID(),
    status: "new",
    createdAt: now,
    updatedAt: now,
  };

  await firestore.collection(firestoreCollectionNames.eventReports).doc(record.id).set(stripUndefinedDeep(record));
  return record;
}

export async function listEventReportsFromFirebase(input: {
  status?: EventReportStatus | "all";
  cursor?: string;
  limit?: number;
} = {}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return { reports: [], nextCursor: null };
  }

  let query: FirebaseFirestore.Query = firestore.collection(firestoreCollectionNames.eventReports);

  if (input.status && input.status !== "all") {
    query = query.where("status", "==", input.status);
  }

  query = query.orderBy("createdAt", "desc");
  if (input.cursor) {
    const cursorSnapshot = await firestore
      .collection(firestoreCollectionNames.eventReports)
      .doc(input.cursor)
      .get();
    if (cursorSnapshot.exists) query = query.startAfter(cursorSnapshot);
  }

  const pageSize = Math.min(Math.max(input.limit ?? 50, 1), 100);
  const snapshot = await query.limit(pageSize + 1).get();
  const pageDocuments = snapshot.docs.slice(0, pageSize);
  return {
    reports: pageDocuments.map(
      (documentSnapshot) => documentSnapshot.data() as EventReportRecord,
    ),
    nextCursor: snapshot.docs.length > pageSize ? pageDocuments.at(-1)?.id ?? null : null,
  };
}

export async function updateEventReportInFirebase(reportId: string, updates: Partial<EventReportRecord>) {
  const firestore = firestoreOrThrow();
  const payload = stripUndefinedDeep({
    ...updates,
    updatedAt: new Date().toISOString(),
  });

  await firestore.collection(firestoreCollectionNames.eventReports).doc(reportId).update(payload);
  const updated = await firestore.collection(firestoreCollectionNames.eventReports).doc(reportId).get();
  return updated.data() as EventReportRecord;
}
