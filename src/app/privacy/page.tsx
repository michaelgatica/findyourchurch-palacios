import Link from "next/link";

import { createPageMetadata, siteConfig } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: "Privacy | Find Your Church Palacios",
  description:
    "Read the privacy overview for Find Your Church Palacios, including church submissions, account information, and Firebase-based storage.",
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
            Find Your Church Palacios uses Firebase Authentication, Cloud Firestore, Firebase
            Storage, and trusted server-side Firebase Admin SDK operations to manage accounts,
            listings, uploaded media, and workflow records.
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
      </div>
    </section>
  );
}
