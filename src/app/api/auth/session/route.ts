import { NextResponse } from "next/server";

import { getFirebaseAdminAuth } from "@/lib/firebase/admin";
import {
  createFirebaseSessionCookie,
  setFirebaseSessionCookie,
  syncUserProfileFromIdToken,
} from "@/lib/firebase/session";

export async function POST(request: Request) {
  const auth = getFirebaseAdminAuth();

  if (!auth) {
    return NextResponse.json(
      {
        error: "Firebase Authentication is not configured.",
      },
      { status: 500 },
    );
  }

  const requestBody = (await request.json().catch(() => null)) as
    | {
        idToken?: string;
        profileName?: string;
        profilePhone?: string;
      }
    | null;
  const idToken = requestBody?.idToken?.trim();

  if (!idToken) {
    return NextResponse.json(
      {
        error: "Missing Firebase ID token.",
      },
      { status: 400 },
    );
  }

  try {
    const decodedToken = await auth.verifyIdToken(idToken);
    const sessionCookie = await createFirebaseSessionCookie(idToken);

    await syncUserProfileFromIdToken({
      firebaseUid: decodedToken.uid,
      email: decodedToken.email,
      name: requestBody?.profileName ?? decodedToken.name,
      phone: requestBody?.profilePhone,
    });
    await setFirebaseSessionCookie(sessionCookie);

    return NextResponse.json({
      success: true,
      uid: decodedToken.uid,
    });
  } catch {
    return NextResponse.json(
      {
        error: "Unable to establish a Firebase session.",
      },
      { status: 401 },
    );
  }
}
