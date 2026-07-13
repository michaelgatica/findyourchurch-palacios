import Link from "next/link";

import { buildLaunchPageTitle, createPageMetadata, siteConfig } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: buildLaunchPageTitle("Listing Guidelines"),
  description: `Review the listing guidelines for ${siteConfig.launchName}, including reviewed listings, accuracy expectations, and rejection criteria.`,
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
            This version of {siteConfig.launchName} does not rank churches or collect public
            reviews. The purpose is connection and clarity, not competition.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Event posting and registration guidance</h2>
          <p>
            Event details should be accurate, current, and appropriate for public display. If a
            church enables internal registration, it should collect only information genuinely
            needed to plan or safely operate the event. Parent or guardian consent should be used
            when appropriate for minors, and emergency, allergy, or accessibility information
            should be limited to what event leaders need.
          </p>
          <p>
            Event forms may not request Social Security numbers, driver&apos;s-license or government
            ID numbers, bank details, or payment-card information. Registration exports are private
            church records and should not be posted publicly or forwarded unnecessarily.
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
