import { safeRevalidatePath } from "@/lib/revalidation";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import {
  getChurchByIdFromFirebase,
  updateChurchAutoPublishSetting,
} from "@/lib/repositories/firebase-church-repository";
import {
  createOwnershipTransferRequestInFirebase,
  getOwnershipTransferRequestById,
  listOwnershipTransferRequests,
  updateOwnershipTransferRequestInFirebase,
} from "@/lib/repositories/firebase-ownership-transfer-repository";
import {
  getActiveEditorForChurch,
  getPrimaryRepresentativeForChurch,
  getRepresentativeById,
  getRepresentativeForChurchUser,
  listChurchRepresentativesForChurch,
  updateRepresentativeStatus,
  upsertChurchRepresentative,
} from "@/lib/repositories/firebase-representative-repository";
import { getUserByEmail, getUserById } from "@/lib/repositories/firebase-user-repository";
import { requireRepresentativeChurchAccess, syncRepresentativeUserRole } from "@/lib/services/representative-access-service";
import {
  sendEditorInviteNotification,
  sendOwnershipTransferApprovedNotification,
  sendOwnershipTransferDeniedNotification,
  sendOwnershipTransferPreviousOwnerNotification,
  sendOwnershipTransferRequestedNotification,
} from "@/lib/services/notification-service";

export async function getRepresentativeTeamData(churchId: string) {
  const [representatives, transferRequests] = await Promise.all([
    listChurchRepresentativesForChurch(churchId),
    listOwnershipTransferRequests({
      churchId,
      limit: 10,
    }),
  ]);

  return {
    representatives,
    transferRequests,
  };
}

export async function inviteChurchEditor(input: {
  churchId: string;
  actorUserId: string;
  editorName: string;
  editorEmail: string;
  editorPhone?: string;
  editorRoleTitle: string;
}) {
  const { church, representative } = await requireRepresentativeChurchAccess({
    userId: input.actorUserId,
    churchId: input.churchId,
    requirePrimary: true,
  });
  const activeEditor = await getActiveEditorForChurch(church.id);
  const trimmedEmail = input.editorEmail.trim().toLowerCase();

  if (activeEditor) {
    throw new Error("This church already has an invited or active editor.");
  }

  if (trimmedEmail === representative.email.toLowerCase()) {
    throw new Error("The primary owner already manages this church listing.");
  }

  const existingUser = await getUserByEmail(trimmedEmail);
  const editorRepresentative = await upsertChurchRepresentative({
    churchId: church.id,
    userId: existingUser?.id ?? null,
    name: input.editorName.trim(),
    email: trimmedEmail,
    phone: input.editorPhone?.trim() || undefined,
    roleTitle: input.editorRoleTitle.trim(),
    permissionRole: "editor",
    status: "invited",
  });

  await createAuditLogInFirebase({
    entityType: "churchRepresentative",
    entityId: editorRepresentative.id,
    action: "editor_invited",
    actorId: input.actorUserId,
    actorType: "church_rep",
    after: editorRepresentative,
    note: "An editor invite was sent from the representative portal.",
  });
  await sendEditorInviteNotification({
    church,
    representative: editorRepresentative,
  });

  safeRevalidatePath("/portal/team");
  safeRevalidatePath(`/admin/churches/${church.id}/representatives`);

  return editorRepresentative;
}

export async function createOwnershipTransferRequest(input: {
  churchId: string;
  actorUserId: string;
  newOwnerName: string;
  newOwnerEmail: string;
  newOwnerPhone?: string;
  newOwnerRoleTitle: string;
  reasonMessage: string;
}) {
  const { church, representative } = await requireRepresentativeChurchAccess({
    userId: input.actorUserId,
    churchId: input.churchId,
    requirePrimary: true,
  });
  const transferRequest = await createOwnershipTransferRequestInFirebase({
    churchId: church.id,
    requestedByUserId: input.actorUserId,
    requestedByRepresentativeId: representative.id,
    currentOwnerRepresentativeId: representative.id,
    newOwnerName: input.newOwnerName.trim(),
    newOwnerEmail: input.newOwnerEmail.trim().toLowerCase(),
    newOwnerPhone: input.newOwnerPhone?.trim() || undefined,
    newOwnerRoleTitle: input.newOwnerRoleTitle.trim(),
    reasonMessage: input.reasonMessage.trim(),
  });

  await createAuditLogInFirebase({
    entityType: "ownershipTransferRequest",
    entityId: transferRequest.id,
    action: "ownership_transfer_requested",
    actorId: input.actorUserId,
    actorType: "church_rep",
    after: transferRequest,
    note: "Primary ownership transfer requested from the representative portal.",
  });
  await sendOwnershipTransferRequestedNotification({
    church,
    transferRequest,
  });

  safeRevalidatePath("/portal/transfer-ownership");
  safeRevalidatePath(`/admin/churches/${church.id}/representatives`);

  return transferRequest;
}

export async function approveOwnershipTransferRequest(input: {
  transferRequestId: string;
  adminUserId: string;
}) {
  const transferRequest = await getOwnershipTransferRequestById(input.transferRequestId);

  if (!transferRequest) {
    throw new Error("The ownership transfer request could not be found.");
  }

  const church = await getChurchByIdFromFirebase(transferRequest.churchId);
  const newOwnerUser = await getUserByEmail(transferRequest.newOwnerEmail);
  const currentPrimary = await getPrimaryRepresentativeForChurch(transferRequest.churchId);

  if (!church) {
    throw new Error("The church linked to this request could not be found.");
  }

  if (!newOwnerUser) {
    throw new Error(
      "The new owner must sign in or create an account with the invited email address before approval.",
    );
  }

  const existingRepresentative =
    (await getRepresentativeForChurchUser(church.id, newOwnerUser.id)) ??
    (await listChurchRepresentativesForChurch(church.id)).find(
      (representative) =>
        representative.email.toLowerCase() === transferRequest.newOwnerEmail.toLowerCase(),
    ) ??
    null;

  if (currentPrimary && currentPrimary.id !== transferRequest.currentOwnerRepresentativeId) {
    await updateRepresentativeStatus(currentPrimary.id, "transferred");
    if (currentPrimary.userId) {
      await syncRepresentativeUserRole(currentPrimary.userId);
    }
  }

  const updatedCurrentOwner = await getRepresentativeById(
    transferRequest.currentOwnerRepresentativeId,
  );

  if (updatedCurrentOwner) {
    await updateRepresentativeStatus(updatedCurrentOwner.id, "transferred");
    if (updatedCurrentOwner.userId) {
      await syncRepresentativeUserRole(updatedCurrentOwner.userId);
    }
  }

  const newPrimaryRepresentative = await upsertChurchRepresentative({
    id: existingRepresentative?.id,
    churchId: church.id,
    userId: newOwnerUser.id,
    name: newOwnerUser.name || transferRequest.newOwnerName,
    email: newOwnerUser.email,
    phone: newOwnerUser.phone ?? transferRequest.newOwnerPhone,
    roleTitle: transferRequest.newOwnerRoleTitle,
    permissionRole: "primary_owner",
    status: "active",
  });
  await updateChurchAutoPublishSetting(church.id, church.autoPublishUpdates ?? false);
  const updatedChurch = await import("@/lib/repositories/firebase-church-repository").then(
    async ({ getChurchDocumentByIdFromFirebase, saveChurchDocumentToFirebase }) => {
      const churchDocument = await getChurchDocumentByIdFromFirebase(church.id);

      if (!churchDocument) {
        throw new Error("The church linked to this request could not be found.");
      }

      churchDocument.primaryRepresentativeId = newPrimaryRepresentative.id;
      churchDocument.updatedAt = new Date().toISOString();

      return saveChurchDocumentToFirebase(churchDocument);
    },
  );

  const approvedAt = new Date().toISOString();

  await updateOwnershipTransferRequestInFirebase(transferRequest.id, {
    status: "approved",
    approvedAt,
    reviewedBy: input.adminUserId,
    adminMessage: undefined,
  });
  await createAuditLogInFirebase({
    entityType: "ownershipTransferRequest",
    entityId: transferRequest.id,
    action: "ownership_transfer_approved",
    actorId: input.adminUserId,
    actorType: "admin",
    before: transferRequest,
    after: {
      status: "approved",
      approvedAt,
      representativeId: newPrimaryRepresentative.id,
    },
    note: "Primary ownership transfer approved.",
  });
  await createAuditLogInFirebase({
    entityType: "churchRepresentative",
    entityId: newPrimaryRepresentative.id,
    action: "representative_assigned",
    actorId: input.adminUserId,
    actorType: "admin",
    after: newPrimaryRepresentative,
    note: "Primary ownership assigned from approved transfer request.",
  });
  await syncRepresentativeUserRole(newOwnerUser.id);
  await sendOwnershipTransferApprovedNotification({
    church: updatedChurch,
    transferRequest: {
      ...transferRequest,
      status: "approved",
      approvedAt,
    },
  });
  if (
    updatedCurrentOwner?.email &&
    updatedCurrentOwner.email.toLowerCase() !== transferRequest.newOwnerEmail.toLowerCase()
  ) {
    await sendOwnershipTransferPreviousOwnerNotification({
      church: updatedChurch,
      previousOwnerEmail: updatedCurrentOwner.email,
      previousOwnerName: updatedCurrentOwner.name,
      transferRequest: {
        ...transferRequest,
        status: "approved",
        approvedAt,
      },
    });
  }

  safeRevalidatePath("/portal/team");
  safeRevalidatePath("/portal/transfer-ownership");
  safeRevalidatePath(`/admin/churches/${church.id}/representatives`);
}

export async function denyOwnershipTransferRequest(input: {
  transferRequestId: string;
  adminUserId: string;
  adminMessage: string;
}) {
  const transferRequest = await getOwnershipTransferRequestById(input.transferRequestId);

  if (!transferRequest) {
    throw new Error("The ownership transfer request could not be found.");
  }

  const church = await getChurchByIdFromFirebase(transferRequest.churchId);
  const trimmedMessage = input.adminMessage.trim();

  if (!church) {
    throw new Error("The church linked to this request could not be found.");
  }

  if (!trimmedMessage) {
    throw new Error("Please enter a message before denying this transfer request.");
  }

  const deniedAt = new Date().toISOString();
  const requesterProfile = await getUserById(transferRequest.requestedByUserId);

  await updateOwnershipTransferRequestInFirebase(transferRequest.id, {
    status: "denied",
    deniedAt,
    reviewedBy: input.adminUserId,
    adminMessage: trimmedMessage,
  });
  await createAuditLogInFirebase({
    entityType: "ownershipTransferRequest",
    entityId: transferRequest.id,
    action: "ownership_transfer_denied",
    actorId: input.adminUserId,
    actorType: "admin",
    before: transferRequest,
    after: {
      status: "denied",
      deniedAt,
      adminMessage: trimmedMessage,
    },
    note: trimmedMessage,
  });
  await sendOwnershipTransferDeniedNotification({
    church,
    transferRequest,
    recipientEmail: requesterProfile?.email ?? transferRequest.newOwnerEmail,
    adminMessage: trimmedMessage,
  });

  safeRevalidatePath("/portal/transfer-ownership");
  safeRevalidatePath(`/admin/churches/${church.id}/representatives`);
}

export async function suspendRepresentativeAccess(input: {
  churchId: string;
  representativeId: string;
  adminUserId: string;
}) {
  const representative = await getRepresentativeById(input.representativeId);

  if (!representative || representative.churchId !== input.churchId) {
    throw new Error("The representative could not be found.");
  }

  await updateRepresentativeStatus(representative.id, "suspended");
  await createAuditLogInFirebase({
    entityType: "churchRepresentative",
    entityId: representative.id,
    action: "representative_suspended",
    actorId: input.adminUserId,
    actorType: "admin",
    before: representative,
    after: {
      status: "suspended",
    },
    note: "Representative access was suspended by an administrator.",
  });

  if (representative.userId) {
    await syncRepresentativeUserRole(representative.userId);
  }

  safeRevalidatePath(`/admin/churches/${input.churchId}/representatives`);
}

export async function toggleChurchAutoPublishUpdates(input: {
  churchId: string;
  adminUserId: string;
  autoPublishUpdates: boolean;
}) {
  const church = await getChurchByIdFromFirebase(input.churchId);

  if (!church) {
    throw new Error("The church could not be found.");
  }

  const updatedChurch = await updateChurchAutoPublishSetting(
    church.id,
    input.autoPublishUpdates,
  );

  await createAuditLogInFirebase({
    entityType: "church",
    entityId: church.id,
    action: "auto_publish_updates_changed",
    actorId: input.adminUserId,
    actorType: "admin",
    before: {
      autoPublishUpdates: church.autoPublishUpdates ?? false,
    },
    after: {
      autoPublishUpdates: updatedChurch.autoPublishUpdates ?? false,
    },
    note: `autoPublishUpdates set to ${updatedChurch.autoPublishUpdates ? "true" : "false"}.`,
  });

  safeRevalidatePath("/portal");
  safeRevalidatePath(`/admin/churches/${church.id}/representatives`);

  return updatedChurch;
}
