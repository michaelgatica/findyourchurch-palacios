import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames, stripUndefinedDeep } from "@/lib/firebase/firestore";
import {
  createRegistrationSearchPrefixes,
  normalizeRegistrationSearchText,
} from "@/lib/registration-utils";
import type {
  EventRegistrationConfigurationRecord,
  RegistrationAccessTokenRecord,
  RegistrationCounterRecord,
  RegistrationFormVersionRecord,
  RegistrationRecord,
  RegistrationStatus,
} from "@/lib/types/registrations";
import type { EventRecord } from "@/lib/types/events";
import { getDefaultRegistrationConfiguration } from "@/lib/validation/registration";
import { communityHubLimits } from "@/lib/community-hub-limits";

function getFirestoreOrThrow() {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  return firestore;
}

function normalizeStoredRegistrationConfiguration(
  record: EventRegistrationConfigurationRecord,
): EventRegistrationConfigurationRecord {
  const defaults = getDefaultRegistrationConfiguration({
    eventId: record.eventId,
    churchId: record.churchId,
    mode: record.mode,
    actorUserId: record.updatedByUserId,
    now: record.createdAt,
    opensAt: record.opensAt,
    closesAt: record.closesAt,
    capacity: record.capacity,
  });
  const definedRecord = Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined),
  ) as Partial<EventRegistrationConfigurationRecord>;

  return {
    ...defaults,
    ...definedRecord,
    scheduledReportFormats: Array.isArray(record.scheduledReportFormats)
      ? record.scheduledReportFormats.filter((format) => format === "pdf" || format === "xlsx")
      : defaults.scheduledReportFormats,
  };
}

function emptyCounters(eventId: string, churchId: string, now: string): RegistrationCounterRecord {
  return {
    eventId,
    churchId,
    submitted: 0,
    confirmed: 0,
    waitlisted: 0,
    cancelled: 0,
    checkedIn: 0,
    attended: 0,
    noShow: 0,
    confirmedAttendees: 0,
    waitlistedAttendees: 0,
    updatedAt: now,
  };
}

function statusContribution(status: RegistrationStatus, attendeeCount: number) {
  const isConfirmed = status === "confirmed" || status === "checked_in" || status === "attended" || status === "no_show";
  return {
    confirmed: isConfirmed ? 1 : 0,
    waitlisted: status === "waitlisted" ? 1 : 0,
    cancelled: status === "cancelled" ? 1 : 0,
    checkedIn: status === "checked_in" || status === "attended" ? 1 : 0,
    attended: status === "attended" ? 1 : 0,
    noShow: status === "no_show" ? 1 : 0,
    confirmedAttendees: isConfirmed ? attendeeCount : 0,
    waitlistedAttendees: status === "waitlisted" ? attendeeCount : 0,
  };
}

function applyStatusChange(
  counters: RegistrationCounterRecord,
  previousStatus: RegistrationStatus,
  nextStatus: RegistrationStatus,
  attendeeCount: number,
  now: string,
) {
  const previous = statusContribution(previousStatus, attendeeCount);
  const next = statusContribution(nextStatus, attendeeCount);

  return {
    ...counters,
    confirmed: Math.max(0, counters.confirmed - previous.confirmed + next.confirmed),
    waitlisted: Math.max(0, counters.waitlisted - previous.waitlisted + next.waitlisted),
    cancelled: Math.max(0, counters.cancelled - previous.cancelled + next.cancelled),
    checkedIn: Math.max(0, counters.checkedIn - previous.checkedIn + next.checkedIn),
    attended: Math.max(0, counters.attended - previous.attended + next.attended),
    noShow: Math.max(0, counters.noShow - previous.noShow + next.noShow),
    confirmedAttendees: Math.max(0, counters.confirmedAttendees - previous.confirmedAttendees + next.confirmedAttendees),
    waitlistedAttendees: Math.max(0, counters.waitlistedAttendees - previous.waitlistedAttendees + next.waitlistedAttendees),
    updatedAt: now,
  };
}

export async function getRegistrationConfiguration(eventId: string) {
  const snapshot = await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventRegistrationConfigurations)
    .doc(eventId)
    .get();
  return snapshot.exists
    ? normalizeStoredRegistrationConfiguration(
        snapshot.data() as EventRegistrationConfigurationRecord,
      )
    : null;
}

export async function saveRegistrationConfiguration(
  configuration: EventRegistrationConfigurationRecord,
) {
  await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventRegistrationConfigurations)
    .doc(configuration.eventId)
    .set(stripUndefinedDeep(configuration));
  return configuration;
}

export async function getRegistrationFormVersion(formVersionId: string) {
  const snapshot = await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventFormVersions)
    .doc(formVersionId)
    .get();
  return snapshot.exists ? (snapshot.data() as RegistrationFormVersionRecord) : null;
}

export async function listRegistrationFormVersions(eventId: string) {
  const snapshot = await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventFormVersions)
    .where("eventId", "==", eventId)
    .orderBy("version", "desc")
    .get();
  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as RegistrationFormVersionRecord);
}

export async function saveRegistrationFormVersion(formVersion: RegistrationFormVersionRecord) {
  await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventFormVersions)
    .doc(formVersion.id)
    .set(stripUndefinedDeep(formVersion));
  return formVersion;
}

export async function activateRegistrationFormVersion(input: {
  configuration: EventRegistrationConfigurationRecord;
  formVersion: RegistrationFormVersionRecord;
  previousActiveFormVersionId?: string | null;
}) {
  const firestore = getFirestoreOrThrow();
  const batch = firestore.batch();
  const formVersions = firestore.collection(firestoreCollectionNames.eventFormVersions);

  batch.set(formVersions.doc(input.formVersion.id), stripUndefinedDeep(input.formVersion));
  batch.set(
    firestore
      .collection(firestoreCollectionNames.eventRegistrationConfigurations)
      .doc(input.configuration.eventId),
    stripUndefinedDeep(input.configuration),
  );

  if (
    input.previousActiveFormVersionId &&
    input.previousActiveFormVersionId !== input.formVersion.id
  ) {
    batch.update(formVersions.doc(input.previousActiveFormVersionId), {
      status: "retired",
      retiredAt: input.formVersion.activatedAt ?? new Date().toISOString(),
    });
  }

  await batch.commit();
  return input.formVersion;
}

export async function countRegistrationsForFormVersion(formVersionId: string) {
  const snapshot = await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventRegistrations)
    .where("formVersionId", "==", formVersionId)
    .limit(1)
    .get();
  return snapshot.size;
}

export async function getRegistrationCounters(eventId: string, churchId?: string) {
  const snapshot = await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventRegistrationCounters)
    .doc(eventId)
    .get();
  return snapshot.exists
    ? (snapshot.data() as RegistrationCounterRecord)
    : emptyCounters(eventId, churchId ?? "", new Date().toISOString());
}

export async function getRegistrationById(registrationId: string) {
  const snapshot = await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventRegistrations)
    .doc(registrationId)
    .get();
  return snapshot.exists ? (snapshot.data() as RegistrationRecord) : null;
}

export async function getRegistrationByConfirmationNumber(confirmationNumber: string) {
  const firestore = getFirestoreOrThrow();
  const confirmationSnapshot = await firestore
    .collection(firestoreCollectionNames.eventRegistrationConfirmations)
    .doc(confirmationNumber)
    .get();
  const registrationId = confirmationSnapshot.data()?.registrationId;
  return typeof registrationId === "string" ? getRegistrationById(registrationId) : null;
}

export async function getRegistrationByTokenHash(tokenHash: string) {
  const firestore = getFirestoreOrThrow();
  const tokenSnapshot = await firestore
    .collection(firestoreCollectionNames.eventRegistrationTokens)
    .doc(tokenHash)
    .get();

  if (!tokenSnapshot.exists) {
    return null;
  }

  const token = tokenSnapshot.data() as RegistrationAccessTokenRecord;
  if (token.revokedAt || new Date(token.expiresAt).getTime() <= Date.now()) {
    return null;
  }

  const registration = await getRegistrationById(token.registrationId);
  return registration ? { registration, token } : null;
}

export async function saveRegistrationAccessToken(token: RegistrationAccessTokenRecord) {
  await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventRegistrationTokens)
    .doc(token.tokenHash)
    .set(stripUndefinedDeep(token));
  return token;
}

export async function markRegistrationAccessTokenUsed(tokenHash: string) {
  await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventRegistrationTokens)
    .doc(tokenHash)
    .update({ lastUsedAt: new Date().toISOString() });
}

export async function cleanupExpiredRegistrationAccessTokens(
  now = new Date().toISOString(),
  limit = 400,
) {
  const firestore = getFirestoreOrThrow();
  const snapshot = await firestore
    .collection(firestoreCollectionNames.eventRegistrationTokens)
    .where("expiresAt", "<=", now)
    .limit(Math.min(Math.max(limit, 1), 400))
    .get();

  if (snapshot.empty) {
    return 0;
  }

  const batch = firestore.batch();
  snapshot.docs.forEach((documentSnapshot) => batch.delete(documentSnapshot.ref));
  await batch.commit();
  return snapshot.size;
}

export async function listRegistrationsForEvent(input: {
  eventId: string;
  status?: RegistrationStatus | "all";
  statuses?: RegistrationStatus[];
  limit?: number;
  cursor?: string | null;
  direction?: "asc" | "desc";
  sortBy?: "submittedAt" | "contactNameNormalized";
}) {
  const firestore = getFirestoreOrThrow();
  let query: FirebaseFirestore.Query = firestore
    .collection(firestoreCollectionNames.eventRegistrations)
    .where("eventId", "==", input.eventId);

  if (input.statuses?.length) {
    query = query.where("status", "in", [...new Set(input.statuses)]);
  } else if (input.status && input.status !== "all") {
    query = query.where("status", "==", input.status);
  }

  query = query.orderBy(input.sortBy ?? "submittedAt", input.direction ?? "desc");

  if (input.cursor) {
    const cursorSnapshot = await firestore
      .collection(firestoreCollectionNames.eventRegistrations)
      .doc(input.cursor)
      .get();
    if (cursorSnapshot.exists) {
      query = query.startAfter(cursorSnapshot);
    }
  }

  const pageSize = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const snapshot = await query.limit(pageSize + 1).get();
  const documents = snapshot.docs.slice(0, pageSize);

  return {
    registrations: documents.map((documentSnapshot) => documentSnapshot.data() as RegistrationRecord),
    nextCursor: snapshot.docs.length > pageSize ? documents.at(-1)?.id ?? null : null,
  };
}

export async function findRegistrationsForEventByName(input: {
  eventId: string;
  search: string;
  status?: RegistrationStatus | "all";
  statuses?: RegistrationStatus[];
  cursor?: string | null;
  direction?: "asc" | "desc";
  limit?: number;
}) {
  const firestore = getFirestoreOrThrow();
  const confirmationSearch = input.search.trim().toUpperCase();
  if (/^FYC-[A-F0-9]{12}$/.test(confirmationSearch)) {
    const registration = await getRegistrationByConfirmationNumber(confirmationSearch);
    const matches = registration?.eventId === input.eventId &&
      (!input.statuses?.length || input.statuses.includes(registration.status)) &&
      (!input.status || input.status === "all" || registration.status === input.status);
    return {
      registrations: matches && registration ? [registration] : [],
      nextCursor: null,
    };
  }

  const normalizedSearch = normalizeRegistrationSearchText(input.search).slice(0, 40);
  if (normalizedSearch.length < 2) {
    return { registrations: [], nextCursor: null };
  }

  let query: FirebaseFirestore.Query = firestore
    .collection(firestoreCollectionNames.eventRegistrations)
    .where("eventId", "==", input.eventId)
    .where("contactSearchPrefixes", "array-contains", normalizedSearch);
  if (input.statuses?.length) {
    query = query.where("status", "in", [...new Set(input.statuses)]);
  } else if (input.status && input.status !== "all") {
    query = query.where("status", "==", input.status);
  }
  query = query.orderBy("submittedAt", input.direction ?? "desc");

  if (input.cursor) {
    const cursorSnapshot = await firestore
      .collection(firestoreCollectionNames.eventRegistrations)
      .doc(input.cursor)
      .get();
    if (cursorSnapshot.exists) {
      query = query.startAfter(cursorSnapshot);
    }
  }

  const pageSize = Math.min(Math.max(input.limit ?? 25, 1), 100);
  const snapshot = await query.limit(pageSize + 1).get();
  const documents = snapshot.docs.slice(0, pageSize);
  return {
    registrations: documents.map((documentSnapshot) => documentSnapshot.data() as RegistrationRecord),
    nextCursor: snapshot.docs.length > pageSize ? documents.at(-1)?.id ?? null : null,
  };
}

export async function listAllRegistrationsForEvent(eventId: string) {
  const snapshot = await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventRegistrations)
    .where("eventId", "==", eventId)
    .orderBy("submittedAt", "asc")
    .limit(communityHubLimits.registrationsPerExport + 1)
    .get();

  if (snapshot.size > communityHubLimits.registrationsPerExport) {
    throw new Error(
      `This operation supports up to ${communityHubLimits.registrationsPerExport.toLocaleString("en-US")} registrations at a time. Narrow or archive the event data before trying again.`,
    );
  }

  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as RegistrationRecord);
}

export async function createRegistrationAtomically(input: {
  registration: RegistrationRecord;
  accessToken: RegistrationAccessTokenRecord;
  idempotencyDocumentId: string;
  duplicateFingerprintDocumentId: string;
  rateLimitDocumentId: string;
  configuration: EventRegistrationConfigurationRecord;
  formVersion: RegistrationFormVersionRecord;
  now: string;
  rateLimitWindowMs: number;
  rateLimitMaximum: number;
  auditId: string;
}) {
  const firestore = getFirestoreOrThrow();
  const registrations = firestore.collection(firestoreCollectionNames.eventRegistrations);
  const counters = firestore.collection(firestoreCollectionNames.eventRegistrationCounters);
  const tokens = firestore.collection(firestoreCollectionNames.eventRegistrationTokens);
  const confirmations = firestore.collection(firestoreCollectionNames.eventRegistrationConfirmations);
  const idempotency = firestore.collection(firestoreCollectionNames.eventRegistrationIdempotency);
    const rateLimits = firestore.collection(firestoreCollectionNames.eventRegistrationRateLimits);
  const auditLogs = firestore.collection(firestoreCollectionNames.auditLogs);

  return firestore.runTransaction(async (transaction) => {
    const registrationReference = registrations.doc(input.registration.id);
    const counterReference = counters.doc(input.registration.eventId);
    const tokenReference = tokens.doc(input.accessToken.tokenHash);
    const confirmationReference = confirmations.doc(input.registration.confirmationNumber);
    const idempotencyReference = idempotency.doc(input.idempotencyDocumentId);
    const duplicateFingerprintReference = idempotency.doc(input.duplicateFingerprintDocumentId);
    const rateLimitReference = rateLimits.doc(input.rateLimitDocumentId);
    const configurationReference = firestore
      .collection(firestoreCollectionNames.eventRegistrationConfigurations)
      .doc(input.registration.eventId);
    const formVersionReference = firestore
      .collection(firestoreCollectionNames.eventFormVersions)
      .doc(input.registration.formVersionId);
    const eventReference = firestore
      .collection(firestoreCollectionNames.events)
      .doc(input.registration.eventId);

    const [
      idempotencySnapshot,
      duplicateFingerprintSnapshot,
      rateLimitSnapshot,
      counterSnapshot,
      confirmationSnapshot,
      configurationSnapshot,
      formVersionSnapshot,
      eventSnapshot,
    ] = await Promise.all([
      transaction.get(idempotencyReference),
      transaction.get(duplicateFingerprintReference),
      transaction.get(rateLimitReference),
      transaction.get(counterReference),
      transaction.get(confirmationReference),
      transaction.get(configurationReference),
      transaction.get(formVersionReference),
      transaction.get(eventReference),
    ]);

    if (idempotencySnapshot.exists) {
      const existingRegistrationId = idempotencySnapshot.data()?.registrationId;
      const existingRegistrationSnapshot = typeof existingRegistrationId === "string"
        ? await transaction.get(registrations.doc(existingRegistrationId))
        : null;
      if (existingRegistrationSnapshot?.exists) {
        return {
          registration: existingRegistrationSnapshot.data() as RegistrationRecord,
          duplicate: true,
        };
      }
    }

    if (
      duplicateFingerprintSnapshot.exists &&
      new Date(duplicateFingerprintSnapshot.data()?.expiresAt ?? 0).getTime() > Date.parse(input.now)
    ) {
      const existingRegistrationId = duplicateFingerprintSnapshot.data()?.registrationId;
      const existingRegistrationSnapshot = typeof existingRegistrationId === "string"
        ? await transaction.get(registrations.doc(existingRegistrationId))
        : null;
      if (existingRegistrationSnapshot?.exists) {
        return {
          registration: existingRegistrationSnapshot.data() as RegistrationRecord,
          duplicate: true,
        };
      }
    }

    const rateLimitData = rateLimitSnapshot.data() as { windowStartedAt?: string; count?: number } | undefined;
    const windowStartedAt = rateLimitData?.windowStartedAt
      ? new Date(rateLimitData.windowStartedAt).getTime()
      : 0;
    const withinWindow = Date.parse(input.now) - windowStartedAt < input.rateLimitWindowMs;
    const rateLimitCount = withinWindow ? Number(rateLimitData?.count ?? 0) : 0;

    if (rateLimitCount >= input.rateLimitMaximum) {
      throw new Error("Too many registration attempts were received. Please wait and try again.");
    }

    const currentConfiguration = configurationSnapshot.data() as EventRegistrationConfigurationRecord | undefined;
    const currentFormVersion = formVersionSnapshot.data() as RegistrationFormVersionRecord | undefined;
    const currentEvent = eventSnapshot.data() as EventRecord | undefined;
    if (!currentConfiguration || currentConfiguration.activeFormVersionId !== input.formVersion.id) {
      throw new Error("The registration form changed. Refresh the page before submitting.");
    }
    if (!currentFormVersion || currentFormVersion.status !== "active") {
      throw new Error("The registration form is not active.");
    }
    if (confirmationSnapshot.exists) {
      throw new Error("Unable to create a unique confirmation number. Please try again.");
    }
    if (
      !currentEvent ||
      currentEvent.churchId !== input.registration.churchId ||
      (currentEvent.status !== "published" && currentEvent.status !== "unlisted") ||
      (currentConfiguration.mode !== "simple_rsvp" && currentConfiguration.mode !== "internal_custom")
    ) {
      throw new Error("Registration is not available for this event.");
    }

    const currentTime = Date.parse(input.now);
    const eventEndTime = new Date(currentEvent.endsAt ?? currentEvent.startsAt).getTime();
    if (
      eventEndTime <= currentTime ||
      (currentConfiguration.opensAt && new Date(currentConfiguration.opensAt).getTime() > currentTime) ||
      (currentConfiguration.closesAt && new Date(currentConfiguration.closesAt).getTime() <= currentTime)
    ) {
      throw new Error(currentConfiguration.closedMessage || "Registration is closed for this event.");
    }

    const currentCounters = counterSnapshot.exists
      ? (counterSnapshot.data() as RegistrationCounterRecord)
      : emptyCounters(input.registration.eventId, input.registration.churchId, input.now);
    const confirmedCapacityUsed = currentConfiguration.capacityUnit === "registrations"
      ? currentCounters.confirmed
      : currentCounters.confirmedAttendees;
    const requestedCapacity = currentConfiguration.capacityUnit === "registrations"
      ? 1
      : input.registration.attendeeCount;
    const capacityAvailable = currentConfiguration.capacity === null || currentConfiguration.capacity === undefined ||
      confirmedCapacityUsed + requestedCapacity <= currentConfiguration.capacity;
    const waitlistUsed = currentConfiguration.capacityUnit === "registrations"
      ? currentCounters.waitlisted
      : currentCounters.waitlistedAttendees;
    const waitlistAvailable = currentConfiguration.waitlistEnabled &&
      (currentConfiguration.waitlistCapacity === null || currentConfiguration.waitlistCapacity === undefined ||
        waitlistUsed + requestedCapacity <= currentConfiguration.waitlistCapacity);

    let status: RegistrationStatus;
    if (capacityAvailable) {
      status = "confirmed";
    } else if (waitlistAvailable) {
      status = "waitlisted";
    } else {
      throw new Error(currentConfiguration.waitlistEnabled
        ? "The event and its waitlist are full."
        : "The event is full.");
    }

    const registration = { ...input.registration, status };
    const contribution = statusContribution(status, registration.attendeeCount);
    const nextCounters: RegistrationCounterRecord = {
      ...currentCounters,
      submitted: currentCounters.submitted + 1,
      confirmed: currentCounters.confirmed + contribution.confirmed,
      waitlisted: currentCounters.waitlisted + contribution.waitlisted,
      cancelled: currentCounters.cancelled + contribution.cancelled,
      checkedIn: currentCounters.checkedIn + contribution.checkedIn,
      attended: currentCounters.attended + contribution.attended,
      noShow: currentCounters.noShow + contribution.noShow,
      confirmedAttendees: currentCounters.confirmedAttendees + contribution.confirmedAttendees,
      waitlistedAttendees: currentCounters.waitlistedAttendees + contribution.waitlistedAttendees,
      updatedAt: input.now,
    };

    transaction.set(registrationReference, stripUndefinedDeep(registration));
    transaction.set(counterReference, nextCounters);
    transaction.set(tokenReference, stripUndefinedDeep(input.accessToken));
    transaction.set(confirmationReference, {
      registrationId: registration.id,
      eventId: registration.eventId,
      churchId: registration.churchId,
      createdAt: input.now,
    });
    transaction.set(idempotencyReference, {
      registrationId: registration.id,
      eventId: registration.eventId,
      createdAt: input.now,
      expiresAt: new Date(Date.parse(input.now) + 24 * 60 * 60 * 1000).toISOString(),
    });
    transaction.set(duplicateFingerprintReference, {
      registrationId: registration.id,
      eventId: registration.eventId,
      createdAt: input.now,
      expiresAt: new Date(Date.parse(input.now) + 90 * 1000).toISOString(),
    });
    transaction.set(rateLimitReference, {
      eventId: registration.eventId,
      churchId: registration.churchId,
      windowStartedAt: withinWindow ? rateLimitData?.windowStartedAt ?? input.now : input.now,
      count: rateLimitCount + 1,
      updatedAt: input.now,
    });
    transaction.set(auditLogs.doc(input.auditId), {
      id: input.auditId,
      entityType: "eventRegistration",
      entityId: registration.id,
      action: status === "waitlisted" ? "registration_waitlisted" : "registration_created",
      actorType: "public_registrant",
      after: {
        eventId: registration.eventId,
        churchId: registration.churchId,
        status,
        attendeeCount: registration.attendeeCount,
        formVersion: registration.formVersion,
      },
      note: "Public registration accepted through the server-validated event form.",
      createdAt: input.now,
    });

    return { registration, duplicate: false };
  });
}

export async function updateRegistrationStatusAtomically(input: {
  registrationId: string;
  churchId: string;
  eventId: string;
  nextStatus: RegistrationStatus;
  actorUserId: string;
  now?: string;
}) {
  const firestore = getFirestoreOrThrow();
  const now = input.now ?? new Date().toISOString();
  const registrationReference = firestore
    .collection(firestoreCollectionNames.eventRegistrations)
    .doc(input.registrationId);
  const counterReference = firestore
    .collection(firestoreCollectionNames.eventRegistrationCounters)
    .doc(input.eventId);
  const configurationReference = firestore
    .collection(firestoreCollectionNames.eventRegistrationConfigurations)
    .doc(input.eventId);

  return firestore.runTransaction(async (transaction) => {
    const [registrationSnapshot, counterSnapshot, configurationSnapshot] = await Promise.all([
      transaction.get(registrationReference),
      transaction.get(counterReference),
      transaction.get(configurationReference),
    ]);
    if (!registrationSnapshot.exists) {
      throw new Error("The registration could not be found.");
    }

    const registration = registrationSnapshot.data() as RegistrationRecord;
    if (registration.churchId !== input.churchId || registration.eventId !== input.eventId) {
      throw new Error("The registration does not belong to this event.");
    }

    const currentCounters = counterSnapshot.exists
      ? (counterSnapshot.data() as RegistrationCounterRecord)
      : emptyCounters(input.eventId, input.churchId, now);
    const configuration = configurationSnapshot.data() as EventRegistrationConfigurationRecord | undefined;
    if (input.nextStatus === "waitlisted") {
      if (!configuration?.waitlistEnabled) {
        throw new Error("The waitlist is not enabled for this event.");
      }
      const requestedCapacity = configuration.capacityUnit === "registrations"
        ? 1
        : registration.attendeeCount;
      const waitlistUsed = configuration.capacityUnit === "registrations"
        ? currentCounters.waitlisted
        : currentCounters.waitlistedAttendees;
      if (
        configuration.waitlistCapacity !== null &&
        configuration.waitlistCapacity !== undefined &&
        waitlistUsed + requestedCapacity > configuration.waitlistCapacity
      ) {
        throw new Error("The waitlist does not have enough remaining capacity.");
      }
    }
    const nextCounters = applyStatusChange(
      currentCounters,
      registration.status,
      input.nextStatus,
      registration.attendeeCount,
      now,
    );
    const updatedRegistration: RegistrationRecord = {
      ...registration,
      status: input.nextStatus,
      updatedAt: now,
      lastEditedByUserId: input.actorUserId,
      cancelledAt: input.nextStatus === "cancelled" ? now : registration.cancelledAt ?? null,
      checkedInAt: input.nextStatus === "checked_in" ? now : registration.checkedInAt ?? null,
      attendedAt: input.nextStatus === "attended" ? now : registration.attendedAt ?? null,
      noShowAt: input.nextStatus === "no_show" ? now : registration.noShowAt ?? null,
    };

    transaction.set(registrationReference, stripUndefinedDeep(updatedRegistration));
    transaction.set(counterReference, nextCounters);
    return updatedRegistration;
  });
}

export async function updateRegistrationRecord(
  registrationId: string,
  updates: Partial<RegistrationRecord>,
) {
  const reference = getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventRegistrations)
    .doc(registrationId);
  await reference.update(stripUndefinedDeep({ ...updates, updatedAt: new Date().toISOString() }));
  return getRegistrationById(registrationId);
}

export async function updateRegistrationAnswersAtomically(input: {
  registrationId: string;
  answers: RegistrationRecord["answers"];
  answerLabels: RegistrationRecord["answerLabels"];
  contactName: string;
  contactEmail?: string | null;
  contactPhone?: string | null;
  attendeeCount: number;
  actorUserId?: string | null;
  now?: string;
}) {
  const firestore = getFirestoreOrThrow();
  const now = input.now ?? new Date().toISOString();
  const registrationReference = firestore
    .collection(firestoreCollectionNames.eventRegistrations)
    .doc(input.registrationId);

  return firestore.runTransaction(async (transaction) => {
    const registrationSnapshot = await transaction.get(registrationReference);
    if (!registrationSnapshot.exists) {
      throw new Error("The registration could not be found.");
    }

    const registration = registrationSnapshot.data() as RegistrationRecord;
    const configurationReference = firestore
      .collection(firestoreCollectionNames.eventRegistrationConfigurations)
      .doc(registration.eventId);
    const counterReference = firestore
      .collection(firestoreCollectionNames.eventRegistrationCounters)
      .doc(registration.eventId);
    const [configurationSnapshot, counterSnapshot] = await Promise.all([
      transaction.get(configurationReference),
      transaction.get(counterReference),
    ]);
    const configuration = configurationSnapshot.data() as EventRegistrationConfigurationRecord | undefined;
    const counters = counterSnapshot.exists
      ? (counterSnapshot.data() as RegistrationCounterRecord)
      : emptyCounters(registration.eventId, registration.churchId, now);

    if (!configuration) {
      throw new Error("Registration settings could not be found.");
    }

    const attendeeDifference = input.attendeeCount - registration.attendeeCount;
    const isConfirmed = registration.status === "confirmed" || registration.status === "checked_in" ||
      registration.status === "attended" || registration.status === "no_show";
    const isWaitlisted = registration.status === "waitlisted";

    if (
      isConfirmed &&
      attendeeDifference > 0 &&
      configuration.capacityUnit === "attendees" &&
      configuration.capacity !== null &&
      configuration.capacity !== undefined &&
      counters.confirmedAttendees + attendeeDifference > configuration.capacity
    ) {
      throw new Error("There is not enough remaining capacity to add those attendees.");
    }
    if (
      isWaitlisted &&
      attendeeDifference > 0 &&
      configuration.capacityUnit === "attendees" &&
      configuration.waitlistCapacity !== null &&
      configuration.waitlistCapacity !== undefined &&
      counters.waitlistedAttendees + attendeeDifference > configuration.waitlistCapacity
    ) {
      throw new Error("There is not enough remaining waitlist capacity to add those attendees.");
    }

    const nextCounters = {
      ...counters,
      confirmedAttendees: isConfirmed
        ? Math.max(0, counters.confirmedAttendees + attendeeDifference)
        : counters.confirmedAttendees,
      waitlistedAttendees: isWaitlisted
        ? Math.max(0, counters.waitlistedAttendees + attendeeDifference)
        : counters.waitlistedAttendees,
      updatedAt: now,
    };
    const updatedRegistration: RegistrationRecord = {
      ...registration,
      answers: input.answers,
      answerLabels: input.answerLabels,
      contactName: input.contactName,
      contactNameNormalized: normalizeRegistrationSearchText(input.contactName),
      contactSearchPrefixes: createRegistrationSearchPrefixes(input.contactName),
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      attendeeCount: input.attendeeCount,
      capacityUnits: configuration.capacityUnit === "registrations" ? 1 : input.attendeeCount,
      updatedAt: now,
      lastEditedByUserId: input.actorUserId ?? registration.lastEditedByUserId ?? null,
    };

    transaction.set(registrationReference, stripUndefinedDeep(updatedRegistration));
    transaction.set(counterReference, nextCounters);
    return updatedRegistration;
  });
}

export async function getFirstWaitlistedRegistration(eventId: string) {
  const snapshot = await getFirestoreOrThrow()
    .collection(firestoreCollectionNames.eventRegistrations)
    .where("eventId", "==", eventId)
    .where("status", "==", "waitlisted")
    .orderBy("submittedAt", "asc")
    .limit(1)
    .get();
  return snapshot.docs[0]?.data() as RegistrationRecord | undefined;
}

export async function promoteWaitlistedRegistrationAtomically(input: {
  registrationId: string;
  eventId: string;
  churchId: string;
  actorUserId: string;
  now?: string;
}) {
  const firestore = getFirestoreOrThrow();
  const now = input.now ?? new Date().toISOString();
  const registrationReference = firestore
    .collection(firestoreCollectionNames.eventRegistrations)
    .doc(input.registrationId);
  const configurationReference = firestore
    .collection(firestoreCollectionNames.eventRegistrationConfigurations)
    .doc(input.eventId);
  const counterReference = firestore
    .collection(firestoreCollectionNames.eventRegistrationCounters)
    .doc(input.eventId);

  return firestore.runTransaction(async (transaction) => {
    const [registrationSnapshot, configurationSnapshot, counterSnapshot] = await Promise.all([
      transaction.get(registrationReference),
      transaction.get(configurationReference),
      transaction.get(counterReference),
    ]);
    if (!registrationSnapshot.exists || !configurationSnapshot.exists) {
      throw new Error("The waitlisted registration or event settings could not be found.");
    }

    const registration = registrationSnapshot.data() as RegistrationRecord;
    const configuration = configurationSnapshot.data() as EventRegistrationConfigurationRecord;
    const counters = counterSnapshot.exists
      ? (counterSnapshot.data() as RegistrationCounterRecord)
      : emptyCounters(input.eventId, input.churchId, now);

    if (registration.eventId !== input.eventId || registration.churchId !== input.churchId) {
      throw new Error("The registration does not belong to this event.");
    }
    if (registration.status !== "waitlisted") {
      throw new Error("Only a waitlisted registration can be promoted.");
    }

    const capacityUsed = configuration.capacityUnit === "registrations"
      ? counters.confirmed
      : counters.confirmedAttendees;
    const requiredCapacity = configuration.capacityUnit === "registrations"
      ? 1
      : registration.attendeeCount;
    if (configuration.capacity !== null && configuration.capacity !== undefined &&
      capacityUsed + requiredCapacity > configuration.capacity) {
      throw new Error("There is not enough capacity to promote this registration.");
    }

    const updatedRegistration: RegistrationRecord = {
      ...registration,
      status: "confirmed",
      updatedAt: now,
      lastEditedByUserId: input.actorUserId,
    };
    const nextCounters = applyStatusChange(
      counters,
      registration.status,
      "confirmed",
      registration.attendeeCount,
      now,
    );
    transaction.set(registrationReference, stripUndefinedDeep(updatedRegistration));
    transaction.set(counterReference, nextCounters);
    return updatedRegistration;
  });
}

export async function deleteRegistrationDataAtomically(input: {
  registrationId: string;
  eventId: string;
  churchId: string;
}) {
  const firestore = getFirestoreOrThrow();
  const registrationReference = firestore.collection(firestoreCollectionNames.eventRegistrations).doc(input.registrationId);
  const counterReference = firestore.collection(firestoreCollectionNames.eventRegistrationCounters).doc(input.eventId);
  const registration = await firestore.runTransaction(async (transaction) => {
    const [registrationSnapshot, counterSnapshot] = await Promise.all([
      transaction.get(registrationReference),
      transaction.get(counterReference),
    ]);
    if (!registrationSnapshot.exists) throw new Error("The registration could not be found.");
    const record = registrationSnapshot.data() as RegistrationRecord;
    if (record.eventId !== input.eventId || record.churchId !== input.churchId) throw new Error("The registration does not belong to this event.");
    if (record.status !== "cancelled") throw new Error("Cancel the registration before deleting its personal data.");
    const counters = counterSnapshot.exists
      ? counterSnapshot.data() as RegistrationCounterRecord
      : emptyCounters(input.eventId, input.churchId, new Date().toISOString());
    const contribution = statusContribution(record.status, record.attendeeCount);
    transaction.delete(registrationReference);
    transaction.set(counterReference, {
      ...counters,
      submitted: Math.max(0, counters.submitted - 1),
      confirmed: Math.max(0, counters.confirmed - contribution.confirmed),
      waitlisted: Math.max(0, counters.waitlisted - contribution.waitlisted),
      cancelled: Math.max(0, counters.cancelled - contribution.cancelled),
      checkedIn: Math.max(0, counters.checkedIn - contribution.checkedIn),
      attended: Math.max(0, counters.attended - contribution.attended),
      noShow: Math.max(0, counters.noShow - contribution.noShow),
      confirmedAttendees: Math.max(0, counters.confirmedAttendees - contribution.confirmedAttendees),
      waitlistedAttendees: Math.max(0, counters.waitlistedAttendees - contribution.waitlistedAttendees),
      updatedAt: new Date().toISOString(),
    });
    transaction.delete(firestore.collection(firestoreCollectionNames.eventRegistrationConfirmations).doc(record.confirmationNumber));
    return record;
  });

  const [tokenSnapshot, idempotencySnapshot] = await Promise.all([
    firestore.collection(firestoreCollectionNames.eventRegistrationTokens).where("registrationId", "==", input.registrationId).get(),
    firestore.collection(firestoreCollectionNames.eventRegistrationIdempotency).where("registrationId", "==", input.registrationId).get(),
  ]);
  const batch = firestore.batch();
  tokenSnapshot.docs.forEach((documentSnapshot) => batch.delete(documentSnapshot.ref));
  idempotencySnapshot.docs.forEach((documentSnapshot) => batch.delete(documentSnapshot.ref));
  await batch.commit();
  return registration;
}

export async function createManualRegistrationId() {
  return randomUUID();
}
