"use client";

import { useState } from "react";

import Script from "next/script";

import { getDonationEmbedFormPath, getDonationEmbedUrl } from "@/lib/config/site";

interface DonationSupportEmbedProps {
  title?: string;
}

export function DonationSupportEmbed({
  title = "Donation form powered by Zeffy",
}: DonationSupportEmbedProps) {
  const [showFallback, setShowFallback] = useState(false);
  const donationEmbedFormPath = getDonationEmbedFormPath();
  const donationEmbedUrl = getDonationEmbedUrl();

  if (!donationEmbedFormPath || !donationEmbedUrl) {
    return null;
  }

  return (
    <div className="zeffy-embed">
      <div data-zeffy-embed data-form-url={donationEmbedFormPath}></div>

      <div
        data-zeffy-embed-fallback
        className={`zeffy-embed__fallback${showFallback ? " zeffy-embed__fallback--visible" : ""}`}
      >
        <div className="zeffy-embed__frame">
          <iframe
            title={title}
            src={donationEmbedUrl}
            className="zeffy-embed__iframe"
            loading="lazy"
            allow="payment"
          />
        </div>
      </div>

      <noscript>
        <div className="zeffy-embed__fallback zeffy-embed__fallback--visible">
          <div className="zeffy-embed__frame">
            <iframe
              title={title}
              src={donationEmbedUrl}
              className="zeffy-embed__iframe"
              loading="lazy"
            />
          </div>
        </div>
      </noscript>

      <Script
        id="zeffy-embed-script"
        src="https://www.zeffy.com/embed/v2/zeffy-embed.js"
        strategy="afterInteractive"
        onError={() => setShowFallback(true)}
      />
    </div>
  );
}
