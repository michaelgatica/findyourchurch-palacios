import { randomUUID } from "crypto";
import path from "path";

import { getFirebaseAdminBucket } from "@/lib/firebase/admin";
import {
  assertFirebaseStorageConfig,
  getFirebaseProjectId,
  getFirebaseStorageBucketName,
} from "@/lib/firebase/config";
import type { UploadAssetRecord } from "@/lib/types/directory";
import type { ValidatedUploadFile } from "@/lib/validation/church-submission";

type FirebaseAdminBucket = NonNullable<ReturnType<typeof getFirebaseAdminBucket>>;
type DownloadUrlDetails =
  | string
  | {
      token: string;
      url: string;
    }
  | undefined;

export class FirebaseStorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseStorageConfigurationError";
  }
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export function isFirebaseStorageConfigurationError(error: unknown) {
  return error instanceof FirebaseStorageConfigurationError;
}

export function getFirebaseStorageSetupHint() {
  const projectId = getFirebaseProjectId();
  const modernBucketExample = projectId
    ? `${projectId}.firebasestorage.app`
    : "PROJECT_ID.firebasestorage.app";
  const legacyBucketExample = projectId
    ? `${projectId}.appspot.com`
    : "PROJECT_ID.appspot.com";

  return [
    "Enable Cloud Storage for Firebase in Firebase Console and confirm the default bucket exists.",
    "Copy the bucket name exactly as shown in the bucket URL, but omit the gs:// prefix.",
    `Newer Firebase projects usually use ${modernBucketExample}. Older default buckets may use ${legacyBucketExample}.`,
  ].join(" ");
}

function createFirebaseStorageConfigurationError(
  summary: string,
  error?: unknown,
) {
  const errorMessage = error ? getErrorMessage(error) : undefined;
  const detail = errorMessage ? ` ${errorMessage}` : "";

  return new FirebaseStorageConfigurationError(
    `${summary}${detail} ${getFirebaseStorageSetupHint()}`.trim(),
  );
}

function buildDownloadUrl(storagePath: string): DownloadUrlDetails {
  const bucketName = getFirebaseStorageBucketName();

  if (!bucketName) {
    return undefined;
  }

  const emulatorHost = process.env.FIREBASE_STORAGE_EMULATOR_HOST;

  if (emulatorHost) {
    return `http://${emulatorHost}/v0/b/${bucketName}/o/${encodeURIComponent(
      storagePath,
    )}?alt=media`;
  }

  const downloadToken = randomUUID();

  return {
    token: downloadToken,
    url: `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(
      storagePath,
    )}?alt=media&token=${downloadToken}`,
  };
}

function buildStoredName(uploadFile: ValidatedUploadFile, index: number) {
  return uploadFile.kind === "logo"
    ? `church-logo${uploadFile.extension}`
    : `church-photo-${index + 1}${uploadFile.extension}`;
}

export function buildSubmissionStoragePath(
  submissionId: string,
  uploadFile: ValidatedUploadFile,
  index: number,
) {
  const storedName = buildStoredName(uploadFile, index);
  const folder = uploadFile.kind === "logo" ? "logo" : "photos";

  return {
    storedName,
    storagePath: path
      .join("church-submissions", submissionId, folder, storedName)
      .replace(/\\/g, "/"),
  };
}

export function buildChurchStoragePath(
  churchId: string,
  uploadFile: ValidatedUploadFile,
  index: number,
) {
  const storedName = buildStoredName(uploadFile, index);
  const folder = uploadFile.kind === "logo" ? "logo" : "photos";

  return {
    storedName,
    storagePath: path.join("churches", churchId, folder, storedName).replace(/\\/g, "/"),
  };
}

async function getVerifiedFirebaseAdminBucket(): Promise<FirebaseAdminBucket> {
  const bucketName = getFirebaseStorageBucketName();

  if (!assertFirebaseStorageConfig()) {
    throw createFirebaseStorageConfigurationError(
      "Firebase Storage is not configured for uploads.",
    );
  }

  const bucket = getFirebaseAdminBucket();

  if (!bucket || !bucketName) {
    throw createFirebaseStorageConfigurationError(
      "Firebase Storage bucket initialization failed.",
    );
  }

  try {
    const [exists] = await bucket.exists();

    if (!exists) {
      throw createFirebaseStorageConfigurationError(
        `Configured Firebase Storage bucket "${bucketName}" does not exist.`,
      );
    }
  } catch (error) {
    if (isFirebaseStorageConfigurationError(error)) {
      throw error;
    }

    const normalizedErrorMessage = getErrorMessage(error).toLowerCase();

    if (normalizedErrorMessage.includes("specified bucket does not exist")) {
      throw createFirebaseStorageConfigurationError(
        `Configured Firebase Storage bucket "${bucketName}" does not exist.`,
        error,
      );
    }

    if (
      normalizedErrorMessage.includes("firebasestorage.googleapis.com") &&
      normalizedErrorMessage.includes("disabled")
    ) {
      throw createFirebaseStorageConfigurationError(
        "The Cloud Storage for Firebase API is disabled for this project.",
        error,
      );
    }

    throw createFirebaseStorageConfigurationError(
      `Unable to access the configured Firebase Storage bucket "${bucketName}".`,
      error,
    );
  }

  return bucket;
}

async function uploadBufferToFirebaseStorage(
  bucket: FirebaseAdminBucket,
  storagePath: string,
  storedName: string,
  uploadFile: ValidatedUploadFile,
  index: number,
): Promise<UploadAssetRecord> {
  const file = bucket.file(storagePath);
  const publicDownload = buildDownloadUrl(storagePath);
  const tokenizedDownload =
    typeof publicDownload === "object" && publicDownload !== null ? publicDownload : null;
  const resolvedDownloadUrl =
    typeof publicDownload === "string" ? publicDownload : tokenizedDownload?.url;
  const metadata =
    tokenizedDownload
      ? {
          contentType: uploadFile.mimeType,
          metadata: {
            firebaseStorageDownloadTokens: tokenizedDownload.token,
          },
        }
      : {
          contentType: uploadFile.mimeType,
        };

  await file.save(uploadFile.buffer, {
    resumable: false,
    metadata,
  });

  return {
    id: `${uploadFile.kind}-${index + 1}`,
    kind: uploadFile.kind,
    originalName: uploadFile.originalName,
    storedName,
    relativePath: storagePath,
    storagePath,
    downloadUrl: resolvedDownloadUrl,
    backend: "firebase",
    mimeType: uploadFile.mimeType,
    size: uploadFile.size,
    width: uploadFile.width,
    height: uploadFile.height,
  };
}

export async function verifyFirebaseStorageBucketConnection() {
  const bucket = await getVerifiedFirebaseAdminBucket();
  const [metadata] = await bucket.getMetadata();

  return {
    bucketName: bucket.name,
    location: metadata.location,
    storageClass: metadata.storageClass,
  };
}

export async function runFirebaseStorageUploadSmokeTest() {
  const bucket = await getVerifiedFirebaseAdminBucket();
  const storagePath = path
    .join("healthchecks", "storage", `${Date.now()}-${randomUUID()}.txt`)
    .replace(/\\/g, "/");
  const file = bucket.file(storagePath);

  try {
    await file.save(Buffer.from("Find Your Church Firebase Storage smoke test", "utf8"), {
      resumable: false,
      metadata: {
        contentType: "text/plain",
        cacheControl: "no-store",
      },
    });
  } catch (error) {
    throw createFirebaseStorageConfigurationError(
      "Firebase Storage upload test failed.",
      error,
    );
  }

  try {
    await file.delete();
  } catch (error) {
    throw createFirebaseStorageConfigurationError(
      `Firebase Storage upload succeeded, but cleanup failed for "${storagePath}".`,
      error,
    );
  }

  return {
    bucketName: bucket.name,
    storagePath,
  };
}

export async function uploadSubmissionAssetsToFirebaseStorage(
  submissionId: string,
  uploads: {
    churchLogo?: ValidatedUploadFile;
    churchPhotos: ValidatedUploadFile[];
  },
) {
  const pendingUploads = [
    ...(uploads.churchLogo ? [uploads.churchLogo] : []),
    ...uploads.churchPhotos,
  ];

  if (pendingUploads.length === 0) {
    return [];
  }

  const bucket = await getVerifiedFirebaseAdminBucket();

  return Promise.all(
    pendingUploads.map((uploadFile, index) => {
      const { storedName, storagePath } = buildSubmissionStoragePath(
        submissionId,
        uploadFile,
        index,
      );

      return uploadBufferToFirebaseStorage(
        bucket,
        storagePath,
        storedName,
        uploadFile,
        index,
      );
    }),
  );
}
