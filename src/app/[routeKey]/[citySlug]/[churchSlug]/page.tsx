import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ChurchProfileView } from "@/components/church-profile-view";
import {
  buildChurchProfilePath,
  buildLaunchPageTitle,
  createPageMetadata,
  siteConfig,
} from "@/lib/config/site";
import { getChurchByRoute } from "@/lib/repositories/church-repository";

export const dynamic = "force-dynamic";

interface CanonicalChurchProfilePageProps {
  params: Promise<{
    routeKey: string;
    citySlug: string;
    churchSlug: string;
  }>;
}

export async function generateMetadata({
  params,
}: CanonicalChurchProfilePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const church = await getChurchByRoute({
    stateCode: resolvedParams.routeKey,
    citySlug: resolvedParams.citySlug,
    churchSlug: resolvedParams.churchSlug,
  });
  const requestedPath = `/${resolvedParams.routeKey}/${resolvedParams.citySlug}/${resolvedParams.churchSlug}`;

  if (!church) {
    return createPageMetadata({
      title: buildLaunchPageTitle("Church Profile"),
      description: "Church listing not found.",
      pathname: requestedPath,
    });
  }

  return createPageMetadata({
    title: `${church.name} | ${siteConfig.launchName}`,
    description: church.description,
    pathname: buildChurchProfilePath(church),
    imagePath: church.logoSrc ?? church.photos[0]?.src,
  });
}

export default async function CanonicalChurchProfilePage({
  params,
}: CanonicalChurchProfilePageProps) {
  const resolvedParams = await params;
  const church = await getChurchByRoute({
    stateCode: resolvedParams.routeKey,
    citySlug: resolvedParams.citySlug,
    churchSlug: resolvedParams.churchSlug,
  });

  if (!church) {
    notFound();
  }

  const canonicalPath = buildChurchProfilePath(church);
  const requestedPath = `/${resolvedParams.routeKey}/${resolvedParams.citySlug}/${resolvedParams.churchSlug}`;

  if (canonicalPath.toLowerCase() !== requestedPath.toLowerCase()) {
    redirect(canonicalPath);
  }

  return <ChurchProfileView church={church} />;
}
