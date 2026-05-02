import { config as loadEnv } from "dotenv";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { upsertUserProfile } from "@/lib/repositories/firebase-user-repository";

loadEnv({
  path: ".env.local",
});

function requiredEnv(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

async function run() {
  const auth = getFirebaseAdminAuth();

  if (!auth) {
    throw new Error("Firebase Admin Auth is not configured.");
  }

  const email = requiredEnv("FIREBASE_ADMIN_SEED_EMAIL");
  const password = requiredEnv("FIREBASE_ADMIN_SEED_PASSWORD");
  const name = process.env.FIREBASE_ADMIN_SEED_NAME?.trim() || "Find Your Church Admin";
  const phone = process.env.FIREBASE_ADMIN_SEED_PHONE?.trim();

  let userRecord;

  try {
    userRecord = await auth.getUserByEmail(email);
  } catch {
    userRecord = await auth.createUser({
      email,
      password,
      displayName: name,
      phoneNumber: phone,
      emailVerified: true,
    });
  }

  const profile = await upsertUserProfile({
    firebaseUid: userRecord.uid,
    name,
    email,
    phone,
    role: "admin",
  });

  // TODO: Consider adding custom claims once the admin portal is in place and
  // the login/session flow is finalized.
  console.log(`Admin user ready: ${profile.email} (${profile.id})`);
}

run().catch((error) => {
  console.error("Failed to seed the admin user.", error);
  process.exitCode = 1;
});
