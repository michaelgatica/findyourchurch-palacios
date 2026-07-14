import { revalidatePath } from "next/cache";

import { getEventByIdFromFirebase, syncPublicEventFromFirebase, updateEventInFirebase } from "@/lib/repositories/firebase-event-repository";
import {
  listAdminEventsFromFirebase,
  listEventCategoriesFromFirebase,
  listEventReportsFromFirebase,
  updateEventReportInFirebase,
  upsertEventCategoryInFirebase,
  type AdminEventListFilters,
} from "@/lib/repositories/firebase-event-admin-repository";
import { createAuditLogInFirebase, listAuditLogsForEntity } from "@/lib/repositories/firebase-audit-log-repository";
import { createOperationalEvent } from "@/lib/services/operational-log-service";
import type {
  EventCategoryGroup,
  EventReportStatus,
  EventStatus,
} from "@/lib/types/events";

function assertAdminProfile(actor: { profile?: { role?: string; name?: string } | null } | null) {
  if (!actor || actor.profile?.role !== "admin") {
    throw new Error("Platform administrator access is required.");
  }
}

function assertPlatformTransition(currentStatus: EventStatus, nextStatus: EventStatus) {
  if (currentStatus === nextStatus) return;
  if (nextStatus === "published" && ["draft", "pending_review", "unlisted"].includes(currentStatus)) return;
  if (nextStatus === "unlisted" && ["published", "draft", "pending_review"].includes(currentStatus)) return;
  if (nextStatus === "cancelled" && ["published", "unlisted"].includes(currentStatus)) return;
  if (nextStatus === "archived" && ["published", "cancelled", "completed", "unlisted"].includes(currentStatus)) return;
  if (nextStatus === "draft" && currentStatus === "archived") return;
  throw new Error(`Platform events cannot move from ${currentStatus} to ${nextStatus}.`);
}

export async function listPlatformEvents(filters: AdminEventListFilters = {}) {
  return listAdminEventsFromFirebase(filters);
}

export async function getPlatformEventDetails(eventId: string) {
  const event = await getEventByIdFromFirebase(eventId);
  if (!event) return null;
  const auditLogs = await listAuditLogsForEntity("event", event.id);

  return {
    event,
    auditLogs,
  };
}

export async function transitionPlatformEvent(input: {
  eventId: string;
  nextStatus: EventStatus;
  actorUserId: string;
  actorName: string;
  note?: string | null;
}) {
  const event = await getEventByIdFromFirebase(input.eventId);
  if (!event) throw new Error("The event could not be found.");
  assertPlatformTransition(event.status, input.nextStatus);
  const now = new Date().toISOString();
  const updated = await updateEventInFirebase(event.id, {
    status: input.nextStatus,
    visibility:
      input.nextStatus === "published"
        ? "public"
        : input.nextStatus === "unlisted"
          ? "unlisted"
          : event.visibility,
    moderationNote: input.note ?? event.moderationNote ?? null,
    cancelledAt: input.nextStatus === "cancelled" ? now : event.cancelledAt ?? null,
    archivedAt: input.nextStatus === "archived" ? now : input.nextStatus === "draft" ? null : event.archivedAt ?? null,
    publishedAt:
      (input.nextStatus === "published" || input.nextStatus === "unlisted") && !event.publishedAt
        ? now
        : event.publishedAt ?? null,
    wasPublished: event.wasPublished || input.nextStatus === "published" || input.nextStatus === "unlisted",
    lastEditedByUserId: input.actorUserId,
    lastEditedByName: input.actorName,
  });
  await syncPublicEventFromFirebase(updated);
  await createAuditLogInFirebase({
    entityType: "event",
    entityId: event.id,
    action: `platform_event_${input.nextStatus}`,
    actorId: input.actorUserId,
    actorType: "admin",
    actorRole: "admin",
    before: { status: event.status },
    after: { status: updated.status },
    note: input.note ?? `Platform administrator changed event status to ${input.nextStatus}.`,
  });
  await createOperationalEvent({
    type: "platform_event_status_changed",
    severity: input.nextStatus === "cancelled" || input.nextStatus === "archived" ? "warning" : "info",
    entityType: "event",
    entityId: event.id,
    actorId: input.actorUserId,
    summary: "Platform administrator changed an event status.",
    metadata: { from: event.status, to: updated.status },
  });
  revalidatePath("/admin/events");
  revalidatePath("/events");
  return updated;
}

export async function setPlatformEventFeatured(input: {
  eventId: string;
  featured: boolean;
  actorUserId: string;
}) {
  const event = await getEventByIdFromFirebase(input.eventId);
  if (!event) throw new Error("The event could not be found.");
  const updated = await updateEventInFirebase(event.id, { isFeatured: input.featured });
  await syncPublicEventFromFirebase(updated);
  await createAuditLogInFirebase({
    entityType: "event",
    entityId: event.id,
    action: input.featured ? "platform_event_featured" : "platform_event_unfeatured",
    actorId: input.actorUserId,
    actorType: "admin",
    actorRole: "admin",
    before: { isFeatured: event.isFeatured },
    after: { isFeatured: updated.isFeatured },
  });
  await createOperationalEvent({
    type: input.featured ? "platform_event_featured" : "platform_event_unfeatured",
    severity: "info",
    entityType: "event",
    entityId: event.id,
    actorId: input.actorUserId,
    summary: "Platform administrator changed event featured status.",
  });
  revalidatePath("/admin/events");
  revalidatePath("/");
  return updated;
}

export async function setPlatformEventEditingLock(input: {
  eventId: string;
  locked: boolean;
  actorUserId: string;
  note?: string | null;
}) {
  const event = await getEventByIdFromFirebase(input.eventId);
  if (!event) throw new Error("The event could not be found.");
  const now = new Date().toISOString();
  const updated = await updateEventInFirebase(event.id, {
    editingLocked: input.locked,
    editingLockedAt: input.locked ? now : null,
    editingLockedByUserId: input.locked ? input.actorUserId : null,
    moderationNote: input.note ?? event.moderationNote ?? null,
  });
  await createAuditLogInFirebase({
    entityType: "event",
    entityId: event.id,
    action: input.locked ? "platform_event_editing_locked" : "platform_event_editing_unlocked",
    actorId: input.actorUserId,
    actorType: "admin",
    actorRole: "admin",
    note: input.note ?? undefined,
  });
  await createOperationalEvent({
    type: input.locked ? "platform_event_editing_locked" : "platform_event_editing_unlocked",
    severity: input.locked ? "warning" : "info",
    entityType: "event",
    entityId: event.id,
    actorId: input.actorUserId,
    summary: "Platform administrator changed event editing lock.",
  });
  revalidatePath("/admin/events");
  return updated;
}

export async function listPlatformCategories(group?: EventCategoryGroup | "all") {
  return listEventCategoriesFromFirebase(group);
}

export async function savePlatformCategory(input: {
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
  const category = await upsertEventCategoryInFirebase(input);
  await createAuditLogInFirebase({
    entityType: "eventCategory",
    entityId: category.id,
    action: input.id ? "event_category_updated" : "event_category_created",
    actorId: input.actorUserId,
    actorType: "admin",
    actorRole: "admin",
    after: { key: category.key, group: category.group, label: category.label, isActive: category.isActive },
  });
  revalidatePath("/admin/event-categories");
  return category;
}

export async function listPlatformEventReports(input: {
  status?: EventReportStatus | "all";
  cursor?: string;
  limit?: number;
} = {}) {
  return listEventReportsFromFirebase(input);
}

export async function updatePlatformEventReport(input: {
  reportId: string;
  status: EventReportStatus;
  internalNote?: string | null;
  actorUserId: string;
}) {
  const report = await updateEventReportInFirebase(input.reportId, {
    status: input.status,
    internalNote: input.internalNote ?? null,
    resolvedAt: input.status === "resolved" || input.status === "dismissed" ? new Date().toISOString() : null,
  });
  await createAuditLogInFirebase({
    entityType: "eventReport",
    entityId: input.reportId,
    action: `event_report_${input.status}`,
    actorId: input.actorUserId,
    actorType: "admin",
    actorRole: "admin",
    after: { status: input.status },
    note: input.internalNote ?? undefined,
  });
  revalidatePath("/admin/event-reports");
  return report;
}

export { assertAdminProfile };
