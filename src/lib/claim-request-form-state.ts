export interface ClaimRequestFormValues {
  churchId: string;
  churchSlug: string;
  churchName: string;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string;
  requesterRoleTitle: string;
  authorizationExplanation: string;
  verifierName: string;
  verifierRoleTitle: string;
  verifierPhone: string;
  communicationConsent: boolean;
  termsAccepted: boolean;
  followUpEmailOptIn: boolean;
}

export type ClaimRequestFieldName =
  | "requesterName"
  | "requesterEmail"
  | "requesterPhone"
  | "requesterRoleTitle"
  | "authorizationExplanation"
  | "verifierName"
  | "verifierRoleTitle"
  | "verifierPhone"
  | "communicationConsent"
  | "termsAccepted";

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
      authorizationExplanation: values?.authorizationExplanation ?? "",
      verifierName: values?.verifierName ?? "",
      verifierRoleTitle: values?.verifierRoleTitle ?? "",
      verifierPhone: values?.verifierPhone ?? "",
      communicationConsent: values?.communicationConsent ?? false,
      termsAccepted: values?.termsAccepted ?? false,
      followUpEmailOptIn: values?.followUpEmailOptIn ?? false,
    },
  };
}
