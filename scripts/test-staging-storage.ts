import { randomBytes, randomUUID } from "crypto";
import { readFile } from "fs/promises";

import { config as loadEnv } from "dotenv";

import { assertSafeNonProductionTarget } from "@/lib/app-environment";
import { verifyStagingOAuthTarget } from "./staging-oauth-rest";

loadEnv({ path: ".env.staging.local" });

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function expectDenied(response: Response, check: string) {
  if (response.ok || ![401, 403].includes(response.status)) {
    throw new Error(`${check} was not denied (received HTTP ${response.status}).`);
  }
}

function storageObjectUrl(bucketName: string, storagePath: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}`;
}

function storageUploadUrl(bucketName: string, storagePath: string) {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o?name=${encodeURIComponent(storagePath)}`;
}

function trustedStorageObjectUrl(bucketName: string, storagePath: string) {
  return `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(storagePath)}`;
}

async function trustedUpload(input: {
  accessToken: string;
  projectId: string;
  bucketName: string;
  storagePath: string;
  contentType: string;
  body: BodyInit;
}) {
  const response = await fetch(
    `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(input.bucketName)}/o?uploadType=media&name=${encodeURIComponent(input.storagePath)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.accessToken}`,
        "Content-Type": input.contentType,
        "x-goog-user-project": input.projectId,
      },
      body: input.body,
    },
  );
  if (!response.ok) {
    throw new Error(`Trusted staging Storage upload failed with HTTP ${response.status}.`);
  }
}

async function trustedDelete(input: {
  accessToken: string;
  projectId: string;
  bucketName: string;
  storagePath: string;
}) {
  const response = await fetch(trustedStorageObjectUrl(input.bucketName, input.storagePath), {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "x-goog-user-project": input.projectId,
    },
  });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Trusted staging Storage cleanup failed with HTTP ${response.status}.`);
  }
}

async function createTemporaryFirebaseUser(apiKey: string, email: string, password: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await response.json() as { idToken?: string; error?: { message?: string } };
  if (!response.ok || !body.idToken) {
    throw new Error(`Temporary staging account creation failed: ${body.error?.message ?? response.status}.`);
  }
  return body.idToken;
}

async function deleteTemporaryFirebaseUser(apiKey: string, idToken: string) {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) {
    throw new Error(`Temporary staging account cleanup failed with HTTP ${response.status}.`);
  }
}

async function main() {
  const target = assertSafeNonProductionTarget("Live staging Storage validation");
  assert(target.environment === "staging", "Live Storage validation requires APP_ENV=staging.");
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const bucketName = process.env.FIREBASE_STORAGE_BUCKET?.trim();
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY?.trim();
  const accessToken = process.env.FIREBASE_OAUTH_ACCESS_TOKEN?.trim();
  assert(projectId === "findyourchurch-staging-2026", "Unexpected staging project ID.");
  assert(bucketName === `${projectId}.firebasestorage.app`, "Unexpected staging bucket name.");
  assert(apiKey, "NEXT_PUBLIC_FIREBASE_API_KEY is required for live Storage validation.");
  assert(accessToken, "FIREBASE_OAUTH_ACCESS_TOKEN is required for live Storage validation.");

  await verifyStagingOAuthTarget();

  const runId = randomUUID();
  const uid = `staging-storage-${runId}`;
  const email = `${uid}@staging.findyourchurch.test`;
  const password = `${randomBytes(36).toString("base64url")}Aa1!`;
  const eventId = `staging-storage-${runId}`;
  const flyerPath = `churches/staging-qa-church-1/events/${eventId}/flyer/flyer.png`;
  const anonymousUploadPath = `churches/staging-qa-church-1/events/${eventId}/flyer/anonymous.png`;
  const churchBPath = `churches/staging-qa-church-2/events/${eventId}/flyer/forged.png`;
  const privateExportPath = `private/event-exports/staging-qa-church-1/${eventId}/report.xlsx`;
  const misroutedExportPath = `churches/staging-qa-church-1/events/${eventId}/flyer/report.xlsx`;
  const cleanupPaths = [flyerPath, anonymousUploadPath, churchBPath, privateExportPath, misroutedExportPath];
  let temporaryIdToken: string | null = null;

  try {
    await verifyStagingOAuthTarget();
    const idToken = await createTemporaryFirebaseUser(apiKey, email, password);
    temporaryIdToken = idToken;
    const firebaseAuthHeader = { Authorization: `Firebase ${idToken}` };
    const flyerBytes = await readFile("public/assets/logos/find-your-church-palacios-512.png");

    await verifyStagingOAuthTarget();
    await trustedUpload({
      accessToken,
      projectId,
      bucketName,
      storagePath: flyerPath,
      contentType: "image/png",
      body: flyerBytes,
    });
    await trustedUpload({
      accessToken,
      projectId,
      bucketName,
      storagePath: privateExportPath,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: Buffer.from("private-export"),
    });
    await trustedUpload({
      accessToken,
      projectId,
      bucketName,
      storagePath: misroutedExportPath,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      body: Buffer.from("misrouted-private-export"),
    });

    const publicFlyerRead = await fetch(`${storageObjectUrl(bucketName, flyerPath)}?alt=media`);
    assert(publicFlyerRead.ok, `Public flyer read failed with HTTP ${publicFlyerRead.status}.`);

    await expectDenied(
      await fetch(storageUploadUrl(bucketName, anonymousUploadPath), {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: flyerBytes,
      }),
      "Anonymous flyer upload",
    );
    await expectDenied(
      await fetch(storageUploadUrl(bucketName, flyerPath), {
        method: "POST",
        headers: { ...firebaseAuthHeader, "Content-Type": "image/png" },
        body: flyerBytes,
      }),
      "Authenticated direct flyer upload",
    );
    await expectDenied(
      await fetch(storageUploadUrl(bucketName, churchBPath), {
        method: "POST",
        headers: { ...firebaseAuthHeader, "Content-Type": "image/png" },
        body: flyerBytes,
      }),
      "Cross-church direct flyer upload",
    );
    await expectDenied(
      await fetch(`${storageObjectUrl(bucketName, privateExportPath)}?alt=media`),
      "Public private-export read",
    );
    await expectDenied(
      await fetch(`${storageObjectUrl(bucketName, misroutedExportPath)}?alt=media`),
      "Misrouted export read from flyer path",
    );
    await expectDenied(
      await fetch(storageObjectUrl(bucketName, flyerPath), {
        method: "DELETE",
        headers: firebaseAuthHeader,
      }),
      "Unauthorized flyer deletion",
    );

    console.log(JSON.stringify({
      ok: true,
      projectId,
      bucketName,
      checks: [
        "trusted Admin Storage upload succeeds",
        "public flyer read succeeds",
        "anonymous flyer upload is denied",
        "authenticated direct flyer upload is denied",
        "cross-church direct flyer upload is denied",
        "private export public read is denied",
        "misrouted export cannot be exposed through a flyer path",
        "unauthorized flyer deletion is denied",
      ],
    }, null, 2));
  } finally {
    await verifyStagingOAuthTarget();
    await Promise.all(cleanupPaths.map((storagePath) => trustedDelete({
      accessToken,
      projectId,
      bucketName,
      storagePath,
    }).catch(() => undefined)));
    if (temporaryIdToken) {
      await deleteTemporaryFirebaseUser(apiKey, temporaryIdToken).catch(() => undefined);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
