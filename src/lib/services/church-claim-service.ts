import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import { getChurchByIdFromFirebase } from "@/lib/repositories/firebase-church-repository";
import { createChurchClaimRequestInFirebase } from "@/lib/repositories/firebase-claim-request-repository";
import { upsertUserProfile } from "@/lib/repositories/firebase-user-repository";
import { sendClaimReceivedNotification } from "@/lib/services/notification-service";
import { validateChurchClaimRequestInput } from "@/lib/validation/church-claim-request";

export async function createPendingChurchClaimRequest(input: {
  churchId: string;
  requesterUserId: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone?: string;
  requesterRoleTitle: string;
  relationshipToChurch: string;
  proofOrExplanation: string;
}) {
  const validatedInput = validateChurchClaimRequestInput(input);
  const church = await getChurchByIdFromFirebase(validatedInput.churchId);

  if (!church) {
    throw new Error("The church listing could not be found.");
  }

  await upsertUserProfile({
    firebaseUid: validatedInput.requesterUserId,
    name: validatedInput.requesterName,
    email: validatedInput.requesterEmail,
    phone: validatedInput.requesterPhone,
  });

  const claimRequest = await createChurchClaimRequestInFirebase(validatedInput);

  await createAuditLogInFirebase({
    entityType: "churchClaimRequest",
    entityId: claimRequest.id,
    action: "created",
    actorId: validatedInput.requesterUserId,
    actorType: "church_rep",
    note: "Pending church ownership claim request created.",
    after: claimRequest,
  });
  await sendClaimReceivedNotification({
    claimRequest,
    church,
  });

  return claimRequest;
}
