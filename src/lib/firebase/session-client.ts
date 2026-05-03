"use client";

export async function establishFirebaseServerSession(input: {
  idToken: string;
  profileName?: string;
  profilePhone?: string;
}) {
  const response = await fetch("/api/auth/session", {
    method: "POST",
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
}

export async function clearFirebaseServerSession() {
  await fetch("/api/auth/signout", {
    method: "DELETE",
  });
}
