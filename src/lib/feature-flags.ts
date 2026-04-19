/**
 * Feature flags — toggle institutional-specific features.
 *
 * When INSTITUTIONAL_FEATURES is `false` (default), Semetra runs as a pure
 * consumer product: no institution selection during signup, no institution-
 * scoped community/connect, no auto-import from institution catalogs.
 *
 * Flip this on via `NEXT_PUBLIC_INSTITUTIONAL_FEATURES=true` once Semetra
 * has verified institutional partnerships.
 */
export const INSTITUTIONAL_FEATURES =
  process.env.NEXT_PUBLIC_INSTITUTIONAL_FEATURES === "true";

/** Sidebar "Verwaltung" / Builder section — only for verified institution admins. */
export const BUILDER_NAV_ENABLED = INSTITUTIONAL_FEATURES;

/** Registration: show institution email detection + dropdown. */
export const REGISTRATION_INSTITUTION_FIELDS = INSTITUTIONAL_FEATURES;

/** Onboarding: auto-import modules from user's institution catalog. */
export const ONBOARDING_INSTITUTION_AUTO_IMPORT = INSTITUTIONAL_FEATURES;

/** Community feed: scope visible members to user's institution. */
export const COMMUNITY_INSTITUTION_SCOPED = INSTITUTIONAL_FEATURES;

/** Connect peer-discovery: match on institution membership. */
export const CONNECT_INSTITUTION_MATCHING = INSTITUTIONAL_FEATURES;
