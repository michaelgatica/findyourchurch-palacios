import type { MetadataRoute } from "next";

import { getSiteUrl } from "@/lib/config/site";
import { isProductionAppEnvironment } from "@/lib/app-environment";

export default function robots(): MetadataRoute.Robots {
  if (!isProductionAppEnvironment()) {
    return {
      rules: [{ userAgent: "*", disallow: "/" }],
      sitemap: `${getSiteUrl()}/sitemap.xml`,
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/churches", "/submit", "/about", "/contact", "/privacy", "/terms", "/listing-guidelines"],
        disallow: [
          "/admin/",
          "/portal/",
          "/registrations/",
          "/submit/confirmation",
          "/events/*/register/confirmation",
        ],
      },
    ],
    sitemap: `${getSiteUrl()}/sitemap.xml`,
  };
}
