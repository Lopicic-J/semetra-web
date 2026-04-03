/**
 * Feature gates for Free vs Pro — Unified model
 *
 * Philosophie:
 * - Free muss nützlich genug sein um Gewohnheit zu schaffen
 * - Limits greifen bei intensiver Nutzung (Prüfungsphase, neues Semester)
 * - Pro = greifbarer Mehrwert, keine leeren Versprechen
 * - KI = Beta, free für alle (noch nicht gut genug für Pro)
 */

/* ─── Free Usage Limits ─── */
export const FREE_LIMITS = {
  // Core — begrenzt (1 Semester reicht, danach Pro nötig)
  modules: 8,                   // ~1 Semester, fürs nächste braucht man Pro
  grades: Infinity,             // Unbegrenzt — Analytics ist der Pro-Upsell
  stundenplanEntries: Infinity, // Keine künstliche Begrenzung
  tasks: Infinity,
  calendarEvents: Infinity,
  lernziele: Infinity,

  // Wissens-Tools — begrenzt
  notes: 15,
  mindMaps: 3,
  flashcardSets: 5,
  flashcardsPerSet: 30,
  brainstormSessions: 3,
  documents: 10,

  // Mathe-Raum — alle Tools zugänglich, aber mit Tageslimit
  mathDailyCalculations: 5,     // 5 Berechnungen pro Tag pro Tool

  // KI = Beta, free for all (kein Limit)

  // Analyse — das ist der echte Pro-Upsell
  gradeExport: false,           // PDF Export nur Pro
  gradePredictions: false,      // Prognosen nur Pro
  gradeTrends: false,           // Trendanalysen nur Pro
} as const;

/* ─── Pro-exclusive Features ─── */
export const PRO_FEATURES = {
  unlimitedModules:    "Unbegrenzte Module",
  unlimitedNotes:      "Unbegrenzte Notizen",
  unlimitedMindMaps:   "Unbegrenzte Mind Maps",
  unlimitedFlashcards: "Unbegrenzte Karteikarten",
  unlimitedBrainstorm: "Unbegrenztes Brainstorming",
  unlimitedDocs:       "Unbegrenzte Dokumente",
  unlimitedMath:       "Mathe-Raum unbegrenzt",
  gradeAnalytics:      "Notenprognosen & Trends",
  gradeExport:         "Semester-Report Export",
  desktopSync:         "Desktop ↔ Web Sync",
  fhImportAll:         "Alle Studiengang-Module importieren",
  spacedRepetition:    "Smart Spaced Repetition",
  studyPlanGenerator:  "Lernplan-Generator",
  themes:              "Benutzerdefinierte Themes",
  prioritySupport:     "Prioritäts-Support",
} as const;

export type ProFeature = keyof typeof PRO_FEATURES;

/* ─── Limit check helpers ─── */

/** Check if a specific feature is accessible */
export function canAccess(feature: ProFeature, isPro: boolean): boolean {
  return isPro;
}

/** Check if user is within free usage limit for countable resources */
export function withinFreeLimit(
  limitKey: keyof Pick<typeof FREE_LIMITS,
    "modules" | "notes" | "mindMaps" | "flashcardSets" | "brainstormSessions" | "documents"
  >,
  currentCount: number,
  isPro: boolean
): { allowed: boolean; current: number; max: number; remaining: number } {
  if (isPro) {
    return { allowed: true, current: currentCount, max: Infinity, remaining: Infinity };
  }
  const max = FREE_LIMITS[limitKey] as number;
  return {
    allowed: currentCount < max,
    current: currentCount,
    max,
    remaining: Math.max(0, max - currentCount),
  };
}

/** Check math tool daily usage (stored in localStorage) */
export function mathUsageToday(toolId: string, isPro: boolean): {
  allowed: boolean;
  used: number;
  max: number;
} {
  if (isPro) return { allowed: true, used: 0, max: Infinity };

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const key = `semetra_math_${toolId}_${today}`;

  if (typeof window === "undefined") return { allowed: true, used: 0, max: FREE_LIMITS.mathDailyCalculations };

  const used = parseInt(localStorage.getItem(key) ?? "0", 10);
  return {
    allowed: used < FREE_LIMITS.mathDailyCalculations,
    used,
    max: FREE_LIMITS.mathDailyCalculations,
  };
}

/** Increment math tool daily usage counter */
export function mathUsageIncrement(toolId: string): void {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  const key = `semetra_math_${toolId}_${today}`;
  const used = parseInt(localStorage.getItem(key) ?? "0", 10);
  localStorage.setItem(key, String(used + 1));
}
