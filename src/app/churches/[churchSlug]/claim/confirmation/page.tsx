import Link from "next/link";

import { createPageMetadata } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: "Claim Request Received | Find Your Church Palacios",
  description:
    "Your church claim request has been received and is awaiting review by Find Your Church Palacios.",
  pathname: "/churches/claim/confirmation",
  noIndex: true,
});

interface ChurchClaimConfirmationPageProps {
  searchParams: Promise<{
    church?: string;
  }>;
}

export default async function ChurchClaimConfirmationPage({
  searchParams,
}: ChurchClaimConfirmationPageProps) {
  const resolvedSearchParams = await searchParams;
  const churchName = resolvedSearchParams.church ?? "this church";

  return (
    <section className="shell page-section">
      <div className="confirmation-card">
        <p className="eyebrow eyebrow--gold">Claim Request Received</p>
        <h1>Your request for {churchName} has been received</h1>
        <p>
          Your request has been received. Please allow up to 24 hours for review.
        </p>
        <p className="supporting-text">
          We may follow up if we need any clarification before linking you to the church listing.
        </p>

        <div className="button-row">
          <Link href="/churches" className="button button--secondary">
            Browse Churches
          </Link>
          <Link href="/" className="button button--ghost">
            Back to Home
          </Link>
        </div>
      </div>
    </section>
  );
}
