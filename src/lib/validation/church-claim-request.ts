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
  authorizationExplanation: z
    .string()
    .min(20, "Please explain how you are authorized to help manage this listing."),
  verifierName: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  verifierRoleTitle: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  verifierPhone: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : undefined)),
  communicationConsent: z.boolean().refine(
    (value) => value,
    "Please confirm that we may email you about this request and review process.",
  ),
  termsAccepted: z.boolean().refine(
    (value) => value,
    "Please agree to the Terms and Privacy Policy before submitting.",
  ),
  followUpEmailOptIn: z.boolean(),
});

export function validateChurchClaimRequestInput(input: CreateChurchClaimRequestInput) {
  return churchClaimRequestSchema.parse(input);
}
