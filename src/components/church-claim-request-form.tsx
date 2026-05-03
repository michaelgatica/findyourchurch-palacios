"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";

import { submitChurchClaimRequestAction } from "@/lib/actions/church-claim-request";
import { createClaimRequestFormState } from "@/lib/claim-request-form-state";
import {
  createFirebaseUserAccount,
  signInWithFirebaseEmail,
  signOutFirebaseUser,
} from "@/lib/firebase/auth-client";
import {
  clearFirebaseServerSession,
  establishFirebaseServerSession,
} from "@/lib/firebase/session-client";
import type { AuthenticatedAppUser } from "@/lib/types/directory";

interface ClaimFormSessionUser {
  name: string;
  email: string;
  phone?: string;
  emailVerified?: boolean;
}

interface ChurchClaimRequestFormProps {
  churchId: string;
  churchName: string;
  churchSlug: string;
  initialAuthenticatedUser: AuthenticatedAppUser | null;
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null;
  }

  return <p className="field__error">{message}</p>;
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="field__label">
      {children} <span className="field__required">Required</span>
    </span>
  );
}

function SubmitClaimButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="button button--primary" disabled={pending}>
      {pending ? "Submitting request..." : "Submit claim request"}
    </button>
  );
}

function AuthenticatedClaimForm(props: {
  churchId: string;
  churchName: string;
  churchSlug: string;
  sessionUser: ClaimFormSessionUser;
}) {
  const initialState = useMemo(
    () =>
      createClaimRequestFormState({
        churchId: props.churchId,
        churchName: props.churchName,
        churchSlug: props.churchSlug,
        requesterName: props.sessionUser.name,
        requesterEmail: props.sessionUser.email,
        requesterPhone: props.sessionUser.phone ?? "",
      }),
    [
      props.churchId,
      props.churchName,
      props.churchSlug,
      props.sessionUser.email,
      props.sessionUser.name,
      props.sessionUser.phone,
    ],
  );
  const [state, formAction] = useActionState(submitChurchClaimRequestAction, initialState);
  const formState = state ?? initialState;

  return (
    <form
      key={props.sessionUser.email}
      action={formAction}
      className="submission-form"
    >
      <input type="hidden" name="churchId" value={formState.values.churchId} />
      <input type="hidden" name="churchSlug" value={formState.values.churchSlug} />
      <input type="hidden" name="churchName" value={formState.values.churchName} />

      <div className="panel">
        <p className="eyebrow eyebrow--gold">Authorized Representative</p>
        <h2>Tell us about your relationship to {props.churchName}</h2>
        <p className="supporting-text">
          Your request will be saved as pending review and checked by the Find Your Church
          ministry team before access is approved.
        </p>
        <p className="supporting-text">Fields marked Required help us review your request more quickly.</p>
        {props.sessionUser.emailVerified === false ? (
          <p className="supporting-text">
            Your Firebase account email is not verified yet. You can still submit the request now,
            but email verification should be completed for future representative access.
          </p>
        ) : null}
        {formState.formError ? <div className="form-alert">{formState.formError}</div> : null}
      </div>

      <div className="panel">
        <div className="form-grid">
          <label className="field">
            <RequiredLabel>Name</RequiredLabel>
            <input
              name="requesterName"
              defaultValue={formState.values.requesterName}
              required
            />
            <FieldError message={formState.errors.requesterName} />
          </label>

          <label className="field">
            <RequiredLabel>Email</RequiredLabel>
            <input
              name="requesterEmail"
              type="email"
              defaultValue={formState.values.requesterEmail}
              readOnly
              required
            />
            <span className="field__hint">
              This should match the email address used for the signed-in account.
            </span>
            <FieldError message={formState.errors.requesterEmail} />
          </label>

          <label className="field">
            <span className="field__label">Phone</span>
            <input
              name="requesterPhone"
              defaultValue={formState.values.requesterPhone}
              placeholder="Optional"
            />
            <FieldError message={formState.errors.requesterPhone} />
          </label>

          <label className="field">
            <RequiredLabel>Role / title</RequiredLabel>
            <input
              name="requesterRoleTitle"
              defaultValue={formState.values.requesterRoleTitle}
              placeholder="Pastor, church secretary, elder, staff member"
              required
            />
            <FieldError message={formState.errors.requesterRoleTitle} />
          </label>

          <label className="field field--full">
            <RequiredLabel>Relationship to church</RequiredLabel>
            <textarea
              name="relationshipToChurch"
              defaultValue={formState.values.relationshipToChurch}
              placeholder="Please explain how you are connected to this church."
              required
            />
            <FieldError message={formState.errors.relationshipToChurch} />
          </label>

          <label className="field field--full">
            <RequiredLabel>Proof or explanation</RequiredLabel>
            <textarea
              name="proofOrExplanation"
              defaultValue={formState.values.proofOrExplanation}
              placeholder="Share any details that will help us confirm you are authorized to manage this listing."
              required
            />
            <FieldError message={formState.errors.proofOrExplanation} />
          </label>
        </div>

        <div className="submission-form__actions">
          <SubmitClaimButton />
        </div>
      </div>
    </form>
  );
}

export function ChurchClaimRequestForm({
  churchId,
  churchName,
  churchSlug,
  initialAuthenticatedUser,
}: ChurchClaimRequestFormProps) {
  const [authMode, setAuthMode] = useState<"signin" | "create">("signin");
  const [sessionUser, setSessionUser] = useState<ClaimFormSessionUser | null>(
    initialAuthenticatedUser
      ? {
          name:
            initialAuthenticatedUser.profile?.name ??
            initialAuthenticatedUser.email?.split("@")[0] ??
            "Find Your Church User",
          email: initialAuthenticatedUser.email ?? initialAuthenticatedUser.profile?.email ?? "",
          phone: initialAuthenticatedUser.profile?.phone,
          emailVerified: initialAuthenticatedUser.emailVerified,
        }
      : null,
  );
  const [isSessionCleared, setIsSessionCleared] = useState(false);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const activeSessionUser =
    isSessionCleared
      ? null
      : sessionUser ??
        (initialAuthenticatedUser
          ? {
              name:
                initialAuthenticatedUser.profile?.name ??
                initialAuthenticatedUser.email?.split("@")[0] ??
                "Find Your Church User",
              email:
                initialAuthenticatedUser.email ??
                initialAuthenticatedUser.profile?.email ??
                "",
              phone: initialAuthenticatedUser.profile?.phone,
              emailVerified: initialAuthenticatedUser.emailVerified,
            }
          : null);

  function handleAuthSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = String(formData.get("authName") ?? "").trim();
    const email = String(formData.get("authEmail") ?? "").trim();
    const password = String(formData.get("authPassword") ?? "");
    const phone = String(formData.get("authPhone") ?? "").trim();

    setAuthErrorMessage(null);

    startTransition(async () => {
      try {
        const userCredential =
          authMode === "create"
            ? await createFirebaseUserAccount(email, password)
            : await signInWithFirebaseEmail(email, password);
        const idToken = await userCredential.user.getIdToken(true);

        await establishFirebaseServerSession({
          idToken,
          profileName: authMode === "create" ? name : undefined,
          profilePhone: authMode === "create" ? phone : undefined,
        });

        setIsSessionCleared(false);
        setSessionUser({
          name: authMode === "create" ? name : userCredential.user.displayName ?? email.split("@")[0],
          email,
          phone: authMode === "create" ? phone || undefined : undefined,
          emailVerified: userCredential.user.emailVerified,
        });
      } catch (error) {
        setAuthErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not complete account access right now. Please try again.",
        );
      }
    });
  }

  function handleUseDifferentAccount() {
    startTransition(async () => {
      await signOutFirebaseUser();
      await clearFirebaseServerSession();
      setSessionUser(null);
      setIsSessionCleared(true);
    });
  }

  if (activeSessionUser) {
    return (
      <div className="section-stack">
        <div className="panel claim-authenticated">
          <div>
            <p className="eyebrow">Signed In</p>
            <h2>Continue your request</h2>
            <p className="supporting-text">
              Signed in as {activeSessionUser.email}. If this is not the right account, you can
              switch before submitting the request.
            </p>
          </div>

          <button
            type="button"
            className="button button--ghost"
            onClick={handleUseDifferentAccount}
            disabled={isPending}
          >
            {isPending ? "Switching..." : "Use a different account"}
          </button>
        </div>

        <AuthenticatedClaimForm
          churchId={churchId}
          churchName={churchName}
          churchSlug={churchSlug}
          sessionUser={activeSessionUser}
        />
      </div>
    );
  }

  return (
    <div className="section-stack">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Sign In Required</p>
        <h2>Sign in to request listing access</h2>
        <p className="supporting-text">
          If you already have an account, sign in below. If not, create a simple account so we can
          connect your request to a verified account and the right church listing.
        </p>

        <div className="button-row claim-auth-switches">
          <button
            type="button"
            className={authMode === "signin" ? "button button--secondary" : "button button--ghost"}
            onClick={() => setAuthMode("signin")}
          >
            I already have an account
          </button>
          <button
            type="button"
            className={authMode === "create" ? "button button--secondary" : "button button--ghost"}
            onClick={() => setAuthMode("create")}
          >
            Create an account
          </button>
        </div>
      </div>

      <form className="submission-form" onSubmit={handleAuthSubmit}>
        <div className="panel">
          <div className="form-grid">
            {authMode === "create" ? (
              <>
                <label className="field">
                  <RequiredLabel>Name</RequiredLabel>
                  <input name="authName" required />
                </label>

                <label className="field">
                  <span className="field__label">Phone</span>
                  <input name="authPhone" placeholder="Optional" />
                </label>
              </>
            ) : null}

            <label className="field">
              <RequiredLabel>Email address</RequiredLabel>
              <input name="authEmail" type="email" autoComplete="email" required />
            </label>

            <label className="field">
              <RequiredLabel>Password</RequiredLabel>
              <input
                name="authPassword"
                type="password"
                autoComplete={authMode === "create" ? "new-password" : "current-password"}
                required
              />
              <span className="field__hint">
                {authMode === "create"
                  ? "Firebase email/password accounts require at least 6 characters."
                  : "Use the password for your Find Your Church account."}
              </span>
            </label>
          </div>

          {authErrorMessage ? <div className="form-alert">{authErrorMessage}</div> : null}

          <div className="submission-form__actions">
            <button type="submit" className="button button--primary" disabled={isPending}>
              {isPending
                ? authMode === "create"
                  ? "Creating account..."
                  : "Signing in..."
                : authMode === "create"
                  ? "Create account and continue"
                  : "Sign in and continue"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
