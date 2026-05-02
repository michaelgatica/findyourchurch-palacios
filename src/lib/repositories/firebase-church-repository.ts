import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  firestoreCollectionNames,
  mapChurchDocumentToChurchRecord,
  mapChurchRecordToChurchDocument,
  stripUndefinedDeep,
} from "@/lib/firebase/firestore";
import { seedChurches } from "@/lib/data/churches";
import type { ChurchDocument, DirectoryFilterOptions } from "@/lib/types/directory";

export async function getPublishedChurchesFromFirebase() {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.churches)
    .where("status", "==", "published")
    .get();

  return snapshot.docs
    .map((documentSnapshot) =>
      mapChurchDocumentToChurchRecord(
        documentSnapshot.data() as ChurchDocument,
      ),
    )
    .sort((leftChurch, rightChurch) => leftChurch.name.localeCompare(rightChurch.name));
}

export async function getChurchBySlugFromFirebase(churchSlug: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.churches)
    .where("slug", "==", churchSlug)
    .limit(1)
    .get();

  const churchDocument = snapshot.docs[0]?.data() as ChurchDocument | undefined;

  return churchDocument ? mapChurchDocumentToChurchRecord(churchDocument) : null;
}

export async function getDirectoryFilterOptionsFromFirebase(): Promise<DirectoryFilterOptions> {
  const publishedChurches = await getPublishedChurchesFromFirebase();

  return {
    denominations: Array.from(
      new Set(publishedChurches.map((church) => church.denomination)),
    ).sort((leftValue, rightValue) => leftValue.localeCompare(rightValue)),
    worshipStyles: Array.from(
      new Set(
        publishedChurches
          .map((church) => church.worshipStyle)
          .filter((worshipStyle): worshipStyle is string => Boolean(worshipStyle)),
      ),
    ).sort((leftValue, rightValue) => leftValue.localeCompare(rightValue)),
  };
}

export async function seedChurchesToFirebase(options?: { overwrite?: boolean }) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const batch = firestore.batch();

  for (const church of seedChurches) {
    const churchDocumentReference = firestore
      .collection(firestoreCollectionNames.churches)
      .doc(church.id);

    if (!options?.overwrite) {
      const existingDocument = await churchDocumentReference.get();

      if (existingDocument.exists) {
        continue;
      }
    }

    batch.set(
      churchDocumentReference,
      stripUndefinedDeep(mapChurchRecordToChurchDocument(church)),
    );
  }

  await batch.commit();
}
