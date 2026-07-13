import Link from "next/link";

import { EventBrowser } from "@/components/event-browser";
import { buildLaunchPageTitle, createPageMetadata, siteConfig } from "@/lib/config/site";
import { getUpcomingPublishedEvents } from "@/lib/repositories/event-repository";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: buildLaunchPageTitle("Community Calendar"),
  description:
    "Discover upcoming church and ministry events in Palacios and nearby communities.",
  pathname: "/events",
});

export default async function EventsPage() {
  const events = await getUpcomingPublishedEvents(60);

  return (
    <section className="shell page-section">
      <div className="page-intro">
        <p className="eyebrow eyebrow--gold">Community Calendar</p>
        <h1>Church and ministry events in {siteConfig.launchAreaLabel}</h1>
        <p>
          Browse upcoming worship gatherings, outreach opportunities, Bible studies, youth events,
          community meals, and ministry events from participating churches.
        </p>
        <div className="button-row">
          <Link href="/churches" className="button button--ghost">
            Browse Churches
          </Link>
          <Link href="/portal/login" className="button button--secondary">
            Church Sign In
          </Link>
        </div>
      </div>

      <EventBrowser events={events} />
    </section>
  );
}
