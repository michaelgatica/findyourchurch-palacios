import type { DecodedIdToken } from "firebase-admin/auth";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import { getUserByFirebaseUid } from "@/lib/repositories/firebase-user-repository";
import type { AuthenticatedAppUser } from "@/lib/types/directory";

export async function verifyFirebaseIdToken(idToken: string) {
  const auth = getFirebaseAdminAuth();

  if (!auth) {
    return null;
  }

  try {
    return await auth.verifyIdToken(idToken);
  } catch {
    return null;
  }
}

export function extractBearerToken(authorizationHeader?: string | null) {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.split(" ");

  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export async function getServerAuthenticatedUser(
  idToken?: string | null,
): Promise<AuthenticatedAppUser | null> {
  if (!idToken) {
    return null;
  }

  const decodedToken = await verifyFirebaseIdToken(idToken);

  if (!decodedToken) {
    return null;
  }

  const userProfile = await getUserByFirebaseUid(decodedToken.uid);

  return {
    firebaseUid: decodedToken.uid,
    email: decodedToken.email,
    emailVerified: decodedToken.email_verified,
    profile: userProfile,
  };
}

export async function getServerAuthenticatedUserFromRequest(request: Request) {
  const bearerToken = extractBearerToken(request.headers.get("authorization"));
  const cookieToken =
    request.headers
      .get("cookie")
      ?.split(";")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith("firebaseIdToken="))
      ?.split("=")[1] ?? null;

  return getServerAuthenticatedUser(bearerToken ?? cookieToken);
}

export function getDecodedTokenRole(decodedToken: DecodedIdToken | null) {
  const roleClaim = decodedToken?.role;
  return typeof roleClaim === "string" ? roleClaim : null;
}
