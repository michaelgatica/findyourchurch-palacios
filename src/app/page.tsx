import Link from "next/link";

import { ChurchCard } from "@/components/church-card";
import { createPageMetadata, siteConfig } from "@/lib/config/site";
import { getPublishedChurches } from "@/lib/repositories/church-repository";

export const metadata = createPageMetadata({
  title: "Find Your Church Palacios | Find Churches in Palacios, Texas",
  description:
    "Find Your Church Palacios helps residents, visitors, and families discover local churches, view service times, and connect with church communities in the Palacios area.",
  pathname: "/",
});

export default async function HomePage() {
  const publishedChurches = await getPublishedChurches();
  const churchPreview = publishedChurches.slice(0, 3);

  return (
    <>
      <section className="hero-section">
        <div className="shell hero-section__inner">
          <div className="hero-section__copy">
            <p className="eyebrow eyebrow--gold">Local Church Directory</p>
            <h1>Find a Church in Palacios, Texas</h1>
            <p className="hero-section__lead">
              Find Your Church Palacios helps residents, visitors, and families discover local
              churches, view service times, and connect with church communities in the Palacios
              area.
            </p>
            <div className="button-row">
              <Link href="/churches" className="button button--primary">
                Browse Churches
              </Link>
              <Link href="/submit" className="button button--secondary">
                Submit Your Church
              </Link>
            </div>
          </div>

          <div className="hero-panel">
            <p className="eyebrow">Our First Local Launch</p>
            <h2>Built for Palacios now, structured for future cities later</h2>
            <p>
              This Phase 1 foundation supports published listings, pending submissions, and a data
              model that can grow into county, state, and multi-city church directories over time.
            </p>
            <div className="hero-panel__stats">
              <div>
                <strong>{publishedChurches.length}</strong>
                <span>Published starter listings</span>
              </div>
              <div>
                <strong>1</strong>
                <span>Active launch city</span>
              </div>
              <div>
                <strong>5</strong>
                <span>Core entities prepared</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="shell section-stack">
        <div className="section-grid">
          <div className="panel">
            <p className="eyebrow">About the Ministry</p>
            <h2>Helping churches be visible and easy to connect with</h2>
            <p>
              Find Your Church is a ministry project powered by El Roi Digital Ministries. The
              Palacios directory is our first local launch, created to help churches be searchable,
              visible, and easy to connect with.
            </p>
          </div>

          <div className="panel panel--gold-tint">
            <p className="eyebrow">Donation-Supported</p>
            <h2>Welcoming churches regardless of budget</h2>
            <p>
              Find Your Church Palacios is offered as a donation-supported ministry project. We do
              not want cost to keep a church from being searchable, visible, and easy to connect
              with. If your church is able to support this work, donations are appreciated. If not,
              your church is still welcome to be listed.
            </p>
          </div>
        </div>
      </section>

      <section className="shell section-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow eyebrow--gold">Explore Local Churches</p>
            <h2>View service times and connect with a local church</h2>
          </div>
          <Link href="/churches" className="button button--ghost">
            Open Directory
          </Link>
        </div>

        <div className="church-grid">
          {churchPreview.map((church) => (
            <ChurchCard key={church.id} church={church} />
          ))}
        </div>
      </section>

      <section className="shell section-stack">
        <div className="cta-banner">
          <div>
            <p className="eyebrow">Church Listing Support</p>
            <h2>Submit or update your church listing</h2>
            <p>
              Churches in and around {siteConfig.launchCity}, {siteConfig.launchState} can submit a
              public listing for review.
            </p>
          </div>
          <Link href="/submit" className="button button--primary">
            Start a Submission
          </Link>
        </div>
      </section>
    </>
  );
}
