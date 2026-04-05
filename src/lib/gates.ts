/**
 * Feature gates for Free vs Pro Basic vs Pro Full vs Lifetime — Semetra Pricing Model v3
 *
 * Modell:
 * 🟢 Free          — Basis-Tools, 3 KI-Requests/Tag (client-side)
 * 🔵 Pro Basic     — 4.90 CHF/Mo, alle Features, 10 KI-Requests/Monat
 * 🟣 Pro Full      — 9.90 CHF/Mo, alle Features, 100 KI-Requests/Monat
 * 🏆 Lifetime Basic — 89.90 CHF einmalig, alle Features OHNE KI (Add-on möglich)
 * 🏆 Lifetime Full  — 129.90 CHF einmalig, alle Features + 20 KI/Monat
 * ➕ Add-on        — +200 KI-Requests für 6.90 CHF (nur aktueller Monat, verfällt!)
 *
 * KI-Kosten werden server-seitig getrackt (Supabase ai_usage Tabelle).
 * Free-Tier nutzt zusätzlich localStorage als Soft-Limit (client-seitig).
 */

export type PlanTier = "basic" | "full";

/* ─── AI Pool Constants ─── */
export const AI_POOL = {
  /** Free: monthly limit (soft, via localStorage) */
  freeMonthlyLimit: 3,
  /** Pro Basic: monthly pool included */
  proBasicMonthlyPool: 10,
  /** Pro Full: monthly pool included */
  proFullMonthlyPool: 100,
  /** Lifetime Full: monthly pool included */
  lifetimeFullMonthlyPool: 20,
  /** Lifetime Basic: no pool */
  lifetimeBasicMonthlyPool: 0,
  /** Add-on: extra credits per purchase (monthly, expires!) */
  addonCredits: 200,
  /** Add-on price in CHF */
  addonPrice: 6.9,
} as const;

/* ─── Free Usage Limits ─── */
export const FREE_LIMITS = {
  // Core — begrenzt
  modules: 3,
  grades: Infinity,
  stundenplanEntries: Infinity,
  tasks: Infinity,
  calendarEvents: Infinity,
  lernziele: Infinity,

  // Wissens-Tools — begrenzt
  notes: 10,
  mindMaps: 2,
  flashcardSets: 3,
  flashcardsPerSet: 20,
  brainstormSessions: 2,
  documents: 5,

  // Mathe-Raum — Tageslimit (zählt zum KI-Pool bei Pro)
  mathDailyCalculations: 3,

  // KI — Free: 3/Monat (localStorage), Pro: aus Pool
  aiMonthlyFree: 3,

  // Analyse — Pro-Upsell
  gradeExport: false,
  gradePredictions: false,
  gradeTrends: false,
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
  aiAssistant:         "KI-Lernassistent",
  themes:              "Benutzerdefinierte Themes",
  prioritySupport:     "Prioritäts-Support",
} as const;

export type ProFeature = keyof typeof PRO_FEATURES;

/* ─── Limit check helpers ─── */

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

/** Check math tool daily usage (localStorage — Free only, Pro uses server pool) */
export function mathUsageToday(toolId: string, isPro: boolean): {
  allowed: boolean;
  used: number;
  max: number;
} {
  if (isPro) return { allowed: true, used: 0, max: Infinity };

  const today = new Date().toISOString().slice(0, 10);
  const key = `semetra_math_${toolId}_${today}`;

  if (typeof window === "undefined") return { allowed: true, used: 0, max: FREE_LIMITS.mathDailyCalculations };

  const used = parseInt(localStorage.getItem(key) ?? "0", 10);
  return {
    allowed: used < FREE_LIMITS.mathDailyCalculations,
    used,
    max: FREE_LIMITS.mathDailyCalculations,
  };
}

/** Get current month key for localStorage (YYYY-MM) */
function currentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Check AI monthly usage — Free tier (localStorage soft limit) */
export function aiUsageThisMonth(isPro: boolean): {
  allowed: boolean;
  used: number;
  max: number;
  remaining: number;
} {
  // Pro users are checked server-side via AI pool — always allow on client
  if (isPro) return { allowed: true, used: 0, max: 999, remaining: 999 };

  const month = currentMonthKey();
  const key = `semetra_ai_usage_${month}`;

  if (typeof window === "undefined") return { allowed: true, used: 0, max: FREE_LIMITS.aiMonthlyFree, remaining: FREE_LIMITS.aiMonthlyFree };

  const used = parseInt(localStorage.getItem(key) ?? "0", 10);
  return {
    allowed: used < FREE_LIMITS.aiMonthlyFree,
    used,
    max: FREE_LIMITS.aiMonthlyFree,
    remaining: Math.max(0, FREE_LIMITS.aiMonthlyFree - used),
  };
}

/** Increment AI monthly usage counter (Free tier — localStorage) */
export function aiUsageIncrement(): void {
  if (typeof window === "undefined") return;
  const month = currentMonthKey();
  const key = `semetra_ai_usage_${month}`;
  const used = parseInt(localStorage.getItem(key) ?? "0", 10);
  localStorage.setItem(key, String(used + 1));
}

/** Increment math tool daily usage counter */
export function mathUsageIncrement(toolId: string): void {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  const key = `semetra_math_${toolId}_${today}`;
  const used = parseInt(localStorage.getItem(key) ?? "0", 10);
  localStorage.setItem(key, String(used + 1));
}

/**
 * Determine the monthly AI pool for a user based on their plan.
 */
export function getMonthlyAiPool(
  isPro: boolean,
  isLifetime: boolean,
  planTier: PlanTier | null,
  hasActiveSubscription: boolean,
): number {
  if (hasActiveSubscription) {
    return planTier === "full" ? AI_POOL.proFullMonthlyPool : AI_POOL.proBasicMonthlyPool;
  }
  if (isLifetime) {
    return planTier === "full" ? AI_POOL.lifetimeFullMonthlyPool : AI_POOL.lifetimeBasicMonthlyPool;
  }
  return 0; // Free
}

/**
 * Check if user has AI access.
 * - Free: limited daily (client-side)
 * - Pro Basic: 10/month pool
 * - Pro Full: 100/month pool
 * - Lifetime Basic: ONLY via add-on credits
 * - Lifetime Full: 20/month pool + add-on
 */
export function hasAiAccess(
  isPro: boolean,
  isLifetime: boolean,
  planTier: PlanTier | null,
  aiCredits: number,
): boolean {
  if (!isPro && !isLifetime) return true; // Free — limited daily, checked elsewhere
  if (isLifetime && planTier === "basic" && !isPro) return aiCredits > 0;
  return true; // Pro or Lifetime Full — has pool
}
