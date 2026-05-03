import Link from "next/link";

import { createPageMetadata, siteConfig } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: "Terms | Find Your Church Palacios",
  description:
    "Read the basic use terms for Find Your Church Palacios, including listing review, informational use, and ministry platform expectations.",
  pathname: "/terms",
});

export default function TermsPage() {
  return (
    <section className="shell page-section">
      <div className="page-intro page-intro--narrow">
        <p className="eyebrow eyebrow--gold">Terms</p>
        <h1>Directory use terms</h1>
        <p>
          Find Your Church Palacios is an informational directory ministry intended to help people
          find local churches and help churches keep their information accurate and accessible.
        </p>
      </div>

      <div className="content-page-stack">
        <div className="panel content-card">
          <h2>Informational directory</h2>
          <p>
            Listings are provided for informational purposes. Find Your Church Palacios does not
            rank churches, provide public reviews, or guarantee the completeness of every listing
            at every moment.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Listing review and moderation</h2>
          <p>
            Listings are reviewed before publication. Find Your Church may approve, deny, edit,
            request clarification on, or remove listings when needed to protect clarity, accuracy,
            and appropriate use of the platform.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Church responsibility</h2>
          <p>
            Churches and authorized representatives are responsible for keeping their own public
            information accurate. If something needs to be corrected, please contact us or submit
            an update request through the representative portal.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Questions</h2>
          <p>
            Questions about these terms can be sent to{" "}
            <Link href={`mailto:${siteConfig.contactEmail}`} className="inline-link">
              {siteConfig.contactEmail}
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
