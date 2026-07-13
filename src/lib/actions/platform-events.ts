"use server";

import { revalidatePath } from "next/cache";

import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import {
  assertAdminProfile,
  savePlatformCategory,
  setPlatformEventEditingLock,
  setPlatformEventFeatured,
  transitionPlatformEvent,
  updatePlatformEventReport,
} from "@/lib/services/platform-event-admin-service";
import { eventCategoryGroups, eventReportStatuses, eventStatuses } from "@/lib/types/events";

async function requireAdminActor() {
  const actor = await getServerAuthenticatedUserFromSessionCookie();
  assertAdminProfile(actor);
  return {
    userId: actor!.firebaseUid,
    name: actor!.profile?.name ?? actor!.email ?? "Platform Admin",
  };
}

export async function transitionPlatformEventAction(formData: FormData) {
  const actor = await requireAdminActor();
  const eventId = String(formData.get("eventId") ?? "");
  const nextStatus = String(formData.get("nextStatus") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!eventId || !eventStatuses.includes(nextStatus as never)) {
    throw new Error("A valid event and status are required.");
  }

  await transitionPlatformEvent({
    eventId,
    nextStatus: nextStatus as never,
    actorUserId: actor.userId,
    actorName: actor.name,
    note: note || null,
  });
  revalidatePath("/admin/events");
}

export async function setPlatformEventFeaturedAction(formData: FormData) {
  const actor = await requireAdminActor();
  const eventId = String(formData.get("eventId") ?? "");
  const featured = String(formData.get("featured") ?? "") === "true";

  if (!eventId) throw new Error("A valid event is required.");
  await setPlatformEventFeatured({ eventId, featured, actorUserId: actor.userId });
  revalidatePath("/admin/events");
}

export async function setPlatformEventEditingLockAction(formData: FormData) {
  const actor = await requireAdminActor();
  const eventId = String(formData.get("eventId") ?? "");
  const locked = String(formData.get("locked") ?? "") === "true";
  const note = String(formData.get("note") ?? "").trim();

  if (!eventId) throw new Error("A valid event is required.");
  await setPlatformEventEditingLock({ eventId, locked, actorUserId: actor.userId, note: note || null });
  revalidatePath("/admin/events");
}

export async function savePlatformCategoryAction(formData: FormData) {
  const actor = await requireAdminActor();
  const id = String(formData.get("id") ?? "").trim();
  const group = String(formData.get("group") ?? "");
  const label = String(formData.get("label") ?? "").trim();
  const key = String(formData.get("key") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const icon = String(formData.get("icon") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = formData.get("isActive") === "on";
  const isPrimary = formData.get("isPrimary") === "on";

  if (!eventCategoryGroups.includes(group as never) || !label) {
    throw new Error("A valid category group and label are required.");
  }

  await savePlatformCategory({
    id: id || undefined,
    key: key || undefined,
    group: group as never,
    label,
    description: description || null,
    icon: icon || null,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    isActive,
    isPrimary,
    actorUserId: actor.userId,
  });
  revalidatePath("/admin/event-categories");
}

export async function updatePlatformEventReportAction(formData: FormData) {
  const actor = await requireAdminActor();
  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "");
  const internalNote = String(formData.get("internalNote") ?? "").trim();

  if (!reportId || !eventReportStatuses.includes(status as never)) {
    throw new Error("A valid report and status are required.");
  }

  await updatePlatformEventReport({
    reportId,
    status: status as never,
    internalNote: internalNote || null,
    actorUserId: actor.userId,
  });
  revalidatePath("/admin/event-reports");
}

