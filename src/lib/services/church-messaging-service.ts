import { safeRevalidatePath } from "@/lib/revalidation";
import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import { getChurchByIdFromFirebase } from "@/lib/repositories/firebase-church-repository";
import {
  createMessageInFirebase,
  listMessagesForChurch,
} from "@/lib/repositories/firebase-message-repository";
import { getUserById } from "@/lib/repositories/firebase-user-repository";
import {
  sendAdminChurchMessageNotification,
  sendRepresentativeChurchMessageNotification,
} from "@/lib/services/notification-service";

function sortByCreatedAtDescending<T extends { createdAt: string }>(records: T[]) {
  return [...records].sort((leftRecord, rightRecord) =>
    rightRecord.createdAt.localeCompare(leftRecord.createdAt),
  );
}

export async function getPublicChurchMessageThread(churchId: string) {
  const messages = await listMessagesForChurch(churchId);

  return sortByCreatedAtDescending(
    messages.filter((message) => !message.isInternal),
  );
}

export async function sendRepresentativeChurchMessage(input: {
  churchId: string;
  senderUserId: string;
  messageBody: string;
}) {
  const church = await getChurchByIdFromFirebase(input.churchId);
  const senderProfile = await getUserById(input.senderUserId);
  const trimmedMessage = input.messageBody.trim();

  if (!church || !senderProfile) {
    throw new Error("The church message could not be sent right now.");
  }

  if (!trimmedMessage) {
    throw new Error("Please enter a message before sending it.");
  }

  const message = await createMessageInFirebase({
    churchId: church.id,
    senderId: input.senderUserId,
    senderType: "church_rep",
    messageBody: trimmedMessage,
    isInternal: false,
  });

  await createAuditLogInFirebase({
    entityType: "church",
    entityId: church.id,
    action: "representative_message_sent",
    actorId: input.senderUserId,
    actorType: "church_rep",
    after: message,
    note: trimmedMessage,
  });
  await sendRepresentativeChurchMessageNotification({
    church,
    senderName: senderProfile.name,
    senderEmail: senderProfile.email,
    messageBody: trimmedMessage,
  });

  safeRevalidatePath("/portal/messages");
  safeRevalidatePath(`/admin/churches/${church.id}/representatives`);

  return message;
}

export async function sendAdminChurchMessage(input: {
  churchId: string;
  adminUserId: string;
  recipientEmail: string;
  messageBody: string;
}) {
  const church = await getChurchByIdFromFirebase(input.churchId);
  const trimmedMessage = input.messageBody.trim();

  if (!church) {
    throw new Error("The church could not be found.");
  }

  if (!trimmedMessage) {
    throw new Error("Please enter a message before sending it.");
  }

  const message = await createMessageInFirebase({
    churchId: church.id,
    senderId: input.adminUserId,
    senderType: "admin",
    messageBody: trimmedMessage,
    isInternal: false,
  });

  await createAuditLogInFirebase({
    entityType: "church",
    entityId: church.id,
    action: "admin_message_sent",
    actorId: input.adminUserId,
    actorType: "admin",
    after: message,
    note: trimmedMessage,
  });
  await sendAdminChurchMessageNotification({
    church,
    recipientEmail: input.recipientEmail,
    messageBody: trimmedMessage,
  });

  safeRevalidatePath("/portal/messages");
  safeRevalidatePath(`/admin/churches/${church.id}/representatives`);

  return message;
}
