import Link from "next/link";

import { formatDateTime } from "@/lib/formatting";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";
import { listManagedRegistrations } from "@/lib/services/registration-management-service";
import type { RegistrationStatus } from "@/lib/types/registrations";

const registrationStatuses: Array<RegistrationStatus | "all"> = ["all", "confirmed", "waitlisted", "cancelled", "checked_in", "attended", "no_show"];
const optionalColumns = ["status", "attendees", "confirmation", "submitted", "form"] as const;
type OptionalColumn = (typeof optionalColumns)[number];

export default async function EventRegistrationDashboardPage(props: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ status?: string; cursor?: string; search?: string; sort?: string; columns?: string | string[]; success?: string; error?: string }>;
}) {
  const [{ eventId }, searchParams, context] = await Promise.all([props.params, props.searchParams, getRepresentativePortalContext()]);
  if (!context?.church || !context.representative) return null;

  const status = registrationStatuses.includes(searchParams.status as RegistrationStatus | "all")
    ? searchParams.status as RegistrationStatus | "all"
    : "all";
  const requestedColumns = (Array.isArray(searchParams.columns)
    ? searchParams.columns
    : searchParams.columns?.split(",") ?? optionalColumns
  ).filter((value): value is OptionalColumn => optionalColumns.includes(value as OptionalColumn));
  const visibleColumns = new Set<OptionalColumn>(requestedColumns.length > 0 ? requestedColumns : optionalColumns);
  const data = await listManagedRegistrations({
    eventId,
    churchId: context.church.id,
    actorUserId: context.profile.id,
    status,
    cursor: searchParams.cursor,
    search: searchParams.search,
    direction: searchParams.sort === "oldest" || searchParams.sort === "name_asc" ? "asc" : "desc",
    sortBy: searchParams.sort === "name_asc" || searchParams.sort === "name_desc"
      ? "contactNameNormalized"
      : "submittedAt",
  });
  const remainingCapacity = data.configuration?.capacity === null || data.configuration?.capacity === undefined
    ? null
    : Math.max(0, data.configuration.capacity - (data.configuration.capacityUnit === "registrations" ? data.counters.confirmed : data.counters.confirmedAttendees));

  return (
    <div className="admin-content">
      {searchParams.success ? <div className="form-alert form-alert--success" role="status">{searchParams.success}</div> : null}
      {searchParams.error ? <div className="form-alert" role="alert">{searchParams.error}</div> : null}
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Registration management</p>
        <h1>{data.event.title}</h1>
        <p className="supporting-text">Private registration data is available only to authorized representatives of {data.church.name} and platform administrators.</p>
        <dl className="event-admin-row__meta">
          <div><dt>Registration opens</dt><dd>{data.configuration?.opensAt ? formatDateTime(data.configuration.opensAt) : "Immediately"}</dd></div>
          <div><dt>Registration closes</dt><dd>{data.configuration?.closesAt ? formatDateTime(data.configuration.closesAt) : "At event completion"}</dd></div>
          <div><dt>Capacity counts</dt><dd>{data.configuration?.capacityUnit === "registrations" ? "Registration submissions" : "People attending"}</dd></div>
          <div><dt>Retention</dt><dd>{data.configuration ? `${data.configuration.retentionDays} days after the event` : "Not configured"}</dd></div>
        </dl>
        <div className="button-row">
          <Link href={`/portal/events/${eventId}/registration/form`} className="button button--primary">Registration setup and form</Link>
          <Link href={`/portal/events/${eventId}/registration/new`} className="button button--ghost">Add manual registration</Link>
          <Link href={`/portal/events/${eventId}/check-in`} className="button button--ghost">Mobile check-in</Link>
          <Link href={`/portal/events/${eventId}/exports`} className="button button--ghost">Reports and exports</Link>
        </div>
      </div>

      <div className="registration-stat-grid">
        <div className="panel"><span>Confirmed</span><strong>{data.counters.confirmed}</strong></div>
        <div className="panel"><span>Confirmed attendees</span><strong>{data.counters.confirmedAttendees}</strong></div>
        <div className="panel"><span>Waitlisted</span><strong>{data.counters.waitlisted}</strong></div>
        <div className="panel"><span>Cancelled</span><strong>{data.counters.cancelled}</strong></div>
        <div className="panel"><span>Checked in</span><strong>{data.counters.checkedIn}</strong></div>
        <div className="panel"><span>Attended</span><strong>{data.counters.attended}</strong></div>
        <div className="panel"><span>Remaining capacity</span><strong>{remainingCapacity ?? "No limit"}</strong></div>
      </div>

      <form className="panel event-dashboard-filters">
        <div className="form-grid">
          <label className="field"><span className="field__label">Search name prefix or exact confirmation number</span><input name="search" defaultValue={searchParams.search ?? ""} minLength={2} /></label>
          <label className="field"><span className="field__label">Status</span><select name="status" defaultValue={status}>{registrationStatuses.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label>
          <label className="field"><span className="field__label">Sort</span><select name="sort" defaultValue={searchParams.sort ?? "newest"}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name_asc">Name A-Z</option><option value="name_desc">Name Z-A</option></select></label>
        </div>
        <fieldset className="registration-column-picker">
          <legend>Visible columns</legend>
          {optionalColumns.map((column) => (
            <label key={column}>
              <input type="checkbox" name="columns" value={column} defaultChecked={visibleColumns.has(column)} />
              {column.replaceAll("_", " ")}
            </label>
          ))}
        </fieldset>
        <div className="button-row"><button className="button button--primary" type="submit">Apply</button><Link href={`/portal/events/${eventId}/registration`} className="button button--ghost">Clear</Link></div>
      </form>

      <div className="panel registration-table-panel">
        <div className="admin-panel__header"><div><p className="eyebrow">Registration list</p><h2>{data.registrations.length} on this page</h2></div><p className="supporting-text">Sensitive answers open only in the individual detail view.</p></div>
        {data.registrations.length === 0 ? <p>No registrations match these filters.</p> : (
          <div className="registration-table-wrap"><table className="registration-table"><thead><tr><th>Name</th>{visibleColumns.has("status") ? <th>Status</th> : null}{visibleColumns.has("attendees") ? <th>Attendees</th> : null}{visibleColumns.has("confirmation") ? <th>Confirmation</th> : null}{visibleColumns.has("submitted") ? <th>Submitted</th> : null}{visibleColumns.has("form") ? <th>Form</th> : null}<th>Action</th></tr></thead><tbody>{data.registrations.map((registration) => <tr key={registration.id}><td>{registration.contactName}</td>{visibleColumns.has("status") ? <td><span className={`status-badge status-badge--${registration.status}`}>{registration.status.replaceAll("_", " ")}</span></td> : null}{visibleColumns.has("attendees") ? <td>{registration.attendeeCount}</td> : null}{visibleColumns.has("confirmation") ? <td>{registration.confirmationNumber}</td> : null}{visibleColumns.has("submitted") ? <td>{formatDateTime(registration.submittedAt)}</td> : null}{visibleColumns.has("form") ? <td>Version {registration.formVersion}</td> : null}<td><Link href={`/portal/events/${eventId}/registration/${registration.id}`} className="text-link">Open</Link></td></tr>)}</tbody></table></div>
        )}
        {data.nextCursor ? <div className="button-row"><Link className="button button--ghost" href={`/portal/events/${eventId}/registration?status=${status}&cursor=${data.nextCursor}&sort=${searchParams.sort ?? "newest"}&search=${encodeURIComponent(searchParams.search ?? "")}&columns=${[...visibleColumns].join(",")}`}>Next page</Link></div> : null}
      </div>
    </div>
  );
}
