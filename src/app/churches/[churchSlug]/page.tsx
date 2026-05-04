import { notFound, redirect } from "next/navigation";

import { buildChurchProfilePath } from "@/lib/config/site";
import { getChurchBySlug } from "@/lib/repositories/church-repository";

interface LegacyChurchProfilePageProps {
  params: Promise<{
    churchSlug: string;
  }>;
}

export default async function LegacyChurchProfilePage({
  params,
}: LegacyChurchProfilePageProps) {
  const resolvedParams = await params;
  const church = await getChurchBySlug(resolvedParams.churchSlug);

  if (!church) {
    notFound();
  }

  redirect(buildChurchProfilePath(church));
}

