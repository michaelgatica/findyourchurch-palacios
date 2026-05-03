import { getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import {
  firestoreCollectionNames,
  stripUndefinedDeep,
  toIsoString,
} from "@/lib/firebase/firestore";
import type { AppUserRecord, AppUserRole } from "@/lib/types/directory";

export async function getUserByFirebaseUid(firebaseUid: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const documentSnapshot = await firestore
    .collection(firestoreCollectionNames.users)
    .doc(firebaseUid)
    .get();

  if (!documentSnapshot.exists) {
    return null;
  }

  const data = documentSnapshot.data() as AppUserRecord;

  return {
    ...data,
    createdAt: toIsoString(data.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(data.updatedAt) ?? new Date().toISOString(),
  };
}

export async function getUserById(userId: string) {
  return getUserByFirebaseUid(userId);
}

export async function getUserByEmail(email: string) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return null;
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.users)
    .where("email", "==", email)
    .limit(1)
    .get();

  const documentSnapshot = snapshot.docs[0];

  if (!documentSnapshot) {
    return null;
  }

  const data = documentSnapshot.data() as AppUserRecord;

  return {
    ...data,
    createdAt: toIsoString(data.createdAt) ?? new Date().toISOString(),
    updatedAt: toIsoString(data.updatedAt) ?? new Date().toISOString(),
  };
}

export async function upsertUserProfile(input: {
  firebaseUid: string;
  name: string;
  email: string;
  phone?: string;
  role?: AppUserRole;
}) {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    throw new Error("Firebase Firestore is not configured.");
  }

  const documentReference = firestore
    .collection(firestoreCollectionNames.users)
    .doc(input.firebaseUid);
  const existingDocument = await documentReference.get();
  const existingData = existingDocument.exists
    ? (existingDocument.data() as Partial<AppUserRecord>)
    : null;
  const timestamp = new Date().toISOString();
  const record: AppUserRecord = {
    id: input.firebaseUid,
    firebaseUid: input.firebaseUid,
    name: input.name || existingData?.name || "Find Your Church User",
    email: input.email || existingData?.email || "",
    phone: input.phone ?? existingData?.phone,
    role: input.role ?? existingData?.role ?? "pending_user",
    createdAt:
      existingData?.createdAt
        ? toIsoString(existingData.createdAt) ?? timestamp
        : timestamp,
    updatedAt: timestamp,
  };

  await documentReference.set(stripUndefinedDeep(record), { merge: true });

  return record;
}

export async function listAdminUsers() {
  const firestore = getFirebaseAdminFirestore();

  if (!firestore) {
    return [];
  }

  const snapshot = await firestore
    .collection(firestoreCollectionNames.users)
    .where("role", "==", "admin")
    .get();

  return snapshot.docs.map((documentSnapshot) => documentSnapshot.data() as AppUserRecord);
}

export async function isAdminUser(firebaseUid: string) {
  const user = await getUserByFirebaseUid(firebaseUid);
  return user?.role === "admin";
}
