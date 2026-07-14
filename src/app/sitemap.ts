import type { MetadataRoute } from "next";

import { buildEventPath } from "@/lib/event-utils";
import { buildAbsoluteUrl, buildChurchProfilePath } from "@/lib/config/site";
import { getPublishedChurches } from "@/lib/repositories/church-repository";
import { getUpcomingPublishedEvents } from "@/lib/repositories/event-repository";
import { communityHubLimits } from "@/lib/community-hub-limits";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [churches, events] = await Promise.all([
    getPublishedChurches(),
    getUpcomingPublishedEvents(communityHubLimits.sitemapEvents),
  ]);
  const baseRoutes = [
    "/",
    "/churches",
    "/events",
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

  const eventRoutes = events.map((event) => ({
    url: buildAbsoluteUrl(buildEventPath(event)),
    changeFrequency: "daily" as const,
    priority: 0.65,
  }));

  return [...baseRoutes, ...churchRoutes, ...eventRoutes];
}
