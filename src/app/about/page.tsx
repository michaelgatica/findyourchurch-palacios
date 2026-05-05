import Link from "next/link";

import { DonationSupportActions } from "@/components/donation-support-actions";
import { DonationSupportEmbed } from "@/components/donation-support-embed";
import { buildLaunchPageTitle, createPageMetadata, siteConfig } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: buildLaunchPageTitle("About"),
  description: `Learn about ${siteConfig.launchName}, its ministry purpose, and the long-term vision behind this local church directory.`,
  pathname: "/about",
});

export default function AboutPage() {
  return (
    <section className="shell page-section">
      <div className="page-intro page-intro--narrow">
        <p className="eyebrow eyebrow--gold">About This Ministry</p>
        <h1>Why {siteConfig.launchName} exists</h1>
        <p>
          {siteConfig.launchName} is a ministry project powered by {siteConfig.ministryName}. Our
          purpose is to help people find local churches and help churches keep their information
          accurate, welcoming, and easy to access.
        </p>
      </div>

      <div className="content-page-grid">
        <div className="panel content-card">
          <h2>{siteConfig.launchCity} is our first local launch</h2>
          <p>{siteConfig.launchVision}</p>
        </div>

        <div className="panel content-card">
          <h2>What this directory is for</h2>
          <p>
            We want residents, visitors, and families to be able to find local churches, view
            service times, and connect with church communities without confusion or unnecessary
            barriers.
          </p>
          <p className="supporting-text">{siteConfig.currentListingScope}</p>
        </div>

        <div className="panel content-card">
          <h2>How listings are handled</h2>
          <p>
            Churches can submit listings publicly, claim their existing listing, and request
            updates through a secure representative portal. Listings are reviewed to help protect
            accuracy and trust.
          </p>
        </div>
      </div>

      <div className="panel panel--gold-tint content-highlight">
        <p className="eyebrow">Donation-Supported Ministry</p>
        <h2>Keeping the directory free for churches</h2>
        <p>{siteConfig.donationDescription}</p>
        <p className="supporting-text">{siteConfig.donationFollowup}</p>
        <DonationSupportActions />
        <DonationSupportEmbed />
      </div>

      <div className="panel content-card">
        <h2>Need help or want to connect?</h2>
        <p>
          Questions about listings, claim requests, updates, or ministry support can be directed to
          our team.
        </p>
        <div className="button-row">
          <Link href="/contact" className="button button--secondary">
            Contact Find Your Church
          </Link>
          <Link href="/listing-guidelines" className="button button--ghost">
            View listing guidelines
          </Link>
        </div>
      </div>
    </section>
  );
}
