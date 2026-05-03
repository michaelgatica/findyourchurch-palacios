"use server";

import { redirect } from "next/navigation";

import { createChurchSubmission } from "@/lib/repositories/submission-repository";
import { isFirebaseStorageConfigurationError } from "@/lib/firebase/storage";
import { queueSubmissionReceivedNotification } from "@/lib/services/notification-service";
import {
  createSubmissionManagerAccount,
  rollbackSubmissionManagerAccount,
} from "@/lib/services/submission-manager-account-service";
import { type SubmissionFormState } from "@/lib/types/directory";
import { validateChurchSubmissionFormData } from "@/lib/validation/church-submission";

export async function submitChurchAction(
  _previousState: SubmissionFormState,
  formData: FormData,
): Promise<SubmissionFormState> {
  const validationResult = await validateChurchSubmissionFormData(formData);

  if (!validationResult.success) {
    return {
      status: "error",
      formError: validationResult.formError,
      errors: validationResult.errors,
      values: validationResult.values,
    };
  }

  let requestedManagerAccount:
    | Awaited<ReturnType<typeof createSubmissionManagerAccount>>
    | null = null;
  let submissionCreated = false;

  try {
    if (validationResult.accountCreationRequest) {
      requestedManagerAccount = await createSubmissionManagerAccount(
        validationResult.accountCreationRequest,
      );
    }

    const submission = await createChurchSubmission(
      validationResult.data,
      validationResult.uploads,
      {
        requestedManagerAccount: requestedManagerAccount ?? undefined,
      },
    );
    submissionCreated = true;

    await queueSubmissionReceivedNotification(submission);
  } catch (error) {
    console.error("Failed to save church submission", error);
    if (requestedManagerAccount && !submissionCreated) {
      await rollbackSubmissionManagerAccount(requestedManagerAccount.firebaseUid);
    }

    return {
      status: "error",
      formError:
        error instanceof Error &&
        (error.message.includes("account already exists") ||
          error.message.includes("Account creation is not configured right now") ||
          error.message.includes("An account with this email already exists."))
          ? error.message
          : isFirebaseStorageConfigurationError(error)
            ? "We could not upload the church images right now. Please try again in a moment, or submit without images."
            : "We could not save your submission right now. Please try again in a moment.",
      errors: {},
      values: validationResult.values,
    };
  }

  redirect(
    `/submit/confirmation?church=${encodeURIComponent(validationResult.data.churchName)}${
      validationResult.accountCreationRequest ? "&account=created" : ""
    }`,
  );
}
