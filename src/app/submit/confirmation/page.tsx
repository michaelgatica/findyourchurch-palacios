import Link from "next/link";

import { createPageMetadata } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: "Submission Received | Find Your Church Palacios",
  description:
    "Your church submission has been received and is awaiting review by Find Your Church Palacios.",
  pathname: "/submit/confirmation",
  noIndex: true,
});

interface SubmissionConfirmationPageProps {
  searchParams: Promise<{
    church?: string;
  }>;
}

export default async function SubmissionConfirmationPage({
  searchParams,
}: SubmissionConfirmationPageProps) {
  const resolvedSearchParams = await searchParams;
  const churchName = resolvedSearchParams.church ?? "your church";

  return (
    <section className="shell page-section">
      <div className="confirmation-card">
        <p className="eyebrow eyebrow--gold">Submission Received</p>
        <h1>Thank you for submitting {churchName}</h1>
        <p>
          Thank you for submitting your church to Find Your Church Palacios. We received your
          listing and will review it for accuracy before publishing. Please allow up to 24 hours
          for approval.
        </p>
        <p className="supporting-text">
          If we need any clarification or edits, we will contact you by email.
        </p>

        <div className="button-row">
          <Link href="/churches" className="button button--secondary">
            Browse Churches
          </Link>
          <Link href="/submit" className="button button--ghost">
            Submit another listing
          </Link>
        </div>
      </div>
    </section>
  );
}
