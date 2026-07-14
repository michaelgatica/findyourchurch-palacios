import {
  getRetentionExpiration,
  operationalRecordRetentionDays,
  operationalRecordTtlField,
} from "@/lib/retention-policy";

const stagingProjectId = "findyourchurch-staging-2026";
const databaseId = "findyourchurchpal";
const documentsBase = `https://firestore.googleapis.com/v1/projects/${stagingProjectId}/databases/${databaseId}/documents`;

interface RestDocument {
  name: string;
  fields?: Record<string, { stringValue?: string; timestampValue?: string }>;
}

interface RetentionUpdate {
  name: string;
  expiresAt: string;
}

async function authorizedFetch(url: string, accessToken: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    throw new Error(`Staging Firestore retention request failed with HTTP ${response.status}.`);
  }
  return response;
}

async function listCollection(collection: string, accessToken: string) {
  const documents: RestDocument[] = [];
  let pageToken = "";
  do {
    const url = new URL(`${documentsBase}/${collection}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const response = await authorizedFetch(url.toString(), accessToken);
    const body = await response.json() as { documents?: RestDocument[]; nextPageToken?: string };
    documents.push(...(body.documents ?? []));
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return documents;
}

async function run() {
  const configuredProject = process.env.FIREBASE_PROJECT_ID?.trim();
  const accessToken = process.env.FYC_STAGING_GCLOUD_ACCESS_TOKEN?.trim();
  if (configuredProject !== stagingProjectId) {
    throw new Error("Refusing to backfill operational retention outside staging.");
  }
  if (!accessToken) {
    throw new Error("Load a staging-scoped gcloud access token into process memory before backfill.");
  }

  const definitions: Array<{
    collection: string;
    days: number;
    dateField: string;
    terminalOnly?: boolean;
  }> = [
    { collection: "auditLogs", days: operationalRecordRetentionDays.auditLogs, dateField: "createdAt" },
    { collection: "emailLogs", days: operationalRecordRetentionDays.emailLogs, dateField: "createdAt" },
    { collection: "operationalEvents", days: operationalRecordRetentionDays.operationalEvents, dateField: "createdAt" },
    { collection: "eventScheduledJobs", days: operationalRecordRetentionDays.eventScheduledJobs, dateField: "updatedAt", terminalOnly: true },
  ];
  const updates: RetentionUpdate[] = [];
  const counts: Record<string, number> = {};

  for (const definition of definitions) {
    const documents = await listCollection(definition.collection, accessToken);
    let count = 0;
    for (const document of documents) {
      const fields = document.fields ?? {};
      if (fields[operationalRecordTtlField]?.timestampValue) continue;
      const status = fields.status?.stringValue ?? "";
      if (definition.terminalOnly && !["completed", "failed"].includes(status)) continue;
      const sourceDate = new Date(fields[definition.dateField]?.stringValue ?? "");
      if (Number.isNaN(sourceDate.getTime())) continue;
      updates.push({
        name: document.name,
        expiresAt: getRetentionExpiration(definition.days, sourceDate).toISOString(),
      });
      count += 1;
    }
    counts[definition.collection] = count;
  }

  for (let index = 0; index < updates.length; index += 400) {
    const writes = updates.slice(index, index + 400).map((update) => ({
      update: {
        name: update.name,
        fields: {
          [operationalRecordTtlField]: { timestampValue: update.expiresAt },
        },
      },
      updateMask: { fieldPaths: [operationalRecordTtlField] },
      currentDocument: { exists: true },
    }));
    await authorizedFetch(
      `https://firestore.googleapis.com/v1/projects/${stagingProjectId}/databases/${databaseId}/documents:batchWrite`,
      accessToken,
      { method: "POST", body: JSON.stringify({ writes }) },
    );
  }

  console.log(JSON.stringify({
    ok: true,
    project: stagingProjectId,
    database: databaseId,
    updated: counts,
    total: updates.length,
  }, null, 2));
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
