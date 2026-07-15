import { expect, type APIRequestContext, type Page } from "@playwright/test";

export const productionBaseUrl = "https://findyourchurchpalacios.org";
export const productionProjectId = "findyourchurch-24562";
export const productionDatabaseId = "findyourchurchpal";
export const productionStorageBucket = "findyourchurch-24562.firebasestorage.app";

export const acceptanceAccounts = {
  administrator: "support@sightsteps.com",
  primaryRepresentative: "support@faithcreekchurch.site",
  editor: "support@findyourchurch.org",
  registrant: "support@sightkeep.com",
} as const;

type FirestoreValue = {
  stringValue?: string;
  integerValue?: string;
  booleanValue?: boolean;
  timestampValue?: string;
  mapValue?: { fields?: Record<string, FirestoreValue> };
  arrayValue?: { values?: FirestoreValue[] };
};

export type FirestoreDocument = {
  name: string;
  fields?: Record<string, FirestoreValue>;
};

function oauthHeaders() {
  const token = process.env.PRODUCTION_OAUTH_ACCESS_TOKEN?.trim();
  expect(token, "A Google OAuth access token must be supplied in process memory.").toBeTruthy();
  return {
    Authorization: `Bearer ${token}`,
    "x-goog-user-project": productionProjectId,
  };
}

function firestoreRoot() {
  return `https://firestore.googleapis.com/v1/projects/${productionProjectId}/databases/${productionDatabaseId}/documents`;
}

export function firestoreDocumentId(document: FirestoreDocument) {
  return document.name.split("/").at(-1)!;
}

export function firestoreString(document: FirestoreDocument, field: string) {
  return document.fields?.[field]?.stringValue ?? null;
}

export async function openProductionPage(page: Page, path: string) {
  const response = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(response, `${path} did not return a response.`).not.toBeNull();
  expect(response!.status(), `${path} returned HTTP ${response!.status()}.`).toBeLessThan(400);
  await expect(page.locator("#main-content")).toBeVisible();
  await expect(page.locator("body")).not.toContainText(/Application error|Unhandled Runtime Error/i);
}

export async function assertNoHorizontalOverflow(page: Page, label: string) {
  const overflow = await page.evaluate(() =>
    Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
  );
  expect(overflow, `${label} horizontally overflows by ${overflow}px.`).toBeLessThanOrEqual(2);
}

export async function lookupAuthUsers(request: APIRequestContext, emails: readonly string[]) {
  const response = await request.post(
    `https://identitytoolkit.googleapis.com/v1/projects/${productionProjectId}/accounts:lookup`,
    {
      headers: oauthHeaders(),
      data: { email: emails },
    },
  );

  if (response.status() === 404) {
    return [] as Array<{ localId: string; email?: string }>;
  }

  expect(response.status(), "Identity Platform account lookup failed.").toBe(200);
  const payload = (await response.json()) as {
    users?: Array<{ localId: string; email?: string }>;
  };
  return payload.users ?? [];
}

export async function promoteUserToTemporaryAdministrator(
  request: APIRequestContext,
  firebaseUid: string,
) {
  const encodedUid = encodeURIComponent(firebaseUid);
  const response = await request.patch(
    `${firestoreRoot()}/users/${encodedUid}?updateMask.fieldPaths=role&updateMask.fieldPaths=updatedAt`,
    {
      headers: oauthHeaders(),
      data: {
        fields: {
          role: { stringValue: "admin" },
          updatedAt: { stringValue: new Date().toISOString() },
        },
      },
    },
  );
  expect(response.status(), "Temporary administrator promotion failed.").toBe(200);
}

export async function queryFirestoreDocuments(
  request: APIRequestContext,
  collectionId: string,
  fieldPath: string,
  value: string,
) {
  const response = await request.post(`${firestoreRoot()}:runQuery`, {
    headers: oauthHeaders(),
    data: {
      structuredQuery: {
        from: [{ collectionId }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: "EQUAL",
            value: { stringValue: value },
          },
        },
        limit: 500,
      },
    },
  });
  expect(response.status(), `Firestore query failed for ${collectionId}.${fieldPath}.`).toBe(200);
  const payload = (await response.json()) as Array<{ document?: FirestoreDocument }>;
  return payload.flatMap((entry) => (entry.document ? [entry.document] : []));
}

async function deleteFirestoreDocument(request: APIRequestContext, document: FirestoreDocument) {
  const response = await request.delete(
    `https://firestore.googleapis.com/v1/${document.name}`,
    { headers: oauthHeaders() },
  );
  expect(
    [200, 404],
    `Firestore cleanup failed for ${document.name} with HTTP ${response.status()}.`,
  ).toContain(response.status());
}

async function deleteStoragePrefix(request: APIRequestContext, prefix: string) {
  const listResponse = await request.get(
    `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(productionStorageBucket)}/o`,
    {
      headers: oauthHeaders(),
      params: { prefix },
    },
  );
  expect(listResponse.status(), `Storage cleanup listing failed for ${prefix}.`).toBe(200);
  const payload = (await listResponse.json()) as { items?: Array<{ name: string }> };

  for (const item of payload.items ?? []) {
    const response = await request.delete(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(productionStorageBucket)}/o/${encodeURIComponent(item.name)}`,
      { headers: oauthHeaders() },
    );
    expect(
      [204, 404],
      `Storage cleanup failed for ${item.name} with HTTP ${response.status()}.`,
    ).toContain(response.status());
  }
}

async function batchDeleteAuthUsers(request: APIRequestContext, localIds: string[]) {
  if (localIds.length === 0) {
    return;
  }

  const response = await request.post(
    `https://identitytoolkit.googleapis.com/v1/projects/${productionProjectId}/accounts:batchDelete`,
    {
      headers: oauthHeaders(),
      data: { localIds, force: true },
    },
  );
  expect(response.status(), "Identity Platform cleanup failed.").toBe(200);
  const payload = (await response.json()) as { errors?: unknown[] };
  expect(payload.errors ?? [], "One or more disposable Auth accounts could not be deleted.").toEqual([]);
}

async function collectByField(
  request: APIRequestContext,
  target: Map<string, FirestoreDocument>,
  collectionId: string,
  fieldPath: string,
  values: Iterable<string>,
) {
  for (const value of values) {
    if (!value) continue;
    const documents = await queryFirestoreDocuments(request, collectionId, fieldPath, value);
    for (const document of documents) {
      target.set(document.name, document);
    }
  }
}

export async function cleanupProductionAcceptanceFixture(
  request: APIRequestContext,
  input: {
    churchSlug: string;
    emails: readonly string[];
  },
) {
  const documents = new Map<string, FirestoreDocument>();
  const submissions = await queryFirestoreDocuments(
    request,
    "churchSubmissions",
    "customShareSlug",
    input.churchSlug,
  );
  const churches = await queryFirestoreDocuments(
    request,
    "churches",
    "customShareSlug",
    input.churchSlug,
  );
  for (const document of [...submissions, ...churches]) documents.set(document.name, document);

  const submissionIds = submissions.map(firestoreDocumentId);
  const churchIds = churches.map(firestoreDocumentId);

  await collectByField(request, documents, "messages", "submissionId", submissionIds);
  await collectByField(request, documents, "auditLogs", "entityId", submissionIds);
  await collectByField(request, documents, "emailLogs", "entityId", submissionIds);

  await collectByField(request, documents, "churchClaimRequests", "churchId", churchIds);
  await collectByField(request, documents, "churchRepresentatives", "churchId", churchIds);
  await collectByField(request, documents, "churchUpdateRequests", "churchId", churchIds);
  await collectByField(request, documents, "ownershipTransferRequests", "churchId", churchIds);
  await collectByField(request, documents, "messages", "churchId", churchIds);
  await collectByField(request, documents, "events", "churchId", churchIds);
  await collectByField(request, documents, "publicEvents", "churchId", churchIds);
  await collectByField(request, documents, "operationalEvents", "churchId", churchIds);

  const claimIds = [...documents.values()]
    .filter((document) => document.name.includes("/churchClaimRequests/"))
    .map(firestoreDocumentId);
  const representativeIds = [...documents.values()]
    .filter((document) => document.name.includes("/churchRepresentatives/"))
    .map(firestoreDocumentId);
  const updateRequestIds = [...documents.values()]
    .filter((document) => document.name.includes("/churchUpdateRequests/"))
    .map(firestoreDocumentId);
  const transferRequestIds = [...documents.values()]
    .filter((document) => document.name.includes("/ownershipTransferRequests/"))
    .map(firestoreDocumentId);
  const eventIds = [...documents.values()]
    .filter((document) => document.name.includes("/events/"))
    .map(firestoreDocumentId);
  const entityIds = [
    ...churchIds,
    ...claimIds,
    ...representativeIds,
    ...updateRequestIds,
    ...transferRequestIds,
    ...eventIds,
  ];

  for (const collection of ["messages", "auditLogs", "emailLogs"]) {
    await collectByField(request, documents, collection, "entityId", entityIds);
  }
  await collectByField(request, documents, "messages", "claimRequestId", claimIds);
  await collectByField(request, documents, "messages", "updateRequestId", updateRequestIds);
  await collectByField(request, documents, "messages", "ownershipTransferRequestId", transferRequestIds);

  const eventCollections = [
    "eventRegistrationConfigurations",
    "eventFormVersions",
    "eventRegistrations",
    "eventRegistrationCounters",
    "eventRegistrationTokens",
    "eventRegistrationConfirmations",
    "eventRegistrationIdempotency",
    "eventRegistrationRateLimits",
    "eventExports",
    "eventScheduledJobs",
    "operationalEvents",
    "auditLogs",
    "emailLogs",
  ];
  for (const collection of eventCollections) {
    await collectByField(request, documents, collection, "eventId", eventIds);
  }

  const authUsers = await lookupAuthUsers(request, input.emails);
  const userIds = authUsers.map((user) => user.localId);
  await collectByField(request, documents, "auditLogs", "actorId", userIds);
  for (const userId of userIds) {
    documents.set(
      `${firestoreRoot()}/users/${userId}`,
      { name: `${firestoreRoot().replace("https://firestore.googleapis.com/v1/", "")}/users/${userId}` },
    );
  }

  for (const submissionId of submissionIds) {
    await deleteStoragePrefix(request, `church-submissions/${submissionId}/`);
  }
  for (const churchId of churchIds) {
    await deleteStoragePrefix(request, `churches/${churchId}/`);
    await deleteStoragePrefix(request, `private/event-exports/${churchId}/`);
  }

  const ordered = [...documents.values()].sort((left, right) => {
    const leftRoot = /\/(churches|churchSubmissions|users)\//.test(left.name) ? 1 : 0;
    const rightRoot = /\/(churches|churchSubmissions|users)\//.test(right.name) ? 1 : 0;
    return leftRoot - rightRoot;
  });
  for (const document of ordered) {
    await deleteFirestoreDocument(request, document);
  }
  await batchDeleteAuthUsers(request, userIds);

  const [remainingSubmissions, remainingChurches, remainingUsers] = await Promise.all([
    queryFirestoreDocuments(request, "churchSubmissions", "customShareSlug", input.churchSlug),
    queryFirestoreDocuments(request, "churches", "customShareSlug", input.churchSlug),
    lookupAuthUsers(request, input.emails),
  ]);
  expect(remainingSubmissions, "Acceptance submissions remain after cleanup.").toEqual([]);
  expect(remainingChurches, "Acceptance churches remain after cleanup.").toEqual([]);
  expect(remainingUsers, "Acceptance Auth users remain after cleanup.").toEqual([]);
}
