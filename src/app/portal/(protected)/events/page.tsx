import Link from "next/link";

import { EventCard } from "@/components/event-card";
import { getUpcomingPublishedEventsForChurch } from "@/lib/repositories/event-repository";
import { getRepresentativePortalContext } from "@/lib/services/representative-access-service";

export default async function PortalEventsPage() {
  const context = await getRepresentativePortalContext();

  if (!context?.church || !context.representative) {
    return null;
  }

  const upcomingEvents = await getUpcomingPublishedEventsForChurch(context.church.id, 12);

  return (
    <div className="admin-content">
      <div className="panel">
        <p className="eyebrow eyebrow--gold">Events</p>
        <h1>Events for {context.church.name}</h1>
        <p className="supporting-text">
          Event creation, registration, flyer uploads, and reports will be managed here as the
          Community Ministry Hub rolls out. Published events already appear here once they are
          available in Firestore.
        </p>
      </div>

      <div className="panel">
        <h2>Upcoming published events</h2>
        {upcomingEvents.length > 0 ? (
          <div className="event-list event-list--compact">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        ) : (
          <p className="supporting-text">
            No upcoming events are published for this church yet.
          </p>
        )}
        <div className="button-row">
          <Link href="/events" className="button button--ghost">
            View Community Calendar
          </Link>
        </div>
      </div>
    </div>
  );
}
