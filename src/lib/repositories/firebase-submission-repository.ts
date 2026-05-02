import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { canUseLocalUploadFallback } from "@/lib/firebase/config";
import {
  buildChurchDraftFromSubmissionInput,
  createSlug,
  firestoreCollectionNames,
  stripUndefinedDeep,
  toIsoString,
} from "@/lib/firebase/firestore";
import {
  isFirebaseStorageConfigurationError,
  uploadSubmissionAssetsToFirebaseStorage,
} from "@/lib/firebase/storage";
import { persistSubmissionUploadsLocally } from "@/lib/repositories/local-submission-repository";
import type {
  ChurchSubmissionRecord,
  CreateChurchSubmissionInput,
} from "@/lib/types/directory";
import type { ValidatedUploadFile } from "@/lib/validation/church-submission";

export async function createChurchSubmissionInFirebase(
  input: CreateChurchSubmissionInput,
  uploads: {
    churchLogo?: ValidatedUploadFile;
    churchPhotos: ValidatedUploadFile[];
  },
) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const submissionId = randomUUID();
  const createdAt = new Date().toISOString();
  let uploadedAssets;
  let internalNotes: string[] = [];

  try {
    uploadedAssets = await uploadSubmissionAssetsToFirebaseStorage(submissionId, uploads);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    if (!canUseLocalUploadFallback()) {
      throw error;
    }

    console.warn(
      `Firebase Storage upload failed during development. Falling back to local upload preservation. ${errorMessage}`,
    );
    uploadedAssets = await persistSubmissionUploadsLocally(submissionId, uploads);
    internalNotes = [
      isFirebaseStorageConfigurationError(error)
        ? "Firebase Storage is not fully configured in development, so local upload fallback preserved the files for manual review."
        : "Firebase Storage upload failed during submission intake. Local upload fallback preserved the files for manual review.",
    ];
  }
  const churchDraft = buildChurchDraftFromSubmissionInput(input, uploadedAssets);
  const record: ChurchSubmissionRecord = {
    id: submissionId,
    slug: createSlug(input.churchName),
    status: "pending_review",
    churchDraft,
    submitterName: input.primaryContactName,
    submitterEmail: input.primaryContactEmail,
    submitterPhone: input.primaryContactPhone || input.phone,
    submitterRole: input.primaryContactRole,
    internalNotes,
    createdAt,
    updatedAt: createdAt,
    source: "public_form",
    uploads: uploadedAssets,
    submittedAt: createdAt,
  };

  await firestore
    .collection(firestoreCollectionNames.churchSubmissions)
    .doc(submissionId)
    .set(stripUndefinedDeep(record));

  return record;
}

export async function getChurchSubmissionByIdFromFirebase(submissionId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const documentSnapshot = await firestore
    .collection(firestoreCollectionNames.churchSubmissions)
    .doc(submissionId)
    .get();

  if (!documentSnapshot.exists) {
    return null;
  }

  const data = documentSnapshot.data() as ChurchSubmissionRecord;

  return {
    ...data,
    createdAt: toIsoString(data.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(data.updatedAt) ?? new Date().toISOString(),
    approvedAt: toIsoString(data.approvedAt),
    deniedAt: toIsoString(data.deniedAt),
    requestedChangesAt: toIsoString(data.requestedChangesAt),
    submittedAt: toIsoString(data.submittedAt ?? data.createdAt) ?? undefined,
  };
}
