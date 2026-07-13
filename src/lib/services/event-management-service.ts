import { randomUUID } from "crypto";

import { buildChurchProfilePath } from "@/lib/config/site";
import {
  deleteFirebaseStorageObjectIfPresent,
  uploadEventFlyerToFirebaseStorage,
} from "@/lib/firebase/storage";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import {
  createUniqueEventSlugFromFirebase,
  deleteEventFromFirebase,
  getEventByIdFromFirebase,
  listEventsForChurchFromFirebase,
  saveEventToFirebase,
  syncPublicEventFromFirebase,
  updateEventInFirebase,
} from "@/lib/repositories/firebase-event-repository";
import { requireChurchEventManagementAccess } from "@/lib/services/representative-access-service";
import { scheduleEventCancellationNotifications } from "@/lib/services/registration-job-service";
import type { ChurchRecord } from "@/lib/types/directory";
import type { EventRecord, EventStatus } from "@/lib/types/events";
import type { ValidatedEventInput } from "@/lib/validation/event-management";

const publishableStatuses = new Set<EventStatus>(["draft", "pending_review", "unlisted"]);

function canArchive(status: EventStatus) {
  return status === "published" || status === "cancelled" || status === "completed";
}

function assertAllowedTransition(currentStatus: EventStatus, nextStatus: EventStatus) {
  if (currentStatus === nextStatus) {
    return;
  }

  if (nextStatus === "published" && publishableStatuses.has(currentStatus)) {
    return;
  }

  if (nextStatus === "unlisted" && currentStatus === "published") {
    return;
  }

  if (nextStatus === "cancelled" && (currentStatus === "published" || currentStatus === "unlisted")) {
    return;
  }

  if (nextStatus === "archived" && canArchive(currentStatus)) {
    return;
  }

  if (nextStatus === "draft" && currentStatus === "archived") {
    return;
  }

  throw new Error(`Events cannot move from ${currentStatus} to ${nextStatus}.`);
}

function buildEventRecord(input: {
  eventId: string;
  church: ChurchRecord;
  actorUserId: string;
  actorName: string;
  validatedInput: ValidatedEventInput;
  status: EventStatus;
  slug: string;
  existingEvent?: EventRecord | null;
}): EventRecord {
  const now = new Date().toISOString();
  const existingEvent = input.existingEvent;
  const flyerImage = existingEvent?.flyerImage ?? null;
  const isPubliclyReleased = input.status === "published" || input.status === "unlisted";
  const statusChangedToPublished = isPubliclyReleased && !existingEvent?.wasPublished;
  const isInternalRegistrationMode =
    input.validatedInput.registrationMode === "simple_rsvp" ||
    input.validatedInput.registrationMode === "internal_custom";
  const preserveActiveInternalRegistration = Boolean(
    existingEvent?.registration.setupEnabled &&
      isInternalRegistrationMode &&
      existingEvent.registration.mode === input.validatedInput.registrationMode,
  );
  const registration = preserveActiveInternalRegistration
    ? existingEvent!.registration
    : {
        mode: input.validatedInput.registrationMode,
        opensAt: input.validatedInput.registrationOpensAt,
        closesAt: input.validatedInput.registrationClosesAt,
        capacity: input.validatedInput.capacity,
        waitlistEnabled: false,
        externalRegistrationUrl: input.validatedInput.externalRegistrationUrl,
        externalRegistrationLabel: input.validatedInput.externalRegistrationLabel,
        setupEnabled:
          input.validatedInput.registrationMode === "google_forms" ||
          input.validatedInput.registrationMode === "external" ||
          input.validatedInput.registrationMode === "none",
      };

  return {
    id: input.eventId,
    churchId: input.church.id,
    churchName: input.church.name,
    churchSlug: input.church.slug,
    churchRoutePath: buildChurchProfilePath(input.church),
    createdByUserId: existingEvent?.createdByUserId ?? input.actorUserId,
    createdByName: existingEvent?.createdByName ?? input.actorName,
    lastEditedByUserId: input.actorUserId,
    lastEditedByName: input.actorName,
    title: input.validatedInput.title,
    slug: existingEvent?.slug ?? input.slug,
    summary: input.validatedInput.summary,
    description: input.validatedInput.description,
    primaryType: input.validatedInput.primaryType,
    audienceTags: input.validatedInput.audienceTags,
    customTags: input.validatedInput.customTags,
    status: input.status,
    visibility: input.validatedInput.visibility,
    isFeatured: existingEvent?.isFeatured ?? false,
    flyerImage,
    additionalImages: existingEvent?.additionalImages ?? [],
    startsAt: input.validatedInput.startsAt,
    endsAt: input.validatedInput.endsAt,
    allDay: input.validatedInput.allDay,
    timeZone: input.validatedInput.timeZone,
    isRecurring: false,
    recurrenceRule: null,
    recurrenceExceptions: [],
    locationMode: input.validatedInput.locationMode,
    venueName: input.validatedInput.venueName,
    address: input.validatedInput.address,
    onlineUrl: input.validatedInput.onlineUrl,
    mapUrl: input.validatedInput.mapUrl,
    hostMinistry: input.validatedInput.hostMinistry,
    coHostDescription: null,
    contactName: input.validatedInput.contactName,
    contactPhone: input.validatedInput.contactPhone,
    contactEmail: input.validatedInput.contactEmail,
    languages: input.validatedInput.languages,
    accessibilityDetails: input.validatedInput.accessibilityDetails,
    childcareProvided: input.validatedInput.childcareProvided,
    mealProvided: input.validatedInput.mealProvided,
    mealDetails: input.validatedInput.mealDetails,
    costStatus: input.validatedInput.costStatus,
    costDetails: input.validatedInput.costDetails,
    informationUrl: input.validatedInput.informationUrl,
    additionalInstructions: input.validatedInput.additionalInstructions,
    registration,
    cancellationMessage: input.validatedInput.cancellationMessage,
    createdAt: existingEvent?.createdAt ?? now,
    publishedAt: statusChangedToPublished
      ? now
      : input.status === "published"
        ? existingEvent?.publishedAt ?? now
        : existingEvent?.publishedAt ?? null,
    updatedAt: now,
    cancelledAt: input.status === "cancelled" ? now : existingEvent?.cancelledAt ?? null,
    archivedAt: input.status === "archived" ? now : existingEvent?.archivedAt ?? null,
    wasPublished: existingEvent?.wasPublished || isPubliclyReleased,
  };
}

async function assertEventChurchAccess(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const event = await getEventByIdFromFirebase(input.eventId);

  if (!event) {
    throw new Error("The event could not be found.");
  }

  if (event.churchId !== input.churchId) {
    throw new Error("This event does not belong to the selected church.");
  }

  if (event.editingLocked) {
    throw new Error("This event is temporarily locked by a platform administrator.");
  }

  const access = await requireChurchEventManagementAccess({
    userId: input.actorUserId,
    churchId: event.churchId,
  });

  return {
    ...access,
    event,
  };
}

async function maybeApplyFlyer(input: {
  event: EventRecord;
  validatedInput: ValidatedEventInput;
  action: "event_created" | "event_updated";
  actorUserId: string;
  actorType: "admin" | "church_rep";
  actorRole: string;
}) {
  let nextEvent = input.event;
  const previousFlyer = input.event.flyerImage;

  if (input.validatedInput.removeFlyer && previousFlyer?.storagePath) {
    await deleteFirebaseStorageObjectIfPresent(previousFlyer.storagePath);
    nextEvent = await updateEventInFirebase(input.event.id, {
      flyerImage: null,
    });
    await createAuditLogInFirebase({
      entityType: "event",
      entityId: input.event.id,
      action: "event_flyer_deleted",
      actorId: input.actorUserId,
      actorType: input.actorType,
      actorRole: input.actorRole,
      before: { flyerImage: previousFlyer },
      after: { flyerImage: null },
      note: "Event flyer removed.",
    });
  }

  if (input.validatedInput.flyerUpload) {
    const flyerImage = await uploadEventFlyerToFirebaseStorage({
      churchId: input.event.churchId,
      eventId: input.event.id,
      uploadFile: input.validatedInput.flyerUpload,
      alt:
        input.validatedInput.flyerAlt ??
        `${input.event.title} event flyer`,
    });

    nextEvent = await updateEventInFirebase(input.event.id, {
      flyerImage,
    });

    if (previousFlyer?.storagePath && previousFlyer.storagePath !== flyerImage.storagePath) {
      await deleteFirebaseStorageObjectIfPresent(previousFlyer.storagePath);
    }

    await createAuditLogInFirebase({
      entityType: "event",
      entityId: input.event.id,
      action: previousFlyer ? "event_flyer_replaced" : "event_flyer_uploaded",
      actorId: input.actorUserId,
      actorType: input.actorType,
      actorRole: input.actorRole,
      before: { flyerImage: previousFlyer ?? null },
      after: { flyerImage },
      note: previousFlyer ? "Event flyer replaced." : "Event flyer uploaded.",
    });
  } else if (input.validatedInput.flyerAlt && previousFlyer) {
    nextEvent = await updateEventInFirebase(input.event.id, {
      flyerImage: {
        ...previousFlyer,
        alt: input.validatedInput.flyerAlt,
      },
    });
  }

  return nextEvent;
}

export async function listManageableEventsForChurch(input: {
  churchId: string;
  actorUserId: string;
  status?: EventStatus | "all";
  limit?: number;
}) {
  await requireChurchEventManagementAccess({
    userId: input.actorUserId,
    churchId: input.churchId,
  });

  return listEventsForChurchFromFirebase({
    churchId: input.churchId,
    status: input.status,
    limit: input.limit,
  });
}

export async function createManagedEvent(input: {
  churchId: string;
  actorUserId: string;
  validatedInput: ValidatedEventInput;
  publishNow: boolean;
}) {
  const access = await requireChurchEventManagementAccess({
    userId: input.actorUserId,
    churchId: input.churchId,
  });
  const eventId = randomUUID();
  const slug = await createUniqueEventSlugFromFirebase({
    title: input.validatedInput.title,
  });
  const status: EventStatus = input.publishNow
    ? input.validatedInput.visibility === "unlisted"
      ? "unlisted"
      : "published"
    : "draft";
  const event = buildEventRecord({
    eventId,
    church: access.church,
    actorUserId: input.actorUserId,
    actorName: access.profile.name,
    validatedInput: input.validatedInput,
    status,
    slug,
  });
  let savedEvent = await saveEventToFirebase(event);

  await createAuditLogInFirebase({
    entityType: "event",
    entityId: savedEvent.id,
    action: "event_created",
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    after: { eventId: savedEvent.id, churchId: savedEvent.churchId, status: savedEvent.status },
    note: `Event created for ${access.church.name}.`,
  });

  if (savedEvent.status === "published" || savedEvent.status === "unlisted") {
    await createAuditLogInFirebase({
      entityType: "event",
      entityId: savedEvent.id,
      action: "event_published",
      actorId: input.actorUserId,
      actorType: access.actorType,
      actorRole: access.actorRole,
      after: { eventId: savedEvent.id, status: savedEvent.status },
      note: "Event published from the event editor.",
    });
  }

  savedEvent = await maybeApplyFlyer({
    event: savedEvent,
    validatedInput: input.validatedInput,
    action: "event_created",
    actorUserId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
  });
  await syncPublicEventFromFirebase(savedEvent);

  return savedEvent;
}

export async function updateManagedEvent(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
  validatedInput: ValidatedEventInput;
  publishNow?: boolean;
}) {
  const access = await assertEventChurchAccess({
    eventId: input.eventId,
    churchId: input.churchId,
    actorUserId: input.actorUserId,
  });
  const nextStatus: EventStatus = input.publishNow
    ? input.validatedInput.visibility === "unlisted"
      ? "unlisted"
      : "published"
    : access.event.status;

  assertAllowedTransition(access.event.status, nextStatus);

  const nextEvent = buildEventRecord({
    eventId: access.event.id,
    church: access.church,
    actorUserId: input.actorUserId,
    actorName: access.profile.name,
    validatedInput: input.validatedInput,
    status: nextStatus,
    slug: access.event.slug,
    existingEvent: access.event,
  });
  let savedEvent = await saveEventToFirebase(nextEvent);

  await createAuditLogInFirebase({
    entityType: "event",
    entityId: savedEvent.id,
    action: "event_updated",
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    before: { status: access.event.status, updatedAt: access.event.updatedAt },
    after: { status: savedEvent.status, updatedAt: savedEvent.updatedAt },
    note: "Event details updated.",
  });

  if (access.event.status !== savedEvent.status && (savedEvent.status === "published" || savedEvent.status === "unlisted")) {
    await createAuditLogInFirebase({
      entityType: "event",
      entityId: savedEvent.id,
      action: "event_published",
      actorId: input.actorUserId,
      actorType: access.actorType,
      actorRole: access.actorRole,
      before: { status: access.event.status },
      after: { status: savedEvent.status },
      note: "Event published.",
    });
  }

  savedEvent = await maybeApplyFlyer({
    event: savedEvent,
    validatedInput: input.validatedInput,
    action: "event_updated",
    actorUserId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
  });
  await syncPublicEventFromFirebase(savedEvent);

  return savedEvent;
}

export async function transitionManagedEvent(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
  nextStatus: EventStatus;
  cancellationMessage?: string;
}) {
  const access = await assertEventChurchAccess({
    eventId: input.eventId,
    churchId: input.churchId,
    actorUserId: input.actorUserId,
  });

  assertAllowedTransition(access.event.status, input.nextStatus);

  const now = new Date().toISOString();
  const updatedEvent = await updateEventInFirebase(access.event.id, {
    status: input.nextStatus,
    visibility:
      input.nextStatus === "unlisted"
        ? "unlisted"
        : input.nextStatus === "published"
          ? "public"
          : access.event.visibility,
    cancellationMessage:
      input.nextStatus === "cancelled"
        ? input.cancellationMessage ?? access.event.cancellationMessage ?? "This event has been cancelled."
        : access.event.cancellationMessage,
    cancelledAt: input.nextStatus === "cancelled" ? now : access.event.cancelledAt ?? null,
    archivedAt:
      input.nextStatus === "archived"
        ? now
        : input.nextStatus === "draft"
          ? null
          : access.event.archivedAt ?? null,
    lastEditedByUserId: input.actorUserId,
    lastEditedByName: access.profile.name,
    wasPublished:
      access.event.wasPublished || input.nextStatus === "published" || input.nextStatus === "unlisted",
    publishedAt:
      (input.nextStatus === "published" || input.nextStatus === "unlisted") && !access.event.publishedAt
        ? now
        : access.event.publishedAt ?? null,
  });
  await syncPublicEventFromFirebase(updatedEvent);

  await createAuditLogInFirebase({
    entityType: "event",
    entityId: access.event.id,
    action: `event_${input.nextStatus}`,
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    before: { status: access.event.status },
    after: { status: updatedEvent.status },
    note: `Event status changed to ${input.nextStatus}.`,
  });

  if (input.nextStatus === "cancelled") {
    const notificationCount = await scheduleEventCancellationNotifications({
      eventId: updatedEvent.id,
      churchId: updatedEvent.churchId,
      actorUserId: input.actorUserId,
      cancelledAt: updatedEvent.cancelledAt ?? now,
    });
    await createAuditLogInFirebase({
      entityType: "event",
      entityId: updatedEvent.id,
      action: "event_cancellation_notifications_scheduled",
      actorId: input.actorUserId,
      actorType: access.actorType,
      actorRole: access.actorRole,
      after: { notificationCount },
      note: "Cancellation notification jobs scheduled without registration answers.",
    });
  }

  return updatedEvent;
}

export async function duplicateManagedEvent(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const access = await assertEventChurchAccess({
    eventId: input.eventId,
    churchId: input.churchId,
    actorUserId: input.actorUserId,
  });
  const now = new Date().toISOString();
  const duplicateId = randomUUID();
  const duplicateTitle = `${access.event.title} Copy`;
  const duplicateSlug = await createUniqueEventSlugFromFirebase({
    title: duplicateTitle,
  });
  const duplicateEvent: EventRecord = {
    ...access.event,
    id: duplicateId,
    title: duplicateTitle,
    slug: duplicateSlug,
    status: "draft",
    visibility: "public",
    flyerImage: null,
    createdByUserId: input.actorUserId,
    createdByName: access.profile.name,
    lastEditedByUserId: input.actorUserId,
    lastEditedByName: access.profile.name,
    createdAt: now,
    updatedAt: now,
    publishedAt: null,
    cancelledAt: null,
    archivedAt: null,
    cancellationMessage: null,
    wasPublished: false,
  };
  const savedEvent = await saveEventToFirebase(duplicateEvent);

  await createAuditLogInFirebase({
    entityType: "event",
    entityId: access.event.id,
    action: "event_duplicated",
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    after: { duplicateEventId: savedEvent.id },
    note: "Event duplicated into a new draft.",
  });

  await createAuditLogInFirebase({
    entityType: "event",
    entityId: savedEvent.id,
    action: "event_created",
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    after: { sourceEventId: access.event.id, eventId: savedEvent.id, status: "draft" },
    note: "Draft event created from duplicate action.",
  });

  return savedEvent;
}

export async function deleteManagedDraftEvent(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const access = await assertEventChurchAccess({
    eventId: input.eventId,
    churchId: input.churchId,
    actorUserId: input.actorUserId,
  });

  if (access.event.status !== "draft") {
    throw new Error("Only draft events can be deleted. Cancel or archive published events instead.");
  }

  if (access.event.flyerImage?.storagePath) {
    await deleteFirebaseStorageObjectIfPresent(access.event.flyerImage.storagePath);
  }

  await deleteEventFromFirebase(access.event.id);
  await createAuditLogInFirebase({
    entityType: "event",
    entityId: access.event.id,
    action: "event_draft_deleted",
    actorId: input.actorUserId,
    actorType: access.actorType,
    actorRole: access.actorRole,
    before: { eventId: access.event.id, churchId: access.event.churchId },
    note: "Draft event deleted.",
  });
}

export async function getManageableEvent(input: {
  eventId: string;
  churchId: string;
  actorUserId: string;
}) {
  const access = await assertEventChurchAccess(input);
  return access.event;
}
