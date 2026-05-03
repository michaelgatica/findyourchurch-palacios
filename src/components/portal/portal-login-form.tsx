"use client";

import { useState, useTransition } from "react";

import {
  createFirebaseUserAccount,
  signInWithFirebaseEmail,
} from "@/lib/firebase/auth-client";
import { establishFirebaseServerSession } from "@/lib/firebase/session-client";

interface PortalLoginFormProps {
  redirectPath: string;
}

export function PortalLoginForm({ redirectPath }: PortalLoginFormProps) {
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const phone = String(formData.get("phone") ?? "").trim();

    setErrorMessage(null);

    startTransition(async () => {
      try {
        const userCredential =
          mode === "create"
            ? await createFirebaseUserAccount(email, password)
            : await signInWithFirebaseEmail(email, password);
        const idToken = await userCredential.user.getIdToken(true);

        await establishFirebaseServerSession({
          idToken,
          profileName: mode === "create" ? name : undefined,
          profilePhone: mode === "create" ? phone || undefined : undefined,
        });
        window.location.assign(redirectPath);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not complete sign-in right now. Please try again.",
        );
      }
    });
  }

  return (
    <div className="section-stack">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Church Representative Portal</p>
        <h1>Sign in to manage your church listing</h1>
        <p className="supporting-text">
          Use the email address connected to your approved church representative access. Invited
          editors should sign in with the same email that received the invitation.
        </p>

        <div className="button-row">
          <button
            type="button"
            className={mode === "signin" ? "button button--secondary" : "button button--ghost"}
            onClick={() => setMode("signin")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={mode === "create" ? "button button--secondary" : "button button--ghost"}
            onClick={() => setMode("create")}
          >
            Create account
          </button>
        </div>
      </div>

      <form className="submission-form" onSubmit={handleSubmit}>
        <div className="panel">
          <div className="form-grid">
            {mode === "create" ? (
              <>
                <label className="field">
                  <span className="field__label">
                    Name <span className="field__required">Required</span>
                  </span>
                  <input name="name" required />
                </label>

                <label className="field">
                  <span className="field__label">Phone</span>
                  <input name="phone" placeholder="Optional" />
                </label>
              </>
            ) : null}

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
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                required
              />
            </label>
          </div>

          {errorMessage ? <div className="form-alert">{errorMessage}</div> : null}

          <div className="submission-form__actions">
            <button type="submit" className="button button--primary" disabled={isPending}>
              {isPending
                ? mode === "create"
                  ? "Creating account..."
                  : "Signing in..."
                : mode === "create"
                  ? "Create account and continue"
                  : "Sign in to portal"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
