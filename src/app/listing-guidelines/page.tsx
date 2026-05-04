import Link from "next/link";

import { createPageMetadata, siteConfig } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: "Listing Guidelines | Find Your Church Palacios",
  description:
    "Review the listing guidelines for Find Your Church Palacios, including reviewed listings, accuracy expectations, and rejection criteria.",
  pathname: "/listing-guidelines",
});

export default function ListingGuidelinesPage() {
  return (
    <section className="shell page-section">
      <div className="page-intro page-intro--narrow">
        <p className="eyebrow eyebrow--gold">Listing Guidelines</p>
        <h1>How listings are reviewed</h1>
        <p>
          Our goal is to keep the directory helpful, respectful, and accurate for both churches and
          the people searching for them.
        </p>
      </div>

      <div className="content-page-stack">
        <div className="panel content-card">
          <h2>What we look for</h2>
          <p>
            Submitted listings should include clear church information, accurate service times,
            contact details, and a respectful description of the church and its ministry.
          </p>
          <p className="supporting-text">{siteConfig.currentListingScope}</p>
        </div>

        <div className="panel content-card">
          <h2>What may be edited or rejected</h2>
          <p>
            Misleading, abusive, spammy, inappropriate, political campaign, or church-attacking
            content may be denied or removed. Listings may also be edited for clarity, grammar, or
            formatting before publication.
          </p>
        </div>

        <div className="panel content-card">
          <h2>No rankings or public reviews</h2>
          <p>
            This version of Find Your Church Palacios does not rank churches or collect public
            reviews. The purpose is connection and clarity, not competition.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Need help with a listing?</h2>
          <p>
            Contact{" "}
            <Link href={`mailto:${siteConfig.contactEmail}`} className="inline-link">
              {siteConfig.contactEmail}
            </Link>{" "}
            if you need to correct or update a listing.
          </p>
        </div>
      </div>
    </section>
  );
}
