"use client";

import { signOutFirebaseUser } from "@/lib/firebase/auth-client";

export const firebaseSessionChangedEvent = "fyc:auth-changed";

function notifyFirebaseSessionChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(firebaseSessionChangedEvent));
  }
}

export async function establishFirebaseServerSession(input: {
  idToken: string;
  profileName?: string;
  profilePhone?: string;
}) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    const responseBody = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(responseBody?.error ?? "Unable to establish a Firebase session.");
  }

  notifyFirebaseSessionChanged();
}

export async function clearFirebaseServerSession() {
  const response = await fetch("/api/auth/signout", {
    method: "DELETE",
    credentials: "same-origin",
    cache: "no-store",
  });

  if (!response.ok) {
    const responseBody = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;

    throw new Error(responseBody?.error ?? "Unable to clear the current session.");
  }
}

export async function signOutApplicationSession() {
  const [firebaseResult, serverResult] = await Promise.allSettled([
    signOutFirebaseUser(),
    clearFirebaseServerSession(),
  ]);

  if (serverResult.status === "rejected") {
    throw serverResult.reason;
  }

  if (firebaseResult.status === "rejected") {
    console.warn("Firebase client sign-out did not complete cleanly.", firebaseResult.reason);
  }

  notifyFirebaseSessionChanged();
}
