import { createChurchSubmissionInFirebase } from "@/lib/repositories/firebase-submission-repository";
import { createChurchSubmissionLocally } from "@/lib/repositories/local-submission-repository";
import { getRepositoryMode } from "@/lib/repositories/repository-mode";
import type {
  CreateChurchSubmissionInput,
  SubmissionManagerAccountRecord,
} from "@/lib/types/directory";
import type { ValidatedUploadFile } from "@/lib/validation/church-submission";

export async function createChurchSubmission(
  input: CreateChurchSubmissionInput,
  uploads: {
    churchLogo?: ValidatedUploadFile;
    churchPhotos: ValidatedUploadFile[];
  },
  options?: {
    requestedManagerAccount?: SubmissionManagerAccountRecord;
  },
) {
  if (getRepositoryMode() === "firebase") {
    return createChurchSubmissionInFirebase(input, uploads, options);
  }

  return createChurchSubmissionLocally(input, uploads, options);
}
