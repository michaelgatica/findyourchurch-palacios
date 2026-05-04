import { notFound, redirect } from "next/navigation";

import { buildChurchClaimPath } from "@/lib/config/site";
import { getChurchBySlug } from "@/lib/repositories/church-repository";

interface LegacyChurchClaimPageProps {
  params: Promise<{
    churchSlug: string;
  }>;
}

export default async function LegacyChurchClaimPage({
  params,
}: LegacyChurchClaimPageProps) {
  const resolvedParams = await params;
  const church = await getChurchBySlug(resolvedParams.churchSlug);

  if (!church) {
    notFound();
  }

  redirect(buildChurchClaimPath(church));
}

