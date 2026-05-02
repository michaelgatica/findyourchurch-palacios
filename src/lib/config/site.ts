import type { Metadata } from "next";

export const siteConfig = {
  projectName: "Find Your Church",
  launchName: "Find Your Church Palacios",
  ministryName: "El Roi Digital Ministries",
  launchCity: "Palacios",
  launchState: "Texas",
  launchStateCode: "TX",
  launchCounty: "Matagorda County",
  organizationDescription:
    "Find Your Church is a ministry project powered by El Roi Digital Ministries.",
  brandColors: {
    deepGreen: "#0B4A24",
    darkGreen: "#06381C",
    gold: "#D9A21B",
    softGold: "#E3B437",
    white: "#FFFFFF",
    lightBackground: "#F7F5EF",
  },
  contactEmail: "connect@findyourchurchpalacios.org",
} as const;

export function getSiteUrl() {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (!configuredSiteUrl) {
    return "http://localhost:3000";
  }

  return configuredSiteUrl.replace(/\/$/, "");
}

export function buildAbsoluteUrl(pathname = "/") {
  const safePath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${getSiteUrl()}${safePath}`;
}

export function buildChurchProfilePath(churchSlug: string) {
  // TODO: Expand this helper for state/city scoped URLs in Phase 2.
  return `/churches/${churchSlug}`;
}

export function createPageMetadata({
  title,
  description,
  pathname = "/",
}: {
  title: string;
  description: string;
  pathname?: string;
}): Metadata {
  return {
    title,
    description,
    alternates: {
      canonical: pathname,
    },
    openGraph: {
      title,
      description,
      url: buildAbsoluteUrl(pathname),
      siteName: siteConfig.launchName,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
