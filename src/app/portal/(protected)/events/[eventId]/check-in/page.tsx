import Link from "next/link";

import { manageRegistrationAction } from "@/lib/actions/registrations";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";
import { listManagedRegistrations } from "@/lib/services/registration-management-service";

export default async function MobileCheckInPage(props: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ search?: string; success?: string; error?: string }>;
}) {
  const [{ eventId }, searchParams, context] = await Promise.all([
    props.params,
    props.searchParams,
    getRepresentativePortalContext(),
  ]);

  if (!context?.church || !context.representative) {
    return null;
  }

  const churchId = context.church.id;
  const data = await listManagedRegistrations({
    eventId,
    churchId,
    actorUserId: context.profile.id,
    search: searchParams.search,
    status: "all",
  });
  const registrations = data.registrations.filter(
    (registration) => registration.status !== "cancelled",
  );
  const checkInPath = `/portal/events/${eventId}/check-in${
    searchParams.search ? `?search=${encodeURIComponent(searchParams.search)}` : ""
  }`;

  return (
    <div className="admin-content check-in-mode">
      {searchParams.success ? (
        <div className="form-alert form-alert--success" role="status">
          {searchParams.success}
        </div>
      ) : null}
      {searchParams.error ? (
        <div className="form-alert" role="alert">
          {searchParams.error}
        </div>
      ) : null}

      <div className="panel">
        <p className="eyebrow eyebrow--gold">Mobile check-in</p>
        <h1>{data.event.title}</h1>
        <p>Only names, confirmation numbers, attendee counts, and check-in status are shown here.</p>
        <Link href={`/portal/events/${eventId}/registration`} className="button button--ghost">
          Full registration dashboard
        </Link>
      </div>

      <form className="check-in-search">
        <label className="field">
          <span className="field__label">Search by name or confirmation number</span>
          <input
            name="search"
            defaultValue={searchParams.search ?? ""}
            autoFocus
            placeholder="Start typing a name or FYC confirmation number"
          />
        </label>
        <button className="button button--primary" type="submit">
          Search
        </button>
      </form>

      <div className="check-in-list">
        {registrations.length === 0 ? (
          <div className="panel">
            <p>No matching registrations.</p>
          </div>
        ) : (
          registrations.map((registration) => (
            <article key={registration.id} className="check-in-card">
              <div>
                <h2>{registration.contactName}</h2>
                <p>
                  {registration.confirmationNumber} | {registration.attendeeCount} attending
                </p>
                <span className={`status-badge status-badge--${registration.status}`}>
                  {registration.status.replaceAll("_", " ")}
                </span>
              </div>
              <form action={manageRegistrationAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="churchId" value={churchId} />
                <input type="hidden" name="registrationId" value={registration.id} />
                <input
                  type="hidden"
                  name="intent"
                  value={registration.status === "checked_in" ? "mark_confirmed" : "mark_checked_in"}
                />
                <input type="hidden" name="redirectTo" value={checkInPath} />
                <button
                  type="submit"
                  className={`button ${
                    registration.status === "checked_in" ? "button--ghost" : "button--primary"
                  }`}
                >
                  {registration.status === "checked_in" ? "Undo check-in" : "Check in"}
                </button>
              </form>
            </article>
          ))
        )}
      </div>
    </div>
  );
}
