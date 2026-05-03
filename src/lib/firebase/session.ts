import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { getUserByFirebaseUid, upsertUserProfile } from "@/lib/repositories/firebase-user-repository";
import type { AuthenticatedAppUser } from "@/lib/types/directory";

export const firebaseSessionCookieName = "fyc_session";

const sessionDurationMs = 1000 * 60 * 60 * 24 * 5;

export async function createFirebaseSessionCookie(idToken: string) {
  const auth = getFirebaseAdminAuth();

  if (!auth) {
    throw new Error("Firebase Authentication is not configured.");
  }

  return auth.createSessionCookie(idToken, {
    expiresIn: sessionDurationMs,
  });
}

export async function setFirebaseSessionCookie(sessionCookie: string) {
  const cookieStore = await cookies();

  cookieStore.set(firebaseSessionCookieName, sessionCookie, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionDurationMs / 1000,
  });
}

export async function clearFirebaseSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(firebaseSessionCookieName);
}

export async function getFirebaseSessionCookieValue() {
  const cookieStore = await cookies();
  return cookieStore.get(firebaseSessionCookieName)?.value ?? null;
}

export async function getServerAuthenticatedUserFromSessionCookie(): Promise<AuthenticatedAppUser | null> {
  const auth = getFirebaseAdminAuth();
  const sessionCookie = await getFirebaseSessionCookieValue();

  if (!auth || !sessionCookie) {
    return null;
  }

  try {
    const decodedToken = await auth.verifySessionCookie(sessionCookie, true);
    const userProfile = await getUserByFirebaseUid(decodedToken.uid);

    return {
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      emailVerified: decodedToken.email_verified,
      profile: userProfile,
    };
  } catch {
    return null;
  }
}

export async function syncUserProfileFromIdToken(input: {
  firebaseUid: string;
  email?: string;
  name?: string;
  phone?: string;
}) {
  const existingProfile = await getUserByFirebaseUid(input.firebaseUid);

  return upsertUserProfile({
    firebaseUid: input.firebaseUid,
    email: input.email ?? existingProfile?.email ?? "",
    name: input.name ?? existingProfile?.name ?? input.email?.split("@")[0] ?? "Find Your Church User",
    phone: input.phone ?? existingProfile?.phone,
    role: existingProfile?.role,
  });
}

export async function requireAuthenticatedUser(redirectPath: string) {
  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();

  if (!authenticatedUser) {
    redirect(`/admin/login?next=${encodeURIComponent(redirectPath)}`);
  }

  return authenticatedUser;
}

export async function requireAdminUser(redirectPath: string) {
  const authenticatedUser = await requireAuthenticatedUser(redirectPath);

  if (authenticatedUser.profile?.role !== "admin") {
    return null;
  }

  return authenticatedUser;
}
