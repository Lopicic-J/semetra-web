/**
 * Umami Analytics Script — Cookie-free, GDPR-compliant analytics.
 *
 * Only loads if NEXT_PUBLIC_UMAMI_WEBSITE_ID and NEXT_PUBLIC_UMAMI_URL are set.
 * Falls back gracefully to Supabase-only tracking if not configured.
 */

import Script from "next/script";

export default function UmamiScript() {
  const websiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  const umamiUrl = process.env.NEXT_PUBLIC_UMAMI_URL;

  if (!websiteId || !umamiUrl) return null;

  return (
    <Script
      async
      defer
      src={`${umamiUrl}/script.js`}
      data-website-id={websiteId}
      strategy="afterInteractive"
    />
  );
}
