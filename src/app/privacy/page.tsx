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
          <h2>Firebase and file storage</h2>
          <p>
            Find Your Church Palacios uses Firebase Authentication, Cloud Firestore, Firebase
            Storage, and trusted server-side Firebase Admin SDK operations to manage accounts,
            listings, uploaded media, and workflow records.
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
