import Link from "next/link";

import { AdminStatusBadge } from "@/components/admin/admin-status-badge";
import {
  setPlatformEventEditingLockAction,
  setPlatformEventFeaturedAction,
  transitionPlatformEventAction,
} from "@/lib/actions/platform-events";
import { formatDateTime } from "@/lib/formatting";
import { listPlatformEvents } from "@/lib/services/platform-event-admin-service";
import { eventRegistrationModes, eventStatuses } from "@/lib/types/events";

interface AdminEventsPageProps {
  searchParams: Promise<{
    keyword?: string;
    status?: string;
    churchId?: string;
    city?: string;
    primaryType?: string;
    audienceTag?: string;
    registrationMode?: string;
    sort?: string;
  }>;
}

export default async function AdminEventsPage({ searchParams }: AdminEventsPageProps) {
  const params = await searchParams;
  const events = await listPlatformEvents({
    keyword: params.keyword,
    status: eventStatuses.includes(params.status as never) ? (params.status as never) : "all",
    churchId: params.churchId,
    city: params.city,
    primaryType: params.primaryType,
    audienceTag: params.audienceTag,
    registrationMode: eventRegistrationModes.includes(params.registrationMode as never)
      ? params.registrationMode
      : undefined,
    sort: params.sort as never,
    limit: 75,
  });

  const counts = eventStatuses.reduce<Record<string, number>>((summary, status) => {
    summary[status] = events.filter((event) => event.status === status).length;
    return summary;
  }, {});
  const registrationEnabled = events.filter((event) => event.registration?.mode && event.registration.mode !== "none").length;

  return (
    <div className="admin-content">
      <div className="panel">
        <div className="admin-panel__header">
          <div>
            <p className="eyebrow eyebrow--gold">Community Ministry Hub</p>
            <h1>Platform event administration</h1>
            <p className="supporting-text">
              Manage events across churches, moderate visibility, review status, and protect
              registration data without impersonating a church representative.
            </p>
          </div>
        </div>

        <form className="admin-filter-form">
          <input name="keyword" defaultValue={params.keyword ?? ""} placeholder="Search title, church, type, or tag" />
          <select name="status" defaultValue={params.status ?? "all"}>
            <option value="all">All statuses</option>
            {eventStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
          </select>
          <input name="churchId" defaultValue={params.churchId ?? ""} placeholder="Church ID" />
          <input name="city" defaultValue={params.city ?? ""} placeholder="City" />
          <select name="registrationMode" defaultValue={params.registrationMode ?? ""}>
            <option value="">Any registration</option>
            {eventRegistrationModes.map((mode) => <option key={mode} value={mode}>{mode.replaceAll("_", " ")}</option>)}
          </select>
          <select name="sort" defaultValue={params.sort ?? "startsAt_desc"}>
            <option value="startsAt_desc">Newest event date</option>
            <option value="startsAt_asc">Oldest event date</option>
            <option value="updatedAt_desc">Recently updated</option>
            <option value="createdAt_desc">Recently created</option>
          </select>
          <button className="button button--primary">Filter events</button>
        </form>

        <div className="admin-inline-stats">
          <span>Total: {events.length}</span>
          <span>Published: {counts.published ?? 0}</span>
          <span>Pending: {counts.pending_review ?? 0}</span>
          <span>Cancelled: {counts.cancelled ?? 0}</span>
          <span>Registration enabled: {registrationEnabled}</span>
        </div>
      </div>

      <div className="admin-card-list">
        {events.length === 0 ? (
          <div className="panel">
            <h2>No events match these filters</h2>
            <p className="supporting-text">Events created by church representatives will appear here.</p>
          </div>
        ) : events.map((event) => (
          <article key={event.id} className="panel admin-card-list__item">
            <div className="admin-card-list__header">
              <div>
                <p className="eyebrow">{event.churchName}</p>
                <h2>{event.title}</h2>
                <p className="supporting-text">
                  {formatDateTime(event.startsAt)} · {event.primaryType} · {event.registration?.mode?.replaceAll("_", " ") ?? "no registration"}
                </p>
              </div>
              <AdminStatusBadge status={event.status} />
            </div>

            <div className="admin-metadata-grid">
              <div><strong>Event ID</strong><p>{event.id}</p></div>
              <div><strong>Church ID</strong><p>{event.churchId}</p></div>
              <div><strong>Owner</strong><p>{event.lastEditedByName ?? event.createdByName ?? "Unknown"}</p></div>
              <div><strong>Visibility</strong><p>{event.visibility}</p></div>
              <div><strong>Featured</strong><p>{event.isFeatured ? "Yes" : "No"}</p></div>
              <div><strong>Editing lock</strong><p>{event.editingLocked ? "Locked" : "Open"}</p></div>
            </div>

            {event.moderationNote ? <p className="admin-note">Moderation note: {event.moderationNote}</p> : null}

            <div className="button-row">
              <Link href={`/events/${event.slug}`} className="button button--ghost">Preview</Link>
              <Link href={`/admin/churches/${event.churchId}/representatives`} className="button button--ghost">Church reps</Link>
              <form action={transitionPlatformEventAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <select name="nextStatus" defaultValue={event.status}>
                  {eventStatuses.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}
                </select>
                <input name="note" placeholder="Optional moderation note" />
                <button className="button button--secondary">Apply status</button>
              </form>
              <form action={setPlatformEventFeaturedAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="featured" value={event.isFeatured ? "false" : "true"} />
                <button className="button button--ghost">{event.isFeatured ? "Remove featured" : "Feature"}</button>
              </form>
              <form action={setPlatformEventEditingLockAction}>
                <input type="hidden" name="eventId" value={event.id} />
                <input type="hidden" name="locked" value={event.editingLocked ? "false" : "true"} />
                <input name="note" placeholder="Lock/unlock note" />
                <button className="button button--ghost">{event.editingLocked ? "Unlock editing" : "Lock editing"}</button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

