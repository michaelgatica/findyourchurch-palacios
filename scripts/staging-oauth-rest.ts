import { getApps, initializeApp, type Credential } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

import { assertSafeNonProductionTarget } from "@/lib/app-environment";

export interface StagingFirestoreRecord {
  collection: string;
  id: string;
  data: unknown;
}

const oauthAdminAppName = "community-hub-staging-oauth";

function getRequiredOAuthTarget() {
  const accessToken = process.env.FIREBASE_OAUTH_ACCESS_TOKEN?.trim();
  if (!accessToken) return null;

  const target = assertSafeNonProductionTarget("Community Hub staging OAuth operation");
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const databaseId = process.env.FIREBASE_DATABASE_ID?.trim();

  if (!projectId || !databaseId) {
    throw new Error("FIREBASE_PROJECT_ID and FIREBASE_DATABASE_ID are required for staging OAuth operations.");
  }

  if (!target.projectIds.length || target.projectIds.some((configuredProjectId) => configuredProjectId !== projectId)) {
    throw new Error("Configured Firebase project identifiers do not agree with the staging OAuth target.");
  }

  return { accessToken, projectId, databaseId };
}

function oauthHeaders(accessToken: string, projectId: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
    "x-goog-user-project": projectId,
  };
}

async function verifyLiveDatabaseTarget(target: NonNullable<ReturnType<typeof getRequiredOAuthTarget>>) {
  const expectedName = `projects/${target.projectId}/databases/${target.databaseId}`;
  const response = await fetch(`https://firestore.googleapis.com/v1/${expectedName}`, {
    headers: oauthHeaders(target.accessToken, target.projectId),
  });
  const body = await response.json() as { name?: string; locationId?: string; error?: { message?: string } };

  if (!response.ok || body.name !== expectedName) {
    throw new Error(`Live staging database verification failed: ${body.error?.message ?? response.status}.`);
  }

  return body;
}

function toFirestoreValue(value: unknown): Record<string, unknown> {
  if (value === null) return { nullValue: null };
  if (typeof value === "string") return { stringValue: value };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(toFirestoreValue) } };
  }
  if (typeof value === "object") {
    const fields = Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, nestedValue]) => nestedValue !== undefined)
        .map(([key, nestedValue]) => [key, toFirestoreValue(nestedValue)]),
    );
    return { mapValue: { fields } };
  }

  throw new Error(`Unsupported Firestore staging value type: ${typeof value}.`);
}

function documentFields(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Staging Firestore records must be objects.");
  }

  return Object.fromEntries(
    Object.entries(data as Record<string, unknown>)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, toFirestoreValue(value)]),
  );
}

export function hasStagingOAuthAccessToken() {
  return Boolean(process.env.FIREBASE_OAUTH_ACCESS_TOKEN?.trim());
}

export async function verifyStagingOAuthTarget() {
  const target = getRequiredOAuthTarget();
  return target ? verifyLiveDatabaseTarget(target) : null;
}

export async function getStagingOAuthAuth() {
  const target = getRequiredOAuthTarget();
  if (!target) return null;

  await verifyLiveDatabaseTarget(target);
  const existingApp = getApps().find((app) => app.name === oauthAdminAppName);
  const credential: Credential = {
    getAccessToken: async () => ({
      access_token: target.accessToken,
      expires_in: 300,
    }),
  };
  const app = existingApp ?? initializeApp({ credential, projectId: target.projectId }, oauthAdminAppName);
  return getAuth(app);
}

export async function commitStagingRecordsWithOAuth(records: StagingFirestoreRecord[]) {
  const target = getRequiredOAuthTarget();
  if (!target) throw new Error("FIREBASE_OAUTH_ACCESS_TOKEN is required for OAuth Firestore writes.");

  for (let index = 0; index < records.length; index += 400) {
    await verifyLiveDatabaseTarget(target);
    const writes = records.slice(index, index + 400).map((record) => ({
      update: {
        name: `projects/${target.projectId}/databases/${target.databaseId}/documents/${encodeURIComponent(record.collection)}/${encodeURIComponent(record.id)}`,
        fields: documentFields(record.data),
      },
    }));
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${target.projectId}/databases/${target.databaseId}/documents:commit`,
      {
        method: "POST",
        headers: oauthHeaders(target.accessToken, target.projectId),
        body: JSON.stringify({ writes }),
      },
    );
    const body = await response.json() as { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(`Staging OAuth Firestore commit failed: ${body.error?.message ?? response.status}.`);
    }
  }
}

export async function listMarkedStagingDocumentsWithOAuth(
  collectionNames: string[],
  marker: string,
  idPrefix: string,
) {
  const target = getRequiredOAuthTarget();
  if (!target) throw new Error("FIREBASE_OAUTH_ACCESS_TOKEN is required for OAuth Firestore reads.");

  await verifyLiveDatabaseTarget(target);
  const matchedPaths = new Set<string>();

  for (const collectionName of collectionNames) {
    let pageToken: string | undefined;
    do {
      const query = new URLSearchParams({ pageSize: "300" });
      if (pageToken) query.set("pageToken", pageToken);
      const response = await fetch(
        `https://firestore.googleapis.com/v1/projects/${target.projectId}/databases/${target.databaseId}/documents/${encodeURIComponent(collectionName)}?${query}`,
        { headers: oauthHeaders(target.accessToken, target.projectId) },
      );
      const body = await response.json() as {
        documents?: Array<{ name: string; fields?: { stagingQaMarker?: { stringValue?: string } } }>;
        nextPageToken?: string;
        error?: { message?: string };
      };
      if (!response.ok && response.status !== 404) {
        throw new Error(`Staging OAuth Firestore list failed: ${body.error?.message ?? response.status}.`);
      }

      for (const document of body.documents ?? []) {
        const documentId = document.name.slice(document.name.lastIndexOf("/") + 1);
        if (document.fields?.stagingQaMarker?.stringValue === marker || documentId.startsWith(idPrefix)) {
          matchedPaths.add(document.name);
        }
      }
      pageToken = body.nextPageToken;
    } while (pageToken);
  }

  return Array.from(matchedPaths);
}

export async function deleteStagingDocumentsWithOAuth(documentNames: string[]) {
  const target = getRequiredOAuthTarget();
  if (!target) throw new Error("FIREBASE_OAUTH_ACCESS_TOKEN is required for OAuth Firestore deletes.");

  for (let index = 0; index < documentNames.length; index += 400) {
    await verifyLiveDatabaseTarget(target);
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${target.projectId}/databases/${target.databaseId}/documents:commit`,
      {
        method: "POST",
        headers: oauthHeaders(target.accessToken, target.projectId),
        body: JSON.stringify({
          writes: documentNames.slice(index, index + 400).map((documentName) => ({ delete: documentName })),
        }),
      },
    );
    const body = await response.json() as { error?: { message?: string } };
    if (!response.ok) {
      throw new Error(`Staging OAuth Firestore delete failed: ${body.error?.message ?? response.status}.`);
    }
  }
}
