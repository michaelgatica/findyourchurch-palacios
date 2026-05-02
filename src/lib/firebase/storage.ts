import { randomUUID } from "crypto";
import path from "path";

import { getFirebaseAdminBucket } from "@/lib/firebase/admin";
import { getFirebaseStorageBucketName } from "@/lib/firebase/config";
import type { UploadAssetRecord } from "@/lib/types/directory";
import type { ValidatedUploadFile } from "@/lib/validation/church-submission";

type DownloadUrlDetails =
  | string
  | {
      token: string;
      url: string;
    }
  | undefined;

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

async function uploadBufferToFirebaseStorage(
  storagePath: string,
  storedName: string,
  uploadFile: ValidatedUploadFile,
  index: number,
): Promise<UploadAssetRecord> {
  const bucket = getFirebaseAdminBucket();

  if (!bucket) {
    throw new Error("Firebase Storage is not configured.");
  }

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

  return Promise.all(
    pendingUploads.map((uploadFile, index) => {
      const { storedName, storagePath } = buildSubmissionStoragePath(
        submissionId,
        uploadFile,
        index,
      );

      return uploadBufferToFirebaseStorage(storagePath, storedName, uploadFile, index);
    }),
  );
}
