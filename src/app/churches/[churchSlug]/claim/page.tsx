import { notFound } from "next/navigation";

import { ChurchClaimRequestForm } from "@/components/church-claim-request-form";
import { buildChurchClaimPath, createPageMetadata } from "@/lib/config/site";
import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import { getChurchBySlug } from "@/lib/repositories/church-repository";

interface ChurchClaimPageProps {
  params: Promise<{
    churchSlug: string;
  }>;
}

export async function generateMetadata({
  params,
}: ChurchClaimPageProps) {
  const resolvedParams = await params;
  const church = await getChurchBySlug(resolvedParams.churchSlug);

  if (!church) {
    return createPageMetadata({
      title: "Claim This Church | Find Your Church Palacios",
      description: "Church listing not found.",
      pathname: buildChurchClaimPath(resolvedParams.churchSlug),
    });
  }

  return createPageMetadata({
    title: `Claim ${church.name} | Find Your Church Palacios`,
    description:
      "Request access to help keep this church listing updated on Find Your Church Palacios.",
    pathname: buildChurchClaimPath(church.slug),
  });
}

export default async function ChurchClaimPage({ params }: ChurchClaimPageProps) {
  const resolvedParams = await params;
  const [church, authenticatedUser] = await Promise.all([
    getChurchBySlug(resolvedParams.churchSlug),
    getServerAuthenticatedUserFromSessionCookie(),
  ]);

  if (!church) {
    notFound();
  }

  return (
    <section className="shell page-section">
      <div className="page-intro page-intro--narrow">
        <p className="eyebrow eyebrow--gold">Claim This Church</p>
        <h1>Request listing access for {church.name}</h1>
        <p>
          Are you a pastor, staff member, or authorized representative? Submit a request so we can
          review your connection to the church and help keep this listing accurate.
        </p>
      </div>

      <ChurchClaimRequestForm
        churchId={church.id}
        churchName={church.name}
        churchSlug={church.slug}
        initialAuthenticatedUser={authenticatedUser}
      />
    </section>
  );
}
