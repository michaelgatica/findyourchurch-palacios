import { randomUUID } from "crypto";

import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames, stripUndefinedDeep, toIsoString } from "@/lib/firebase/firestore";
import type { ChurchRepresentativeRecord } from "@/lib/types/directory";

export async function listChurchRepresentativesForChurch(churchId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.churchRepresentatives)
    .where("churchId", "==", churchId)
    .get();

  return snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as ChurchRepresentativeRecord)
    .map((representative) => ({
      ...representative,
      createdAt: toIsoString(representative.createdAt) ?? new Date().toISOString(),
      updatedAt: toIsoString(representative.updatedAt) ?? new Date().toISOString(),
    }));
}

export async function getPrimaryRepresentativeForChurch(churchId: string) {
  const representatives = await listChurchRepresentativesForChurch(churchId);

  return (
    representatives.find(
      (representative) =>
        representative.permissionRole === "primary_owner" && representative.status === "active",
    ) ?? null
  );
}

export async function getRepresentativeForChurchUser(churchId: string, userId: string) {
  const representatives = await listChurchRepresentativesForChurch(churchId);
  return representatives.find((representative) => representative.userId === userId) ?? null;
}

export async function getRepresentativeById(representativeId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const documentSnapshot = await firestore
    .collection(firestoreCollectionNames.churchRepresentatives)
    .doc(representativeId)
    .get();

  if (!documentSnapshot.exists) {
    return null;
  }

  const representative = documentSnapshot.data() as ChurchRepresentativeRecord;

  return {
    ...representative,
    createdAt: toIsoString(representative.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(representative.updatedAt) ?? new Date().toISOString(),
  };
}

export async function listChurchRepresentativesForUser(userId: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.churchRepresentatives)
    .where("userId", "==", userId)
    .get();

  return snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as ChurchRepresentativeRecord)
    .map((representative) => ({
      ...representative,
      createdAt: toIsoString(representative.createdAt) ?? new Date().toISOString(),
      updatedAt: toIsoString(representative.updatedAt) ?? new Date().toISOString(),
    }));
}

export async function listInvitedRepresentativesByEmail(email: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.churchRepresentatives)
    .where("email", "==", email)
    .where("status", "==", "invited")
    .get();

  return snapshot.docs
    .map((documentSnapshot) => documentSnapshot.data() as ChurchRepresentativeRecord)
    .map((representative) => ({
      ...representative,
      createdAt: toIsoString(representative.createdAt) ?? new Date().toISOString(),
      updatedAt: toIsoString(representative.updatedAt) ?? new Date().toISOString(),
    }));
}

export async function getActiveEditorForChurch(churchId: string) {
  const representatives = await listChurchRepresentativesForChurch(churchId);

  return (
    representatives.find(
      (representative) =>
        representative.permissionRole === "editor" &&
        (representative.status === "active" || representative.status === "invited"),
    ) ?? null
  );
}

export async function upsertChurchRepresentative(input: {
  id?: string;
  churchId: string;
  userId?: string | null;
  name: string;
  email: string;
  phone?: string;
  roleTitle: string;
  permissionRole: ChurchRepresentativeRecord["permissionRole"];
  status: ChurchRepresentativeRecord["status"];
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const existingRepresentative =
    input.id
      ? await firestore
          .collection(firestoreCollectionNames.churchRepresentatives)
          .doc(input.id)
          .get()
      : null;
  const now = new Date().toISOString();
  const record: ChurchRepresentativeRecord = {
    id: input.id ?? existingRepresentative?.id ?? randomUUID(),
    churchId: input.churchId,
    userId: input.userId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    roleTitle: input.roleTitle,
    permissionRole: input.permissionRole,
    status: input.status,
    createdAt:
      existingRepresentative?.exists && existingRepresentative.data()
        ? toIsoString(existingRepresentative.data()?.createdAt) ?? now
        : now,
    updatedAt: now,
  };

  await firestore
    .collection(firestoreCollectionNames.churchRepresentatives)
    .doc(record.id)
    .set(stripUndefinedDeep(record), { merge: true });

  return record;
}

export async function updateRepresentativeStatus(
  representativeId: string,
  status: ChurchRepresentativeRecord["status"],
) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  await firestore
    .collection(firestoreCollectionNames.churchRepresentatives)
    .doc(representativeId)
    .set(
      {
        status,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );
}

export async function activateInvitedRepresentative(
  representativeId: string,
  input: {
    userId: string;
    name?: string;
    phone?: string;
  },
) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const existingRepresentative = await getRepresentativeById(representativeId);

  if (!existingRepresentative) {
    throw new Error("The invited representative record could not be found.");
  }

  const updatedRepresentative: ChurchRepresentativeRecord = {
    ...existingRepresentative,
    userId: input.userId,
    name: input.name || existingRepresentative.name,
    phone: input.phone ?? existingRepresentative.phone,
    status: "active",
    updatedAt: new Date().toISOString(),
  };

  await firestore
    .collection(firestoreCollectionNames.churchRepresentatives)
    .doc(representativeId)
    .set(stripUndefinedDeep(updatedRepresentative), { merge: true });

  return updatedRepresentative;
}
