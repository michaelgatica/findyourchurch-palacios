"use server";

import { redirect } from "next/navigation";

import { requireAdminUser } from "@/lib/firebase/session";
import {
  approveClaimRequest,
  denyClaimRequest,
  requestClaimMoreInfo,
  saveClaimInternalNote,
  sendClaimPublicMessage,
} from "@/lib/services/admin-claim-review-service";
import {
  approveUpdateRequest,
  denyUpdateRequest,
  requestUpdateChanges,
  saveUpdateInternalNote,
  sendUpdatePublicMessage,
} from "@/lib/services/admin-update-review-service";
import { sendAdminChurchMessage } from "@/lib/services/church-messaging-service";
import {
  approveOwnershipTransferRequest,
  denyOwnershipTransferRequest,
  suspendRepresentativeAccess,
  toggleChurchAutoPublishUpdates,
} from "@/lib/services/representative-team-service";
import {
  approveSubmission,
  denySubmission,
  requestSubmissionChanges,
  saveSubmissionInternalNote,
  sendSubmissionPublicMessage,
} from "@/lib/services/admin-submission-service";

function getRequiredString(formData: FormData, fieldName: string, errorMessage: string) {
  const value = formData.get(fieldName);

  if (typeof value !== "string" || !value.trim()) {
    throw new Error(errorMessage);
  }

  return value.trim();
}

function getOptionalString(formData: FormData, fieldName: string) {
  const value = formData.get(fieldName);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getRedirectPath(formData: FormData, fallbackPath: string) {
  const value = formData.get("redirectTo");
  return typeof value === "string" && value.startsWith("/") ? value : fallbackPath;
}

async function requireAdminActor() {
  const authenticatedUser = await requireAdminUser("/admin");

  if (!authenticatedUser?.profile || authenticatedUser.profile.role !== "admin") {
    throw new Error("Admin access is required.");
  }

  return authenticatedUser.profile;
}

export async function saveSubmissionInternalNoteAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const submissionId = getRequiredString(
    formData,
    "submissionId",
    "The church submission could not be identified.",
  );
  const note = getRequiredString(formData, "note", "Please enter a note before saving.");
  const redirectTo = getRedirectPath(formData, `/admin/submissions/${submissionId}`);

  await saveSubmissionInternalNote({
    submissionId,
    adminUserId: adminUser.id,
    note,
  });

  redirect(redirectTo);
}

export async function sendSubmissionPublicMessageAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const submissionId = getRequiredString(
    formData,
    "submissionId",
    "The church submission could not be identified.",
  );
  const messageBody = getRequiredString(
    formData,
    "messageBody",
    "Please enter a message before sending.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/submissions/${submissionId}`);

  await sendSubmissionPublicMessage({
    submissionId,
    adminUserId: adminUser.id,
    messageBody,
  });

  redirect(redirectTo);
}

export async function approveSubmissionAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const submissionId = getRequiredString(
    formData,
    "submissionId",
    "The church submission could not be identified.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/submissions/${submissionId}`);

  await approveSubmission({
    submissionId,
    adminUserId: adminUser.id,
    adminMessage: getOptionalString(formData, "adminMessage"),
  });

  redirect(redirectTo);
}

export async function denySubmissionAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const submissionId = getRequiredString(
    formData,
    "submissionId",
    "The church submission could not be identified.",
  );
  const adminMessage = getRequiredString(
    formData,
    "adminMessage",
    "Please enter a message before denying this submission.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/submissions/${submissionId}`);

  await denySubmission({
    submissionId,
    adminUserId: adminUser.id,
    adminMessage,
  });

  redirect(redirectTo);
}

export async function requestSubmissionChangesAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const submissionId = getRequiredString(
    formData,
    "submissionId",
    "The church submission could not be identified.",
  );
  const adminMessage = getRequiredString(
    formData,
    "adminMessage",
    "Please enter a message before requesting changes.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/submissions/${submissionId}`);

  await requestSubmissionChanges({
    submissionId,
    adminUserId: adminUser.id,
    adminMessage,
  });

  redirect(redirectTo);
}

export async function saveClaimInternalNoteAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const claimRequestId = getRequiredString(
    formData,
    "claimRequestId",
    "The church claim request could not be identified.",
  );
  const note = getRequiredString(formData, "note", "Please enter a note before saving.");
  const redirectTo = getRedirectPath(formData, `/admin/claims/${claimRequestId}`);

  await saveClaimInternalNote({
    claimRequestId,
    adminUserId: adminUser.id,
    note,
  });

  redirect(redirectTo);
}

export async function sendClaimPublicMessageAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const claimRequestId = getRequiredString(
    formData,
    "claimRequestId",
    "The church claim request could not be identified.",
  );
  const messageBody = getRequiredString(
    formData,
    "messageBody",
    "Please enter a message before sending.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/claims/${claimRequestId}`);

  await sendClaimPublicMessage({
    claimRequestId,
    adminUserId: adminUser.id,
    messageBody,
  });

  redirect(redirectTo);
}

export async function approveClaimRequestAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const claimRequestId = getRequiredString(
    formData,
    "claimRequestId",
    "The church claim request could not be identified.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/claims/${claimRequestId}`);

  await approveClaimRequest({
    claimRequestId,
    adminUserId: adminUser.id,
  });

  redirect(redirectTo);
}

export async function denyClaimRequestAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const claimRequestId = getRequiredString(
    formData,
    "claimRequestId",
    "The church claim request could not be identified.",
  );
  const adminMessage = getRequiredString(
    formData,
    "adminMessage",
    "Please enter a message before denying this claim request.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/claims/${claimRequestId}`);

  await denyClaimRequest({
    claimRequestId,
    adminUserId: adminUser.id,
    adminMessage,
  });

  redirect(redirectTo);
}

export async function requestClaimMoreInfoAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const claimRequestId = getRequiredString(
    formData,
    "claimRequestId",
    "The church claim request could not be identified.",
  );
  const adminMessage = getRequiredString(
    formData,
    "adminMessage",
    "Please enter a message before requesting more information.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/claims/${claimRequestId}`);

  await requestClaimMoreInfo({
    claimRequestId,
    adminUserId: adminUser.id,
    adminMessage,
  });

  redirect(redirectTo);
}

export async function saveUpdateInternalNoteAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const updateRequestId = getRequiredString(
    formData,
    "updateRequestId",
    "The church update request could not be identified.",
  );
  const note = getRequiredString(formData, "note", "Please enter a note before saving.");
  const redirectTo = getRedirectPath(formData, `/admin/updates/${updateRequestId}`);

  await saveUpdateInternalNote({
    updateRequestId,
    adminUserId: adminUser.id,
    note,
  });

  redirect(redirectTo);
}

export async function sendUpdatePublicMessageAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const updateRequestId = getRequiredString(
    formData,
    "updateRequestId",
    "The church update request could not be identified.",
  );
  const messageBody = getRequiredString(
    formData,
    "messageBody",
    "Please enter a message before sending.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/updates/${updateRequestId}`);

  await sendUpdatePublicMessage({
    updateRequestId,
    adminUserId: adminUser.id,
    messageBody,
  });

  redirect(redirectTo);
}

export async function approveUpdateRequestAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const updateRequestId = getRequiredString(
    formData,
    "updateRequestId",
    "The church update request could not be identified.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/updates/${updateRequestId}`);

  await approveUpdateRequest({
    updateRequestId,
    adminUserId: adminUser.id,
  });

  redirect(redirectTo);
}

export async function denyUpdateRequestAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const updateRequestId = getRequiredString(
    formData,
    "updateRequestId",
    "The church update request could not be identified.",
  );
  const adminMessage = getRequiredString(
    formData,
    "adminMessage",
    "Please enter a message before denying this update request.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/updates/${updateRequestId}`);

  await denyUpdateRequest({
    updateRequestId,
    adminUserId: adminUser.id,
    adminMessage,
  });

  redirect(redirectTo);
}

export async function requestUpdateChangesAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const updateRequestId = getRequiredString(
    formData,
    "updateRequestId",
    "The church update request could not be identified.",
  );
  const adminMessage = getRequiredString(
    formData,
    "adminMessage",
    "Please enter a message before requesting changes.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/updates/${updateRequestId}`);

  await requestUpdateChanges({
    updateRequestId,
    adminUserId: adminUser.id,
    adminMessage,
  });

  redirect(redirectTo);
}

export async function toggleChurchAutoPublishUpdatesAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const churchId = getRequiredString(
    formData,
    "churchId",
    "The church could not be identified.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/churches/${churchId}/representatives`);

  await toggleChurchAutoPublishUpdates({
    churchId,
    adminUserId: adminUser.id,
    autoPublishUpdates: formData.get("autoPublishUpdates") === "on",
  });

  redirect(redirectTo);
}

export async function suspendRepresentativeAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const churchId = getRequiredString(
    formData,
    "churchId",
    "The church could not be identified.",
  );
  const representativeId = getRequiredString(
    formData,
    "representativeId",
    "The representative could not be identified.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/churches/${churchId}/representatives`);

  await suspendRepresentativeAccess({
    churchId,
    representativeId,
    adminUserId: adminUser.id,
  });

  redirect(redirectTo);
}

export async function sendAdminChurchMessageAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const churchId = getRequiredString(
    formData,
    "churchId",
    "The church could not be identified.",
  );
  const recipientEmail = getRequiredString(
    formData,
    "recipientEmail",
    "The recipient email could not be identified.",
  );
  const messageBody = getRequiredString(
    formData,
    "messageBody",
    "Please enter a message before sending.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/churches/${churchId}/representatives`);

  await sendAdminChurchMessage({
    churchId,
    adminUserId: adminUser.id,
    recipientEmail,
    messageBody,
  });

  redirect(redirectTo);
}

export async function approveOwnershipTransferRequestAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const transferRequestId = getRequiredString(
    formData,
    "transferRequestId",
    "The ownership transfer request could not be identified.",
  );
  const churchId = getRequiredString(
    formData,
    "churchId",
    "The church could not be identified.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/churches/${churchId}/representatives`);

  await approveOwnershipTransferRequest({
    transferRequestId,
    adminUserId: adminUser.id,
  });

  redirect(redirectTo);
}

export async function denyOwnershipTransferRequestAction(formData: FormData) {
  const adminUser = await requireAdminActor();
  const transferRequestId = getRequiredString(
    formData,
    "transferRequestId",
    "The ownership transfer request could not be identified.",
  );
  const churchId = getRequiredString(
    formData,
    "churchId",
    "The church could not be identified.",
  );
  const adminMessage = getRequiredString(
    formData,
    "adminMessage",
    "Please enter a message before denying this transfer request.",
  );
  const redirectTo = getRedirectPath(formData, `/admin/churches/${churchId}/representatives`);

  await denyOwnershipTransferRequest({
    transferRequestId,
    adminUserId: adminUser.id,
    adminMessage,
  });

  redirect(redirectTo);
}
