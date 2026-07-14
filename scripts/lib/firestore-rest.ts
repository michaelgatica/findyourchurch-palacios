type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

interface FirestoreDocumentResponse {
  name: string;
  fields?: Record<string, FirestoreValue>;
}

export interface FirestoreRestDocument {
  name: string;
  id: string;
  data: Record<string, unknown>;
}

export interface FirestoreRestFilter {
  field: string;
  operator?: "EQUAL" | "NOT_EQUAL" | "LESS_THAN_OR_EQUAL";
  value: unknown;
}

function encodeValue(value: unknown): FirestoreValue {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? { integerValue: String(value) }
      : { doubleValue: value };
  }
  if (typeof value === "string") return { stringValue: value };
  if (Array.isArray(value)) {
    return { arrayValue: { values: value.map(encodeValue) } };
  }
  if (typeof value === "object") {
    return { mapValue: { fields: encodeFields(value as Record<string, unknown>) } };
  }
  return { stringValue: String(value) };
}

function encodeFields(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, encodeValue(value)]),
  );
}

function decodeValue(value: FirestoreValue): unknown {
  if ("nullValue" in value) return null;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("stringValue" in value) return value.stringValue;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in value) return decodeFields(value.mapValue.fields ?? {});
  return null;
}

function decodeFields(fields: Record<string, FirestoreValue>) {
  return Object.fromEntries(
    Object.entries(fields).map(([key, value]) => [key, decodeValue(value)]),
  );
}

function decodeDocument(document: FirestoreDocumentResponse): FirestoreRestDocument {
  return {
    name: document.name,
    id: document.name.split("/").at(-1) ?? "",
    data: decodeFields(document.fields ?? {}),
  };
}

export class FirestoreRestClient {
  private readonly databaseRoot: string;
  private readonly documentsRoot: string;

  constructor(
    private readonly projectId: string,
    private readonly databaseId: string,
    private readonly accessToken: string,
  ) {
    this.databaseRoot = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/${encodeURIComponent(databaseId)}`;
    this.documentsRoot = `${this.databaseRoot}/documents`;
  }

  private async request<T>(url: string, init: RequestInit = {}, allowNotFound = false): Promise<T | null> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`Firestore REST request failed with HTTP ${response.status}.`);
    }
    if (response.status === 204) return null;
    return await response.json() as T;
  }

  private documentUrl(collection: string, id: string) {
    return `${this.documentsRoot}/${encodeURIComponent(collection)}/${encodeURIComponent(id)}`;
  }

  async get(collection: string, id: string) {
    const result = await this.request<FirestoreDocumentResponse>(
      this.documentUrl(collection, id),
      {},
      true,
    );
    return result ? decodeDocument(result) : null;
  }

  async set(collection: string, id: string, data: Record<string, unknown>) {
    const result = await this.request<FirestoreDocumentResponse>(
      this.documentUrl(collection, id),
      {
        method: "PATCH",
        body: JSON.stringify({ fields: encodeFields(data) }),
      },
    );
    return decodeDocument(result!);
  }

  async update(collection: string, id: string, updates: Record<string, unknown>) {
    const existing = await this.get(collection, id);
    if (!existing) throw new Error("The Firestore document to update was not found.");
    return this.set(collection, id, { ...existing.data, ...updates });
  }

  async delete(collection: string, id: string) {
    await this.request(this.documentUrl(collection, id), { method: "DELETE" }, true);
  }

  async query(collection: string, filters: FirestoreRestFilter[] = [], limit = 100) {
    const fieldFilters = filters.map((filter) => ({
      fieldFilter: {
        field: { fieldPath: filter.field },
        op: filter.operator ?? "EQUAL",
        value: encodeValue(filter.value),
      },
    }));
    const where = fieldFilters.length === 0
      ? undefined
      : fieldFilters.length === 1
        ? fieldFilters[0]
        : { compositeFilter: { op: "AND", filters: fieldFilters } };
    const result = await this.request<Array<{ document?: FirestoreDocumentResponse }>>(
      `${this.databaseRoot}/documents:runQuery`,
      {
        method: "POST",
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: collection }],
            where,
            limit,
          },
        }),
      },
    );
    return (result ?? []).flatMap((entry) => entry.document ? [decodeDocument(entry.document)] : []);
  }

  async deleteStorageObject(bucket: string, storagePath: string) {
    const response = await fetch(
      `https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(storagePath)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${this.accessToken}` },
      },
    );
    if (!response.ok && response.status !== 404) {
      throw new Error(`Storage REST delete failed with HTTP ${response.status}.`);
    }
  }
}
