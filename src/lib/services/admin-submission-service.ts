import { buildChurchProfilePath } from "@/lib/config/site";
import { safeRevalidatePath } from "@/lib/revalidation";
import { getChurchByIdFromFirebase, upsertChurchFromSubmissionApproval } from "@/lib/repositories/firebase-church-repository";
import { createAuditLogInFirebase, listAuditLogsForEntity } from "@/lib/repositories/firebase-audit-log-repository";
import { listEmailLogsForEntity } from "@/lib/repositories/firebase-email-log-repository";
import {
  createMessageInFirebase,
  listMessagesForSubmission,
} from "@/lib/repositories/firebase-message-repository";
import {
  getChurchSubmissionByIdFromFirebase,
  listChurchSubmissionsFromFirebase,
  updateChurchSubmissionInFirebase,
} from "@/lib/repositories/firebase-submission-repository";
import {
  getPrimaryRepresentativeForChurch,
  getRepresentativeForChurchUser,
  upsertChurchRepresentative,
} from "@/lib/repositories/firebase-representative-repository";
import { upsertUserProfile } from "@/lib/repositories/firebase-user-repository";
import {
  sendSubmissionApprovedNotification,
  sendSubmissionChangesRequestedNotification,
  sendSubmissionDeniedNotification,
  sendSubmissionMessageNotification,
} from "@/lib/services/notification-service";

function createRequiredMessageError() {
  return new Error("A message is required for this action.");
}

async function assignRequestedManagerAccountOnApproval(input: {
  submission: NonNullable<Awaited<ReturnType<typeof getChurchSubmissionByIdFromFirebase>>>;
  church: Awaited<ReturnType<typeof upsertChurchFromSubmissionApproval>>;
  adminUserId: string;
}) {
  const requestedManagerAccount = input.submission.requestedManagerAccount;

  if (!requestedManagerAccount) {
    return {
      church: input.church,
      managerAccountAssigned: false,
    };
  }

  const currentPrimaryRepresentative = await getPrimaryRepresentativeForChurch(input.church.id);

  if (
    currentPrimaryRepresentative &&
    currentPrimaryRepresentative.userId !== requestedManagerAccount.firebaseUid
  ) {
    const updatedRequestedManagerAccount = {
      ...requestedManagerAccount,
      assignmentStatus: "manual_review_required" as const,
    };

    await updateChurchSubmissionInFirebase(input.submission.id, {
      requestedManagerAccount: updatedRequestedManagerAccount,
    });
    await createAuditLogInFirebase({
      entityType: "churchSubmission",
      entityId: input.submission.id,
      action: "requested_manager_account_manual_review_required",
      actorId: input.adminUserId,
      actorType: "admin",
      note: "The submission requested a manager account, but the church already has an assigned primary representative.",
      after: updatedRequestedManagerAccount,
    });

    return {
      church: input.church,
      managerAccountAssigned: false,
    };
  }

  const existingRepresentative = await getRepresentativeForChurchUser(
    input.church.id,
    requestedManagerAccount.firebaseUid,
  );
  const representative = await upsertChurchRepresentative({
    id: existingRepresentative?.id,
    churchId: input.church.id,
    userId: requestedManagerAccount.firebaseUid,
    name: requestedManagerAccount.name,
    email: requestedManagerAccount.email,
    phone: requestedManagerAccount.phone,
    roleTitle: requestedManagerAccount.roleTitle,
    permissionRole: "primary_owner",
    status: "active",
  });
  await upsertUserProfile({
    firebaseUid: requestedManagerAccount.firebaseUid,
    name: requestedManagerAccount.name,
    email: requestedManagerAccount.email,
    phone: requestedManagerAccount.phone,
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
    .doc(input.church.id)
    .set(
      {
        primaryRepresentativeId: representative.id,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

  const updatedRequestedManagerAccount = {
    ...requestedManagerAccount,
    assignmentStatus: "assigned_as_primary_owner" as const,
  };

  await updateChurchSubmissionInFirebase(input.submission.id, {
    requestedManagerAccount: updatedRequestedManagerAccount,
  });
  await createAuditLogInFirebase({
    entityType: "churchRepresentative",
    entityId: representative.id,
    action: "representative_assigned",
    actorId: input.adminUserId,
    actorType: "admin",
    after: representative,
    note: "Primary owner assigned from church submission account request.",
  });

  return {
    church: {
      ...input.church,
      primaryRepresentativeId: representative.id,
    },
    managerAccountAssigned: true,
  };
}

function sortByCreatedAtDescending<T extends { createdAt: string }>(records: T[]) {
  return [...records].sort((leftRecord, rightRecord) =>
    rightRecord.createdAt.localeCompare(leftRecord.createdAt),
  );
}

export async function listAdminSubmissions(status?: string) {
  return listChurchSubmissionsFromFirebase({
    status: status as never,
  });
}

export async function getSubmissionDashboardCounts() {
  const submissions = await listChurchSubmissionsFromFirebase();

  return {
    pendingReview: submissions.filter((submission) => submission.status === "pending_review").length,
    denied: submissions.filter((submission) => submission.status === "denied").length,
    changesRequested: submissions.filter((submission) => submission.status === "changes_requested")
      .length,
    approved: submissions.filter((submission) => submission.status === "approved").length,
  };
}

export async function getAdminSubmissionReviewData(submissionId: string) {
  const submission = await getChurchSubmissionByIdFromFirebase(submissionId);

  if (!submission) {
    return null;
  }

  const [messages, auditLogs, emailLogs] = await Promise.all([
    listMessagesForSubmission(submissionId),
    listAuditLogsForEntity("churchSubmission", submissionId),
    listEmailLogsForEntity("churchSubmission", submissionId),
  ]);

  return {
    submission,
    messages: sortByCreatedAtDescending(messages),
    auditLogs: sortByCreatedAtDescending(auditLogs),
    emailLogs: sortByCreatedAtDescending(emailLogs),
  };
}

export async function saveSubmissionInternalNote(input: {
  submissionId: string;
  adminUserId: string;
  note: string;
}) {
  const submission = await getChurchSubmissionByIdFromFirebase(input.submissionId);

  if (!submission) {
    throw new Error("The church submission could not be found.");
  }

  const trimmedNote = input.note.trim();

  if (!trimmedNote) {
    throw createRequiredMessageError();
  }

  await createMessageInFirebase({
    submissionId: submission.id,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedNote,
    isInternal: true,
  });
  await updateChurchSubmissionInFirebase(submission.id, {
    internalNotes: [...submission.internalNotes, trimmedNote],
  });
  await createAuditLogInFirebase({
    entityType: "churchSubmission",
    entityId: submission.id,
    action: "internal_note_saved",
    actorId: input.adminUserId,
    actorType: "admin",
    note: trimmedNote,
  });

  safeRevalidatePath(`/admin/submissions/${submission.id}`);
}

export async function sendSubmissionPublicMessage(input: {
  submissionId: string;
  adminUserId: string;
  messageBody: string;
}) {
  const submission = await getChurchSubmissionByIdFromFirebase(input.submissionId);

  if (!submission) {
    throw new Error("The church submission could not be found.");
  }

  const trimmedMessage = input.messageBody.trim();

  if (!trimmedMessage) {
    throw createRequiredMessageError();
  }

  await createMessageInFirebase({
    submissionId: submission.id,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedMessage,
    isInternal: false,
  });
  await createAuditLogInFirebase({
    entityType: "churchSubmission",
    entityId: submission.id,
    action: "public_message_sent",
    actorId: input.adminUserId,
    actorType: "admin",
    note: trimmedMessage,
  });
  await sendSubmissionMessageNotification({
    submission,
    messageBody: trimmedMessage,
  });

  safeRevalidatePath(`/admin/submissions/${submission.id}`);
}

export async function approveSubmission(input: {
  submissionId: string;
  adminUserId: string;
  adminMessage?: string;
}) {
  const submission = await getChurchSubmissionByIdFromFirebase(input.submissionId);

  if (!submission) {
    throw new Error("The church submission could not be found.");
  }

  const church = await upsertChurchFromSubmissionApproval({
    submissionId: submission.id,
    lastVerifiedAt: new Date().toISOString(),
  });
  const assignmentResult = await assignRequestedManagerAccountOnApproval({
    submission,
    church,
    adminUserId: input.adminUserId,
  });

  await updateChurchSubmissionInFirebase(submission.id, {
    status: "approved",
    approvedAt: new Date().toISOString(),
    adminMessage: input.adminMessage?.trim() || undefined,
  });
  await createAuditLogInFirebase({
    entityType: "churchSubmission",
    entityId: submission.id,
    action: "submission_approved",
    actorId: input.adminUserId,
    actorType: "admin",
    before: submission,
    after: assignmentResult.church,
    note: input.adminMessage?.trim() || "Church submission approved and published.",
  });
  await sendSubmissionApprovedNotification({
    submission: {
      ...submission,
      status: "approved",
    },
    church: assignmentResult.church,
    managerAccountAssigned: assignmentResult.managerAccountAssigned,
  });

  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/submissions");
  safeRevalidatePath(`/admin/submissions/${submission.id}`);
  safeRevalidatePath("/churches");
  safeRevalidatePath(buildChurchProfilePath(assignmentResult.church));
}

export async function denySubmission(input: {
  submissionId: string;
  adminUserId: string;
  adminMessage: string;
}) {
  const submission = await getChurchSubmissionByIdFromFirebase(input.submissionId);

  if (!submission) {
    throw new Error("The church submission could not be found.");
  }

  const trimmedMessage = input.adminMessage.trim();

  if (!trimmedMessage) {
    throw createRequiredMessageError();
  }

  const deniedAt = new Date().toISOString();

  await updateChurchSubmissionInFirebase(submission.id, {
    status: "denied",
    deniedAt,
    adminMessage: trimmedMessage,
  });
  await createMessageInFirebase({
    submissionId: submission.id,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedMessage,
    isInternal: false,
  });
  await createAuditLogInFirebase({
    entityType: "churchSubmission",
    entityId: submission.id,
    action: "submission_denied",
    actorId: input.adminUserId,
    actorType: "admin",
    before: submission,
    after: {
      status: "denied",
      deniedAt,
      adminMessage: trimmedMessage,
    },
    note: trimmedMessage,
  });
  await sendSubmissionDeniedNotification({
    submission,
    adminMessage: trimmedMessage,
  });

  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/submissions");
  safeRevalidatePath(`/admin/submissions/${submission.id}`);
}

export async function requestSubmissionChanges(input: {
  submissionId: string;
  adminUserId: string;
  adminMessage: string;
}) {
  const submission = await getChurchSubmissionByIdFromFirebase(input.submissionId);

  if (!submission) {
    throw new Error("The church submission could not be found.");
  }

  const trimmedMessage = input.adminMessage.trim();

  if (!trimmedMessage) {
    throw createRequiredMessageError();
  }

  const requestedChangesAt = new Date().toISOString();

  await updateChurchSubmissionInFirebase(submission.id, {
    status: "changes_requested",
    requestedChangesAt,
    adminMessage: trimmedMessage,
  });
  await createMessageInFirebase({
    submissionId: submission.id,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedMessage,
    isInternal: false,
  });
  await createAuditLogInFirebase({
    entityType: "churchSubmission",
    entityId: submission.id,
    action: "changes_requested",
    actorId: input.adminUserId,
    actorType: "admin",
    before: submission,
    after: {
      status: "changes_requested",
      requestedChangesAt,
      adminMessage: trimmedMessage,
    },
    note: trimmedMessage,
  });
  await sendSubmissionChangesRequestedNotification({
    submission,
    adminMessage: trimmedMessage,
  });

  safeRevalidatePath("/admin");
  safeRevalidatePath("/admin/submissions");
  safeRevalidatePath(`/admin/submissions/${submission.id}`);
}

export async function getAdminChurchRecord(churchId: string) {
  return getChurchByIdFromFirebase(churchId);
}
