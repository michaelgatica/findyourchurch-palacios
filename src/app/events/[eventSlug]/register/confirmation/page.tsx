import Link from "next/link";
import { notFound } from "next/navigation";

import { createPageMetadata } from "@/lib/config/site";
import { getPublicRegistrationConfirmation } from "@/lib/services/public-registration-service";

export const metadata = createPageMetadata({
  title: "Registration Received",
  description: "Your event registration has been received.",
  pathname: "/events/registration/confirmation",
  noIndex: true,
});

export default async function RegistrationConfirmationPage(props: {
  params: Promise<{ eventSlug: string }>;
  searchParams: Promise<{ confirmation?: string; manage?: string }>;
}) {
  const [{ eventSlug }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  if (!searchParams.confirmation) {
    notFound();
  }

  const confirmation = await getPublicRegistrationConfirmation({
    eventSlug,
    confirmationNumber: searchParams.confirmation,
    accessToken: searchParams.manage,
  });
  if (!confirmation) {
    notFound();
  }

  const waitlisted = confirmation.status === "waitlisted";

  return (
    <div className="shell page-section">
      <div className="confirmation-card registration-confirmation-card">
        <p className="eyebrow eyebrow--gold">
          {waitlisted ? "Waitlist saved" : "Registration confirmed"}
        </p>
        <h1>{waitlisted ? "You are on the waitlist" : "Your registration is complete"}</h1>
        <p>{confirmation.message}</p>
        <div className="registration-confirmation-number">
          <span>Confirmation number</span>
          <strong>{confirmation.confirmationNumber}</strong>
        </div>
        <p className="supporting-text">Number attending: {confirmation.attendeeCount}</p>
        <p className="supporting-text">
          If you provided an email address, a confirmation has been sent without including your
          private form answers.
        </p>
        <div className="button-row">
          {searchParams.manage && confirmation.managementTokenIsValid ? (
            <Link
              href={`/registrations/manage/${encodeURIComponent(searchParams.manage)}`}
              className="button button--primary"
            >
              Manage registration
            </Link>
          ) : null}
          <Link href={`/events/${eventSlug}`} className="button button--ghost">
            Return to event
          </Link>
        </div>
      </div>
    </div>
  );
}
