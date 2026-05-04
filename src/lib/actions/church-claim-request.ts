"use server";

import { redirect } from "next/navigation";

import { buildChurchClaimPath } from "@/lib/config/site";
import type { ClaimRequestFormState, ClaimRequestFormValues } from "@/lib/claim-request-form-state";
import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import { createPendingChurchClaimRequest } from "@/lib/services/church-claim-service";

function readFormValue(formData: FormData, fieldName: keyof ClaimRequestFormValues) {
  const value = formData.get(fieldName);
  return typeof value === "string" ? value.trim() : "";
}

function readFormCheckboxValue(formData: FormData, fieldName: keyof ClaimRequestFormValues) {
  return formData.get(fieldName) === "on";
}

function isValidEmailAddress(value: string) {
  return /\S+@\S+\.\S+/.test(value);
}

export async function submitChurchClaimRequestAction(
  _previousState: ClaimRequestFormState,
  formData: FormData,
): Promise<ClaimRequestFormState> {
  const values: ClaimRequestFormValues = {
    churchId: readFormValue(formData, "churchId"),
    churchSlug: readFormValue(formData, "churchSlug"),
    churchName: readFormValue(formData, "churchName"),
    requesterName: readFormValue(formData, "requesterName"),
    requesterEmail: readFormValue(formData, "requesterEmail"),
    requesterPhone: readFormValue(formData, "requesterPhone"),
    requesterRoleTitle: readFormValue(formData, "requesterRoleTitle"),
    relationshipToChurch: readFormValue(formData, "relationshipToChurch"),
    proofOrExplanation: readFormValue(formData, "proofOrExplanation"),
    communicationConsent: readFormCheckboxValue(formData, "communicationConsent"),
    termsAccepted: readFormCheckboxValue(formData, "termsAccepted"),
    followUpEmailOptIn: readFormCheckboxValue(formData, "followUpEmailOptIn"),
  };
  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();

  if (!authenticatedUser) {
    return {
      status: "error",
      formError: "Please sign in before submitting a church access request.",
      errors: {},
      values,
    };
  }

  const errors: ClaimRequestFormState["errors"] = {};

  if (values.requesterName.length < 2) {
    errors.requesterName = "Please enter your name.";
  }

  if (!isValidEmailAddress(values.requesterEmail)) {
    errors.requesterEmail = "Please enter a valid email address.";
  }

  if (
    authenticatedUser.email &&
    values.requesterEmail.toLowerCase() !== authenticatedUser.email.toLowerCase()
  ) {
    errors.requesterEmail =
      "Please use the same email address that is tied to the signed-in account.";
  }

  if (values.requesterRoleTitle.length < 2) {
    errors.requesterRoleTitle = "Please enter your role or title.";
  }

  if (values.relationshipToChurch.length < 5) {
    errors.relationshipToChurch = "Please explain your relationship to the church.";
  }

  if (values.proofOrExplanation.length < 20) {
    errors.proofOrExplanation =
      "Please provide enough detail for the ministry team to review the request.";
  }

  if (!values.communicationConsent) {
    errors.communicationConsent =
      "Please confirm that we may email you about this request and review process.";
  }

  if (!values.termsAccepted) {
    errors.termsAccepted = "Please agree to the Terms and Privacy Policy before submitting.";
  }

  if (!values.churchId || !values.churchSlug || !values.churchName) {
    return {
      status: "error",
      formError: "The church listing could not be identified. Please return to the church profile and try again.",
      errors,
      values,
    };
  }

  if (Object.keys(errors).length > 0) {
    return {
      status: "error",
      formError: "Please review the highlighted fields and try again.",
      errors,
      values,
    };
  }

  try {
    await createPendingChurchClaimRequest({
      churchId: values.churchId,
      requesterUserId: authenticatedUser.firebaseUid,
      requesterName: values.requesterName,
      requesterEmail: values.requesterEmail,
      requesterPhone: values.requesterPhone || undefined,
      requesterRoleTitle: values.requesterRoleTitle,
      relationshipToChurch: values.relationshipToChurch,
      proofOrExplanation: values.proofOrExplanation,
      communicationConsent: values.communicationConsent,
      termsAccepted: values.termsAccepted,
      followUpEmailOptIn: values.followUpEmailOptIn,
    });
  } catch (error) {
    console.error("Failed to create church claim request", error);

    return {
      status: "error",
      formError:
        "We could not save your request right now. Please try again in a moment.",
      errors: {},
      values,
    };
  }

  redirect(
    `${buildChurchClaimPath(values.churchSlug)}/confirmation?church=${encodeURIComponent(
      values.churchName,
    )}`,
  );
}
