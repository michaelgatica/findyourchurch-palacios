"use server";

import { redirect } from "next/navigation";

import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import {
  deleteManagedDraftEvent,
  duplicateManagedEvent,
  transitionManagedEvent,
} from "@/lib/services/event-management-service";
import {
  getEventEditorSubmissionEventId,
  saveEventEditorSubmission,
} from "@/lib/services/event-editor-submission-service";

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
  const eventId = getEventEditorSubmissionEventId(formData);
  const redirectBase = eventId ? `/portal/events/${eventId}/edit` : "/portal/events/new";
  let redirectTo = "";

  try {
    const result = await saveEventEditorSubmission({ formData, actorUserId: actor.id });

    redirectTo = buildRedirectWithMessage(
      `/portal/events/${result.event.id}/edit`,
      "success",
      result.publishNow ? "event-published" : "event-saved",
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
