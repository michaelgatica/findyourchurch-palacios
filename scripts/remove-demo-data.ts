import { config as loadEnv } from "dotenv";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames } from "@/lib/firebase/firestore";

loadEnv({
  path: ".env.local",
});

const knownDemoSlugs = new Set([
  "grace-harbor-fellowship",
  "st-mark-by-the-bay",
  "iglesia-esperanza-palacios",
  "river-of-life-chapel",
]);

async function run() {
  const confirm = process.argv.includes("--confirm");
  const dryRun = process.argv.includes("--dry-run");

  if (!confirm && !dryRun) {
    throw new Error(
      "Refusing to remove demo data without --confirm or --dry-run. This script deletes Firestore churches marked isSeedContent=true.",
    );
  }

  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const snapshot = await firestore.collection(firestoreCollectionNames.churches).get();

  const matchingDocs = snapshot.docs.filter((documentSnapshot) => {
    const data = documentSnapshot.data();
    const slug = String(data.slug ?? "");

    return data.isSeedContent === true || knownDemoSlugs.has(slug);
  });

  if (matchingDocs.length === 0) {
    console.log("No demo churches were found.");
    return;
  }

  console.log("Demo churches matched for cleanup:");
  for (const documentSnapshot of matchingDocs) {
    const data = documentSnapshot.data();
    console.log(`- ${documentSnapshot.id}: ${String(data.name ?? "Unnamed church")}`);
  }

  if (dryRun) {
    console.log(`Dry run complete. ${matchingDocs.length} demo church listing(s) would be removed.`);
    return;
  }

  const batch = firestore.batch();

  for (const documentSnapshot of matchingDocs) {
    batch.delete(documentSnapshot.ref);
  }

  await batch.commit();

  console.log(`Removed ${matchingDocs.length} demo church listing(s).`);
}

run().catch((error) => {
  console.error("Failed to remove demo churches.", error);
  process.exitCode = 1;
});
