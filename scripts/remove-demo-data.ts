import { config as loadEnv } from "dotenv";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames } from "@/lib/firebase/firestore";

loadEnv({
  path: ".env.local",
});

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

  const snapshot = await firestore
    .collection(firestoreCollectionNames.churches)
    .where("isSeedContent", "==", true)
    .get();

  if (snapshot.empty) {
    console.log("No demo churches were found.");
    return;
  }

  console.log("Demo churches matched for cleanup:");
  for (const documentSnapshot of snapshot.docs) {
    const data = documentSnapshot.data();
    console.log(`- ${documentSnapshot.id}: ${String(data.name ?? "Unnamed church")}`);
  }

  if (dryRun) {
    console.log(`Dry run complete. ${snapshot.size} demo church listing(s) would be removed.`);
    return;
  }

  const batch = firestore.batch();

  for (const documentSnapshot of snapshot.docs) {
    batch.delete(documentSnapshot.ref);
  }

  await batch.commit();

  console.log(`Removed ${snapshot.size} demo church listing(s).`);
}

run().catch((error) => {
  console.error("Failed to remove demo churches.", error);
  process.exitCode = 1;
});
