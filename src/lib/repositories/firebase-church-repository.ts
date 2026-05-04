import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  firestoreCollectionNames,
  mapDraftToChurchDocument,
  mapChurchDocumentToChurchRecord,
  mapChurchRecordToChurchDocument,
  stripUndefinedDeep,
} from "@/lib/firebase/firestore";
import { seedChurches } from "@/lib/data/churches";
import { getChurchSubmissionByIdFromFirebase } from "@/lib/repositories/firebase-submission-repository";
import type { ChurchDocument, ChurchRecord, DirectoryFilterOptions } from "@/lib/types/directory";

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

  if (!churchDocument || churchDocument.status !== "published") {
    return null;
  }

  return mapChurchDocumentToChurchRecord(churchDocument);
}

export async function getChurchByIdFromFirebase(churchId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const documentSnapshot = await firestore
    .collection(firestoreCollectionNames.churches)
    .doc(churchId)
    .get();

  if (!documentSnapshot.exists) {
    return null;
  }

  return mapChurchDocumentToChurchRecord(documentSnapshot.data() as ChurchDocument);
}

export async function getChurchByVerificationTokenFromFirebase(
  listingVerificationToken: string,
) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.churches)
    .where("listingVerificationToken", "==", listingVerificationToken)
    .limit(1)
    .get();

  const churchDocument = snapshot.docs[0]?.data() as ChurchDocument | undefined;

  return churchDocument ? mapChurchDocumentToChurchRecord(churchDocument) : null;
}

export async function getChurchDocumentByIdFromFirebase(churchId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const documentSnapshot = await firestore
    .collection(firestoreCollectionNames.churches)
    .doc(churchId)
    .get();

  if (!documentSnapshot.exists) {
    return null;
  }

  return documentSnapshot.data() as ChurchDocument;
}

export async function listChurchesFromFirebase(options?: {
  status?: ChurchRecord["status"];
  limit?: number;
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  let query: FirebaseFirestore.Query = firestore.collection(firestoreCollectionNames.churches);

  if (options?.status) {
    query = query.where("status", "==", options.status);
  }

  const snapshot = await query.get();
  const churches = snapshot.docs
    .map((documentSnapshot) =>
      mapChurchDocumentToChurchRecord(documentSnapshot.data() as ChurchDocument),
    )
    .sort((leftChurch, rightChurch) => rightChurch.updatedAt.localeCompare(leftChurch.updatedAt));

  if (options?.limit) {
    return churches.slice(0, options.limit);
  }

  return churches;
}

export async function upsertChurchFromSubmissionApproval(options: {
  submissionId: string;
  lastVerifiedAt?: string | null;
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const submission = await getChurchSubmissionByIdFromFirebase(options.submissionId);

  if (!submission) {
    throw new Error("The church submission could not be found.");
  }

  const existingChurch = await getChurchBySlugFromFirebase(submission.slug);
  const now = new Date().toISOString();
  const churchId = existingChurch?.id ?? submission.slug;
  const churchDocument = mapDraftToChurchDocument(
    churchId,
    submission.slug,
    submission.churchDraft,
    "published",
    existingChurch?.createdAt ?? now,
    now,
  );

  churchDocument.primaryRepresentativeId = existingChurch?.primaryRepresentativeId ?? null;
  churchDocument.autoPublishUpdates = existingChurch?.autoPublishUpdates ?? false;
  churchDocument.lastVerifiedAt = options.lastVerifiedAt ?? now;
  churchDocument.listingVerificationStatus = "current";
  churchDocument.listingVerificationRequestedAt = null;
  churchDocument.listingVerificationGraceEndsAt = null;
  churchDocument.listingVerificationReminder7SentAt = null;
  churchDocument.listingVerificationReminder3SentAt = null;
  churchDocument.archivedAt = null;
  churchDocument.archivedReason = null;

  await firestore
    .collection(firestoreCollectionNames.churches)
    .doc(churchId)
    .set(stripUndefinedDeep(churchDocument), { merge: true });

  return mapChurchDocumentToChurchRecord(churchDocument);
}

export async function saveChurchDocumentToFirebase(churchDocument: ChurchDocument) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  await firestore
    .collection(firestoreCollectionNames.churches)
    .doc(churchDocument.id)
    .set(stripUndefinedDeep(churchDocument), { merge: true });

  return mapChurchDocumentToChurchRecord(churchDocument);
}

export async function updateChurchAutoPublishSetting(
  churchId: string,
  autoPublishUpdates: boolean,
) {
  const churchDocument = await getChurchDocumentByIdFromFirebase(churchId);

  if (!churchDocument) {
    throw new Error("The church could not be found.");
  }

  const updatedChurchDocument: ChurchDocument = {
    ...churchDocument,
    autoPublishUpdates,
    updatedAt: new Date().toISOString(),
  };

  return saveChurchDocumentToFirebase(updatedChurchDocument);
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

export async function seedChurchesToFirebase(options?: {
  overwrite?: boolean;
  includeSeedContent?: boolean;
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const batch = firestore.batch();

  for (const church of seedChurches) {
    if (church.isSeedContent && !options?.includeSeedContent) {
      continue;
    }

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
