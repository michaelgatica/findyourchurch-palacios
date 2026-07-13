import { randomUUID } from "crypto";

import {
  createConfirmationNumber,
  createRegistrationAccessToken,
  createRegistrationSearchPrefixes,
  hashRegistrationSecret,
  normalizeRegistrationSearchText,
  verifyRegistrationChallenge,
} from "@/lib/registration-utils";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import {
  createRegistrationAtomically,
  getRegistrationByConfirmationNumber,
  getRegistrationByTokenHash,
  getRegistrationConfiguration,
  getRegistrationCounters,
  getRegistrationFormVersion,
  markRegistrationAccessTokenUsed,
  promoteWaitlistedRegistrationAtomically,
  getFirstWaitlistedRegistration,
  updateRegistrationAnswersAtomically,
  updateRegistrationStatusAtomically,
} from "@/lib/repositories/firebase-registration-repository";
import {
  getEventByIdFromFirebase,
  getPublicEventBySlugFromFirebase,
} from "@/lib/repositories/firebase-event-repository";
import {
  sendOrganizerRegistrationNotification,
  sendRegistrantRegistrationConfirmation,
  sendRegistrationCancellationNotification,
  sendRegistrationUpdatedNotification,
  sendWaitlistPromotionNotification,
} from "@/lib/services/registration-notification-service";
import type { EventRecord } from "@/lib/types/events";
import type {
  EventRegistrationConfigurationRecord,
  RegistrationFormVersionRecord,
  RegistrationRecord,
} from "@/lib/types/registrations";
import {
  parseRegistrationAnswerPayload,
  validateRegistrationAnswers,
} from "@/lib/validation/registration";

export type PublicRegistrationStatus =
  | "not_yet_open"
  | "open"
  | "almost_full"
  | "full"
  | "waitlist_available"
  | "waitlist_full"
  | "closed"
  | "event_cancelled"
  | "event_completed";

function isInternalMode(mode: EventRegistrationConfigurationRecord["mode"]) {
  return mode === "simple_rsvp" || mode === "internal_custom";
}

export function getPublicRegistrationStatus(input: {
  event: EventRecord;
  configuration: EventRegistrationConfigurationRecord;
  confirmedCapacityUsed: number;
  waitlistCapacityUsed: number;
  now?: number;
}): PublicRegistrationStatus {
  const now = input.now ?? Date.now();
  if (input.event.status === "cancelled") {
    return "event_cancelled";
  }
  if (new Date(input.event.endsAt ?? input.event.startsAt).getTime() < now) {
    return "event_completed";
  }
  if (input.configuration.opensAt && new Date(input.configuration.opensAt).getTime() > now) {
    return "not_yet_open";
  }
  if (input.configuration.closesAt && new Date(input.configuration.closesAt).getTime() <= now) {
    return "closed";
  }

  const capacity = input.configuration.capacity;
  if (capacity !== null && capacity !== undefined) {
    const remaining = capacity - input.confirmedCapacityUsed;
    if (remaining <= 0) {
      if (!input.configuration.waitlistEnabled) {
        return "full";
      }
      const waitlistCapacity = input.configuration.waitlistCapacity;
      if (waitlistCapacity !== null && waitlistCapacity !== undefined &&
        input.waitlistCapacityUsed >= waitlistCapacity) {
        return "waitlist_full";
      }
      return "waitlist_available";
    }
    if (remaining <= Math.max(3, Math.ceil(capacity * 0.1))) {
      return "almost_full";
    }
  }

  return "open";
}

async function getInternalRegistrationBundle(event: EventRecord) {
  const configuration = await getRegistrationConfiguration(event.id);
  if (!configuration || !isInternalMode(configuration.mode) || !configuration.activeFormVersionId) {
    return null;
  }

  const [formVersion, counters] = await Promise.all([
    getRegistrationFormVersion(configuration.activeFormVersionId),
    getRegistrationCounters(event.id, event.churchId),
  ]);
  if (!formVersion || formVersion.status !== "active") {
    return null;
  }

  const confirmedCapacityUsed = configuration.capacityUnit === "registrations"
    ? counters.confirmed
    : counters.confirmedAttendees;
  const waitlistCapacityUsed = configuration.capacityUnit === "registrations"
    ? counters.waitlisted
    : counters.waitlistedAttendees;

  return {
    configuration,
    formVersion,
    counters,
    status: getPublicRegistrationStatus({
      event,
      configuration,
      confirmedCapacityUsed,
      waitlistCapacityUsed,
    }),
    remainingCapacity:
      configuration.capacity === null || configuration.capacity === undefined
        ? null
        : Math.max(0, configuration.capacity - confirmedCapacityUsed),
  };
}

export async function getPublicRegistrationExperience(eventSlug: string) {
  const event = await getPublicEventBySlugFromFirebase(eventSlug);
  if (!event) {
    return null;
  }

  const bundle = await getInternalRegistrationBundle(event);
  return bundle ? { event, ...bundle } : { event, configuration: null, formVersion: null, counters: null, status: "closed" as const, remainingCapacity: null };
}

export async function getPublicRegistrationConfirmation(input: {
  eventSlug: string;
  confirmationNumber: string;
  accessToken?: string | null;
}) {
  const [event, registration] = await Promise.all([
    getPublicEventBySlugFromFirebase(input.eventSlug),
    getRegistrationByConfirmationNumber(input.confirmationNumber),
  ]);
  if (!event || !registration || registration.eventId !== event.id) {
    return null;
  }

  const configuration = await getRegistrationConfiguration(event.id);
  const tokenAccess = input.accessToken
    ? await getRegistrationByTokenHash(hashRegistrationSecret(input.accessToken))
    : null;

  return {
    event,
    confirmationNumber: registration.confirmationNumber,
    status: registration.status,
    attendeeCount: registration.attendeeCount,
    message:
      registration.status === "waitlisted"
        ? configuration?.waitlistMessage ?? "We will notify you if space becomes available."
        : configuration?.successMessage ?? "The host church has received your registration.",
    managementTokenIsValid:
      Boolean(tokenAccess) && tokenAccess?.registration.id === registration.id,
  };
}

export async function submitPublicRegistration(input: {
  eventSlug: string;
  answerPayload: string;
  idempotencyKey: string;
  challenge: string;
  honeypot: string;
  requestIdentity: string;
}) {
  if (input.honeypot.trim()) {
    throw new Error("The registration could not be submitted.");
  }
  if (!verifyRegistrationChallenge(input.challenge)) {
    throw new Error("This registration form expired. Refresh the page and try again.");
  }
  if (!/^[a-zA-Z0-9_-]{12,120}$/.test(input.idempotencyKey)) {
    throw new Error("The registration session is invalid. Refresh the page and try again.");
  }

  const publicEvent = await getPublicEventBySlugFromFirebase(input.eventSlug);
  if (!publicEvent) {
    throw new Error("The event could not be found.");
  }
  const privateEvent = await getEventByIdFromFirebase(publicEvent.id);
  if (!privateEvent || privateEvent.churchId !== publicEvent.churchId) {
    throw new Error("Registration is not available for this event.");
  }
  const bundle = await getInternalRegistrationBundle(privateEvent);
  if (!bundle || (bundle.status !== "open" && bundle.status !== "almost_full" && bundle.status !== "waitlist_available")) {
    throw new Error(bundle?.configuration.closedMessage ?? "Registration is not open for this event.");
  }

  const answers = parseRegistrationAnswerPayload(input.answerPayload);
  const validated = validateRegistrationAnswers({
    sections: bundle.formVersion.sections,
    answers,
    maximumAttendeesPerRegistration: bundle.configuration.maximumAttendeesPerRegistration,
  });
  const now = new Date().toISOString();
  const registrationId = randomUUID();
  const accessToken = createRegistrationAccessToken();
  const tokenHash = hashRegistrationSecret(accessToken);
  const eventEnd = new Date(privateEvent.endsAt ?? privateEvent.startsAt).getTime();
  const tokenExpiresAt = new Date(
    Math.min(
      eventEnd + 30 * 24 * 60 * 60 * 1000,
      Date.now() + 180 * 24 * 60 * 60 * 1000,
    ),
  ).toISOString();
  const registration: RegistrationRecord = {
    id: registrationId,
    eventId: privateEvent.id,
    churchId: privateEvent.churchId,
    formVersionId: bundle.formVersion.id,
    formVersion: bundle.formVersion.version,
    formTitle: bundle.formVersion.title,
    confirmationNumber: createConfirmationNumber(),
    status: "confirmed",
    contactName: validated.contactName,
    contactNameNormalized: normalizeRegistrationSearchText(validated.contactName),
    contactSearchPrefixes: createRegistrationSearchPrefixes(validated.contactName),
    contactEmail: validated.contactEmail,
    contactPhone: validated.contactPhone,
    attendeeCount: validated.attendeeCount,
    capacityUnits: bundle.configuration.capacityUnit === "registrations" ? 1 : validated.attendeeCount,
    answers: validated.answers,
    answerLabels: validated.answerLabels,
    privateOrganizerNotes: null,
    source: "public",
    idempotencyKeyHash: hashRegistrationSecret(input.idempotencyKey),
    submittedAt: now,
    updatedAt: now,
    cancelledAt: null,
    checkedInAt: null,
    attendedAt: null,
    noShowAt: null,
    lastEditedByUserId: null,
  };
  const result = await createRegistrationAtomically({
    registration,
    accessToken: {
      id: tokenHash,
      registrationId,
      eventId: privateEvent.id,
      churchId: privateEvent.churchId,
      tokenHash,
      expiresAt: tokenExpiresAt,
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    },
    idempotencyDocumentId: hashRegistrationSecret(`${privateEvent.id}:idempotency:${input.idempotencyKey}`),
    duplicateFingerprintDocumentId: hashRegistrationSecret(
      `${privateEvent.id}:duplicate:${validated.contactEmail ?? validated.contactPhone ?? validated.contactName}:${JSON.stringify(validated.answers)}`,
    ),
    rateLimitDocumentId: hashRegistrationSecret(`${privateEvent.id}:rate:${input.requestIdentity}`),
    configuration: bundle.configuration,
    formVersion: bundle.formVersion,
    now,
    rateLimitWindowMs: 15 * 60 * 1000,
    rateLimitMaximum: 8,
    auditId: randomUUID(),
  });

  if (!result.duplicate) {
    const counters = await getRegistrationCounters(privateEvent.id, privateEvent.churchId);
    const capacityUsed = bundle.configuration.capacityUnit === "registrations"
      ? counters.confirmed
      : counters.confirmedAttendees;
    const capacityReached = bundle.configuration.capacity !== null &&
      bundle.configuration.capacity !== undefined && capacityUsed >= bundle.configuration.capacity;
    const notifications: Promise<unknown>[] = [];
    if (bundle.configuration.confirmationEmailEnabled) {
      notifications.push(sendRegistrantRegistrationConfirmation({
        event: privateEvent,
        registration: result.registration,
        accessToken,
        managementEnabled:
          bundle.configuration.allowRegistrantEditing || bundle.configuration.allowRegistrantCancellation,
      }));
    }
    if (bundle.configuration.organizerNewRegistrationEmail) {
      notifications.push(sendOrganizerRegistrationNotification({
        event: privateEvent,
        registration: result.registration,
        capacityReached,
      }));
    }
    const outcomes = await Promise.allSettled(notifications);
    outcomes.forEach((outcome) => {
      if (outcome.status === "rejected") {
        console.error("Registration notification failed", outcome.reason);
      }
    });
  }

  return {
    registration: result.registration,
    accessToken: result.duplicate ? null : accessToken,
    duplicate: result.duplicate,
    successMessage:
      result.registration.status === "waitlisted"
        ? bundle.configuration.waitlistMessage
        : bundle.configuration.successMessage,
  };
}

export async function getRegistrantManagementContext(accessToken: string) {
  const tokenHash = hashRegistrationSecret(accessToken);
  const access = await getRegistrationByTokenHash(tokenHash);
  if (!access) {
    return null;
  }
  const [event, configuration, formVersion] = await Promise.all([
    getEventByIdFromFirebase(access.registration.eventId),
    getRegistrationConfiguration(access.registration.eventId),
    getRegistrationFormVersion(access.registration.formVersionId),
  ]);
  if (!event || !configuration || !formVersion) {
    return null;
  }
  await markRegistrationAccessTokenUsed(tokenHash);
  return { ...access, event, configuration, formVersion };
}

export async function updateRegistrationWithAccessToken(input: {
  accessToken: string;
  answerPayload: string;
}) {
  const context = await getRegistrantManagementContext(input.accessToken);
  if (!context || !context.configuration.allowRegistrantEditing) {
    throw new Error("This registration cannot be edited.");
  }
  if (context.registration.status === "cancelled") {
    throw new Error("A cancelled registration cannot be edited.");
  }

  const validated = validateRegistrationAnswers({
    sections: context.formVersion.sections,
    answers: parseRegistrationAnswerPayload(input.answerPayload),
    maximumAttendeesPerRegistration: context.configuration.maximumAttendeesPerRegistration,
  });
  const registration = await updateRegistrationAnswersAtomically({
    registrationId: context.registration.id,
    answers: validated.answers,
    answerLabels: validated.answerLabels,
    contactName: validated.contactName,
    contactEmail: validated.contactEmail,
    contactPhone: validated.contactPhone,
    attendeeCount: validated.attendeeCount,
  });
  await createAuditLogInFirebase({
    entityType: "eventRegistration",
    entityId: registration.id,
    action: "registration_updated_by_registrant",
    actorType: "public_registration_token",
    before: { attendeeCount: context.registration.attendeeCount },
    after: { attendeeCount: registration.attendeeCount },
    note: "Registrant updated their response using a valid access token. Answer values are omitted.",
  });
  await sendRegistrationUpdatedNotification({
    event: context.event,
    registration,
    accessToken: input.accessToken,
  });
  return registration;
}

export async function cancelRegistrationWithAccessToken(accessToken: string) {
  const context = await getRegistrantManagementContext(accessToken);
  if (!context || !context.configuration.allowRegistrantCancellation) {
    throw new Error("This registration cannot be cancelled online.");
  }
  if (context.registration.status === "cancelled") {
    return context.registration;
  }

  const cancelledRegistration = await updateRegistrationStatusAtomically({
    registrationId: context.registration.id,
    churchId: context.registration.churchId,
    eventId: context.registration.eventId,
    nextStatus: "cancelled",
    actorUserId: "public-token",
  });
  await createAuditLogInFirebase({
    entityType: "eventRegistration",
    entityId: cancelledRegistration.id,
    action: "registration_cancelled_by_registrant",
    actorType: "public_registration_token",
    before: { status: context.registration.status },
    after: { status: "cancelled" },
    note: "Registrant cancelled using a valid access token.",
  });
  await sendRegistrationCancellationNotification({
    event: context.event,
    registration: cancelledRegistration,
  });

  if (context.configuration.automaticWaitlistPromotion) {
    const firstWaitlisted = await getFirstWaitlistedRegistration(context.event.id);
    if (firstWaitlisted) {
      try {
        const promoted = await promoteWaitlistedRegistrationAtomically({
          registrationId: firstWaitlisted.id,
          eventId: context.event.id,
          churchId: context.event.churchId,
          actorUserId: "automatic-waitlist",
        });
        await createAuditLogInFirebase({
          entityType: "eventRegistration",
          entityId: promoted.id,
          action: "registration_auto_promoted",
          actorType: "system",
          before: { status: "waitlisted" },
          after: { status: "confirmed" },
          note: "Automatically promoted after a registrant cancellation released capacity.",
        });
        await sendWaitlistPromotionNotification({ event: context.event, registration: promoted });
      } catch (error) {
        console.warn("Automatic waitlist promotion was not completed", error);
      }
    }
  }

  return cancelledRegistration;
}
