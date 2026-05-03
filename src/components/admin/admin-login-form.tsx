"use client";

import { useState, useTransition } from "react";

import { signInWithFirebaseEmail } from "@/lib/firebase/auth-client";
import { establishFirebaseServerSession } from "@/lib/firebase/session-client";

interface AdminLoginFormProps {
  redirectPath: string;
}

export function AdminLoginForm({ redirectPath }: AdminLoginFormProps) {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    setErrorMessage(null);

    startTransition(async () => {
      try {
        const userCredential = await signInWithFirebaseEmail(email, password);
        const idToken = await userCredential.user.getIdToken(true);

        await establishFirebaseServerSession({ idToken });
        window.location.assign(redirectPath);
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "We could not sign you in right now. Please try again.";

        setErrorMessage(errorMessage);
      }
    });
  }

  return (
    <form className="submission-form" onSubmit={handleSubmit}>
      <div className="panel">
        <label className="field">
          <span className="field__label">
            Email address <span className="field__required">Required</span>
          </span>
          <input name="email" type="email" autoComplete="email" required />
        </label>

        <label className="field">
          <span className="field__label">
            Password <span className="field__required">Required</span>
          </span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>

        {errorMessage ? <div className="form-alert">{errorMessage}</div> : null}

        <div className="submission-form__actions">
          <button type="submit" className="button button--primary" disabled={isPending}>
            {isPending ? "Signing in..." : "Sign in to admin"}
          </button>
        </div>
      </div>
    </form>
  );
}
