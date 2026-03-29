/**
 * Feature gates for Free vs Pro
 * Used throughout the app to check what a user can access.
 */

export const FREE_LIMITS = {
  modulesPerSemester: 2,   // max modules per semester in stundenplan
  stundenplanEntries: 4,   // max total stundenplan entries
} as const;

/**
 * Pro-only features — check these before rendering locked UI
 */
export const PRO_FEATURES = {
  scrap:          "Portal Import (Scrap)",
  aiCoach:        "KI-Coach & AI",
  unlimitedMods:  "Unbegrenzte Module",
  desktopSync:    "Desktop ↔ Web Sync",
} as const;

export type ProFeature = keyof typeof PRO_FEATURES;

/**
 * Returns true if the user can access a given feature
 */
export function canAccess(feature: ProFeature, isPro: boolean): boolean {
  switch (feature) {
    case "scrap":
    case "aiCoach":
    case "unlimitedMods":
    case "desktopSync":
      return isPro;
    default:
      return true;
  }
}
