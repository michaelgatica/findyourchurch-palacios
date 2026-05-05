import type { Metadata } from "next";
import { Fraunces, Work_Sans } from "next/font/google";
import Script from "next/script";
import "leaflet/dist/leaflet.css";

import { OptionalAnalytics } from "@/components/optional-analytics";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  buildLaunchHomeTitle,
  buildMetadataImageUrl,
  getSiteUrl,
  siteConfig,
} from "@/lib/config/site";

import "./globals.css";

const headingFont = Fraunces({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["600", "700"],
});

const bodyFont = Work_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: buildLaunchHomeTitle(),
  description: siteConfig.launchDescription,
  icons: {
    icon: siteConfig.brandAssets.squareLogoSrc,
  },
  openGraph: {
    title: buildLaunchHomeTitle(),
    description: siteConfig.launchDescription,
    url: getSiteUrl(),
    siteName: siteConfig.launchName,
    type: "website",
    images: [
      {
        url: buildMetadataImageUrl(),
        width: 1200,
        height: 630,
        alt: `${siteConfig.launchName} branding`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: buildLaunchHomeTitle(),
    description: siteConfig.launchDescription,
    images: [buildMetadataImageUrl()],
  },
  verification: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION
    ? {
        google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
      }
    : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>
        <Script
          id="zeffy-modal-script"
          src="https://zeffy-scripts.s3.ca-central-1.amazonaws.com/embed-form-script.min.js"
          strategy="afterInteractive"
        />
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <OptionalAnalytics />
        <div className="site-shell">
          <SiteHeader />
          <main id="main-content">{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
