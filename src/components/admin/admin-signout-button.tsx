"use client";

import { useTransition } from "react";

import { signOutFirebaseUser } from "@/lib/firebase/auth-client";
import { clearFirebaseServerSession } from "@/lib/firebase/session-client";

interface AdminSignOutButtonProps {
  className?: string;
  redirectTo?: string;
}

export function AdminSignOutButton({
  className,
  redirectTo = "/admin/login",
}: AdminSignOutButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      await signOutFirebaseUser();
      await clearFirebaseServerSession();
      window.location.assign(redirectTo);
    });
  }

  return (
    <button
      type="button"
      className={className ?? "button button--ghost"}
      onClick={handleSignOut}
      disabled={isPending}
    >
      {isPending ? "Signing out..." : "Sign out"}
    </button>
  );
}
