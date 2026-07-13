import { assertSafeNonProductionTarget } from "@/lib/app-environment";
import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames } from "@/lib/firebase/firestore";
import {
  deleteStagingDocumentsWithOAuth,
  getStagingOAuthAuth,
  hasStagingOAuthAccessToken,
  listMarkedStagingDocumentsWithOAuth,
  verifyStagingOAuthTarget,
} from "./staging-oauth-rest";

const marker = "community-hub-staging-qa";
const idPrefix = "staging-qa";
const testEmailDomain = "staging.findyourchurch.test";

function hasArg(name: string) {
  return process.argv.includes(name);
}

async function listMarkedDocuments(collectionName: string) {
  const firestore = getFirebaseAdminFirestore();
  if (!firestore) throw new Error("Firebase Firestore is not configured.");

  const [markerSnapshot, prefixSnapshot] = await Promise.all([
    firestore.collection(collectionName).where("stagingQaMarker", "==", marker).get(),
    firestore.collection(collectionName).where("__name__", ">=", idPrefix).where("__name__", "<", `${idPrefix}\uf8ff`).get(),
  ]);

  const byPath = new Map<string, FirebaseFirestore.DocumentSnapshot>();
  markerSnapshot.docs.forEach((documentSnapshot) => byPath.set(documentSnapshot.ref.path, documentSnapshot));
  prefixSnapshot.docs.forEach((documentSnapshot) => byPath.set(documentSnapshot.ref.path, documentSnapshot));
  return Array.from(byPath.values());
}

async function deleteFirestoreDocuments(collectionNames: string[]) {
  const firestore = getFirebaseAdminFirestore();
  if (!firestore) throw new Error("Firebase Firestore is not configured.");

  const snapshots = (await Promise.all(collectionNames.map(listMarkedDocuments))).flat();
  for (let index = 0; index < snapshots.length; index += 400) {
    const batch = firestore.batch();
    snapshots.slice(index, index + 400).forEach((documentSnapshot) => {
      batch.delete(documentSnapshot.ref);
    });
    await batch.commit();
  }

  return snapshots.map((documentSnapshot) => documentSnapshot.ref.path);
}

async function deleteAuthUsers() {
  const auth = await getStagingOAuthAuth() ?? getFirebaseAdminAuth();
  if (!auth) return { deleted: 0, skipped: 0 };

  const users = [
    `${idPrefix}-admin`,
    `${idPrefix}-rep-user-1`,
    `${idPrefix}-rep-user-2`,
    `${idPrefix}-rep-user-3`,
    `${idPrefix}-event-manager`,
  ];

  let deleted = 0;
  let skipped = 0;
  for (const uid of users) {
    try {
      const user = await auth.getUser(uid);
      if (user.email?.endsWith(`@${testEmailDomain}`)) {
        await verifyStagingOAuthTarget();
        await auth.deleteUser(uid);
        deleted += 1;
      } else {
        skipped += 1;
      }
    } catch {
      skipped += 1;
    }
  }

  return { deleted, skipped };
}

async function main() {
  const dryRun = hasArg("--dry-run");
  const confirm = hasArg("--confirm");

  if (!dryRun && !confirm) {
    throw new Error("Use --dry-run to preview or --confirm to reset staging data.");
  }

  const target = assertSafeNonProductionTarget("Community Hub staging reset");
  const collectionNames = [
    firestoreCollectionNames.churches,
    firestoreCollectionNames.users,
    firestoreCollectionNames.churchRepresentatives,
    firestoreCollectionNames.events,
    firestoreCollectionNames.publicEvents,
    firestoreCollectionNames.eventCategories,
    firestoreCollectionNames.eventReports,
    firestoreCollectionNames.eventRegistrationConfigurations,
    firestoreCollectionNames.eventFormVersions,
    firestoreCollectionNames.eventRegistrations,
    firestoreCollectionNames.eventRegistrationCounters,
    firestoreCollectionNames.eventRegistrationTokens,
    firestoreCollectionNames.eventRegistrationConfirmations,
    firestoreCollectionNames.eventRegistrationIdempotency,
    firestoreCollectionNames.eventRegistrationRateLimits,
    firestoreCollectionNames.eventExports,
    firestoreCollectionNames.eventScheduledJobs,
    firestoreCollectionNames.operationalEvents,
    firestoreCollectionNames.auditLogs,
    firestoreCollectionNames.emailLogs,
  ];
  if (hasStagingOAuthAccessToken()) {
    const matchedPaths = await listMarkedStagingDocumentsWithOAuth(collectionNames, marker, idPrefix);
    console.log(JSON.stringify({
      dryRun,
      confirm,
      environment: target.environment,
      projectIds: target.projectIds,
      marker,
      totalDocuments: matchedPaths.length,
      oauth: true,
    }, null, 2));

    if (dryRun) {
      console.log("Dry run complete. No staging records were deleted.");
      return;
    }

    await deleteStagingDocumentsWithOAuth(matchedPaths);
    const authResult = await deleteAuthUsers();
    console.log(JSON.stringify({ ok: true, deletedDocuments: matchedPaths.length, authResult }, null, 2));
    return;
  }

  const matched = (await Promise.all(collectionNames.map(async (collectionName) => ({
    collectionName,
    documents: await listMarkedDocuments(collectionName),
  })))).filter((entry) => entry.documents.length > 0);

  console.log(JSON.stringify({
    dryRun,
    confirm,
    environment: target.environment,
    projectIds: target.projectIds,
    marker,
    matchedCollections: matched.map((entry) => ({
      collectionName: entry.collectionName,
      count: entry.documents.length,
    })),
    totalDocuments: matched.reduce((sum, entry) => sum + entry.documents.length, 0),
  }, null, 2));

  if (dryRun) {
    console.log("Dry run complete. No staging records were deleted.");
    return;
  }

  const deletedPaths = await deleteFirestoreDocuments(collectionNames);
  const authResult = await deleteAuthUsers();
  console.log(JSON.stringify({ ok: true, deletedDocuments: deletedPaths.length, authResult }, null, 2));
}

main().catch((error) => {
  console.error("Failed to reset Community Hub staging data.", error);
  process.exit(1);
});
