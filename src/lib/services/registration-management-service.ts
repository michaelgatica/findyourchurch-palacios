import { randomUUID } from "crypto";

import {
  createConfirmationNumber,
  createRegistrationAccessToken,
  createRegistrationSearchPrefixes,
  hashRegistrationSecret,
  normalizeRegistrationSearchText,
} from "@/lib/registration-utils";
import {
  createAuditLogInFirebase,
  listAuditLogsForEntity,
} from "@/lib/repositories/firebase-audit-log-repository";
import {
  createRegistrationAtomically,
  deleteRegistrationDataAtomically,
  findRegistrationsForEventByName,
  getFirstWaitlistedRegistration,
  getRegistrationById,
  getRegistrationConfiguration,
  getRegistrationCounters,
  getRegistrationFormVersion,
  listRegistrationsForEvent,
  promoteWaitlistedRegistrationAtomically,
  saveRegistrationAccessToken,
  updateRegistrationAnswersAtomically,
  updateRegistrationRecord,
  updateRegistrationStatusAtomically,
} from "@/lib/repositories/firebase-registration-repository";
import { getEventByIdFromFirebase } from "@/lib/repositories/firebase-event-repository";
import { requireChurchEventManagementAccess } from "@/lib/services/representative-access-service";
import {
  sendRegistrantRegistrationConfirmation,
  sendRegistrationCancellationNotification,
  sendWaitlistPromotionNotification,
} from "@/lib/services/registration-notification-service";
import type { RegistrationStatus } from "@/lib/types/registrations";
import {
  parseRegistrationAnswerPayload,
  validateRegistrationAnswers,
} from "@/lib/validation/registration";

async function requireEventAccess(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const access = await requireChurchEventManagementAccess({
    churchId: input.churchId,
    userId: input.actorUserId,
  });
  const event = await getEventByIdFromFirebase(input.eventId);
  if (!event || event.churchId !== input.churchId) {
    throw new Error("The event does not belong to this church.");
  }
  return { ...access, event };
}

async function requireRegistrationAccess(input: {
  registrationId: string;
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const access = await requireEventAccess(input);
  const registration = await getRegistrationById(input.registrationId);
  if (!registration || registration.eventId !== input.eventId || registration.churchId !== input.churchId) {
    throw new Error("The registration does not belong to this event.");
  }
  return { ...access, registration };
}

export async function listManagedRegistrations(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
  status?: RegistrationStatus | "all";
  statuses?: RegistrationStatus[];
  cursor?: string | null;
  search?: string;
  direction?: "asc" | "desc";
  sortBy?: "submittedAt" | "contactNameNormalized";
}) {
  const access = await requireEventAccess(input);
  const [configuration, counters, page] = await Promise.all([
    getRegistrationConfiguration(input.eventId),
    getRegistrationCounters(input.eventId, input.churchId),
    input.search?.trim()
      ? findRegistrationsForEventByName({
          eventId: input.eventId,
          search: input.search,
          status: input.status,
          statuses: input.statuses,
          cursor: input.cursor,
          direction: input.direction,
          limit: 25,
        })
      : listRegistrationsForEvent({
          eventId: input.eventId,
          status: input.status,
          statuses: input.statuses,
          cursor: input.cursor,
          direction: input.direction,
          sortBy: input.sortBy,
          limit: 25,
        }),
  ]);
  return { ...access, configuration, counters, ...page };
}

export async function getManagedRegistration(input: {
  registrationId: string;
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const access = await requireRegistrationAccess(input);
  const [configuration, formVersion, auditLogs] = await Promise.all([
    getRegistrationConfiguration(input.eventId),
    getRegistrationFormVersion(access.registration.formVersionId),
    listAuditLogsForEntity("eventRegistration", input.registrationId),
  ]);
  return {
    ...access,
    configuration,
    formVersion,
    auditLogs: auditLogs.toSorted((left, right) => right.createdAt.localeCompare(left.createdAt)),
  };
}

const allowedStatusTransitions: Record<RegistrationStatus, RegistrationStatus[]> = {
  confirmed: ["waitlisted", "cancelled", "checked_in", "attended", "no_show"],
  waitlisted: ["confirmed", "cancelled"],
  cancelled: [],
  checked_in: ["confirmed", "cancelled", "attended", "no_show"],
  attended: ["checked_in"],
  no_show: ["confirmed", "checked_in"],
};

export function isRegistrationStatusTransitionAllowed(
  currentStatus: RegistrationStatus,
  nextStatus: RegistrationStatus,
) {
  return allowedStatusTransitions[currentStatus].includes(nextStatus);
}

export async function changeManagedRegistrationStatus(input: {
  registrationId: string;
  eventId: string;
  churchId: string;
  actorUserId: string;
  nextStatus: RegistrationStatus;
}) {
  const access = await requireRegistrationAccess(input);
  if (!isRegistrationStatusTransitionAllowed(access.registration.status, input.nextStatus)) {
    throw new Error(`Registration cannot move from ${access.registration.status} to ${input.nextStatus}.`);
  }

  const configuration = await getRegistrationConfiguration(input.eventId);
  const registration = input.nextStatus === "confirmed" && access.registration.status === "waitlisted"
    ? await promoteWaitlistedRegistrationAtomically(input)
    : await updateRegistrationStatusAtomically(input);

  await createAuditLogInFirebase({
    entityType: "eventRegistration",
    entityId: registration.id,
    action: `registration_${input.nextStatus}`,
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    before: { status: access.registration.status },
    after: { status: registration.status },
    note: "Registration status updated by an authorized event manager.",
  });

  if (input.nextStatus === "confirmed" && access.registration.status === "waitlisted") {
    await sendWaitlistPromotionNotification({ event: access.event, registration });
  }
  if (input.nextStatus === "cancelled") {
    await sendRegistrationCancellationNotification({ event: access.event, registration });
    if (configuration?.automaticWaitlistPromotion) {
      const nextWaitlisted = await getFirstWaitlistedRegistration(input.eventId);
      if (nextWaitlisted) {
        try {
          const promoted = await promoteWaitlistedRegistrationAtomically({
            registrationId: nextWaitlisted.id,
            eventId: input.eventId,
            churchId: input.churchId,
            actorUserId: input.actorUserId,
          });
          await sendWaitlistPromotionNotification({ event: access.event, registration: promoted });
          await createAuditLogInFirebase({
            entityType: "eventRegistration",
            entityId: promoted.id,
            action: "registration_auto_promoted",
            actorId: input.actorUserId,
            actorType: access.actorType,
            actorRole: access.actorRole,
            before: { status: "waitlisted" },
            after: { status: "confirmed" },
            note: "Automatically promoted after a cancellation released capacity.",
          });
        } catch (error) {
          console.warn("Automatic waitlist promotion was not completed", error);
        }
      }
    }
  }

  return registration;
}

export async function updateManagedRegistration(input: {
  registrationId: string;
  eventId: string;
  churchId: string;
  actorUserId: string;
  answerPayload: string;
  privateOrganizerNotes?: string;
}) {
  const access = await requireRegistrationAccess(input);
  const [configuration, formVersion] = await Promise.all([
    getRegistrationConfiguration(input.eventId),
    getRegistrationFormVersion(access.registration.formVersionId),
  ]);
  if (!configuration || !formVersion) {
    throw new Error("The registration form version could not be found.");
  }

  const validated = validateRegistrationAnswers({
    sections: formVersion.sections,
    answers: parseRegistrationAnswerPayload(input.answerPayload),
    maximumAttendeesPerRegistration: configuration.maximumAttendeesPerRegistration,
  });
  const registration = await updateRegistrationAnswersAtomically({
    registrationId: input.registrationId,
    answers: validated.answers,
    answerLabels: validated.answerLabels,
    contactName: validated.contactName,
    contactEmail: validated.contactEmail,
    contactPhone: validated.contactPhone,
    attendeeCount: validated.attendeeCount,
    actorUserId: input.actorUserId,
  });
  await updateRegistrationRecord(registration.id, {
    privateOrganizerNotes: input.privateOrganizerNotes?.trim().slice(0, 2000) || null,
  });
  await createAuditLogInFirebase({
    entityType: "eventRegistration",
    entityId: registration.id,
    action: "registration_updated",
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    before: { attendeeCount: access.registration.attendeeCount },
    after: { attendeeCount: registration.attendeeCount },
    note: "Registration details updated. Answer values are intentionally omitted from audit logs.",
  });
  return registration;
}

export async function createManualRegistration(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
  answerPayload: string;
}) {
  const access = await requireEventAccess(input);
  const configuration = await getRegistrationConfiguration(input.eventId);
  const formVersion = configuration?.activeFormVersionId
    ? await getRegistrationFormVersion(configuration.activeFormVersionId)
    : null;
  if (!configuration || !formVersion) {
    throw new Error("Activate an internal registration form before adding a manual registration.");
  }

  const validated = validateRegistrationAnswers({
    sections: formVersion.sections,
    answers: parseRegistrationAnswerPayload(input.answerPayload),
    maximumAttendeesPerRegistration: configuration.maximumAttendeesPerRegistration,
  });
  const now = new Date().toISOString();
  const registrationId = randomUUID();
  const accessToken = createRegistrationAccessToken();
  const tokenHash = hashRegistrationSecret(accessToken);
  const registration = {
    id: registrationId,
    eventId: input.eventId,
    churchId: input.churchId,
    formVersionId: formVersion.id,
    formVersion: formVersion.version,
    formTitle: formVersion.title,
    confirmationNumber: createConfirmationNumber(),
    status: "confirmed" as const,
    contactName: validated.contactName,
    contactNameNormalized: normalizeRegistrationSearchText(validated.contactName),
    contactSearchPrefixes: createRegistrationSearchPrefixes(validated.contactName),
    contactEmail: validated.contactEmail,
    contactPhone: validated.contactPhone,
    attendeeCount: validated.attendeeCount,
    capacityUnits: configuration.capacityUnit === "registrations" ? 1 : validated.attendeeCount,
    answers: validated.answers,
    answerLabels: validated.answerLabels,
    privateOrganizerNotes: null,
    source: "manual" as const,
    idempotencyKeyHash: hashRegistrationSecret(randomUUID()),
    submittedAt: now,
    updatedAt: now,
    cancelledAt: null,
    checkedInAt: null,
    attendedAt: null,
    noShowAt: null,
    lastEditedByUserId: input.actorUserId,
  };
  const result = await createRegistrationAtomically({
    registration,
    accessToken: {
      id: tokenHash,
      registrationId,
      eventId: input.eventId,
      churchId: input.churchId,
      tokenHash,
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      lastUsedAt: null,
      revokedAt: null,
    },
    idempotencyDocumentId: hashRegistrationSecret(`${input.eventId}:manual:${randomUUID()}`),
    duplicateFingerprintDocumentId: hashRegistrationSecret(`${input.eventId}:manual-duplicate:${randomUUID()}`),
    rateLimitDocumentId: hashRegistrationSecret(`${input.eventId}:manual:${input.actorUserId}`),
    configuration,
    formVersion,
    now,
    rateLimitWindowMs: 60 * 1000,
    rateLimitMaximum: 100,
    auditId: randomUUID(),
  });
  if (configuration.confirmationEmailEnabled) {
    await sendRegistrantRegistrationConfirmation({
      event: access.event,
      registration: result.registration,
      accessToken,
      managementEnabled: configuration.allowRegistrantEditing || configuration.allowRegistrantCancellation,
    });
  }
  return result.registration;
}

export async function resendManagedRegistrationConfirmation(input: {
  registrationId: string;
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const access = await requireRegistrationAccess(input);
  if (!access.registration.contactEmail) {
    throw new Error("This registration does not include an email address.");
  }
  const configuration = await getRegistrationConfiguration(input.eventId);
  if (!configuration) {
    throw new Error("Registration settings could not be found.");
  }
  const accessToken = createRegistrationAccessToken();
  const tokenHash = hashRegistrationSecret(accessToken);
  await saveRegistrationAccessToken({
    id: tokenHash,
    registrationId: access.registration.id,
    eventId: input.eventId,
    churchId: input.churchId,
    tokenHash,
    expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
    createdAt: new Date().toISOString(),
    lastUsedAt: null,
    revokedAt: null,
  });
  await sendRegistrantRegistrationConfirmation({
    event: access.event,
    registration: access.registration,
    accessToken,
    managementEnabled: configuration.allowRegistrantEditing || configuration.allowRegistrantCancellation,
  });
  await createAuditLogInFirebase({
    entityType: "eventRegistration",
    entityId: access.registration.id,
    action: "registration_confirmation_resent",
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    note: "Confirmation email resent without including private answers.",
  });
}

export async function deleteManagedRegistrationData(input: {
  registrationId: string;
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const access = await requireRegistrationAccess(input);
  if (access.registration.status !== "cancelled") {
    throw new Error("Cancel the registration before deleting its personal data.");
  }
  await deleteRegistrationDataAtomically(input);
  await createAuditLogInFirebase({
    entityType: "eventRegistration",
    entityId: input.registrationId,
    action: "registration_personal_data_deleted",
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    after: { eventId: input.eventId, churchId: input.churchId, deletionCompleted: true },
    note: "Registration personal data deleted. Minimal audit metadata retained.",
  });
}
