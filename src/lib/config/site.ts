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
  launchDescription:
    "Find Your Church Palacios helps residents, visitors, and families discover local churches, view service times, and connect with church communities in the Palacios area.",
  directoryDescription:
    "Browse published church listings in Palacios, Texas, compare service times, and connect with local church communities.",
  launchVision:
    "Palacios is our first local launch. Our long-term vision is to help more communities make local church information easy to find, accurate, and accessible.",
  donationDescription:
    "Find Your Church Palacios is offered as a donation-supported ministry project. Many church directory and ministry technology platforms charge monthly or yearly fees for enhanced listings, directory tools, or visibility. Our desire is different: we do not want cost to keep a church from being searchable, visible, and easy to connect with.",
  donationFollowup:
    "If your church is able to support this work with a donation, it would be deeply appreciated and will help us continue serving churches and expanding this ministry. If your church is unable to give at this time, we completely understand. Your church can still be listed. We believe God will provide through those who are able.",
  brandColors: {
    deepGreen: "#0B4A24",
    darkGreen: "#06381C",
    gold: "#D9A21B",
    softGold: "#E3B437",
    white: "#FFFFFF",
    lightBackground: "#F7F5EF",
  },
  contactEmail: "support@findyourchurchpalacios.org",
  donationEmbedFormPath: "/embed/donation-form/helping-churches-reach-people-through-technology",
} as const;

const defaultOpenGraphImagePath = "/assets/logos/find-your-church-palacios-512.png";
const defaultZeffyHost = "https://www.zeffy.com";

function getOptionalPublicEnvVar(name: string) {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function areDonationsEnabled() {
  const rawValue = process.env.NEXT_PUBLIC_ENABLE_DONATIONS?.trim().toLowerCase();
  return rawValue !== "false" && rawValue !== "0" && rawValue !== "no" && rawValue !== "off";
}

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

export function buildMetadataImageUrl(imagePath = defaultOpenGraphImagePath) {
  if (/^https?:\/\//i.test(imagePath)) {
    return imagePath;
  }

  return buildAbsoluteUrl(imagePath);
}

export function getDonationUrl() {
  if (!areDonationsEnabled()) {
    return null;
  }

  const configuredDonationUrl = getOptionalPublicEnvVar("NEXT_PUBLIC_DONATION_URL");

  if (configuredDonationUrl) {
    return configuredDonationUrl;
  }

  const donationEmbedUrl = getDonationEmbedUrl();

  if (!donationEmbedUrl) {
    return null;
  }

  return `${donationEmbedUrl}?modal=true`;
}

export function getDonationEmbedFormPath() {
  if (!areDonationsEnabled()) {
    return null;
  }

  return getOptionalPublicEnvVar("NEXT_PUBLIC_ZEFFY_FORM_PATH") ?? siteConfig.donationEmbedFormPath;
}

export function getDonationEmbedUrl() {
  const donationEmbedFormPath = getDonationEmbedFormPath();

  if (!donationEmbedFormPath) {
    return null;
  }

  if (/^https?:\/\//i.test(donationEmbedFormPath)) {
    return donationEmbedFormPath;
  }

  return `${defaultZeffyHost}${donationEmbedFormPath}`;
}

export function getGoogleAnalyticsMeasurementId() {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() || null;
}

export function getGoogleSiteVerificationToken() {
  return process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION?.trim() || null;
}

export function buildChurchProfilePath(churchSlug: string) {
  // TODO: Expand this helper for state/city scoped URLs in Phase 2.
  return `/churches/${churchSlug}`;
}

export function buildChurchClaimPath(churchSlug: string) {
  return `${buildChurchProfilePath(churchSlug)}/claim`;
}

export function createPageMetadata({
  title,
  description,
  pathname = "/",
  imagePath,
  noIndex = false,
}: {
  title: string;
  description: string;
  pathname?: string;
  imagePath?: string;
  noIndex?: boolean;
}): Metadata {
  const resolvedImageUrl = buildMetadataImageUrl(imagePath);

  return {
    title,
    description,
    alternates: {
      canonical: pathname,
    },
    robots: noIndex
      ? {
          index: false,
          follow: false,
        }
      : undefined,
    openGraph: {
      title,
      description,
      url: buildAbsoluteUrl(pathname),
      siteName: siteConfig.launchName,
      type: "website",
      images: [
        {
          url: resolvedImageUrl,
          width: 1200,
          height: 630,
          alt: `${siteConfig.launchName} branding`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [resolvedImageUrl],
    },
  };
}
