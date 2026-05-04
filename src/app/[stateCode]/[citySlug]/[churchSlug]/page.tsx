import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { ChurchProfileView } from "@/components/church-profile-view";
import { buildChurchProfilePath, createPageMetadata } from "@/lib/config/site";
import { getPublishedChurches, getChurchByRoute } from "@/lib/repositories/church-repository";

interface CanonicalChurchProfilePageProps {
  params: Promise<{
    stateCode: string;
    citySlug: string;
    churchSlug: string;
  }>;
}

export async function generateStaticParams() {
  const churches = await getPublishedChurches();

  return churches.map((church) => {
    const path = buildChurchProfilePath(church).split("/").filter(Boolean);

    return {
      stateCode: path[0],
      citySlug: path[1],
      churchSlug: path[2],
    };
  });
}

export async function generateMetadata({
  params,
}: CanonicalChurchProfilePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const church = await getChurchByRoute(resolvedParams);
  const requestedPath = `/${resolvedParams.stateCode}/${resolvedParams.citySlug}/${resolvedParams.churchSlug}`;

  if (!church) {
    return createPageMetadata({
      title: "Church Profile | Find Your Church Palacios",
      description: "Church listing not found.",
      pathname: requestedPath,
    });
  }

  return createPageMetadata({
    title: `${church.name} | Find Your Church Palacios`,
    description: church.description,
    pathname: buildChurchProfilePath(church),
    imagePath: church.logoSrc ?? church.photos[0]?.src,
  });
}

export default async function CanonicalChurchProfilePage({
  params,
}: CanonicalChurchProfilePageProps) {
  const resolvedParams = await params;
  const church = await getChurchByRoute(resolvedParams);

  if (!church) {
    notFound();
  }

  const canonicalPath = buildChurchProfilePath(church);
  const requestedPath = `/${resolvedParams.stateCode}/${resolvedParams.citySlug}/${resolvedParams.churchSlug}`;

  if (canonicalPath.toLowerCase() !== requestedPath.toLowerCase()) {
    redirect(canonicalPath);
  }

  return <ChurchProfileView church={church} />;
}
