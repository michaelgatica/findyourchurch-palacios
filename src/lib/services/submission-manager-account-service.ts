import { getFirebaseAdminAuth, getFirebaseAdminFirestore } from "@/lib/firebase/admin";
import { firestoreCollectionNames } from "@/lib/firebase/firestore";
import { upsertUserProfile } from "@/lib/repositories/firebase-user-repository";
import type { SubmissionManagerAccountRecord } from "@/lib/types/directory";

function isFirebaseAuthErrorCode(
  error: unknown,
  code: string,
): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string" &&
    (error as { code: string }).code === code
  );
}

function createAccountConfigurationError() {
  return new Error(
    "Account creation is not configured right now. You can still submit the church listing without creating a managing account yet.",
  );
}

export async function createSubmissionManagerAccount(input: {
  name: string;
  email: string;
  phone?: string;
  roleTitle: string;
  password: string;
}): Promise<SubmissionManagerAccountRecord> {
  const firebaseAdminAuth = getFirebaseAdminAuth();

  if (!firebaseAdminAuth) {
    throw createAccountConfigurationError();
  }

  try {
    const existingUser = await firebaseAdminAuth.getUserByEmail(input.email);

    if (existingUser) {
      throw new Error(
        "An account with this email already exists. You can submit the listing now and sign in later to manage or claim the church listing.",
      );
    }
  } catch (error) {
    if (!isFirebaseAuthErrorCode(error, "auth/user-not-found")) {
      throw error;
    }
  }

  const authUser = await firebaseAdminAuth.createUser({
    email: input.email,
    password: input.password,
    displayName: input.name,
  });

  try {
    await upsertUserProfile({
      firebaseUid: authUser.uid,
      name: input.name,
      email: input.email,
      phone: input.phone,
      role: "pending_user",
    });
  } catch (error) {
    await firebaseAdminAuth.deleteUser(authUser.uid).catch(() => undefined);
    throw error;
  }

  return {
    firebaseUid: authUser.uid,
    email: input.email,
    name: input.name,
    phone: input.phone,
    roleTitle: input.roleTitle,
    requestedAt: new Date().toISOString(),
    assignmentStatus: "pending_submission_approval",
  };
}

export async function rollbackSubmissionManagerAccount(firebaseUid: string) {
  const firebaseAdminAuth = getFirebaseAdminAuth();
  const firestore = getFirebaseAdminFirestore();

  await Promise.all([
    firebaseAdminAuth?.deleteUser(firebaseUid).catch(() => undefined),
    firestore
      ?.collection(firestoreCollectionNames.users)
      .doc(firebaseUid)
      .delete()
      .catch(() => undefined),
  ]);
}
