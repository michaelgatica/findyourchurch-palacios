import { buildChurchProfilePath } from "@/lib/config/site";
import { safeRevalidatePath } from "@/lib/revalidation";
import { createAuditLogInFirebase, listAuditLogsForEntity } from "@/lib/repositories/firebase-audit-log-repository";
import { getChurchByIdFromFirebase } from "@/lib/repositories/firebase-church-repository";
import { listEmailLogsForEntity } from "@/lib/repositories/firebase-email-log-repository";
import {
  createMessageInFirebase,
  listMessagesForUpdateRequest,
} from "@/lib/repositories/firebase-message-repository";
import { getRepresentativeById } from "@/lib/repositories/firebase-representative-repository";
import {
  getChurchUpdateRequestById,
  listChurchUpdateRequests,
  updateChurchUpdateRequestInFirebase,
} from "@/lib/repositories/firebase-update-request-repository";
import { getUserById } from "@/lib/repositories/firebase-user-repository";
import {
  buildApprovedChurchRecordFromDraft,
} from "@/lib/services/church-update-service";
import {
  sendRepresentativeUpdateApprovedNotification,
  sendRepresentativeUpdateChangesRequestedNotification,
  sendRepresentativeUpdateDeniedNotification,
  sendRepresentativeUpdateMessageNotification,
} from "@/lib/services/notification-service";

function sortByCreatedAtDescending<T extends { createdAt: string }>(records: T[]) {
  return [...records].sort((leftRecord, rightRecord) =>
    rightRecord.createdAt.localeCompare(leftRecord.createdAt),
  );
}

function createRequiredMessageError() {
  return new Error("A message is required for this action.");
}

export async function listAdminUpdateRequests(status?: string) {
  return listChurchUpdateRequests({
    status: status as never,
  });
}

export async function getUpdateDashboardCounts() {
  const updateRequests = await listChurchUpdateRequests();

  return {
    pendingReview: updateRequests.filter(
      (updateRequest) => updateRequest.status === "pending_review",
    ).length,
    approved: updateRequests.filter(
      (updateRequest) => updateRequest.status === "approved",
    ).length,
    denied: updateRequests.filter(
      (updateRequest) => updateRequest.status === "denied",
    ).length,
    changesRequested: updateRequests.filter(
      (updateRequest) => updateRequest.status === "changes_requested",
    ).length,
  };
}

export async function getAdminUpdateReviewData(updateRequestId: string) {
  const updateRequest = await getChurchUpdateRequestById(updateRequestId);

  if (!updateRequest) {
    return null;
  }

  const [church, representative, submittedByUser, messages, auditLogs, emailLogs] =
    await Promise.all([
      getChurchByIdFromFirebase(updateRequest.churchId),
      getRepresentativeById(updateRequest.submittedByRepresentativeId),
      getUserById(updateRequest.submittedByUserId),
      listMessagesForUpdateRequest(updateRequestId),
      listAuditLogsForEntity("churchUpdateRequest", updateRequestId),
      listEmailLogsForEntity("churchUpdateRequest", updateRequestId),
    ]);

  return {
    updateRequest,
    church,
    representative,
    submittedByUser,
    messages: sortByCreatedAtDescending(messages),
    auditLogs: sortByCreatedAtDescending(auditLogs),
    emailLogs: sortByCreatedAtDescending(emailLogs),
  };
}

export async function saveUpdateInternalNote(input: {
  updateRequestId: string;
  adminUserId: string;
  note: string;
}) {
  const updateRequest = await getChurchUpdateRequestById(input.updateRequestId);

  if (!updateRequest) {
    throw new Error("The church update request could not be found.");
  }

  const trimmedNote = input.note.trim();

  if (!trimmedNote) {
    throw createRequiredMessageError();
  }

  await createMessageInFirebase({
    updateRequestId: updateRequest.id,
    churchId: updateRequest.churchId,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedNote,
    isInternal: true,
  });
  await updateChurchUpdateRequestInFirebase(updateRequest.id, {
    internalNotes: [...updateRequest.internalNotes, trimmedNote],
  });
  await createAuditLogInFirebase({
    entityType: "churchUpdateRequest",
    entityId: updateRequest.id,
    action: "internal_note_saved",
    actorId: input.adminUserId,
    actorType: "admin",
    note: trimmedNote,
  });

  safeRevalidatePath(`/admin/updates/${updateRequest.id}`);
}

export async function sendUpdatePublicMessage(input: {
  updateRequestId: string;
  adminUserId: string;
  messageBody: string;
}) {
  const updateRequest = await getChurchUpdateRequestById(input.updateRequestId);

  if (!updateRequest) {
    throw new Error("The church update request could not be found.");
  }

  const church = await getChurchByIdFromFirebase(updateRequest.churchId);
  const submittedByUser = await getUserById(updateRequest.submittedByUserId);
  const trimmedMessage = input.messageBody.trim();

  if (!church || !submittedByUser?.email) {
    throw new Error("The church update request is missing linked review data.");
  }

  if (!trimmedMessage) {
    throw createRequiredMessageError();
  }

  await createMessageInFirebase({
    updateRequestId: updateRequest.id,
    churchId: church.id,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedMessage,
    isInternal: false,
  });
  await createAuditLogInFirebase({
    entityType: "churchUpdateRequest",
    entityId: updateRequest.id,
    action: "public_message_sent",
    actorId: input.adminUserId,
    actorType: "admin",
    note: trimmedMessage,
  });
  await sendRepresentativeUpdateMessageNotification({
    church,
    updateRequest,
    representativeEmail: submittedByUser.email,
    messageBody: trimmedMessage,
  });

  safeRevalidatePath(`/admin/updates/${updateRequest.id}`);
}

export async function approveUpdateRequest(input: {
  updateRequestId: string;
  adminUserId: string;
}) {
  const updateRequest = await getChurchUpdateRequestById(input.updateRequestId);

  if (!updateRequest) {
    throw new Error("The church update request could not be found.");
  }

  const church = await getChurchByIdFromFirebase(updateRequest.churchId);
  const submittedByUser = await getUserById(updateRequest.submittedByUserId);

  if (!church || !submittedByUser?.email) {
    throw new Error("The church update request is missing linked review data.");
  }

  const updatedChurch = await buildApprovedChurchRecordFromDraft({
    church,
    proposedChanges: updateRequest.proposedChanges,
  });
  const approvedAt = new Date().toISOString();

  await updateChurchUpdateRequestInFirebase(updateRequest.id, {
    status: "approved",
    approvedAt,
    reviewedBy: input.adminUserId,
    adminMessage: undefined,
    autoPublished: false,
  });
  await createAuditLogInFirebase({
    entityType: "churchUpdateRequest",
    entityId: updateRequest.id,
    action: "admin_approved_update",
    actorId: input.adminUserId,
    actorType: "admin",
    before: updateRequest,
    after: {
      status: "approved",
      approvedAt,
    },
    note: "Representative listing updates were approved.",
  });
  await sendRepresentativeUpdateApprovedNotification({
    church: updatedChurch,
    updateRequest: {
      ...updateRequest,
      status: "approved",
      approvedAt,
    },
    representativeEmail: submittedByUser.email,
  });

  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/updates");
  safeRevalidatePath(`/admin/updates/${updateRequest.id}`);
  safeRevalidatePath("/portal");
  safeRevalidatePath("/portal/updates");
  safeRevalidatePath("/churches");
  safeRevalidatePath(buildChurchProfilePath(updatedChurch));
}

export async function denyUpdateRequest(input: {
  updateRequestId: string;
  adminUserId: string;
  adminMessage: string;
}) {
  const updateRequest = await getChurchUpdateRequestById(input.updateRequestId);

  if (!updateRequest) {
    throw new Error("The church update request could not be found.");
  }

  const church = await getChurchByIdFromFirebase(updateRequest.churchId);
  const submittedByUser = await getUserById(updateRequest.submittedByUserId);
  const trimmedMessage = input.adminMessage.trim();

  if (!church || !submittedByUser?.email) {
    throw new Error("The church update request is missing linked review data.");
  }

  if (!trimmedMessage) {
    throw createRequiredMessageError();
  }

  const deniedAt = new Date().toISOString();

  await updateChurchUpdateRequestInFirebase(updateRequest.id, {
    status: "denied",
    deniedAt,
    reviewedBy: input.adminUserId,
    adminMessage: trimmedMessage,
  });
  await createMessageInFirebase({
    updateRequestId: updateRequest.id,
    churchId: church.id,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedMessage,
    isInternal: false,
  });
  await createAuditLogInFirebase({
    entityType: "churchUpdateRequest",
    entityId: updateRequest.id,
    action: "admin_denied_update",
    actorId: input.adminUserId,
    actorType: "admin",
    before: updateRequest,
    after: {
      status: "denied",
      deniedAt,
      adminMessage: trimmedMessage,
    },
    note: trimmedMessage,
  });
  await sendRepresentativeUpdateDeniedNotification({
    church,
    updateRequest,
    representativeEmail: submittedByUser.email,
    adminMessage: trimmedMessage,
  });

  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/updates");
  safeRevalidatePath(`/admin/updates/${updateRequest.id}`);
  safeRevalidatePath("/portal/updates");
}

export async function requestUpdateChanges(input: {
  updateRequestId: string;
  adminUserId: string;
  adminMessage: string;
}) {
  const updateRequest = await getChurchUpdateRequestById(input.updateRequestId);

  if (!updateRequest) {
    throw new Error("The church update request could not be found.");
  }

  const church = await getChurchByIdFromFirebase(updateRequest.churchId);
  const submittedByUser = await getUserById(updateRequest.submittedByUserId);
  const trimmedMessage = input.adminMessage.trim();

  if (!church || !submittedByUser?.email) {
    throw new Error("The church update request is missing linked review data.");
  }

  if (!trimmedMessage) {
    throw createRequiredMessageError();
  }

  const requestedChangesAt = new Date().toISOString();

  await updateChurchUpdateRequestInFirebase(updateRequest.id, {
    status: "changes_requested",
    requestedChangesAt,
    reviewedBy: input.adminUserId,
    adminMessage: trimmedMessage,
  });
  await createMessageInFirebase({
    updateRequestId: updateRequest.id,
    churchId: church.id,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedMessage,
    isInternal: false,
  });
  await createAuditLogInFirebase({
    entityType: "churchUpdateRequest",
    entityId: updateRequest.id,
    action: "admin_requested_update_changes",
    actorId: input.adminUserId,
    actorType: "admin",
    before: updateRequest,
    after: {
      status: "changes_requested",
      requestedChangesAt,
      adminMessage: trimmedMessage,
    },
    note: trimmedMessage,
  });
  await sendRepresentativeUpdateChangesRequestedNotification({
    church,
    updateRequest,
    representativeEmail: submittedByUser.email,
    adminMessage: trimmedMessage,
  });

  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/updates");
  safeRevalidatePath(`/admin/updates/${updateRequest.id}`);
  safeRevalidatePath("/portal/updates");
}
