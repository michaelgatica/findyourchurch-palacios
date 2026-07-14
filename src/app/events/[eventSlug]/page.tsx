import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  buildAbsoluteUrl,
  buildChurchProfilePath,
  createPageMetadata,
  siteConfig,
} from "@/lib/config/site";
import { submitEventReportAction } from "@/lib/actions/event-reports";
import { formatAddress } from "@/lib/church-utils";
import {
  buildEventPath,
  buildEventStructuredData,
  buildGoogleCalendarUrl,
  formatEventDateRange,
  getEventRegistrationStatusLabel,
} from "@/lib/event-utils";
import { getPublicEventBySlug } from "@/lib/repositories/event-repository";
import { getExternalRegistrationDestination } from "@/lib/validation/external-registration-url";
import { eventReportReasons } from "@/lib/types/events";

export const dynamic = "force-dynamic";

interface EventPageProps {
  params: Promise<{
    eventSlug: string;
  }>;
}

function formatCostStatus(value: string) {
  switch (value) {
    case "donation_requested":
      return "Donation requested";
    case "fee_required":
      return "Fee required";
    default:
      return "Free";
  }
}

function formatLocationMode(value: string) {
  switch (value) {
    case "online":
      return "Online";
    case "hybrid":
      return "Hybrid";
    default:
      return "In person";
  }
}

export async function generateMetadata({ params }: EventPageProps): Promise<Metadata> {
  const { eventSlug } = await params;
  const event = await getPublicEventBySlug(eventSlug);

  if (!event) {
    notFound();
  }

  return createPageMetadata({
    title: `${event.title} | ${siteConfig.launchName}`,
    description: event.summary,
    pathname: buildEventPath(event),
    imagePath: event.flyerImage?.src,
    imageWidth: event.flyerImage?.width ?? undefined,
    imageHeight: event.flyerImage?.height ?? undefined,
    imageAlt: event.flyerImage?.alt,
    noIndex: event.status !== "published",
  });
}

export default async function EventPage({ params }: EventPageProps) {
  const { eventSlug } = await params;
  const event = await getPublicEventBySlug(eventSlug);

  if (!event) {
    notFound();
  }

  const churchPath = event.churchRoutePath ?? buildChurchProfilePath(event.churchSlug);
  const eventUrl = buildAbsoluteUrl(buildEventPath(event));

  return (
    <>
      {event.visibility === "public" ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(buildEventStructuredData(event)) }}
        />
      ) : null}

      <section className="shell page-section">
        <div className="event-detail-layout">
          <article className="panel event-detail">
            <p className="eyebrow eyebrow--gold">{event.primaryType}</p>
            <h1>{event.title}</h1>
            {event.status === "cancelled" ? (
              <div className="form-alert" role="status">
                <strong>This event has been cancelled.</strong>
                {event.cancellationMessage ? <p>{event.cancellationMessage}</p> : null}
              </div>
            ) : null}
            <p className="event-card__date">{formatEventDateRange(event)}</p>
            <p className="supporting-text">
              Hosted by{" "}
              <Link href={churchPath} className="text-link">
                {event.churchName}
              </Link>
            </p>

            <div className="event-detail__summary">
              <p>{event.description}</p>
            </div>

            <div className="info-grid">
              <div>
                <h2>Location</h2>
                <p>{formatLocationMode(event.locationMode)}</p>
                {event.venueName ? <p>{event.venueName}</p> : null}
                {event.address ? <p>{formatAddress(event.address)}</p> : null}
                {event.onlineUrl ? (
                  <Link href={event.onlineUrl} target="_blank" rel="noreferrer" className="text-link">
                    Online event link
                  </Link>
                ) : null}
              </div>

              <div>
                <h2>Registration</h2>
                <p>{getEventRegistrationStatusLabel(event)}</p>
                {event.status === "cancelled" ? (
                  <p className="supporting-text">Registration is closed because this event was cancelled.</p>
                ) : (event.registration.mode === "google_forms" || event.registration.mode === "external") &&
                event.registration.externalRegistrationUrl ? (
                  <>
                    <p className="supporting-text">
                      Registration is handled externally by the host church. You will leave Find
                      Your Church Palacios and continue to {getExternalRegistrationDestination(event.registration.externalRegistrationUrl)}.
                    </p>
                    <Link
                      href={event.registration.externalRegistrationUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="button button--secondary"
                    >
                      {event.registration.externalRegistrationLabel ?? "Open Registration"}
                    </Link>
                  </>
                ) : event.registration.mode === "none" ? (
                  <p className="supporting-text">No registration is required for this event.</p>
                ) : event.registration.setupEnabled ? (
                  <Link href={`${buildEventPath(event)}/register`} className="button button--secondary">
                    Register for this event
                  </Link>
                ) : (
                  <p className="supporting-text">
                    Registration is not currently open.
                  </p>
                )}
              </div>

              <div>
                <h2>Details</h2>
                <dl className="detail-list">
                  <div className="detail-row">
                    <dt>Cost</dt>
                    <dd>{formatCostStatus(event.costStatus)}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Languages</dt>
                    <dd>{event.languages.length > 0 ? event.languages.join(", ") : "Not listed"}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Childcare</dt>
                    <dd>{event.childcareProvided ? "Provided" : "Not listed"}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Meal</dt>
                    <dd>{event.mealProvided ? event.mealDetails ?? "Provided" : "Not listed"}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <h2>Contact</h2>
                <dl className="detail-list">
                  <div className="detail-row">
                    <dt>Name</dt>
                    <dd>{event.contactName ?? event.churchName}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Email</dt>
                    <dd>{event.contactEmail ?? "Use the church listing contact information"}</dd>
                  </div>
                  <div className="detail-row">
                    <dt>Phone</dt>
                    <dd>{event.contactPhone ?? "Not listed"}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </article>

          <aside className="event-detail-sidebar">
            <div className="panel">
              <h2>Share and save</h2>
              <div className="button-row">
                <Link href={buildGoogleCalendarUrl(event)} target="_blank" rel="noreferrer" className="button button--ghost">
                  Add to Google Calendar
                </Link>
                <Link href={`${buildEventPath(event)}/calendar.ics`} className="button button--ghost">
                  Download calendar file
                </Link>
                <Link href={`mailto:?subject=${encodeURIComponent(event.title)}&body=${encodeURIComponent(eventUrl)}`} className="button button--ghost">
                  Share by Email
                </Link>
              </div>
            </div>

            <div className="panel">
              <h2>Event tags</h2>
              <div className="tag-row">
                {event.audienceTags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
                {event.customTags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <form action={submitEventReportAction} className="panel event-report-form">
              <input type="hidden" name="eventSlug" value={event.slug} />
              <label className="registration-honeypot" aria-hidden="true">
                Website
                <input name="website" tabIndex={-1} autoComplete="off" />
              </label>
              <h2>Report event information</h2>
              <p className="supporting-text">
                Let the review team know if something appears inaccurate. Reports are reviewed
                privately and do not automatically remove an event.
              </p>
              <label className="field">
                <span className="field__label">Reason</span>
                <select name="reason" required>
                  {eventReportReasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span className="field__label">What should we review?</span>
                <textarea name="message" minLength={10} maxLength={1200} required />
              </label>
              <label className="field">
                <span className="field__label">Your name, optional</span>
                <input name="reporterName" maxLength={120} />
              </label>
              <label className="field">
                <span className="field__label">Your email, optional</span>
                <input name="reporterEmail" type="email" maxLength={160} />
              </label>
              <button className="button button--ghost">Submit report</button>
            </form>
          </aside>
        </div>
      </section>
    </>
  );
}
