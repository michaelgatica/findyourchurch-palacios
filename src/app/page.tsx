import Link from "next/link";

import { ChurchCard } from "@/components/church-card";
import { EventCard } from "@/components/event-card";
import {
  buildLaunchHomeTitle,
  createPageMetadata,
  siteConfig,
} from "@/lib/config/site";
import { getPublishedChurches } from "@/lib/repositories/church-repository";
import { getUpcomingPublishedEvents } from "@/lib/repositories/event-repository";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: buildLaunchHomeTitle(),
  description: siteConfig.launchDescription,
  pathname: "/",
});

function pickRandomChurchPreview<T>(items: T[], count: number) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }

  return shuffled.slice(0, count);
}

function DiscoveryIcon({ type }: { type: "church" | "people" | "heart" }) {
  if (type === "church") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M24 4v9m-4-5h8M9 44V23l15-10 15 10v21M17 44V31h14v13M5 44h38" />
      </svg>
    );
  }

  if (type === "people") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="15" r="6" />
        <circle cx="10" cy="20" r="4" />
        <circle cx="38" cy="20" r="4" />
        <path d="M13 43v-6c0-7 5-12 11-12s11 5 11 12v6M2 41v-5c0-5 3-9 8-9 2 0 4 1 5 2m31 12v-5c0-5-3-9-8-9-2 0-4 1-5 2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path d="M24 42S6 31 6 17c0-6 4-10 10-10 4 0 7 2 8 6 1-4 4-6 8-6 6 0 10 4 10 10 0 14-18 25-18 25Z" />
    </svg>
  );
}

export default async function HomePage() {
  const [publishedChurches, upcomingEvents] = await Promise.all([
    getPublishedChurches(),
    getUpcomingPublishedEvents(3),
  ]);
  const churchPreview = pickRandomChurchPreview(publishedChurches, 3);

  return (
    <>
      <section className="premium-hero">
        <div className="shell premium-hero__inner">
          <div className="premium-hero__copy">
            <p className="premium-hero__kicker">A local church guide for the Palacios community</p>
            <h1>Find a church where you can belong.</h1>
            <p className="premium-hero__lead">
              Explore churches, service times, ministries, and community events across Palacios
              and nearby communities.
            </p>
            <div className="button-row premium-hero__actions">
              <Link href="/churches" className="button button--primary">
                Browse churches
              </Link>
              <Link href="/events" className="button button--on-dark">
                Explore events
              </Link>
            </div>
            <p className="premium-hero__promise">
              Free for every church. Built for neighbors, families, and visitors.
            </p>
          </div>
        </div>
      </section>

      <div className="shell premium-search-wrap">
        <form action="/churches" className="premium-search" role="search">
          <label className="premium-search__field">
            <span>Find a church</span>
            <input
              type="search"
              name="keyword"
              placeholder="Search churches, ministries, or service times"
            />
          </label>
          <div className="premium-search__location" aria-label={`Search area: ${siteConfig.launchAreaLabel}`}>
            <span aria-hidden="true">⌖</span>
            <span>{siteConfig.launchAreaLabel}</span>
          </div>
          <button type="submit" className="button button--secondary">
            Search directory
          </button>
        </form>
      </div>

      <section className="shell premium-section premium-intro">
        <div className="premium-section__heading premium-section__heading--centered">
          <h2>A clearer way to find your church community</h2>
          <p>
            Reliable local information, welcoming next steps, and one shared calendar for church
            life across the Palacios area.
          </p>
        </div>
        <div className="premium-value-grid">
          <article className="premium-value">
            <DiscoveryIcon type="church" />
            <div>
              <h3>Discover with confidence</h3>
              <p>Compare service times, ministries, accessibility details, and church profiles.</p>
            </div>
          </article>
          <article className="premium-value">
            <DiscoveryIcon type="people" />
            <div>
              <h3>Get connected</h3>
              <p>Find gatherings and community events with clear locations and next steps.</p>
            </div>
          </article>
          <article className="premium-value">
            <DiscoveryIcon type="heart" />
            <div>
              <h3>Serve together</h3>
              <p>Help churches share accurate information and opportunities to care for neighbors.</p>
            </div>
          </article>
        </div>
      </section>

      <section className="premium-section premium-section--sage">
        <div className="shell">
          <div className="premium-section__heading premium-section__heading--split">
            <div>
              <p className="premium-overline">Church directory</p>
              <h2>Explore churches across {siteConfig.launchAreaLabel}</h2>
            </div>
            <Link href="/churches" className="premium-text-link">
              View all {publishedChurches.length} churches <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="church-grid premium-church-grid">
            {churchPreview.map((church) => (
              <ChurchCard key={church.id} church={church} />
            ))}
          </div>
        </div>
      </section>

      <section className="shell premium-section">
        <div className="premium-section__heading premium-section__heading--split">
          <div>
            <p className="premium-overline">Community calendar</p>
            <h2>Gather, serve, and grow together</h2>
          </div>
          <Link href="/events" className="premium-text-link">
            View all community events <span aria-hidden="true">→</span>
          </Link>
        </div>

        {upcomingEvents.length > 0 ? (
          <div className="event-grid premium-event-grid">
            {upcomingEvents.map((event) => (
              <EventCard key={event.id} event={event} compact />
            ))}
          </div>
        ) : (
          <div className="premium-empty-state">
            <div>
              <h3>Community events are coming soon</h3>
              <p>
                Verified church representatives can publish worship gatherings, outreach
                opportunities, Bible studies, and other community events.
              </p>
            </div>
            <Link href="/portal/login" className="button button--ghost">
              Church sign in
            </Link>
          </div>
        )}
      </section>

      <section className="shell premium-section">
        <div className="premium-church-cta">
          <div>
            <p className="premium-overline">For church leaders</p>
            <h2>Give your church a clear, welcoming place in the community.</h2>
            <p>
              Submit a church, claim an existing profile, and use the Community Ministry Hub to
              keep events and registration information current.
            </p>
          </div>
          <div className="button-row">
            <Link href="/submit" className="button button--primary">
              List your church
            </Link>
            <Link href="/churches" className="button button--on-dark">
              Claim a church
            </Link>
          </div>
        </div>
      </section>

      <section className="shell premium-section premium-ministry-note">
        <div>
          <p className="premium-overline">A ministry of El Roi Digital Ministries</p>
          <h2>Free for churches. Sustained by people who believe in the mission.</h2>
          <p>
            Find Your Church Palacios is provided free of charge by El Roi Digital Ministries.
            Help us continue spreading the Word of God and serving local churches through
            thoughtful technology.
          </p>
        </div>
        <Link
          href={siteConfig.ministryDonationUrl}
          className="button button--primary"
          target="_blank"
          rel="noreferrer"
        >
          Support the ministry
        </Link>
      </section>
    </>
  );
}
