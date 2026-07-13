import Image from "next/image";
import Link from "next/link";

import {
  buildEventPath,
  formatEventDateRange,
  getEventRegistrationStatusLabel,
} from "@/lib/event-utils";
import { buildChurchProfilePath } from "@/lib/config/site";
import type { EventRecord } from "@/lib/types/events";

function formatCostStatus(value: EventRecord["costStatus"]) {
  switch (value) {
    case "donation_requested":
      return "Donation requested";
    case "fee_required":
      return "Fee required";
    default:
      return "Free";
  }
}

function formatLocationMode(value: EventRecord["locationMode"]) {
  switch (value) {
    case "online":
      return "Online";
    case "hybrid":
      return "Hybrid";
    default:
      return "In person";
  }
}

export function EventCard({ event, compact = false }: { event: EventRecord; compact?: boolean }) {
  return (
    <article className={`event-card${compact ? " event-card--compact" : ""}`}>
      <div className="event-card__media" aria-hidden={!event.flyerImage}>
        {event.flyerImage ? (
          <Image
            src={event.flyerImage.src}
            alt={event.flyerImage.alt}
            width={720}
            height={480}
            className="event-card__image"
          />
        ) : (
          <div className="event-card__fallback">
            <span>{event.primaryType}</span>
          </div>
        )}
      </div>

      <div className="event-card__body">
        <div className="event-card__meta-row">
          <span className="church-card__badge">{event.primaryType}</span>
          <span className="tag">{getEventRegistrationStatusLabel(event)}</span>
        </div>

        <h3>
          <Link href={buildEventPath(event)}>{event.title}</Link>
        </h3>

        <p className="event-card__date">{formatEventDateRange(event)}</p>
        <p className="supporting-text">
          Hosted by{" "}
          <Link href={buildChurchProfilePath(event.churchSlug)} className="text-link">
            {event.churchName}
          </Link>
        </p>
        <p className="supporting-text">
          {event.venueName ?? event.address?.city ?? formatLocationMode(event.locationMode)}
        </p>
        {compact ? null : <p>{event.summary}</p>}

        <div className="tag-row">
          <span className="tag">{formatCostStatus(event.costStatus)}</span>
          <span className="tag">{formatLocationMode(event.locationMode)}</span>
          {event.audienceTags.slice(0, 2).map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>

        <div className="event-card__actions">
          <Link href={buildEventPath(event)} className="button button--secondary">
            View Event
          </Link>
        </div>
      </div>
    </article>
  );
}
