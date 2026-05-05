import Link from "next/link";

import { DonationSupportActions } from "@/components/donation-support-actions";
import { DonationSupportEmbed } from "@/components/donation-support-embed";
import { buildLaunchPageTitle, createPageMetadata, siteConfig } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: buildLaunchPageTitle("Contact"),
  description: `Contact ${siteConfig.launchName} for listing questions, ministry support, corrections, or church representative access help.`,
  pathname: "/contact",
});

export default function ContactPage() {
  return (
    <section className="shell page-section">
      <div className="page-intro page-intro--narrow">
        <p className="eyebrow eyebrow--gold">Contact</p>
        <h1>Questions, corrections, or support</h1>
        <p>
          We want {siteConfig.launchName} to be helpful, accurate, and easy to use. If you need
          help with a listing, claim request, portal access, or ministry support, please reach
          out.
        </p>
      </div>

      <div className="content-page-grid">
        <div className="panel content-card">
          <h2>Email support</h2>
          <p>
            For listing questions, corrections, claim requests, or support, email{" "}
            <Link href={`mailto:${siteConfig.contactEmail}`} className="inline-link">
              {siteConfig.contactEmail}
            </Link>
            .
          </p>
          <p className="supporting-text">{siteConfig.currentListingScope}</p>
        </div>

        <div className="panel content-card">
          <h2>Ministry affiliation</h2>
          <p>
            {siteConfig.launchName} is a ministry project powered by {siteConfig.ministryName}.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Support this work</h2>
          <p>
            If you would like to help keep this directory free and available for churches, donation
            support is appreciated but never required for a listing.
          </p>
          <DonationSupportActions />
        </div>
      </div>

      <div className="panel content-card">
        <DonationSupportEmbed />
      </div>
    </section>
  );
}
