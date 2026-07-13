"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import {
  changeManagedRegistrationStatus,
  createManualRegistration,
  deleteManagedRegistrationData,
  resendManagedRegistrationConfirmation,
  updateManagedRegistration,
} from "@/lib/services/registration-management-service";
import {
  duplicateRegistrationFormFromEvent,
  saveEventRegistrationSetup,
} from "@/lib/services/registration-form-service";
import {
  cancelRegistrationWithAccessToken,
  submitPublicRegistration,
  updateRegistrationWithAccessToken,
} from "@/lib/services/public-registration-service";
import type { RegistrationStatus } from "@/lib/types/registrations";

export interface PublicRegistrationActionState {
  status: "idle" | "error";
  message?: string;
}

function stringValue(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function requiredString(formData: FormData, fieldName: string) {
  const value = stringValue(formData, fieldName);
  if (!value) {
    throw new Error(`Missing required field: ${fieldName}.`);
  }
  return value;
}

function booleanValue(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return value === "on" || value === "true" || value === "1";
}

function nullableNumber(formData: FormData, fieldName: string) {
  const value = stringValue(formData, fieldName);
  return value ? Number(value) : null;
}

function nullableDateTime(formData: FormData, fieldName: string) {
  const value = stringValue(formData, fieldName);
  return value ? new Date(value).toISOString() : null;
}

function safePortalRedirect(formData: FormData, fallback: string) {
  const requestedPath = stringValue(formData, "redirectTo");
  return requestedPath.startsWith("/portal/events/") && !requestedPath.startsWith("//")
    ? requestedPath
    : fallback;
}

async function requirePortalActor() {
  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();
  if (!authenticatedUser?.profile) {
    redirect("/portal/login");
  }
  return authenticatedUser.profile;
}

export async function saveRegistrationSetupAction(formData: FormData) {
  const actor = await requirePortalActor();
  const eventId = requiredString(formData, "eventId");
  const churchId = requiredString(formData, "churchId");
  const mode = requiredString(formData, "mode");
  const sectionsJson = stringValue(formData, "sectionsJson");
  let sectionsInput: unknown = undefined;

  try {
    sectionsInput = sectionsJson ? JSON.parse(sectionsJson) : undefined;
    await saveEventRegistrationSetup({
      eventId,
      churchId,
      actorUserId: actor.id,
      configurationInput: {
        mode,
        opensAt: nullableDateTime(formData, "opensAt"),
        closesAt: nullableDateTime(formData, "closesAt"),
        capacity: nullableNumber(formData, "capacity"),
        capacityUnit: stringValue(formData, "capacityUnit") || "attendees",
        maximumAttendeesPerRegistration: Number(stringValue(formData, "maximumAttendeesPerRegistration") || "10"),
        waitlistEnabled: booleanValue(formData, "waitlistEnabled"),
        waitlistCapacity: nullableNumber(formData, "waitlistCapacity"),
        automaticWaitlistPromotion: booleanValue(formData, "automaticWaitlistPromotion"),
        allowRegistrantEditing: booleanValue(formData, "allowRegistrantEditing"),
        allowRegistrantCancellation: booleanValue(formData, "allowRegistrantCancellation"),
        showCapacityStatus: booleanValue(formData, "showCapacityStatus"),
        confirmationEmailEnabled: booleanValue(formData, "confirmationEmailEnabled"),
        reminderEmailEnabled: booleanValue(formData, "reminderEmailEnabled"),
        organizerNewRegistrationEmail: booleanValue(formData, "organizerNewRegistrationEmail"),
        organizerDailyDigestEmail: booleanValue(formData, "organizerDailyDigestEmail"),
        registrationClosingReportEnabled: booleanValue(formData, "registrationClosingReportEnabled"),
        preEventReportEnabled: booleanValue(formData, "preEventReportEnabled"),
        scheduledReportFormats: formData
          .getAll("scheduledReportFormats")
          .map(String)
          .filter((value): value is "pdf" | "xlsx" => value === "pdf" || value === "xlsx"),
        successMessage: requiredString(formData, "successMessage"),
        closedMessage: requiredString(formData, "closedMessage"),
        waitlistMessage: requiredString(formData, "waitlistMessage"),
        consentText: stringValue(formData, "consentText") || null,
        retentionDays: Number(stringValue(formData, "retentionDays") || "180"),
      },
      sectionsInput,
      formTitle: stringValue(formData, "formTitle"),
      presetId: stringValue(formData, "presetId") || null,
      activate: requiredString(formData, "intent") === "activate",
    });
  } catch (error) {
    redirect(`/portal/events/${eventId}/registration/form?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to save registration settings.")}`);
  }

  redirect(`/portal/events/${eventId}/registration?success=${encodeURIComponent(requiredString(formData, "intent") === "activate" ? "Registration form activated." : "Registration setup saved.")}`);
}

export async function duplicateRegistrationFormAction(formData: FormData) {
  const actor = await requirePortalActor();
  const targetEventId = requiredString(formData, "targetEventId");
  try {
    await duplicateRegistrationFormFromEvent({
      sourceEventId: requiredString(formData, "sourceEventId"),
      targetEventId,
      churchId: requiredString(formData, "churchId"),
      actorUserId: actor.id,
    });
  } catch (error) {
    redirect(`/portal/events/${targetEventId}/registration/form?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to duplicate the registration form.")}`);
  }
  redirect(`/portal/events/${targetEventId}/registration/form?success=Registration+form+copied+as+a+draft.`);
}

export async function submitPublicRegistrationAction(
  _previousState: PublicRegistrationActionState,
  formData: FormData,
): Promise<PublicRegistrationActionState> {
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    const requestIdentity = [
      forwardedFor ?? requestHeaders.get("x-real-ip") ?? "unknown",
      requestHeaders.get("user-agent")?.slice(0, 200) ?? "unknown",
    ].join("|");
    const eventSlug = requiredString(formData, "eventSlug");
    const result = await submitPublicRegistration({
      eventSlug,
      answerPayload: requiredString(formData, "answersJson"),
      idempotencyKey: requiredString(formData, "idempotencyKey"),
      challenge: requiredString(formData, "challenge"),
      honeypot: stringValue(formData, "website"),
      requestIdentity,
    });
    const params = new URLSearchParams({
      confirmation: result.registration.confirmationNumber,
    });
    if (result.accessToken) {
      params.set("manage", result.accessToken);
    }
    redirect(`/events/${eventSlug}/register/confirmation?${params.toString()}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) {
      throw error;
    }
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Unable to submit the registration.",
    };
  }
}

export async function manageRegistrationAction(formData: FormData) {
  const actor = await requirePortalActor();
  const eventId = requiredString(formData, "eventId");
  const churchId = requiredString(formData, "churchId");
  const registrationId = requiredString(formData, "registrationId");
  const intent = requiredString(formData, "intent");
  const returnPath = safePortalRedirect(
    formData,
    `/portal/events/${eventId}/registration/${registrationId}`,
  );
  let redirectPath = `${returnPath}${returnPath.includes("?") ? "&" : "?"}success=Registration+updated.`;

  try {
    if (intent === "update") {
      await updateManagedRegistration({
        registrationId,
        eventId,
        churchId,
        actorUserId: actor.id,
        answerPayload: requiredString(formData, "answersJson"),
        privateOrganizerNotes: stringValue(formData, "privateOrganizerNotes"),
      });
    } else if (intent === "resend_confirmation") {
      await resendManagedRegistrationConfirmation({ registrationId, eventId, churchId, actorUserId: actor.id });
    } else if (intent === "delete_data") {
      await deleteManagedRegistrationData({ registrationId, eventId, churchId, actorUserId: actor.id });
      redirectPath = `/portal/events/${eventId}/registration?success=Registration+personal+data+deleted.`;
    } else {
      const nextStatus = intent.replace("mark_", "") as RegistrationStatus;
      await changeManagedRegistrationStatus({ registrationId, eventId, churchId, actorUserId: actor.id, nextStatus });
    }
  } catch (error) {
    redirect(`${returnPath}${returnPath.includes("?") ? "&" : "?"}error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to update the registration.")}`);
  }
  redirect(redirectPath);
}

export async function createManualRegistrationAction(formData: FormData) {
  const actor = await requirePortalActor();
  const eventId = requiredString(formData, "eventId");
  try {
    await createManualRegistration({
      eventId,
      churchId: requiredString(formData, "churchId"),
      actorUserId: actor.id,
      answerPayload: requiredString(formData, "answersJson"),
    });
  } catch (error) {
    redirect(`/portal/events/${eventId}/registration/new?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to add the registration.")}`);
  }
  redirect(`/portal/events/${eventId}/registration?success=Manual+registration+added.`);
}

export async function registrantUpdateAction(formData: FormData) {
  const accessToken = requiredString(formData, "accessToken");
  try {
    await updateRegistrationWithAccessToken({
      accessToken,
      answerPayload: requiredString(formData, "answersJson"),
    });
  } catch (error) {
    redirect(`/registrations/manage/${encodeURIComponent(accessToken)}?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to update the registration.")}`);
  }
  redirect(`/registrations/manage/${encodeURIComponent(accessToken)}?success=Registration+updated.`);
}

export async function registrantCancelAction(formData: FormData) {
  const accessToken = requiredString(formData, "accessToken");
  try {
    await cancelRegistrationWithAccessToken(accessToken);
  } catch (error) {
    redirect(`/registrations/manage/${encodeURIComponent(accessToken)}?error=${encodeURIComponent(error instanceof Error ? error.message : "Unable to cancel the registration.")}`);
  }
  redirect(`/registrations/manage/${encodeURIComponent(accessToken)}?success=Registration+cancelled.`);
}
