import { buildChurchProfilePath } from "@/lib/config/site";
import {
  mapChurchDocumentToChurchRecord,
  mapDraftToChurchDocument,
} from "@/lib/firebase/firestore";
import { safeRevalidatePath } from "@/lib/revalidation";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import {
  getChurchByIdFromFirebase,
  getChurchDocumentByIdFromFirebase,
  saveChurchDocumentToFirebase,
} from "@/lib/repositories/firebase-church-repository";
import {
  getChurchUpdateRequestById,
  updateChurchUpdateRequestInFirebase,
} from "@/lib/repositories/firebase-update-request-repository";
import { getUserById } from "@/lib/repositories/firebase-user-repository";
import { sendRepresentativeUpdateApprovedNotification } from "@/lib/services/notification-service";
import { runNotificationBestEffort } from "@/lib/services/notification-delivery";
import type { ChurchListingDraft, ChurchRecord } from "@/lib/types/directory";

export async function buildApprovedChurchRecordFromDraft(input: {
  church: ChurchRecord;
  proposedChanges: ChurchListingDraft;
  updatedAt?: string;
}) {
  const churchDocument = await getChurchDocumentByIdFromFirebase(input.church.id);

  if (!churchDocument) {
    throw new Error("The church listing could not be found.");
  }

  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const updatedDocument = mapDraftToChurchDocument(
    input.church.id,
    input.church.slug,
    input.proposedChanges,
    "published",
    churchDocument.createdAt,
    updatedAt,
  );

  updatedDocument.primaryRepresentativeId =
    churchDocument.primaryRepresentativeId ?? null;
  updatedDocument.autoPublishUpdates = churchDocument.autoPublishUpdates ?? false;
  updatedDocument.publishedAt = churchDocument.publishedAt ?? updatedAt;
  updatedDocument.lastVerifiedAt = updatedAt;
  updatedDocument.listingVerificationStatus = "current";
  updatedDocument.listingVerificationRequestedAt = null;
  updatedDocument.listingVerificationGraceEndsAt = null;
  updatedDocument.listingVerificationReminder7SentAt = null;
  updatedDocument.listingVerificationReminder3SentAt = null;
  updatedDocument.archivedAt = null;
  updatedDocument.archivedReason = null;

  await saveChurchDocumentToFirebase(updatedDocument);

  return mapChurchDocumentToChurchRecord(updatedDocument);
}

export async function approvePendingChurchUpdate(input: {
  updateRequestId: string;
  reviewerId: string;
  reviewerType: "admin" | "system";
  automated?: boolean;
}) {
  const updateRequest = await getChurchUpdateRequestById(input.updateRequestId);

  if (!updateRequest) {
    throw new Error("The church update request could not be found.");
  }

  if (updateRequest.status !== "pending_review") {
    throw new Error("Only a pending church update request can be approved.");
  }

  const [church, submittedByUser] = await Promise.all([
    getChurchByIdFromFirebase(updateRequest.churchId),
    getUserById(updateRequest.submittedByUserId),
  ]);

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
    reviewedBy: input.reviewerId,
    adminMessage: undefined,
    autoPublished: input.automated ?? false,
  });
  await createAuditLogInFirebase({
    entityType: "churchUpdateRequest",
    entityId: updateRequest.id,
    action: input.automated
      ? "ai_clear_update_auto_approved"
      : "admin_approved_update",
    actorId: input.reviewerId,
    actorType: input.reviewerType,
    before: updateRequest,
    after: {
      status: "approved",
      approvedAt,
      autoPublished: input.automated ?? false,
    },
    note: input.automated
      ? "A trusted server workflow auto-approved an eligible update after a clear advisory review."
      : "Representative listing updates were approved.",
  });
  await runNotificationBestEffort(() =>
    sendRepresentativeUpdateApprovedNotification({
      church: updatedChurch,
      updateRequest: {
        ...updateRequest,
        status: "approved",
        approvedAt,
        autoPublished: input.automated ?? false,
      },
      representativeEmail: submittedByUser.email,
    }),
  );

  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/updates");
  safeRevalidatePath(`/admin/updates/${updateRequest.id}`);
  safeRevalidatePath("/portal");
  safeRevalidatePath("/portal/updates");
  safeRevalidatePath("/churches");
  safeRevalidatePath(buildChurchProfilePath(updatedChurch));

  return updatedChurch;
}
