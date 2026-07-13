import Link from "next/link";

import { buildLaunchPageTitle, createPageMetadata, siteConfig } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: buildLaunchPageTitle("Privacy"),
  description: `Read the privacy overview for ${siteConfig.launchName}, including church submissions, account information, and Firebase-based storage.`,
  pathname: "/privacy",
});

export default function PrivacyPage() {
  return (
    <section className="shell page-section">
      <div className="page-intro page-intro--narrow">
        <p className="eyebrow eyebrow--gold">Privacy</p>
        <h1>Privacy overview</h1>
        <p>
          We collect only the information needed to operate the directory, review listings,
          process church representative requests, and communicate with people who contact us.
        </p>
      </div>

      <div className="content-page-stack">
        <div className="panel content-card">
          <h2>Information we collect</h2>
          <p>
            This can include church listing details, submitter contact information, church
            representative claim details, account information for admin or representative access,
            and messages sent through the site or related workflows.
          </p>
        </div>

        <div className="panel content-card">
          <h2>How information is used</h2>
          <p>
            Information is used to review listings, publish approved church details, process access
            claims, maintain directory accuracy, send email updates, and support the admin and
            representative portals.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Email communication and consent</h2>
          <p>
            If you submit a church listing, claim a church, create an access account, or contact
            us through this site, we may email you about that request, related account access,
            listing review, annual verification, or support follow-up. Optional non-essential
            follow-up emails are opt-in where provided.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Opting out of non-essential emails</h2>
          <p>
            You may opt out of non-essential follow-up emails at any time by contacting{" "}
            <Link href={`mailto:${siteConfig.contactEmail}`} className="inline-link">
              {siteConfig.contactEmail}
            </Link>
            . Transactional emails needed to complete an active submission, claim, account, or
            listing workflow may still be sent while that request is in progress.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Firebase and file storage</h2>
          <p>
            {siteConfig.launchName} uses Firebase Authentication, Cloud Firestore, Firebase
            Storage, and trusted server-side Firebase Admin SDK operations to manage accounts,
            listings, uploaded media, and workflow records.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Event registrations and church-created questions</h2>
          <p>
            When an event uses internal registration, the host church chooses the questions it
            needs and authorized church representatives receive the submitted answers. Depending
            on the event, this may include contact details, participant or minor information,
            parent or guardian consent, emergency contacts, allergies, dietary needs, or
            accessibility accommodations. This information is not displayed in public event
            listings.
          </p>
          <p>
            El Roi Digital Ministries provides the platform and may access registration data only
            as needed to operate, secure, troubleshoot, or support the service. Host churches are
            responsible for requesting only information they genuinely need and handling reports
            appropriately.
          </p>
        </div>

        <div className="panel content-card">
          <h2>External registration services</h2>
          <p>
            Some events link to Google Forms or another church-selected registration service.
            Those submissions are handled by the external service and the host church under their
            own terms and privacy practices, not stored as internal registrations on this site.
            The destination is identified before you leave this website.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Registration emails, reports, and access links</h2>
          <p>
            We may send transactional confirmation, waitlist, update, cancellation, promotion,
            reminder, or event-cancellation emails. Authorized church representatives may create
            and email private registration reports to approved church or event contacts. Editing
            and cancellation links contain a secure access token; anyone receiving such a link
            should keep it private.
          </p>
        </div>

        <div className="panel content-card">
          <h2>How long information is kept</h2>
          <p>
            We retain workflow records, listings, and account-related information for as long as
            needed to operate the directory, review requests, restore archived listings, keep
            audit trails, and respond to support questions. We aim to minimize unnecessary data
            while keeping enough information to operate responsibly.
          </p>
          <p>
            Internal event registrations default to deletion 180 days after the event. Organizers
            may choose a bounded period from 30 to 730 days and should use shorter retention when
            information involving minors is no longer needed. Temporary PDF and Excel exports
            expire after 24 hours. Minimal audit records may remain after personal data is removed
            so the platform can document that an authorized action occurred.
          </p>
        </div>

        <div className="panel content-card">
          <h2>Requesting corrections or deletion</h2>
          <p>
            If you need to request a correction, removal, or deletion related to a listing or your
            submitted information, contact{" "}
            <Link href={`mailto:${siteConfig.contactEmail}`} className="inline-link">
              {siteConfig.contactEmail}
            </Link>
            .
          </p>
        </div>

        <div className="panel content-card">
          <h2>Legal review notice</h2>
          <p>
            This privacy overview is operational policy language, not legal advice. It should be
            reviewed by qualified legal counsel before broad production use, especially for events
            involving minors, health-related information, or state-specific retention duties.
          </p>
        </div>
      </div>
    </section>
  );
}
