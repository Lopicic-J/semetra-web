/**
 * Grading system definitions for European countries.
 *
 * Each system defines the grade scale, pass threshold, labels, colors,
 * and display helpers so the entire app can adapt dynamically.
 */

export type CountryCode =
  | "CH" | "DE" | "AT" | "FR" | "IT" | "NL" | "ES" | "UK";

/** Whether higher numbers are better (CH, FR, IT, NL, ES, UK) or lower (DE, AT). */
export type GradeDirection = "higher_better" | "lower_better";

export interface GradeLabel {
  /** Lower bound (inclusive) of the range for this label. */
  min: number;
  /** Upper bound (inclusive). */
  max: number;
  label: string;
  /** Tailwind-compatible color class for the badge. */
  color: string;
}

export interface GradingSystem {
  country: CountryCode;
  /** Display name, e.g. "Schweiz" */
  name: string;
  /** Flag emoji */
  flag: string;
  /** Language hint for date/number formatting */
  locale: string;
  /** Full name of the grading scale, e.g. "1–6 (6 = best)" */
  scaleLabel: string;

  /** Numeric boundaries */
  min: number;
  max: number;
  /** Step size for the grade input (e.g. 0.25 for CH) */
  step: number;
  /** Grade at or above/below which a module counts as passed */
  passingGrade: number;
  direction: GradeDirection;

  /** Whether the system uses ECTS credits (most of Europe) */
  usesECTS: boolean;
  /** Alternative credit label if not ECTS, e.g. "CFU" for Italy */
  creditLabel: string;

  /** Ordered from best to worst for display. */
  labels: GradeLabel[];

  /** Placeholder text for the grade input field */
  inputPlaceholder: string;
  /** Validation helper: returns true if the grade value is within the valid range */
  isValid: (grade: number) => boolean;
  /** Returns true if the given grade counts as passed */
  isPassing: (grade: number) => boolean;
  /** Compare two grades: returns positive if a is better than b */
  compare: (a: number, b: number) => number;
  /** Round a grade to the system's step increment */
  round: (grade: number) => number;
}

// ─── Helper factories ──────────────────────────────────────────────

function higherBetter(sys: { min: number; max: number; step: number; passingGrade: number }) {
  return {
    direction: "higher_better" as const,
    isValid: (g: number) => g >= sys.min && g <= sys.max,
    isPassing: (g: number) => g >= sys.passingGrade,
    compare: (a: number, b: number) => a - b,
    round: (g: number) => Math.round(g / sys.step) * sys.step,
  };
}

function lowerBetter(sys: { min: number; max: number; step: number; passingGrade: number }) {
  return {
    direction: "lower_better" as const,
    isValid: (g: number) => g >= sys.min && g <= sys.max,
    isPassing: (g: number) => g <= sys.passingGrade,
    compare: (a: number, b: number) => b - a, // lower is better
    round: (g: number) => Math.round(g / sys.step) * sys.step,
  };
}

// ─── Country definitions ───────────────────────────────────────────

const CH: GradingSystem = {
  country: "CH",
  name: "Schweiz",
  flag: "\u{1F1E8}\u{1F1ED}",
  locale: "de-CH",
  scaleLabel: "1–6 (6 = beste Note)",
  min: 1, max: 6, step: 0.25, passingGrade: 4.0,
  usesECTS: true, creditLabel: "ECTS",
  inputPlaceholder: "Note (1–6)",
  labels: [
    { min: 5.5, max: 6.0,  label: "sehr gut",     color: "text-emerald-700 bg-emerald-100" },
    { min: 5.0, max: 5.49, label: "gut",           color: "text-green-700 bg-green-100" },
    { min: 4.5, max: 4.99, label: "befriedigend",  color: "text-lime-700 bg-lime-100" },
    { min: 4.0, max: 4.49, label: "genügend",      color: "text-amber-700 bg-amber-100" },
    { min: 1.0, max: 3.99, label: "ungenügend",    color: "text-red-700 bg-red-100" },
  ],
  ...higherBetter({ min: 1, max: 6, step: 0.25, passingGrade: 4.0 }),
};

const DE: GradingSystem = {
  country: "DE",
  name: "Deutschland",
  flag: "\u{1F1E9}\u{1F1EA}",
  locale: "de-DE",
  scaleLabel: "1,0–5,0 (1,0 = beste Note)",
  min: 1.0, max: 5.0, step: 0.1, passingGrade: 4.0,
  usesECTS: true, creditLabel: "ECTS",
  inputPlaceholder: "Note (1,0–5,0)",
  labels: [
    { min: 1.0, max: 1.5, label: "sehr gut",       color: "text-emerald-700 bg-emerald-100" },
    { min: 1.6, max: 2.5, label: "gut",             color: "text-green-700 bg-green-100" },
    { min: 2.6, max: 3.5, label: "befriedigend",    color: "text-lime-700 bg-lime-100" },
    { min: 3.6, max: 4.0, label: "ausreichend",     color: "text-amber-700 bg-amber-100" },
    { min: 4.1, max: 5.0, label: "nicht bestanden", color: "text-red-700 bg-red-100" },
  ],
  ...lowerBetter({ min: 1.0, max: 5.0, step: 0.1, passingGrade: 4.0 }),
};

const AT: GradingSystem = {
  country: "AT",
  name: "Österreich",
  flag: "\u{1F1E6}\u{1F1F9}",
  locale: "de-AT",
  scaleLabel: "1–5 (1 = beste Note)",
  min: 1, max: 5, step: 1, passingGrade: 4,
  usesECTS: true, creditLabel: "ECTS",
  inputPlaceholder: "Note (1–5)",
  labels: [
    { min: 1, max: 1, label: "sehr gut",       color: "text-emerald-700 bg-emerald-100" },
    { min: 2, max: 2, label: "gut",             color: "text-green-700 bg-green-100" },
    { min: 3, max: 3, label: "befriedigend",    color: "text-lime-700 bg-lime-100" },
    { min: 4, max: 4, label: "genügend",        color: "text-amber-700 bg-amber-100" },
    { min: 5, max: 5, label: "nicht genügend",  color: "text-red-700 bg-red-100" },
  ],
  ...lowerBetter({ min: 1, max: 5, step: 1, passingGrade: 4 }),
};

const FR: GradingSystem = {
  country: "FR",
  name: "France",
  flag: "\u{1F1EB}\u{1F1F7}",
  locale: "fr-FR",
  scaleLabel: "0–20 (20 = meilleure note)",
  min: 0, max: 20, step: 0.5, passingGrade: 10,
  usesECTS: true, creditLabel: "ECTS",
  inputPlaceholder: "Note (0–20)",
  labels: [
    { min: 16, max: 20,   label: "très bien",       color: "text-emerald-700 bg-emerald-100" },
    { min: 14, max: 15.99, label: "bien",            color: "text-green-700 bg-green-100" },
    { min: 12, max: 13.99, label: "assez bien",      color: "text-lime-700 bg-lime-100" },
    { min: 10, max: 11.99, label: "passable",        color: "text-amber-700 bg-amber-100" },
    { min: 0,  max: 9.99,  label: "insuffisant",     color: "text-red-700 bg-red-100" },
  ],
  ...higherBetter({ min: 0, max: 20, step: 0.5, passingGrade: 10 }),
};

const IT: GradingSystem = {
  country: "IT",
  name: "Italia",
  flag: "\u{1F1EE}\u{1F1F9}",
  locale: "it-IT",
  scaleLabel: "18–30 (30 e lode = massimo)",
  min: 18, max: 30, step: 1, passingGrade: 18,
  usesECTS: true, creditLabel: "CFU",
  inputPlaceholder: "Voto (18–30)",
  labels: [
    { min: 28, max: 30, label: "ottimo",      color: "text-emerald-700 bg-emerald-100" },
    { min: 25, max: 27, label: "buono",        color: "text-green-700 bg-green-100" },
    { min: 22, max: 24, label: "discreto",     color: "text-lime-700 bg-lime-100" },
    { min: 18, max: 21, label: "sufficiente",  color: "text-amber-700 bg-amber-100" },
  ],
  ...higherBetter({ min: 18, max: 30, step: 1, passingGrade: 18 }),
};

const NL: GradingSystem = {
  country: "NL",
  name: "Nederland",
  flag: "\u{1F1F3}\u{1F1F1}",
  locale: "nl-NL",
  scaleLabel: "1–10 (10 = hoogste cijfer)",
  min: 1, max: 10, step: 0.5, passingGrade: 5.5,
  usesECTS: true, creditLabel: "ECTS",
  inputPlaceholder: "Cijfer (1–10)",
  labels: [
    { min: 8.0,  max: 10,   label: "uitstekend",    color: "text-emerald-700 bg-emerald-100" },
    { min: 7.0,  max: 7.99, label: "goed",           color: "text-green-700 bg-green-100" },
    { min: 6.0,  max: 6.99, label: "voldoende",      color: "text-lime-700 bg-lime-100" },
    { min: 5.5,  max: 5.99, label: "net voldoende",  color: "text-amber-700 bg-amber-100" },
    { min: 1.0,  max: 5.49, label: "onvoldoende",    color: "text-red-700 bg-red-100" },
  ],
  ...higherBetter({ min: 1, max: 10, step: 0.5, passingGrade: 5.5 }),
};

const ES: GradingSystem = {
  country: "ES",
  name: "España",
  flag: "\u{1F1EA}\u{1F1F8}",
  locale: "es-ES",
  scaleLabel: "0–10 (10 = mejor nota)",
  min: 0, max: 10, step: 0.5, passingGrade: 5.0,
  usesECTS: true, creditLabel: "ECTS",
  inputPlaceholder: "Nota (0–10)",
  labels: [
    { min: 9.0,  max: 10,   label: "sobresaliente",   color: "text-emerald-700 bg-emerald-100" },
    { min: 7.0,  max: 8.99, label: "notable",          color: "text-green-700 bg-green-100" },
    { min: 5.0,  max: 6.99, label: "aprobado",         color: "text-lime-700 bg-lime-100" },
    { min: 0,    max: 4.99, label: "suspenso",          color: "text-red-700 bg-red-100" },
  ],
  ...higherBetter({ min: 0, max: 10, step: 0.5, passingGrade: 5.0 }),
};

const UK: GradingSystem = {
  country: "UK",
  name: "United Kingdom",
  flag: "\u{1F1EC}\u{1F1E7}",
  locale: "en-GB",
  scaleLabel: "0–100% (100 = best)",
  min: 0, max: 100, step: 1, passingGrade: 40,
  usesECTS: false, creditLabel: "Credits",
  inputPlaceholder: "Grade (0–100%)",
  labels: [
    { min: 70,  max: 100, label: "First",     color: "text-emerald-700 bg-emerald-100" },
    { min: 60,  max: 69,  label: "2:1",       color: "text-green-700 bg-green-100" },
    { min: 50,  max: 59,  label: "2:2",       color: "text-lime-700 bg-lime-100" },
    { min: 40,  max: 49,  label: "Third",     color: "text-amber-700 bg-amber-100" },
    { min: 0,   max: 39,  label: "Fail",      color: "text-red-700 bg-red-100" },
  ],
  ...higherBetter({ min: 0, max: 100, step: 1, passingGrade: 40 }),
};

// ─── Registry ──────────────────────────────────────────────────────

export const GRADING_SYSTEMS: Record<CountryCode, GradingSystem> = {
  CH, DE, AT, FR, IT, NL, ES, UK,
};

/** Ordered for the country selector UI */
export const COUNTRY_LIST: { code: CountryCode; name: string; flag: string }[] = [
  { code: "CH", name: "Schweiz",           flag: CH.flag },
  { code: "DE", name: "Deutschland",       flag: DE.flag },
  { code: "AT", name: "Österreich",        flag: AT.flag },
  { code: "FR", name: "France",            flag: FR.flag },
  { code: "IT", name: "Italia",            flag: IT.flag },
  { code: "NL", name: "Nederland",         flag: NL.flag },
  { code: "ES", name: "España",            flag: ES.flag },
  { code: "UK", name: "United Kingdom",    flag: UK.flag },
];

/** Default grading system if none selected */
export const DEFAULT_COUNTRY: CountryCode = "CH";

// ─── Public helpers ────────────────────────────────────────────────

export function getGradingSystem(country?: CountryCode | null): GradingSystem {
  return GRADING_SYSTEMS[country ?? DEFAULT_COUNTRY] ?? GRADING_SYSTEMS[DEFAULT_COUNTRY];
}

/** Get the label object for a given grade in a given system */
export function getGradeLabel(grade: number, country?: CountryCode | null): GradeLabel | null {
  const sys = getGradingSystem(country);
  return sys.labels.find(l => grade >= l.min && grade <= l.max) ?? null;
}

/** Get just the text color class for a grade (for inline text styling) */
export function getGradeColor(grade: number, country?: CountryCode | null): string {
  const label = getGradeLabel(grade, country);
  if (!label) return "text-surface-500";
  // Extract just the text-xxx class from "text-xxx-700 bg-xxx-100"
  return label.color.split(" ")[0];
}

/** Get the label text (e.g. "sehr gut", "gut") for a grade */
export function getGradeLabelText(grade: number, country?: CountryCode | null): string {
  const label = getGradeLabel(grade, country);
  return label?.label ?? "";
}

/** Format a grade for display, respecting the system's locale */
export function formatGrade(grade: number, country?: CountryCode | null): string {
  const sys = getGradingSystem(country);
  const rounded = sys.round(grade);
  // Show decimals only when the step is less than 1
  const decimals = sys.step < 1 ? (sys.step <= 0.1 ? 1 : Math.ceil(-Math.log10(sys.step))) : 0;
  return rounded.toLocaleString(sys.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}
