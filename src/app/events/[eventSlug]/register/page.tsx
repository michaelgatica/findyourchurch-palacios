import { randomUUID } from "crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { PublicRegistrationForm } from "@/components/registration/public-registration-form";
import { createPageMetadata } from "@/lib/config/site";
import { buildEventPath } from "@/lib/event-utils";
import { formatDateTime } from "@/lib/formatting";
import { createRegistrationChallenge } from "@/lib/registration-utils";
import { getPublicRegistrationExperience } from "@/lib/services/public-registration-service";

export const dynamic = "force-dynamic";

export async function generateMetadata(props: { params: Promise<{ eventSlug: string }> }): Promise<Metadata> {
  const { eventSlug } = await props.params;
  return createPageMetadata({
    title: "Event Registration",
    description: "Register for a church or community ministry event.",
    pathname: `/events/${eventSlug}/register`,
    noIndex: true,
  });
}

const statusMessages = {
  not_yet_open: "Registration has not opened yet.",
  open: "Registration is open.",
  almost_full: "Registration is open, but only limited space remains.",
  full: "This event is full.",
  waitlist_available: "The event is full. New registrations will be added to the waitlist.",
  waitlist_full: "The event and waitlist are full.",
  closed: "Registration is closed.",
  event_cancelled: "This event has been cancelled.",
  event_completed: "This event has already ended.",
} as const;

export default async function PublicEventRegistrationPage(props: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await props.params;
  const experience = await getPublicRegistrationExperience(eventSlug);
  if (!experience) notFound();

  const canSubmit = experience.formVersion &&
    (experience.status === "open" || experience.status === "almost_full" || experience.status === "waitlist_available");

  return (
    <div className="shell page-section registration-public-page">
      <div className="registration-public-hero">
        <div>
          <p className="eyebrow eyebrow--gold">Event registration</p>
          <h1>{experience.event.title}</h1>
          <p className="supporting-text">Hosted by {experience.event.churchName}</p>
        </div>
        <dl className="registration-event-summary">
          <div><dt>Date and time</dt><dd>{formatDateTime(experience.event.startsAt)}</dd></div>
          <div><dt>Location</dt><dd>{experience.event.locationMode === "online" ? "Online" : experience.event.venueName ?? experience.event.address?.city ?? "See event details"}</dd></div>
          {experience.configuration?.showCapacityStatus && experience.remainingCapacity !== null ? <div><dt>Space remaining</dt><dd>{experience.remainingCapacity}</dd></div> : null}
        </dl>
      </div>

      <div className={`registration-status-banner registration-status-banner--${experience.status}`} role="status">
        {statusMessages[experience.status]}
      </div>

      {canSubmit ? (
        <PublicRegistrationForm
          eventSlug={eventSlug}
          sections={experience.formVersion.sections}
          challenge={createRegistrationChallenge()}
          idempotencyKey={randomUUID()}
          consentText={experience.configuration?.consentText}
        />
      ) : (
        <div className="panel registration-closed-card">
          <p>{experience.configuration?.closedMessage ?? statusMessages[experience.status]}</p>
          <Link href={buildEventPath(experience.event)} className="button button--ghost">Return to event details</Link>
        </div>
      )}
    </div>
  );
}
