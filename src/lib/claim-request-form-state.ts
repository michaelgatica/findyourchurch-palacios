export interface ClaimRequestFormValues {
  churchId: string;
  churchSlug: string;
  churchName: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  requesterRoleTitle: string;
  relationshipToChurch: string;
  proofOrExplanation: string;
}

export type ClaimRequestFieldName =
  | "requesterName"
  | "requesterEmail"
  | "requesterPhone"
  | "requesterRoleTitle"
  | "relationshipToChurch"
  | "proofOrExplanation";

export interface ClaimRequestFormState {
  status: "idle" | "error";
  formError?: string;
  errors: Partial<Record<ClaimRequestFieldName, string>>;
  values: ClaimRequestFormValues;
}

export function createClaimRequestFormState(
  values?: Partial<ClaimRequestFormValues>,
): ClaimRequestFormState {
  return {
    status: "idle",
    errors: {},
    values: {
      churchId: values?.churchId ?? "",
      churchSlug: values?.churchSlug ?? "",
      churchName: values?.churchName ?? "",
      requesterName: values?.requesterName ?? "",
      requesterEmail: values?.requesterEmail ?? "",
      requesterPhone: values?.requesterPhone ?? "",
      requesterRoleTitle: values?.requesterRoleTitle ?? "",
      relationshipToChurch: values?.relationshipToChurch ?? "",
      proofOrExplanation: values?.proofOrExplanation ?? "",
    },
  };
}
