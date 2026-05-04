import Link from "next/link";

import { ChurchCard } from "@/components/church-card";
import { DonationSupportActions } from "@/components/donation-support-actions";
import { DonationSupportEmbed } from "@/components/donation-support-embed";
import { createPageMetadata, siteConfig } from "@/lib/config/site";
import { getPublishedChurches } from "@/lib/repositories/church-repository";

export const dynamic = "force-dynamic";

export const metadata = createPageMetadata({
  title: "Find Your Church Palacios | Find Churches in Palacios, Texas",
  description:
    "Find Your Church Palacios helps residents, visitors, and families discover local churches, view service times, and connect with church communities in the Palacios area.",
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

export default async function HomePage() {
  const publishedChurches = await getPublishedChurches();
  const churchPreview = pickRandomChurchPreview(publishedChurches, 3);

  return (
    <>
      <section className="hero-section">
        <div className="shell hero-section__inner">
          <div className="hero-section__copy">
            <p className="eyebrow eyebrow--gold">Local Church Directory</p>
            <h1>Find a Church in Palacios, Texas</h1>
          <p className="hero-section__lead">
            Find service times, contact information, and helpful details for local churches in
            the Palacios area.
          </p>
          <p className="supporting-text hero-section__scope-note">{siteConfig.currentListingScope}</p>
            <div className="button-row">
              <Link href="/churches" className="button button--primary">
                Browse Churches
              </Link>
              <Link href="/submit" className="button button--secondary">
                Submit Your Church
              </Link>
              <Link href="/churches" className="button button--ghost">
                Claim a Church
              </Link>
            </div>
          </div>

          <div className="hero-panel">
            <p className="eyebrow">Simple and Local</p>
            <h2>A clear place to explore churches in the Palacios community</h2>
            <p>{siteConfig.launchVision}</p>
            <div className="hero-panel__stats">
              <div>
                <strong>{publishedChurches.length}</strong>
                <span>Churches listed</span>
              </div>
              <div>
                <strong>Local</strong>
                <span>Built to help residents, visitors, and families</span>
              </div>
              <div>
                <strong>Free</strong>
                <span>No church is required to pay to be listed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="shell section-stack">
        <div className="panel trust-banner">
          <p className="eyebrow eyebrow--gold">A Free Local Church Directory</p>
          <h2>Created to help people connect with church communities</h2>
          <p>
            Find Your Church Palacios is a simple, ministry-focused directory created to help
            people find churches, view service times, and connect with local congregations.
          </p>
        </div>
      </section>

      <section className="shell section-stack">
        <div className="section-grid section-grid--three">
          <div className="panel">
            <p className="eyebrow">Browse local churches</p>
            <h3>Find service times and contact information</h3>
            <p>
              Search the directory, compare ministries, and explore local church details in one
              place.
            </p>
          </div>

          <div className="panel">
            <p className="eyebrow">Submit your church</p>
            <h3>Help your church stay easy to find</h3>
            <p>
              Church leaders and trusted contacts can submit a listing so the community can find
              clear, up-to-date information.
            </p>
            <p className="supporting-text">{siteConfig.currentListingScope}</p>
          </div>

          <div className="panel">
            <p className="eyebrow">Claim or update a listing</p>
            <h3>Keep your church profile current</h3>
            <p>
              Pastors, staff members, and authorized representatives can request access to help
              keep their listing accurate.
            </p>
          </div>
        </div>
      </section>

      <section className="shell section-stack">
        <div className="section-heading">
          <div>
            <p className="eyebrow eyebrow--gold">Explore Local Churches</p>
            <h2>Start with a few churches in the Palacios area</h2>
          </div>
          <Link href="/churches" className="button button--ghost">
            Browse All Churches
          </Link>
        </div>

        <div className="church-grid church-grid--stacked">
          {churchPreview.map((church) => (
            <ChurchCard key={church.id} church={church} />
          ))}
        </div>
      </section>

      <section className="shell section-stack">
        <div className="section-grid">
          <div className="panel">
            <p className="eyebrow">Submit or update a listing</p>
            <h2>Help your church information stay easy to find</h2>
            <p>
              Churches can submit a new listing for review or request access to an existing listing
              to keep contact information, service times, and ministry details current.
            </p>
            <p className="supporting-text">{siteConfig.currentListingScope}</p>
            <div className="button-row">
              <Link href="/submit" className="button button--secondary">
                Submit Your Church
              </Link>
              <Link href="/churches" className="button button--ghost">
                Claim a Church
              </Link>
            </div>
          </div>

          <div className="panel panel--gold-tint">
            <p className="eyebrow">Donation-Supported</p>
            <h2>Keeping the directory free for churches</h2>
            <p>{siteConfig.donationDescription}</p>
            <p className="supporting-text">{siteConfig.donationFollowup}</p>
            <DonationSupportActions />
            <DonationSupportEmbed />
          </div>
        </div>
      </section>
    </>
  );
}
