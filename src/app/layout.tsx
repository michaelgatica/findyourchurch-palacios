import type { Metadata } from "next";
import { Libre_Baskerville, Poppins, Source_Sans_3 } from "next/font/google";
import Script from "next/script";
import "leaflet/dist/leaflet.css";

import { OptionalAnalytics } from "@/components/optional-analytics";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import {
  buildLaunchHomeTitle,
  buildMetadataImageUrl,
  areDonationsEnabled,
  getSiteUrl,
  siteConfig,
} from "@/lib/config/site";
import { isProductionAppEnvironment } from "@/lib/app-environment";

import "./globals.css";
import "./premium.css";

const headingFont = Poppins({
  subsets: ["latin"],
  variable: "--font-heading",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const displayFont = Libre_Baskerville({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: buildLaunchHomeTitle(),
  description: siteConfig.launchDescription,
  icons: {
    icon: siteConfig.brandAssets.squareLogoSrc,
  },
  robots: isProductionAppEnvironment()
    ? undefined
    : {
        index: false,
        follow: false,
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
        width: 512,
        height: 512,
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
  const donationsEnabled = areDonationsEnabled();

  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${headingFont.variable} ${bodyFont.variable}`}>
        {donationsEnabled ? (
          <Script
            id="zeffy-modal-script"
            src="https://zeffy-scripts.s3.ca-central-1.amazonaws.com/embed-form-script.min.js"
            strategy="afterInteractive"
          />
        ) : null}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <OptionalAnalytics />
        <div className="site-shell">
          <SiteHeader />
          <main id="main-content" tabIndex={-1}>{children}</main>
          <SiteFooter />
        </div>
      </body>
    </html>
  );
}
