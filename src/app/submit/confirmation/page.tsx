import Link from "next/link";

import { buildLaunchPageTitle, createPageMetadata, siteConfig } from "@/lib/config/site";

export const metadata = createPageMetadata({
  title: buildLaunchPageTitle("Submission Received"),
  description: `Your church submission has been received and is awaiting review by ${siteConfig.launchName}.`,
  pathname: "/submit/confirmation",
  noIndex: true,
});

interface SubmissionConfirmationPageProps {
  searchParams: Promise<{
    church?: string;
    account?: string;
  }>;
}

export default async function SubmissionConfirmationPage({
  searchParams,
}: SubmissionConfirmationPageProps) {
  const resolvedSearchParams = await searchParams;
  const churchName = resolvedSearchParams.church ?? "your church";
  const managerAccountCreated = resolvedSearchParams.account === "created";

  return (
    <section className="shell page-section">
      <div className="confirmation-card">
        <p className="eyebrow eyebrow--gold">Submission Received</p>
        <h1>Thank you for submitting {churchName}</h1>
        <p>
          Thank you for submitting your church to {siteConfig.launchName}. We received your
          listing and will review it for accuracy before publishing. Please allow up to 24 hours
          for approval.
        </p>
        <p className="supporting-text">
          If we need any clarification or edits, we will contact you by email.
        </p>
        {managerAccountCreated ? (
          <p className="supporting-text">
            We also created your Find Your Church account. Once the listing is approved, that
            account can be connected as the church&apos;s listing manager so you can sign in and
            keep the page updated.
          </p>
        ) : null}

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
