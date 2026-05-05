"use client";

import { useState, useTransition } from "react";

import { signOutApplicationSession } from "@/lib/firebase/session-client";

interface AdminSignOutButtonProps {
  className?: string;
  redirectTo?: string;
}

export function AdminSignOutButton({
  className,
  redirectTo = "/admin/login",
}: AdminSignOutButtonProps) {
  const [isPending, startTransition] = useTransition();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function handleSignOut() {
    startTransition(async () => {
      try {
        setErrorMessage(null);
        await signOutApplicationSession();
        window.location.assign(redirectTo);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not complete sign-out. Please try again.",
        );
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className={className ?? "button button--ghost"}
        onClick={handleSignOut}
        disabled={isPending}
      >
        {isPending ? "Signing out..." : "Sign out"}
      </button>
      {errorMessage ? (
        <p className="field__error" aria-live="polite">
          {errorMessage}
        </p>
      ) : null}
    </>
  );
}
