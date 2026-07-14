import Link from "next/link";

import { eventQuickAction } from "@/lib/actions/portal-events";
import { primaryEventTypeOptions } from "@/lib/data/event-taxonomy";
import { formatDateTime } from "@/lib/formatting";
import { buildEventPath } from "@/lib/event-utils";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";
import { listManageableEventsForChurch } from "@/lib/services/event-management-service";
import { eventStatuses, type EventRecord, type EventStatus } from "@/lib/types/events";

interface PortalEventsPageProps {
  searchParams: Promise<{
    status?: string;
    eventType?: string;
    keyword?: string;
    success?: string;
    error?: string;
  }>;
}

function getSuccessMessage(value?: string) {
  switch (value) {
    case "event-saved":
      return "Event saved.";
    case "event-published":
      return "Event published.";
    case "event-duplicated":
      return "Event duplicated into a new draft.";
    case "draft-deleted":
      return "Draft event deleted.";
    default:
      return value ? "Event action completed." : null;
  }
}

function statusCanPublish(status: EventStatus) {
  return status === "draft" || status === "pending_review" || status === "unlisted";
}

function filterEvents(events: EventRecord[], input: { keyword?: string; eventType?: string }) {
  const keyword = input.keyword?.trim().toLowerCase() ?? "";

  return events.filter((event) => {
    if (input.eventType && event.primaryType !== input.eventType) {
      return false;
    }

    if (!keyword) {
      return true;
    }

    return [
      event.title,
      event.summary,
      event.description,
      event.primaryType,
      event.hostMinistry,
      event.venueName,
      event.address?.city,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(keyword);
  });
}

export default async function PortalEventsPage({ searchParams }: PortalEventsPageProps) {
  const context = await getRepresentativePortalContext();
  const resolvedSearchParams = await searchParams;

  if (!context?.church || !context.representative) {
    return null;
  }

  const church = context.church;
  const requestedStatus = eventStatuses.includes(resolvedSearchParams.status as EventStatus)
    ? (resolvedSearchParams.status as EventStatus)
    : "all";
  const events = await listManageableEventsForChurch({
    churchId: church.id,
    actorUserId: context.profile.id,
    status: requestedStatus,
    limit: 50,
  });
  const filteredEvents = filterEvents(events, {
    keyword: resolvedSearchParams.keyword,
    eventType: resolvedSearchParams.eventType,
  });
  const successMessage = getSuccessMessage(resolvedSearchParams.success);
  const statusCounts = eventStatuses.reduce(
    (counts, status) => ({
      ...counts,
      [status]: events.filter((event) => event.status === status).length,
    }),
    {} as Record<EventStatus, number>,
  );

  return (
    <div className="admin-content">
      {successMessage ? (
        <div className="form-alert form-alert--success" role="status">
          {successMessage}
        </div>
      ) : null}
      {resolvedSearchParams.error ? (
        <div className="form-alert" role="alert">
          {resolvedSearchParams.error}
        </div>
      ) : null}

      <div className="panel">
        <p className="eyebrow eyebrow--gold">Events</p>
        <h1>Events for {church.name}</h1>
        <p className="supporting-text">
          Create and manage events that belong to your church. Published public events appear on
          the Community Calendar, this church profile, and the homepage when they are upcoming.
        </p>
        <div className="button-row">
          <Link href="/portal/events/new" className="button button--primary">
            Create Event
          </Link>
          <Link href="/events" className="button button--ghost">
            View Community Calendar
          </Link>
        </div>
      </div>

      <div className="admin-summary-grid">
        {eventStatuses.map((status) => (
          <div key={status} className="panel admin-stat-card">
            <p className="eyebrow">{status.replace(/_/g, " ")}</p>
            <strong>{statusCounts[status]}</strong>
            <span>Events</span>
          </div>
        ))}
      </div>

      <form className="panel event-dashboard-filters">
        <div className="form-grid">
          <label className="field">
            <span className="field__label">Search events</span>
            <input name="keyword" defaultValue={resolvedSearchParams.keyword ?? ""} placeholder="Search by title, ministry, city, or keyword" />
          </label>
          <label className="field">
            <span className="field__label">Status</span>
            <select name="status" defaultValue={requestedStatus}>
              <option value="all">All statuses</option>
              {eventStatuses.map((status) => (
                <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Event type</span>
            <select name="eventType" defaultValue={resolvedSearchParams.eventType ?? ""}>
              <option value="">All event types</option>
              {primaryEventTypeOptions.map((option) => (
                <option key={option.slug} value={option.label}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="button-row">
          <button className="button button--primary" type="submit">Apply filters</button>
          <Link href="/portal/events" className="button button--ghost">Clear filters</Link>
        </div>
      </form>

      <div className="panel">
        <div className="admin-panel__header">
          <div>
            <p className="eyebrow">Event list</p>
            <h2>{filteredEvents.length} event{filteredEvents.length === 1 ? "" : "s"}</h2>
          </div>
          <p className="supporting-text">
            Registration count is reserved for the next registration phase and is not fabricated.
          </p>
        </div>

        {filteredEvents.length === 0 ? (
          <p className="supporting-text">No events match the current filters.</p>
        ) : (
          <div className="event-admin-list">
            {filteredEvents.map((event) => (
              <article key={event.id} className="event-admin-row">
                <div>
                  <div className="event-admin-row__title">
                    <span className={`status-badge status-badge--${event.status.replace(/_/g, "-")}`}>
                      {event.status.replace(/_/g, " ")}
                    </span>
                    <h3>{event.title}</h3>
                  </div>
                  <p>{event.summary}</p>
                  <dl className="event-admin-row__meta">
                    <div><dt>Date</dt><dd>{formatDateTime(event.startsAt)}</dd></div>
                    <div><dt>Type</dt><dd>{event.primaryType}</dd></div>
                    <div><dt>Registration</dt><dd>{event.registration.mode.replace(/_/g, " ")}</dd></div>
                    <div><dt>Count</dt><dd>Not active yet</dd></div>
                    <div><dt>Modified</dt><dd>{formatDateTime(event.updatedAt)}</dd></div>
                    <div><dt>Modified by</dt><dd>{event.lastEditedByName ?? "Not listed"}</dd></div>
                  </dl>
                </div>
                <div className="event-admin-row__actions">
                  <Link href={buildEventPath(event)} className="button button--ghost" target="_blank">
                    View
                  </Link>
                  <Link href={`/portal/events/${event.id}/edit`} className="button button--ghost">
                    Edit
                  </Link>
                  <Link href={`/portal/events/${event.id}/registration`} className="button button--ghost">
                    Registrations
                  </Link>
                  <form action={eventQuickAction}>
                    <input type="hidden" name="eventId" value={event.id} />
                    <input type="hidden" name="churchId" value={church.id} />
                    <input type="hidden" name="intent" value="duplicate" />
                    <button type="submit" className="button button--ghost">Duplicate</button>
                  </form>
                  {statusCanPublish(event.status) ? (
                    <form action={eventQuickAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="churchId" value={church.id} />
                      <input type="hidden" name="intent" value="publish" />
                      <button type="submit" className="button button--primary">Publish</button>
                    </form>
                  ) : null}
                  {event.status === "published" ? (
                    <form action={eventQuickAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="churchId" value={church.id} />
                      <input type="hidden" name="intent" value="unpublish" />
                      <button type="submit" className="button button--ghost">Unpublish</button>
                    </form>
                  ) : null}
                  {(event.status === "published" || event.status === "unlisted") ? (
                    <form action={eventQuickAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="churchId" value={church.id} />
                      <input type="hidden" name="intent" value="cancel" />
                      <button type="submit" className="button button--ghost">Cancel</button>
                    </form>
                  ) : null}
                  {(event.status === "published" || event.status === "cancelled" || event.status === "completed") ? (
                    <form action={eventQuickAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="churchId" value={church.id} />
                      <input type="hidden" name="intent" value="archive" />
                      <button type="submit" className="button button--ghost">Archive</button>
                    </form>
                  ) : null}
                  {event.status === "archived" ? (
                    <form action={eventQuickAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="churchId" value={church.id} />
                      <input type="hidden" name="intent" value="restore" />
                      <button type="submit" className="button button--ghost">Restore</button>
                    </form>
                  ) : null}
                  {event.status === "draft" ? (
                    <form action={eventQuickAction}>
                      <input type="hidden" name="eventId" value={event.id} />
                      <input type="hidden" name="churchId" value={church.id} />
                      <input type="hidden" name="intent" value="delete_draft" />
                      <button type="submit" className="button button--danger">Delete draft</button>
                    </form>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
