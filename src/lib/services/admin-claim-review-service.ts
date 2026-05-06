import { createAuditLogInFirebase, listAuditLogsForEntity } from "@/lib/repositories/firebase-audit-log-repository";
import { safeRevalidatePath } from "@/lib/revalidation";
import { getChurchByIdFromFirebase } from "@/lib/repositories/firebase-church-repository";
import { listEmailLogsForEntity } from "@/lib/repositories/firebase-email-log-repository";
import {
  getChurchClaimRequestById,
  listChurchClaimRequests,
  updateChurchClaimRequestStatus,
} from "@/lib/repositories/firebase-claim-request-repository";
import { createMessageInFirebase, listMessagesForClaimRequest } from "@/lib/repositories/firebase-message-repository";
import {
  getPrimaryRepresentativeForChurch,
  getRepresentativeForChurchUser,
  updateRepresentativeStatus,
  upsertChurchRepresentative,
} from "@/lib/repositories/firebase-representative-repository";
import { getUserById, upsertUserProfile } from "@/lib/repositories/firebase-user-repository";
import {
  sendClaimApprovedNotification,
  sendClaimDeniedNotification,
  sendClaimMessageNotification,
  sendClaimMoreInfoNotification,
} from "@/lib/services/notification-service";

function sortByCreatedAtDescending<T extends { createdAt: string }>(records: T[]) {
  return [...records].sort((leftRecord, rightRecord) =>
    rightRecord.createdAt.localeCompare(leftRecord.createdAt),
  );
}

function createRequiredMessageError() {
  return new Error("A message is required for this action.");
}

function canReviewClaim(status: string) {
  return status === "pending_review" || status === "more_info_requested";
}

function createClaimAlreadyReviewedError(status: string) {
  return new Error(`This claim has already been reviewed and is currently ${status.replace(/_/g, " ")}.`);
}

export async function listAdminClaimRequests(status?: string) {
  return listChurchClaimRequests({
    status: status as never,
  });
}

export async function getClaimDashboardCounts() {
  const claimRequests = await listChurchClaimRequests();

  return {
    pendingReview: claimRequests.filter((claimRequest) => claimRequest.status === "pending_review")
      .length,
    approved: claimRequests.filter((claimRequest) => claimRequest.status === "approved").length,
    denied: claimRequests.filter((claimRequest) => claimRequest.status === "denied").length,
    moreInfoRequested: claimRequests.filter(
      (claimRequest) => claimRequest.status === "more_info_requested",
    ).length,
  };
}

export async function getAdminClaimReviewData(claimRequestId: string) {
  const claimRequest = await getChurchClaimRequestById(claimRequestId);

  if (!claimRequest) {
    return null;
  }

  const church = await getChurchByIdFromFirebase(claimRequest.churchId);
  const [messages, auditLogs, emailLogs] = await Promise.all([
    listMessagesForClaimRequest(claimRequestId),
    listAuditLogsForEntity("churchClaimRequest", claimRequestId),
    listEmailLogsForEntity("churchClaimRequest", claimRequestId),
  ]);

  return {
    claimRequest,
    church,
    messages: sortByCreatedAtDescending(messages),
    auditLogs: sortByCreatedAtDescending(auditLogs),
    emailLogs: sortByCreatedAtDescending(emailLogs),
  };
}

export async function saveClaimInternalNote(input: {
  claimRequestId: string;
  adminUserId: string;
  note: string;
}) {
  const claimRequest = await getChurchClaimRequestById(input.claimRequestId);

  if (!claimRequest) {
    throw new Error("The church claim request could not be found.");
  }

  const trimmedNote = input.note.trim();

  if (!trimmedNote) {
    throw createRequiredMessageError();
  }

  await createMessageInFirebase({
    claimRequestId: claimRequest.id,
    churchId: claimRequest.churchId,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedNote,
    isInternal: true,
  });
  await createAuditLogInFirebase({
    entityType: "churchClaimRequest",
    entityId: claimRequest.id,
    action: "internal_note_saved",
    actorId: input.adminUserId,
    actorType: "admin",
    note: trimmedNote,
  });

  safeRevalidatePath(`/admin/claims/${claimRequest.id}`);
}

export async function requestClaimMoreInfo(input: {
  claimRequestId: string;
  adminUserId: string;
  adminMessage: string;
}) {
  const claimRequest = await getChurchClaimRequestById(input.claimRequestId);

  if (!claimRequest) {
    throw new Error("The church claim request could not be found.");
  }

  if (!canReviewClaim(claimRequest.status)) {
    throw createClaimAlreadyReviewedError(claimRequest.status);
  }

  const church = await getChurchByIdFromFirebase(claimRequest.churchId);

  if (!church) {
    throw new Error("The church linked to this claim request could not be found.");
  }

  const trimmedMessage = input.adminMessage.trim();

  if (!trimmedMessage) {
    throw createRequiredMessageError();
  }

  await updateChurchClaimRequestStatus(claimRequest.id, "more_info_requested", {
    adminMessage: trimmedMessage,
    reviewedBy: input.adminUserId,
  });
  await createMessageInFirebase({
    claimRequestId: claimRequest.id,
    churchId: church.id,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedMessage,
    isInternal: false,
  });
  await createAuditLogInFirebase({
    entityType: "churchClaimRequest",
    entityId: claimRequest.id,
    action: "more_info_requested",
    actorId: input.adminUserId,
    actorType: "admin",
    before: claimRequest,
    after: {
      status: "more_info_requested",
      adminMessage: trimmedMessage,
    },
    note: trimmedMessage,
  });
  await sendClaimMoreInfoNotification({
    claimRequest,
    church,
    adminMessage: trimmedMessage,
  });

  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/claims");
  safeRevalidatePath(`/admin/claims/${claimRequest.id}`);
}

export async function sendClaimPublicMessage(input: {
  claimRequestId: string;
  adminUserId: string;
  messageBody: string;
}) {
  const claimRequest = await getChurchClaimRequestById(input.claimRequestId);

  if (!claimRequest) {
    throw new Error("The church claim request could not be found.");
  }

  const church = await getChurchByIdFromFirebase(claimRequest.churchId);

  if (!church) {
    throw new Error("The church linked to this claim request could not be found.");
  }

  const trimmedMessage = input.messageBody.trim();

  if (!trimmedMessage) {
    throw createRequiredMessageError();
  }

  await createMessageInFirebase({
    claimRequestId: claimRequest.id,
    churchId: church.id,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedMessage,
    isInternal: false,
  });
  await createAuditLogInFirebase({
    entityType: "churchClaimRequest",
    entityId: claimRequest.id,
    action: "public_message_sent",
    actorId: input.adminUserId,
    actorType: "admin",
    note: trimmedMessage,
  });
  await sendClaimMessageNotification({
    claimRequest,
    church,
    messageBody: trimmedMessage,
  });

  safeRevalidatePath(`/admin/claims/${claimRequest.id}`);
}

export async function denyClaimRequest(input: {
  claimRequestId: string;
  adminUserId: string;
  adminMessage: string;
}) {
  const claimRequest = await getChurchClaimRequestById(input.claimRequestId);

  if (!claimRequest) {
    throw new Error("The church claim request could not be found.");
  }

  if (!canReviewClaim(claimRequest.status)) {
    throw createClaimAlreadyReviewedError(claimRequest.status);
  }

  const church = await getChurchByIdFromFirebase(claimRequest.churchId);

  if (!church) {
    throw new Error("The church linked to this claim request could not be found.");
  }

  const trimmedMessage = input.adminMessage.trim();

  if (!trimmedMessage) {
    throw createRequiredMessageError();
  }

  await updateChurchClaimRequestStatus(claimRequest.id, "denied", {
    adminMessage: trimmedMessage,
    reviewedBy: input.adminUserId,
  });
  await createMessageInFirebase({
    claimRequestId: claimRequest.id,
    churchId: church.id,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedMessage,
    isInternal: false,
  });
  await createAuditLogInFirebase({
    entityType: "churchClaimRequest",
    entityId: claimRequest.id,
    action: "claim_denied",
    actorId: input.adminUserId,
    actorType: "admin",
    before: claimRequest,
    after: {
      status: "denied",
      adminMessage: trimmedMessage,
    },
    note: trimmedMessage,
  });
  await sendClaimDeniedNotification({
    claimRequest,
    church,
    adminMessage: trimmedMessage,
  });

  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/claims");
  safeRevalidatePath(`/admin/claims/${claimRequest.id}`);
}

export async function approveClaimRequest(input: {
  claimRequestId: string;
  adminUserId: string;
}) {
  const claimRequest = await getChurchClaimRequestById(input.claimRequestId);

  if (!claimRequest) {
    throw new Error("The church claim request could not be found.");
  }

  if (!canReviewClaim(claimRequest.status)) {
    throw createClaimAlreadyReviewedError(claimRequest.status);
  }

  const church = await getChurchByIdFromFirebase(claimRequest.churchId);

  if (!church) {
    throw new Error("The church linked to this claim request could not be found.");
  }

  const requesterProfile = await getUserById(claimRequest.requesterUserId);
  const currentPrimaryRepresentative = await getPrimaryRepresentativeForChurch(church.id);

  if (currentPrimaryRepresentative && currentPrimaryRepresentative.userId !== claimRequest.requesterUserId) {
    await updateRepresentativeStatus(currentPrimaryRepresentative.id, "transferred");
    await createAuditLogInFirebase({
      entityType: "churchRepresentative",
      entityId: currentPrimaryRepresentative.id,
      action: "representative_transferred",
      actorId: input.adminUserId,
      actorType: "admin",
      before: currentPrimaryRepresentative,
      after: {
        status: "transferred",
      },
      note: "Primary ownership moved to an approved claim requester.",
    });
  }

  const existingRepresentative = await getRepresentativeForChurchUser(
    church.id,
    claimRequest.requesterUserId,
  );
  const representative = await upsertChurchRepresentative({
    id: existingRepresentative?.id,
    churchId: church.id,
    userId: claimRequest.requesterUserId,
    name: requesterProfile?.name ?? claimRequest.requesterName,
    email: requesterProfile?.email ?? claimRequest.requesterEmail,
    phone: requesterProfile?.phone ?? claimRequest.requesterPhone,
    roleTitle: claimRequest.requesterRoleTitle,
    permissionRole: "primary_owner",
    status: "active",
  });
  await upsertUserProfile({
    firebaseUid: claimRequest.requesterUserId,
    name: requesterProfile?.name ?? claimRequest.requesterName,
    email: requesterProfile?.email ?? claimRequest.requesterEmail,
    phone: requesterProfile?.phone ?? claimRequest.requesterPhone,
    role: "church_primary",
  });

  const { getFirebaseAdminFirestore } = await import("@/lib/firebase/admin");
  const { firestoreCollectionNames } = await import("@/lib/firebase/firestore");
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  await firestore
    .collection(firestoreCollectionNames.churches)
    .doc(church.id)
    .set(
      {
        primaryRepresentativeId: representative.id,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

  await updateChurchClaimRequestStatus(claimRequest.id, "approved", {
    reviewedBy: input.adminUserId,
  });
  await createAuditLogInFirebase({
    entityType: "churchClaimRequest",
    entityId: claimRequest.id,
    action: "claim_approved",
    actorId: input.adminUserId,
    actorType: "admin",
    before: claimRequest,
    after: {
      status: "approved",
      representativeId: representative.id,
    },
    note: "Church claim request approved.",
  });
  await createAuditLogInFirebase({
    entityType: "churchRepresentative",
    entityId: representative.id,
    action: "representative_assigned",
    actorId: input.adminUserId,
    actorType: "admin",
    after: representative,
    note: "Primary owner assigned from approved claim request.",
  });
  await sendClaimApprovedNotification({
    claimRequest,
    church: {
      ...church,
      primaryRepresentativeId: representative.id,
    },
  });

  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/claims");
  safeRevalidatePath(`/admin/claims/${claimRequest.id}`);
  safeRevalidatePath("/admin/churches");
}
