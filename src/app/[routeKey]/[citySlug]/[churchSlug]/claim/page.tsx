import { notFound, redirect } from "next/navigation";

import { ChurchClaimRequestForm } from "@/components/church-claim-request-form";
import {
  buildChurchClaimPath,
  createPageMetadata,
  siteConfig,
} from "@/lib/config/site";
import { getServerAuthenticatedUserFromSessionCookie } from "@/lib/firebase/session";
import { getChurchByRoute } from "@/lib/repositories/church-repository";

export const dynamic = "force-dynamic";

interface CanonicalChurchClaimPageProps {
  params: Promise<{
    routeKey: string;
    citySlug: string;
    churchSlug: string;
  }>;
}

export async function generateMetadata({
  params,
}: CanonicalChurchClaimPageProps) {
  const resolvedParams = await params;
  const church = await getChurchByRoute({
    stateCode: resolvedParams.routeKey,
    citySlug: resolvedParams.citySlug,
    churchSlug: resolvedParams.churchSlug,
  });
  const requestedPath = `/${resolvedParams.routeKey}/${resolvedParams.citySlug}/${resolvedParams.churchSlug}/claim`;

  if (!church) {
    notFound();
  }

  return createPageMetadata({
    title: `Claim ${church.name} | ${siteConfig.launchName}`,
    description: `Request access to help keep this church listing updated on ${siteConfig.launchName}.`,
    pathname: buildChurchClaimPath(church),
  });
}

export default async function CanonicalChurchClaimPage({
  params,
}: CanonicalChurchClaimPageProps) {
  const resolvedParams = await params;
  const [church, authenticatedUser] = await Promise.all([
    getChurchByRoute({
      stateCode: resolvedParams.routeKey,
      citySlug: resolvedParams.citySlug,
      churchSlug: resolvedParams.churchSlug,
    }),
    getServerAuthenticatedUserFromSessionCookie(),
  ]);

  if (!church) {
    notFound();
  }

  const canonicalPath = buildChurchClaimPath(church);
  const requestedPath = `/${resolvedParams.routeKey}/${resolvedParams.citySlug}/${resolvedParams.churchSlug}/claim`;

  if (canonicalPath.toLowerCase() !== requestedPath.toLowerCase()) {
    redirect(canonicalPath);
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
