"use server";

import { redirect } from "next/navigation";

import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import {
  createManagedEvent,
  deleteManagedDraftEvent,
  duplicateManagedEvent,
  transitionManagedEvent,
  updateManagedEvent,
} from "@/lib/services/event-management-service";
import { validateEventFormData } from "@/lib/validation/event-management";

function buildRedirectWithMessage(pathname: string, key: "success" | "error", value: string) {
  const separator = pathname.includes("?") ? "&" : "?";
  return `${pathname}${separator}${key}=${encodeURIComponent(value)}`;
}

function getRequiredString(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing required field: ${fieldName}.`);
  }

  return value.trim();
}

async function requirePortalActor() {
  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();

  if (!authenticatedUser?.profile) {
    redirect("/portal/login");
  }

  return authenticatedUser.profile;
}

export async function saveEventAction(formData: FormData) {
  const actor = await requirePortalActor();
  const eventId = typeof formData.get("eventId") === "string" ? String(formData.get("eventId")).trim() : "";
  const intent = getRequiredString(formData, "intent");
  const churchId = getRequiredString(formData, "churchId");
  const redirectBase = eventId ? `/portal/events/${eventId}/edit` : "/portal/events/new";
  let redirectTo = "";

  try {
    const validatedInput = await validateEventFormData(formData);
    const publishNow = intent === "publish";
    const savedEvent = eventId
      ? await updateManagedEvent({
          eventId,
          churchId,
          actorUserId: actor.id,
          validatedInput,
          publishNow,
        })
      : await createManagedEvent({
          churchId,
          actorUserId: actor.id,
          validatedInput,
          publishNow,
        });

    redirectTo = buildRedirectWithMessage(
      `/portal/events/${savedEvent.id}/edit`,
      "success",
      publishNow ? "event-published" : "event-saved",
    );
  } catch (error) {
    redirect(
      buildRedirectWithMessage(
        redirectBase,
        "error",
        error instanceof Error ? error.message : "Unable to save the event.",
      ),
    );
  }

  redirect(redirectTo);
}

export async function eventQuickAction(formData: FormData) {
  const actor = await requirePortalActor();
  const eventId = getRequiredString(formData, "eventId");
  const churchId = getRequiredString(formData, "churchId");
  const intent = getRequiredString(formData, "intent");
  let redirectTo = buildRedirectWithMessage("/portal/events", "success", `event-${intent}`);

  try {
    if (intent === "duplicate") {
      const duplicateEvent = await duplicateManagedEvent({
        eventId,
        churchId,
        actorUserId: actor.id,
      });

      redirectTo = buildRedirectWithMessage(
        `/portal/events/${duplicateEvent.id}/edit`,
        "success",
        "event-duplicated",
      );
    } else if (intent === "delete_draft") {
      await deleteManagedDraftEvent({
        eventId,
        churchId,
        actorUserId: actor.id,
      });
      redirectTo = buildRedirectWithMessage("/portal/events", "success", "draft-deleted");
    } else if (intent === "publish") {
      await transitionManagedEvent({
        eventId,
        churchId,
        actorUserId: actor.id,
        nextStatus: "published",
      });
    } else if (intent === "unpublish") {
      await transitionManagedEvent({
        eventId,
        churchId,
        actorUserId: actor.id,
        nextStatus: "unlisted",
      });
    } else if (intent === "cancel") {
      await transitionManagedEvent({
        eventId,
        churchId,
        actorUserId: actor.id,
        nextStatus: "cancelled",
        cancellationMessage:
          typeof formData.get("cancellationMessage") === "string"
            ? String(formData.get("cancellationMessage")).trim()
            : undefined,
      });
    } else if (intent === "archive") {
      await transitionManagedEvent({
        eventId,
        churchId,
        actorUserId: actor.id,
        nextStatus: "archived",
      });
    } else if (intent === "restore") {
      await transitionManagedEvent({
        eventId,
        churchId,
        actorUserId: actor.id,
        nextStatus: "draft",
      });
    } else {
      throw new Error("That event action is not supported.");
    }
  } catch (error) {
    redirect(
      buildRedirectWithMessage(
        "/portal/events",
        "error",
        error instanceof Error ? error.message : "Unable to update the event.",
      ),
    );
  }

  redirect(redirectTo);
}
