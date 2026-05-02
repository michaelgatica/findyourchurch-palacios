import { z } from "zod";

import type { CreateChurchClaimRequestInput } from "@/lib/types/directory";

export const churchClaimRequestSchema = z.object({
  churchId: z.string().min(1, "Church ID is required."),
  requesterUserId: z.string().min(1, "Requester user ID is required."),
  requesterName: z.string().min(2, "Requester name is required."),
  requesterEmail: z.string().email("Requester email must be valid."),
  requesterPhone: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  requesterRoleTitle: z.string().min(2, "Role title is required."),
  relationshipToChurch: z
    .string()
    .min(5, "Please explain your relationship to the church."),
  proofOrExplanation: z
    .string()
    .min(20, "Please provide enough detail for the ministry team to review the request."),
});

export function validateChurchClaimRequestInput(input: CreateChurchClaimRequestInput) {
  return churchClaimRequestSchema.parse(input);
}
