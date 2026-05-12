"use server";

import { redirect } from "next/navigation";

import {
  getChurchByCustomShareSlugFromFirebase,
  getChurchByIdFromFirebase,
} from "@/lib/repositories/firebase-church-repository";
import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import type { ChurchListingFormState } from "@/lib/portal-church-form-state";
import { sendRepresentativeChurchMessage } from "@/lib/services/church-messaging-service";
import { submitRepresentativeChurchUpdate } from "@/lib/services/church-update-service";
import {
  createOwnershipTransferRequest,
  inviteChurchEditor,
} from "@/lib/services/representative-team-service";
import { requireRepresentativeChurchAccess } from "@/lib/services/representative-access-service";
import { validateChurchListingUpdateFormData } from "@/lib/validation/church-listing-update";

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

export async function updateChurchListingAction(
  _previousState: ChurchListingFormState,
  formData: FormData,
): Promise<ChurchListingFormState> {
  const churchId = getRequiredString(formData, "churchId");
  const currentChurch = await getChurchByIdFromFirebase(churchId);

  if (!currentChurch) {
    throw new Error("The church listing could not be found.");
  }

  const validationResult = await validateChurchListingUpdateFormData(
    formData,
    currentChurch,
  );

  if (!validationResult.success) {
    return {
      status: "error",
      formError: validationResult.formError,
      errors: validationResult.errors,
      values: validationResult.values,
    };
  }

  if (validationResult.data.customShareSlug) {
    const existingChurch = await getChurchByCustomShareSlugFromFirebase(
      validationResult.data.customShareSlug,
    );

    if (existingChurch && existingChurch.id !== churchId) {
      return {
        status: "error",
        formError: "Please choose a different custom share link.",
        errors: {
          customShareSlug:
            "That custom share link is already being used by another church.",
        },
        values: validationResult.values,
      };
    }
  }

  const actor = await requirePortalActor();
  let redirectTo: string;

  try {
    const access = await requireRepresentativeChurchAccess({
      userId: actor.id,
      churchId,
    });
    const result = await submitRepresentativeChurchUpdate({
      currentChurch,
      validatedInput: validationResult.data,
      uploads: validationResult.uploads,
      submittedByUserId: actor.id,
      submittedByRepresentativeId: access.representative.id,
      representativeEmail: access.profile.email,
    });

    redirectTo =
      result.mode === "auto_published"
        ? buildRedirectWithMessage("/portal", "success", "listing-updated")
        : buildRedirectWithMessage(
            "/portal/updates",
            "success",
            "updates-submitted",
          );
  } catch (error) {
    return {
      status: "error",
      formError:
        error instanceof Error
          ? error.message
          : "We could not save your church listing changes right now.",
      errors:
        error instanceof Error && error.message.toLowerCase().includes("custom share link")
          ? {
              customShareSlug: error.message,
            }
          : {},
      values: validationResult.values,
    };
  }

  redirect(redirectTo);
}

export async function sendRepresentativeChurchMessageAction(formData: FormData) {
  const actor = await requirePortalActor();
  const churchId = getRequiredString(formData, "churchId");
  const redirectTo = "/portal/messages";

  try {
    await requireRepresentativeChurchAccess({
      userId: actor.id,
      churchId,
    });
    await sendRepresentativeChurchMessage({
      churchId,
      senderUserId: actor.id,
      messageBody: getRequiredString(formData, "messageBody"),
    });
  } catch (error) {
    redirect(
      buildRedirectWithMessage(
        redirectTo,
        "error",
        error instanceof Error ? error.message : "Unable to send the message.",
      ),
    );
  }

  redirect(buildRedirectWithMessage(redirectTo, "success", "message-sent"));
}

export async function inviteChurchEditorAction(formData: FormData) {
  const actor = await requirePortalActor();
  const churchId = getRequiredString(formData, "churchId");
  const redirectTo = "/portal/team";

  try {
    await inviteChurchEditor({
      churchId,
      actorUserId: actor.id,
      editorName: getRequiredString(formData, "editorName"),
      editorEmail: getRequiredString(formData, "editorEmail"),
      editorPhone:
        typeof formData.get("editorPhone") === "string"
          ? String(formData.get("editorPhone")).trim() || undefined
          : undefined,
      editorRoleTitle: getRequiredString(formData, "editorRoleTitle"),
    });
  } catch (error) {
    redirect(
      buildRedirectWithMessage(
        redirectTo,
        "error",
        error instanceof Error ? error.message : "Unable to invite an editor.",
      ),
    );
  }

  redirect(buildRedirectWithMessage(redirectTo, "success", "editor-invited"));
}

export async function requestOwnershipTransferAction(formData: FormData) {
  const actor = await requirePortalActor();
  const churchId = getRequiredString(formData, "churchId");
  const redirectTo = "/portal/transfer-ownership";

  try {
    await createOwnershipTransferRequest({
      churchId,
      actorUserId: actor.id,
      newOwnerName: getRequiredString(formData, "newOwnerName"),
      newOwnerEmail: getRequiredString(formData, "newOwnerEmail"),
      newOwnerPhone:
        typeof formData.get("newOwnerPhone") === "string"
          ? String(formData.get("newOwnerPhone")).trim() || undefined
          : undefined,
      newOwnerRoleTitle: getRequiredString(formData, "newOwnerRoleTitle"),
      reasonMessage: getRequiredString(formData, "reasonMessage"),
    });
  } catch (error) {
    redirect(
      buildRedirectWithMessage(
        redirectTo,
        "error",
        error instanceof Error
          ? error.message
          : "Unable to submit the ownership transfer request.",
      ),
    );
  }

  redirect(buildRedirectWithMessage(redirectTo, "success", "transfer-requested"));
}
