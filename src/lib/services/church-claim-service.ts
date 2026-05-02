import { createAuditLogInFirebase } from "@/lib/repositories/firebase-audit-log-repository";
import { createChurchClaimRequestInFirebase } from "@/lib/repositories/firebase-claim-request-repository";
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

  // TODO: Phase 3 should add admin messaging, email verification checks, and the
  // single-primary-owner transfer workflow before any approval action is exposed.
  return claimRequest;
}
