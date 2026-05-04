import { notFound, redirect } from "next/navigation";

import { buildChurchProfilePath, isReservedChurchShareSlug } from "@/lib/config/site";
import { getChurchByCustomShareSlug } from "@/lib/repositories/church-repository";

interface ChurchShareRedirectPageProps {
  params: Promise<{
    shareSlug: string;
  }>;
}

export default async function ChurchShareRedirectPage({
  params,
}: ChurchShareRedirectPageProps) {
  const resolvedParams = await params;

  if (isReservedChurchShareSlug(resolvedParams.shareSlug)) {
    notFound();
  }

  const church = await getChurchByCustomShareSlug(resolvedParams.shareSlug);

  if (!church) {
    notFound();
  }

  redirect(buildChurchProfilePath(church));
}
