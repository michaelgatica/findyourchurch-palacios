import Link from "next/link";

import { buildLaunchPageTitle, createPageMetadata, siteConfig } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: buildLaunchPageTitle("Terms and Conditions"),
  description: `Read the Terms and Conditions for ${siteConfig.launchName}, including website use, listing submissions, account responsibilities, and communication consent.`,
  pathname: "/terms",
});

export default function TermsPage() {
  return (
    <section className="shell page-section">
      <div className="page-intro page-intro--narrow">
        <p className="eyebrow eyebrow--gold">Terms</p>
        <h1>Terms and Conditions</h1>
        <p>
          These Terms and Conditions govern the use of {siteConfig.launchName}, including public
          browsing, church listing submissions, church representative access, and communication
          through this ministry platform.
        </p>
      </div>

      <div className="content-page-stack">
        <div className="panel content-card">
          <h2>Informational directory use</h2>
          <p>
            Listings are provided for informational purposes. {siteConfig.launchName} does not rank
            churches, provide public reviews, or guarantee the completeness of every listing at
            every moment.
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
          <h2>Authorized submissions and accounts</h2>
          <p>
            By submitting a church listing, claim request, or representative update, you confirm
            that the information you provide is accurate to the best of your knowledge and that
            you are authorized to submit it on behalf of the church or ministry context described.
            Account holders are responsible for keeping their sign-in credentials secure.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Email communication consent</h2>
          <p>
            When you submit a listing, claim a church, create a representative account, or contact
            us through this site, you agree that we may send transactional emails related to your
            request, listing review, account access, annual verification, or support follow-up.
            Optional non-essential follow-up emails are always opt-in and can be turned down when
            you submit a form or later by contacting us.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Opt-out and contact preferences</h2>
          <p>
            You may opt out of non-essential follow-up emails at any time by contacting{" "}
            <Link href={`mailto:${siteConfig.contactEmail}`} className="inline-link">
              {siteConfig.contactEmail}
            </Link>
            . Please note that transactional emails related to an active listing, claim, account,
            or support request may still be necessary while the workflow is in progress.
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
          <h2>Event registration responsibilities</h2>
          <p>
            Churches that create internal registration forms are responsible for collecting only
            information reasonably needed for the event, obtaining appropriate parent or guardian
            consent, keeping emergency or allergy information accurate, limiting report access,
            and deleting information when it is no longer needed. Churches may not use this
            platform to request Social Security numbers, government identification numbers,
            driver&apos;s-license numbers, bank information, or payment-card information.
          </p>
          <p>
            This platform does not process payment cards. A church may provide a secure external
            information or payment link, but that transaction is handled by the external provider.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Registration access, reports, and third parties</h2>
          <p>
            Registrants must protect confirmation and registration-management links. Authorized
            church representatives may view, update, export, or email registration information for
            their own events. Google Forms and other external registration providers operate under
            their own terms; Find Your Church does not control information submitted directly to
            those services.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Acceptable use</h2>
          <p>
            This site may not be used for spam, impersonation, deceptive listing activity,
            political campaign misuse, harassment, or content that attacks or misrepresents a
            church, ministry, or individual. We reserve the right to suspend access or remove
            content that conflicts with these expectations.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Availability and updates</h2>
          <p>
            We may revise site features, workflows, legal pages, or listing processes as needed to
            improve accuracy, safety, and ministry usefulness. Continued use of the site after
            updates means you accept the revised terms.
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

        <div className="panel content-card">
          <h2>Legal review notice</h2>
          <p>
            These terms are operational policy language and are not legal advice. Qualified legal
            counsel should review them before broad production use, particularly for registrations
            involving minors, consent records, or health-related accommodations.
          </p>
        </div>
      </div>
    </section>
  );
}
