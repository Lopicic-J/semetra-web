/**
 * Robots.txt — Controls search engine crawling
 *
 * Allows crawling of public pages, blocks dashboard/API routes.
 */

import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/register", "/pricing", "/verify/"],
        disallow: [
          "/dashboard/",
          "/api/",
          "/onboarding/",
          "/settings/",
          "/modules/",
          "/tasks/",
          "/timer/",
          "/ai-assistant/",
          "/groups/",
          "/stundenplan/",
          "/lernnachweis/",
          "/lern-dna/",
          "/calendar/",
          "/notes/",
        ],
      },
    ],
    sitemap: "https://app.semetra.ch/sitemap.xml",
  };
}
