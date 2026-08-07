import { config as loadEnv } from "dotenv";
import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";

import {
  defaultEventTimeZone,
  reinterpretUtcIsoAsZonedWallTime,
} from "@/lib/date-time";

loadEnv({ path: ".env.local" });

const databaseId = process.env.FIREBASE_DATABASE_ID?.trim() || "findyourchurchpal";
const approvedProjects = new Set([
  "findyourchurch-24562",
  "findyourchurch-staging-2026",
]);
const migrationVersion = "central-wall-time-v1";
const confirmationPhrase = "REPAIR-CENTRAL-EVENT-TIMES";

interface ParsedArguments {
  apply: boolean;
  beforeCreatedAt?: Date;
  confirm?: string;
  eventIds: string[];
  limit: number;
}

interface EventRepairCandidate {
  eventId: string;
  title: string;
  status: string;
  timeZone: string;
  startsAt: string;
  correctedStartsAt: string;
  endsAt?: string | null;
  correctedEndsAt?: string | null;
  registrationOpensAt?: string | null;
  correctedRegistrationOpensAt?: string | null;
  registrationClosesAt?: string | null;
  correctedRegistrationClosesAt?: string | null;
  deltaHours: number;
  registration: Record<string, unknown>;
  hasPublicProjection: boolean;
}

function parseArguments(argv: string[]): ParsedArguments {
  const result: ParsedArguments = {
    apply: argv.includes("--apply"),
    eventIds: [],
    limit: 500,
  };

  for (const argument of argv) {
    if (argument.startsWith("--before-created-at=")) {
      const value = new Date(argument.slice("--before-created-at=".length));
      if (Number.isNaN(value.getTime())) {
        throw new Error("--before-created-at must be a valid ISO timestamp.");
      }
      result.beforeCreatedAt = value;
    } else if (argument.startsWith("--confirm=")) {
      result.confirm = argument.slice("--confirm=".length);
    } else if (argument.startsWith("--event-id=")) {
      const eventId = argument.slice("--event-id=".length).trim();
      if (eventId) result.eventIds.push(eventId);
    } else if (argument.startsWith("--limit=")) {
      const limit = Number(argument.slice("--limit=".length));
      if (!Number.isInteger(limit) || limit < 1 || limit > 5000) {
        throw new Error("--limit must be a whole number between 1 and 5000.");
      }
      result.limit = limit;
    }
  }

  if (result.apply) {
    if (!result.confirm || result.confirm !== confirmationPhrase) {
      throw new Error(`Applying repairs requires --confirm=${confirmationPhrase}.`);
    }

    if (!result.beforeCreatedAt && result.eventIds.length === 0) {
      throw new Error("Applying a broad repair requires --before-created-at=...");
    }
  }

  return result;
}

function createFirestore(projectId: string): Firestore {
  const existingApp = getApps().find((app) => app.name === "event-timezone-repair");
  const app = existingApp ?? (() => {
    const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH?.trim();
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim();

    if (serviceAccountPath) {
      const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
      return initializeApp({
        credential: cert(serviceAccount),
        projectId,
      }, "event-timezone-repair");
    }

    if (privateKey && clientEmail) {
      return initializeApp({
        credential: cert({ clientEmail, privateKey, projectId }),
        projectId,
      }, "event-timezone-repair");
    }

    return initializeApp({
      credential: applicationDefault(),
      projectId,
    }, "event-timezone-repair");
  })();

  return getFirestore(app, databaseId);
}

function asRecord(value: unknown) {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function asOptionalString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function repairTimestamp(value: unknown, timeZone: string) {
  const storedValue = asOptionalString(value);
  if (!storedValue) return null;

  const correctedValue = reinterpretUtcIsoAsZonedWallTime(storedValue, timeZone);
  const deltaHours = (new Date(correctedValue).getTime() - new Date(storedValue).getTime()) / 3_600_000;

  if (deltaHours < 4 || deltaHours > 7) {
    return null;
  }

  return { storedValue, correctedValue, deltaHours };
}

function getCreatedAt(event: Record<string, unknown>) {
  const createdAt = asOptionalString(event.createdAt);
  return createdAt ? new Date(createdAt) : null;
}

function buildCandidate(
  eventId: string,
  data: Record<string, unknown>,
  hasPublicProjection: boolean,
): EventRepairCandidate | null {
  const timeZone = asOptionalString(data.timeZone) ?? "";
  if (timeZone !== defaultEventTimeZone) return null;

  const startsAt = repairTimestamp(data.startsAt, timeZone);
  if (!startsAt) return null;

  const endsAt = repairTimestamp(data.endsAt, timeZone);
  const registration = asRecord(data.registration);
  const registrationOpensAt = repairTimestamp(registration.opensAt, timeZone);
  const registrationClosesAt = repairTimestamp(registration.closesAt, timeZone);

  return {
    eventId,
    title: asOptionalString(data.title) ?? "(untitled event)",
    status: asOptionalString(data.status) ?? "unknown",
    timeZone,
    startsAt: startsAt.storedValue,
    correctedStartsAt: startsAt.correctedValue,
    endsAt: endsAt?.storedValue ?? null,
    correctedEndsAt: endsAt?.correctedValue ?? null,
    registrationOpensAt: registrationOpensAt?.storedValue ?? null,
    correctedRegistrationOpensAt: registrationOpensAt?.correctedValue ?? null,
    registrationClosesAt: registrationClosesAt?.storedValue ?? null,
    correctedRegistrationClosesAt: registrationClosesAt?.correctedValue ?? null,
    deltaHours: startsAt.deltaHours,
    registration,
    hasPublicProjection,
  };
}

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId || !approvedProjects.has(projectId)) {
    throw new Error("Set FIREBASE_PROJECT_ID to the approved staging or production project.");
  }

  const argumentsValue = parseArguments(process.argv.slice(2));
  const firestore = createFirestore(projectId);
  const eventSnapshots = argumentsValue.eventIds.length > 0
    ? await Promise.all(argumentsValue.eventIds.map((eventId) => firestore.collection("events").doc(eventId).get()))
    : (await firestore.collection("events").limit(argumentsValue.limit + 1).get()).docs;
  if (argumentsValue.eventIds.length === 0 && eventSnapshots.length > argumentsValue.limit) {
    throw new Error(`More than ${argumentsValue.limit} events matched the scan limit; rerun with a higher --limit after reviewing the dry run.`);
  }
  const candidates: EventRepairCandidate[] = [];
  const skipped: Array<{ eventId: string; reason: string }> = [];

  for (const snapshot of eventSnapshots) {
    if (!snapshot.exists) {
      skipped.push({ eventId: snapshot.id, reason: "event does not exist" });
      continue;
    }

    const data = snapshot.data() ?? {};
    const migration = await firestore.collection("eventTimeZoneMigrations").doc(snapshot.id).get();
    if (migration.exists && migration.data()?.version === migrationVersion) {
      skipped.push({ eventId: snapshot.id, reason: "already repaired by this migration" });
      continue;
    }

    if (argumentsValue.eventIds.length === 0 && argumentsValue.beforeCreatedAt) {
      const createdAt = getCreatedAt(data);
      if (!createdAt || createdAt >= argumentsValue.beforeCreatedAt) {
        skipped.push({ eventId: snapshot.id, reason: "created after --before-created-at" });
        continue;
      }
    }

    try {
      const publicProjection = await firestore.collection("publicEvents").doc(snapshot.id).get();
      const candidate = buildCandidate(snapshot.id, data, publicProjection.exists);
      if (candidate) candidates.push(candidate);
    } catch (error) {
      skipped.push({
        eventId: snapshot.id,
        reason: error instanceof Error ? error.message : "invalid timestamp",
      });
    }
  }

  console.log(JSON.stringify({
    mode: argumentsValue.apply ? "apply" : "dry-run",
    projectId,
    databaseId,
    migrationVersion,
    candidateCount: candidates.length,
    skippedCount: skipped.length,
    candidates,
    skipped,
  }, null, 2));

  if (!argumentsValue.apply || candidates.length === 0) return;

  const now = new Date().toISOString();
  for (let index = 0; index < candidates.length; index += 100) {
    const batch = firestore.batch();
    for (const candidate of candidates.slice(index, index + 100)) {
      const eventReference = firestore.collection("events").doc(candidate.eventId);
      const publicReference = firestore.collection("publicEvents").doc(candidate.eventId);
      const migrationReference = firestore.collection("eventTimeZoneMigrations").doc(candidate.eventId);
      const registrationUpdates = Object.fromEntries(
        [
          ["opensAt", candidate.correctedRegistrationOpensAt],
          ["closesAt", candidate.correctedRegistrationClosesAt],
        ].filter(([, value]) => value !== null),
      );
      const correctedRegistration = {
        ...candidate.registration,
        ...registrationUpdates,
      };

      batch.update(eventReference, {
        startsAt: candidate.correctedStartsAt,
        ...(candidate.correctedEndsAt ? { endsAt: candidate.correctedEndsAt } : {}),
        ...(Object.keys(registrationUpdates).length > 0 ? { registration: correctedRegistration } : {}),
        updatedAt: now,
      });
      if (candidate.hasPublicProjection) {
        batch.update(publicReference, {
          startsAt: candidate.correctedStartsAt,
          ...(candidate.correctedEndsAt ? { endsAt: candidate.correctedEndsAt } : {}),
          ...(Object.keys(registrationUpdates).length > 0 ? { registration: correctedRegistration } : {}),
          updatedAt: now,
        });
      }
      batch.set(migrationReference, {
        version: migrationVersion,
        eventId: candidate.eventId,
        appliedAt: now,
        previousStartsAt: candidate.startsAt,
        correctedStartsAt: candidate.correctedStartsAt,
        deltaHours: candidate.deltaHours,
      });
    }
    await batch.commit();
  }

  console.log(JSON.stringify({ ok: true, applied: candidates.length }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
