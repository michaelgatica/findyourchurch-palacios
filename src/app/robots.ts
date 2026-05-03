import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/config/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/churches", "/submit", "/about", "/contact", "/privacy", "/terms", "/listing-guidelines"],
        disallow: ["/admin/", "/portal/", "/submit/confirmation"],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
