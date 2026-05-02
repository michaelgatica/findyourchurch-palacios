import { createChurchSubmissionInFirebase } from "@/lib/repositories/firebase-submission-repository";
import { createChurchSubmissionLocally } from "@/lib/repositories/local-submission-repository";
import { getRepositoryMode } from "@/lib/repositories/repository-mode";
import type { CreateChurchSubmissionInput } from "@/lib/types/directory";
import type { ValidatedUploadFile } from "@/lib/validation/church-submission";

export async function createChurchSubmission(
  input: CreateChurchSubmissionInput,
  uploads: {
    churchLogo?: ValidatedUploadFile;
    churchPhotos: ValidatedUploadFile[];
  },
) {
  if (getRepositoryMode() === "firebase") {
    return createChurchSubmissionInFirebase(input, uploads);
  }

  return createChurchSubmissionLocally(input, uploads);
}
