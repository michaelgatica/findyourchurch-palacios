import { config as loadEnv } from "dotenv";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames } from "@/lib/firebase/firestore";
import { buildLocationRecords } from "@/lib/firebase/firestore";
import { seedChurchesToFirebase } from "@/lib/repositories/firebase-church-repository";

loadEnv({
  path: ".env.local",
});

async function seedLocations() {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const batch = firestore.batch();

  for (const locationRecord of buildLocationRecords()) {
    batch.set(
      firestore.collection(firestoreCollectionNames.locations).doc(locationRecord.id),
      locationRecord,
      { merge: true },
    );
  }

  await batch.commit();
}

async function run() {
  await seedLocations();
  await seedChurchesToFirebase({
    overwrite: process.argv.includes("--overwrite"),
  });

  console.log("Firebase launch data seeded successfully.");
}

run().catch((error) => {
  console.error("Failed to seed Firebase launch data.", error);
  process.exitCode = 1;
});
