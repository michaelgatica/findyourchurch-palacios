"use server";

import { redirect } from "next/navigation";

import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import { upsertUserProfile } from "@/lib/repositories/firebase-user-repository";

function buildRedirectWithMessage(pathname: string, key: "success" | "error", value: string) {
  const separator = pathname.includes("?") ? "&" : "?";
  return `${pathname}${separator}${key}=${encodeURIComponent(value)}`;
}

export async function updateProfileAction(formData: FormData) {
  const authenticatedUser = await getServerAuthenticatedUserFromSessionCookie();

  if (!authenticatedUser) {
    redirect("/portal/login?next=/account");
  }

  const name = String(formData.get("name") ?? "").trim();
  const phone = String(formData.get("phone") ?? "").trim();
  const email = authenticatedUser.profile?.email ?? authenticatedUser.email ?? "";

  if (!name) {
    redirect(buildRedirectWithMessage("/account", "error", "name-required"));
  }

  await upsertUserProfile({
    firebaseUid: authenticatedUser.firebaseUid,
    name,
    email,
    phone: phone || undefined,
    role: authenticatedUser.profile?.role,
  });

  redirect(buildRedirectWithMessage("/account", "success", "profile-updated"));
}
