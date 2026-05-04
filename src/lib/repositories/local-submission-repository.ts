import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";

import { buildChurchDraftFromSubmissionInput, createSlug } from "@/lib/firebase/firestore";
import type {
  ChurchSubmissionRecord,
  CreateChurchSubmissionInput,
  SubmissionManagerAccountRecord,
  UploadAssetRecord,
} from "@/lib/types/directory";
import type { ValidatedUploadFile } from "@/lib/validation/church-submission";

const submissionsFilePath = path.join(
  process.cwd(),
  "storage",
  "submissions",
  "church-submissions.json",
);
const uploadsRootPath = path.join(process.cwd(), "storage", "uploads");

async function ensureStoragePaths() {
  await fs.mkdir(path.dirname(submissionsFilePath), { recursive: true });
  await fs.mkdir(uploadsRootPath, { recursive: true });

  try {
    await fs.access(submissionsFilePath);
  } catch {
    await fs.writeFile(submissionsFilePath, "[]\n", "utf8");
  }
}

async function readSubmissions() {
  await ensureStoragePaths();
  const rawStore = await fs.readFile(submissionsFilePath, "utf8");
  const parsedStore = JSON.parse(rawStore) as ChurchSubmissionRecord[];

  return Array.isArray(parsedStore) ? parsedStore : [];
}

async function writeSubmissions(submissions: ChurchSubmissionRecord[]) {
  await fs.writeFile(
    submissionsFilePath,
    `${JSON.stringify(submissions, null, 2)}\n`,
    "utf8",
  );
}

async function persistUploadFileLocally(
  submissionId: string,
  uploadFile: ValidatedUploadFile,
  index: number,
): Promise<UploadAssetRecord> {
  const submissionDirectory = path.join(uploadsRootPath, submissionId);
  await fs.mkdir(submissionDirectory, { recursive: true });

  const storedName =
    uploadFile.kind === "logo"
      ? `church-logo${uploadFile.extension}`
      : `church-photo-${index + 1}${uploadFile.extension}`;
  const relativePath = path
    .join("storage", "uploads", submissionId, storedName)
    .replace(/\\/g, "/");

  await fs.writeFile(path.join(submissionDirectory, storedName), uploadFile.buffer);

  return {
    id: `${uploadFile.kind}-${index + 1}`,
    kind: uploadFile.kind,
    originalName: uploadFile.originalName,
    storedName,
    relativePath,
    storagePath: relativePath,
    backend: "local",
    mimeType: uploadFile.mimeType,
    size: uploadFile.size,
    width: uploadFile.width,
    height: uploadFile.height,
  };
}

export async function persistSubmissionUploadsLocally(
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
    pendingUploads.map((uploadFile, index) =>
      persistUploadFileLocally(submissionId, uploadFile, index),
    ),
  );
}

export async function createChurchSubmissionLocally(
  input: CreateChurchSubmissionInput,
  uploads: {
    churchLogo?: ValidatedUploadFile;
    churchPhotos: ValidatedUploadFile[];
  },
  options?: {
    requestedManagerAccount?: SubmissionManagerAccountRecord;
  },
) {
  const submissionId = randomUUID();
  const createdAt = new Date().toISOString();
  const persistedUploads = await persistSubmissionUploadsLocally(submissionId, uploads);
  const churchDraft = buildChurchDraftFromSubmissionInput(input, persistedUploads);
  const record: ChurchSubmissionRecord = {
    id: submissionId,
    slug: createSlug(input.churchName),
    status: "pending_review",
    churchDraft,
    church: churchDraft,
    submitterName: input.primaryContactName,
    submitterEmail: input.primaryContactEmail,
    submitterPhone: input.primaryContactPhone || input.phone,
    submitterRole: input.primaryContactRole,
    communicationConsentAcceptedAt: createdAt,
    termsAcceptedAt: createdAt,
    followUpEmailOptIn: input.followUpEmailOptIn,
    requestedManagerAccount: options?.requestedManagerAccount,
    internalNotes: [],
    createdAt,
    updatedAt: createdAt,
    source: "public_form",
    uploads: persistedUploads,
    submittedAt: createdAt,
  };

  const existingSubmissions = await readSubmissions();
  await writeSubmissions([record, ...existingSubmissions]);

  return record;
}

export async function getChurchSubmissionByIdLocally(submissionId: string) {
  const submissions = await readSubmissions();
  return submissions.find((submission) => submission.id === submissionId) ?? null;
}
