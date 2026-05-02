"use server";

import { redirect } from "next/navigation";

import { createChurchSubmission } from "@/lib/repositories/submission-repository";
import { isFirebaseStorageConfigurationError } from "@/lib/firebase/storage";
import { queueSubmissionReceivedNotification } from "@/lib/services/notification-service";
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

  try {
    const submission = await createChurchSubmission(
      validationResult.data,
      validationResult.uploads,
    );

    await queueSubmissionReceivedNotification(submission);
  } catch (error) {
    console.error("Failed to save church submission", error);

    return {
      status: "error",
      formError: isFirebaseStorageConfigurationError(error)
        ? "We could not upload the church images right now. Please try again in a moment, or submit without images."
        : "We could not save your submission right now. Please try again in a moment.",
      errors: {},
      values: validationResult.values,
    };
  }

  redirect(
    `/submit/confirmation?church=${encodeURIComponent(
      validationResult.data.churchName,
    )}`,
  );
}
