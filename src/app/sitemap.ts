import type { MetadataRoute } from "next";

import { buildAbsoluteUrl, buildChurchProfilePath } from "@/lib/config/site";
import { getPublishedChurches } from "@/lib/repositories/church-repository";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const churches = await getPublishedChurches();
  const baseRoutes = [
    "/",
    "/churches",
    "/submit",
    "/about",
    "/contact",
    "/privacy",
    "/terms",
    "/listing-guidelines",
  ].map((pathname) => ({
    url: buildAbsoluteUrl(pathname),
    changeFrequency: "weekly" as const,
    priority: pathname === "/" ? 1 : 0.8,
  }));

  const churchRoutes = churches.map((church) => ({
    url: buildAbsoluteUrl(buildChurchProfilePath(church)),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...baseRoutes, ...churchRoutes];
}
