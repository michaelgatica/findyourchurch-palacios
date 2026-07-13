"use client";

import { useActionState } from "react";

import { RegistrationFieldsEditor } from "@/components/registration/registration-fields-editor";
import {
  submitPublicRegistrationAction,
  type PublicRegistrationActionState,
} from "@/lib/actions/registrations";
import type { RegistrationFormSection } from "@/lib/types/registrations";

const initialState: PublicRegistrationActionState = { status: "idle" };

export function PublicRegistrationForm(props: {
  eventSlug: string;
  sections: RegistrationFormSection[];
  challenge: string;
  idempotencyKey: string;
  consentText?: string | null;
}) {
  const [state, action, pending] = useActionState(submitPublicRegistrationAction, initialState);

  return (
    <form action={action} className="registration-public-form">
      <input type="hidden" name="eventSlug" value={props.eventSlug} />
      <input type="hidden" name="challenge" value={props.challenge} />
      <input type="hidden" name="idempotencyKey" value={props.idempotencyKey} />
      <label className="registration-honeypot" aria-hidden="true">
        Website
        <input name="website" tabIndex={-1} autoComplete="off" />
      </label>

      {state.status === "error" ? <div className="form-alert" role="alert">{state.message}</div> : null}
      <RegistrationFieldsEditor sections={props.sections} />

      <div className="registration-privacy-note">
        <strong>Your information is private.</strong>
        <p>
          Your answers are shared only with authorized representatives of the host church and platform administrators who support this registration system. They are not shown publicly.
        </p>
        {props.consentText ? <p>{props.consentText}</p> : null}
      </div>

      <button type="submit" className="button button--primary" disabled={pending}>
        {pending ? "Submitting registration..." : "Submit registration"}
      </button>
    </form>
  );
}
