import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found | Find Your Church Palacios",
  robots: {
    index: false,
    follow: false,
  },
};

export default function NotFoundPage() {
  return (
    <section className="shell page-section">
      <div className="confirmation-card">
        <p className="eyebrow eyebrow--gold">Page Not Found</p>
        <h1>We couldn&apos;t find that church page</h1>
        <p>
          The listing may be unavailable, unpublished, or still pending review. You can head back
          to the directory to keep exploring local churches.
        </p>
        <div className="button-row">
          <Link href="/churches" className="button button--secondary">
            Open Directory
          </Link>
          <Link href="/" className="button button--ghost">
            Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}
