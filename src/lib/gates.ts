/**
 * Feature gates for Free vs Pro
 * Used throughout the app to check what a user can access.
 */

export const FREE_LIMITS = {
  modulesPerSemester: 2,   // max modules per semester
  totalModules: 6,         // max total modules across all semesters
  stundenplanEntries: 4,   // max total stundenplan entries
  grades: 3,               // max grades total
} as const;

/**
 * Pro-only features — check these before rendering locked UI
 */
export const PRO_FEATURES = {
  aiCoach:        "KI-Coach & AI",
  unlimitedMods:  "Unbegrenzte Module",
  desktopSync:    "Desktop ↔ Web Sync",
  fhImport:       "FH-Voreinstellungen Import",
  unlimitedGrades: "Unbegrenzte Noten",
  unlimitedPlan:  "Unbegrenzter Stundenplan",
} as const;

export type ProFeature = keyof typeof PRO_FEATURES;

/**
 * Returns true if the user can access a given feature
 */
export function canAccess(feature: ProFeature, isPro: boolean): boolean {
  if (isPro) return true;
  switch (feature) {
    case "aiCoach":
    case "unlimitedMods":
    case "desktopSync":
    case "fhImport":
    case "unlimitedGrades":
    case "unlimitedPlan":
      return false;
    default:
      return true;
  }
}
