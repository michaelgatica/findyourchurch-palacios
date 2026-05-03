import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChurchProfileView } from "@/components/church-profile-view";
import { buildChurchProfilePath, createPageMetadata } from "@/lib/config/site";
import {
  getChurchBySlug,
  getPublishedChurches,
} from "@/lib/repositories/church-repository";

interface ChurchProfilePageProps {
  params: Promise<{
    churchSlug: string;
  }>;
}

export async function generateStaticParams() {
  const churches = await getPublishedChurches();

  return churches.map((church) => ({
    churchSlug: church.slug,
  }));
}

export async function generateMetadata({
  params,
}: ChurchProfilePageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const church = await getChurchBySlug(resolvedParams.churchSlug);

  if (!church) {
    return createPageMetadata({
      title: "Church Profile | Find Your Church Palacios",
      description: "Church listing not found.",
      pathname: buildChurchProfilePath(resolvedParams.churchSlug),
    });
  }

  return createPageMetadata({
    title: `${church.name} | Find Your Church Palacios`,
    description: church.description,
    pathname: buildChurchProfilePath(church.slug),
    imagePath: church.logoSrc ?? church.photos[0]?.src,
  });
}

export default async function ChurchProfilePage({ params }: ChurchProfilePageProps) {
  const resolvedParams = await params;
  const church = await getChurchBySlug(resolvedParams.churchSlug);

  if (!church) {
    notFound();
  }

  return <ChurchProfileView church={church} />;
}
