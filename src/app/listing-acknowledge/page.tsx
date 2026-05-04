import Link from "next/link";

import { buildChurchProfilePath, createPageMetadata } from "@/lib/config/site";
import { acknowledgeChurchListingByToken } from "@/lib/services/listing-verification-service";

export const metadata = createPageMetadata({
  title: "Listing Confirmation | Find Your Church Palacios",
  description: "Confirm that a church listing is still active on Find Your Church Palacios.",
  pathname: "/listing-acknowledge",
  noIndex: true,
});

interface ListingAcknowledgePageProps {
  searchParams: Promise<{
    token?: string;
  }>;
}

export default async function ListingAcknowledgePage({
  searchParams,
}: ListingAcknowledgePageProps) {
  const resolvedSearchParams = await searchParams;
  const token = resolvedSearchParams.token?.trim() ?? "";
  const result = token
    ? await acknowledgeChurchListingByToken(token)
    : { status: "invalid" as const, church: null };

  if (result.status === "acknowledged" && result.church) {
    return (
      <section className="shell page-section">
        <div className="info-card info-card--soft">
          <p className="eyebrow eyebrow--gold">Listing confirmed</p>
          <h1>Thank you for confirming {result.church.name}</h1>
          <p>
            We marked this church listing as active so it can remain visible in the public
            directory.
          </p>
          <div className="button-row">
            <Link
              href={buildChurchProfilePath(result.church)}
              className="button button--primary"
            >
              View church listing
            </Link>
            <Link href="/portal/login" className="button button--ghost">
              Sign in to manage listing
            </Link>
          </div>
        </div>
      </section>
    );
  }

  if (result.status === "archived") {
    return (
      <section className="shell page-section">
        <div className="info-card info-card--soft">
          <p className="eyebrow eyebrow--gold">Listing archived</p>
          <h1>This confirmation link is no longer active</h1>
          <p>
            This church listing has already been archived from the public directory. If the church
            is still active, please contact us so we can help restore the listing.
          </p>
          <div className="button-row">
            <Link href="/contact" className="button button--primary">
              Contact us
            </Link>
            <Link href="/churches" className="button button--ghost">
              Browse churches
            </Link>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="shell page-section">
      <div className="info-card info-card--soft">
        <p className="eyebrow eyebrow--gold">Link unavailable</p>
        <h1>This listing confirmation link could not be used</h1>
        <p>
          The link may be missing, expired, or already replaced. If you need help confirming a
          listing, please contact us and we will gladly assist you.
        </p>
        <div className="button-row">
          <Link href="/contact" className="button button--primary">
            Contact us
          </Link>
          <Link href="/churches" className="button button--ghost">
            Browse churches
          </Link>
        </div>
      </div>
    </section>
  );
}
