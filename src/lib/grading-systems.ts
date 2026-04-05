/**
 * Grading system definitions — Maximum Edition
 *
 * Supports 17 countries with full grade scale metadata.
 * Each system defines scale, pass threshold, labels, colors,
 * credit system, and display helpers.
 *
 * Architecture:
 *   - This file provides CLIENT-SIDE grade display logic (labels, colors, formatting)
 *   - The academic engine (@/lib/academic) provides CALCULATION logic
 *   - The database (grade_scales, grade_bands, etc.) is the source of truth
 *   - This file acts as a fast, offline-capable cache of the most common scales
 */

export type CountryCode =
  | "CH" | "DE" | "AT" | "FR" | "IT" | "NL" | "ES" | "UK"
  | "US" | "SE" | "PL" | "CZ" | "DK" | "FI" | "PT" | "BE" | "NO";

export type GradeDirection = "higher_better" | "lower_better";

export type CreditSystemLabel = "ECTS" | "CFU" | "Credits" | "CATS";

export interface GradeLabel {
  min: number;
  max: number;
  label: string;
  /** Tailwind-compatible color class for the badge */
  color: string;
  /** Short international label (A, B, C, ...) */
  shortLabel?: string;
}

export interface GradingSystem {
  country: CountryCode;
  name: string;
  flag: string;
  locale: string;
  scaleLabel: string;

  /** Numeric boundaries */
  min: number;
  max: number;
  step: number;
  passingGrade: number;
  direction: GradeDirection;

  /** Credit system info */
  usesECTS: boolean;
  creditLabel: CreditSystemLabel;
  /** Conversion factor to ECTS (e.g. 0.5 for CATS) */
  creditToEcts: number;

  /** Grade scale code (matches grade_scales.code in DB) */
  scaleCode: string;

  /** Ordered from best to worst for display */
  labels: GradeLabel[];

  inputPlaceholder: string;

  /** Whether this system supports honours/lode/distinction */
  supportsHonours: boolean;
  /** Special grade labels (e.g. "30L" = "30 e lode") */
  specialGrades?: Record<string, string>;

  // ─── Helpers ───
  isValid: (grade: number) => boolean;
  isPassing: (grade: number) => boolean;
  compare: (a: number, b: number) => number;
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
    compare: (a: number, b: number) => b - a,
    round: (g: number) => Math.round(g / sys.step) * sys.step,
  };
}

// Colors
const C = {
  best:   "text-emerald-700 bg-emerald-100",
  good:   "text-green-700 bg-green-100",
  ok:     "text-lime-700 bg-lime-100",
  pass:   "text-amber-700 bg-amber-100",
  fail:   "text-red-700 bg-red-100",
};

// ─── Country definitions ───────────────────────────────────────────

const CH: GradingSystem = {
  country: "CH", name: "Schweiz", flag: "🇨🇭", locale: "de-CH",
  scaleLabel: "1–6 (6 = beste Note)", scaleCode: "CH_1_6",
  min: 1, max: 6, step: 0.25, passingGrade: 4.0,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Note (1–6)", supportsHonours: false,
  labels: [
    { min: 5.5, max: 6.0,  label: "sehr gut",     shortLabel: "A", color: C.best },
    { min: 5.0, max: 5.49, label: "gut",           shortLabel: "B", color: C.good },
    { min: 4.5, max: 4.99, label: "befriedigend",  shortLabel: "C", color: C.ok },
    { min: 4.0, max: 4.49, label: "genügend",      shortLabel: "D", color: C.pass },
    { min: 1.0, max: 3.99, label: "ungenügend",    shortLabel: "F", color: C.fail },
  ],
  ...higherBetter({ min: 1, max: 6, step: 0.25, passingGrade: 4.0 }),
};

const DE: GradingSystem = {
  country: "DE", name: "Deutschland", flag: "🇩🇪", locale: "de-DE",
  scaleLabel: "1,0–5,0 (1,0 = beste Note)", scaleCode: "DE_1_5",
  min: 1.0, max: 5.0, step: 0.1, passingGrade: 4.0,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Note (1,0–5,0)", supportsHonours: false,
  labels: [
    { min: 1.0, max: 1.5, label: "sehr gut",       shortLabel: "1", color: C.best },
    { min: 1.6, max: 2.5, label: "gut",             shortLabel: "2", color: C.good },
    { min: 2.6, max: 3.5, label: "befriedigend",    shortLabel: "3", color: C.ok },
    { min: 3.6, max: 4.0, label: "ausreichend",     shortLabel: "4", color: C.pass },
    { min: 4.1, max: 5.0, label: "nicht bestanden", shortLabel: "5", color: C.fail },
  ],
  ...lowerBetter({ min: 1.0, max: 5.0, step: 0.1, passingGrade: 4.0 }),
};

const AT: GradingSystem = {
  country: "AT", name: "Österreich", flag: "🇦🇹", locale: "de-AT",
  scaleLabel: "1–5 (1 = beste Note)", scaleCode: "AT_1_5",
  min: 1, max: 5, step: 1, passingGrade: 4,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Note (1–5)", supportsHonours: false,
  labels: [
    { min: 1, max: 1, label: "sehr gut",       shortLabel: "1", color: C.best },
    { min: 2, max: 2, label: "gut",             shortLabel: "2", color: C.good },
    { min: 3, max: 3, label: "befriedigend",    shortLabel: "3", color: C.ok },
    { min: 4, max: 4, label: "genügend",        shortLabel: "4", color: C.pass },
    { min: 5, max: 5, label: "nicht genügend",  shortLabel: "5", color: C.fail },
  ],
  ...lowerBetter({ min: 1, max: 5, step: 1, passingGrade: 4 }),
};

const FR: GradingSystem = {
  country: "FR", name: "France", flag: "🇫🇷", locale: "fr-FR",
  scaleLabel: "0–20 (20 = meilleure note)", scaleCode: "FR_0_20",
  min: 0, max: 20, step: 0.5, passingGrade: 10,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Note (0–20)", supportsHonours: false,
  labels: [
    { min: 16, max: 20,    label: "très bien",  shortLabel: "TB", color: C.best },
    { min: 14, max: 15.99, label: "bien",        shortLabel: "B",  color: C.good },
    { min: 12, max: 13.99, label: "assez bien",  shortLabel: "AB", color: C.ok },
    { min: 10, max: 11.99, label: "passable",    shortLabel: "P",  color: C.pass },
    { min: 0,  max: 9.99,  label: "insuffisant", shortLabel: "I",  color: C.fail },
  ],
  ...higherBetter({ min: 0, max: 20, step: 0.5, passingGrade: 10 }),
};

const IT: GradingSystem = {
  country: "IT", name: "Italia", flag: "🇮🇹", locale: "it-IT",
  scaleLabel: "18–30 (30 e lode = massimo)", scaleCode: "IT_18_30_LODE",
  min: 18, max: 30, step: 1, passingGrade: 18,
  usesECTS: true, creditLabel: "CFU", creditToEcts: 1,
  inputPlaceholder: "Voto (18–30)", supportsHonours: true,
  specialGrades: { "30L": "30 e lode" },
  labels: [
    { min: 28, max: 30, label: "ottimo",      shortLabel: "A", color: C.best },
    { min: 25, max: 27, label: "buono",        shortLabel: "B", color: C.good },
    { min: 22, max: 24, label: "discreto",     shortLabel: "C", color: C.ok },
    { min: 18, max: 21, label: "sufficiente",  shortLabel: "D", color: C.pass },
  ],
  ...higherBetter({ min: 18, max: 30, step: 1, passingGrade: 18 }),
};

const NL: GradingSystem = {
  country: "NL", name: "Nederland", flag: "🇳🇱", locale: "nl-NL",
  scaleLabel: "1–10 (10 = hoogste cijfer)", scaleCode: "NL_1_10",
  min: 1, max: 10, step: 0.5, passingGrade: 5.5,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Cijfer (1–10)", supportsHonours: false,
  labels: [
    { min: 8.0,  max: 10,   label: "uitstekend",    shortLabel: "A", color: C.best },
    { min: 7.0,  max: 7.99, label: "goed",           shortLabel: "B", color: C.good },
    { min: 6.0,  max: 6.99, label: "voldoende",      shortLabel: "C", color: C.ok },
    { min: 5.5,  max: 5.99, label: "net voldoende",  shortLabel: "D", color: C.pass },
    { min: 1.0,  max: 5.49, label: "onvoldoende",    shortLabel: "F", color: C.fail },
  ],
  ...higherBetter({ min: 1, max: 10, step: 0.5, passingGrade: 5.5 }),
};

const ES: GradingSystem = {
  country: "ES", name: "España", flag: "🇪🇸", locale: "es-ES",
  scaleLabel: "0–10 (10 = mejor nota)", scaleCode: "ES_0_10",
  min: 0, max: 10, step: 0.5, passingGrade: 5.0,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Nota (0–10)", supportsHonours: true,
  specialGrades: { "MH": "matrícula de honor" },
  labels: [
    { min: 9.0,  max: 10,   label: "sobresaliente", shortLabel: "SB", color: C.best },
    { min: 7.0,  max: 8.99, label: "notable",        shortLabel: "NT", color: C.good },
    { min: 5.0,  max: 6.99, label: "aprobado",       shortLabel: "AP", color: C.ok },
    { min: 0,    max: 4.99, label: "suspenso",        shortLabel: "SS", color: C.fail },
  ],
  ...higherBetter({ min: 0, max: 10, step: 0.5, passingGrade: 5.0 }),
};

const UK: GradingSystem = {
  country: "UK", name: "United Kingdom", flag: "🇬🇧", locale: "en-GB",
  scaleLabel: "0–100% (100 = best)", scaleCode: "UK_PERCENTAGE",
  min: 0, max: 100, step: 1, passingGrade: 40,
  usesECTS: false, creditLabel: "CATS", creditToEcts: 0.5,
  inputPlaceholder: "Grade (0–100%)", supportsHonours: true,
  labels: [
    { min: 70,  max: 100, label: "First",  shortLabel: "1st",  color: C.best },
    { min: 60,  max: 69,  label: "2:1",    shortLabel: "2:1",  color: C.good },
    { min: 50,  max: 59,  label: "2:2",    shortLabel: "2:2",  color: C.ok },
    { min: 40,  max: 49,  label: "Third",  shortLabel: "3rd",  color: C.pass },
    { min: 0,   max: 39,  label: "Fail",   shortLabel: "Fail", color: C.fail },
  ],
  ...higherBetter({ min: 0, max: 100, step: 1, passingGrade: 40 }),
};

const US: GradingSystem = {
  country: "US", name: "United States", flag: "🇺🇸", locale: "en-US",
  scaleLabel: "0.0–4.0 GPA", scaleCode: "US_GPA",
  min: 0.0, max: 4.0, step: 0.1, passingGrade: 2.0,
  usesECTS: false, creditLabel: "Credits", creditToEcts: 1,
  inputPlaceholder: "GPA (0.0–4.0)", supportsHonours: true,
  labels: [
    { min: 3.7, max: 4.0,  label: "A / Excellent",  shortLabel: "A",  color: C.best },
    { min: 3.0, max: 3.69, label: "B / Good",        shortLabel: "B",  color: C.good },
    { min: 2.0, max: 2.99, label: "C / Average",     shortLabel: "C",  color: C.ok },
    { min: 1.0, max: 1.99, label: "D / Below Avg",   shortLabel: "D",  color: C.pass },
    { min: 0.0, max: 0.99, label: "F / Failing",     shortLabel: "F",  color: C.fail },
  ],
  ...higherBetter({ min: 0.0, max: 4.0, step: 0.1, passingGrade: 2.0 }),
};

const SE: GradingSystem = {
  country: "SE", name: "Sverige", flag: "🇸🇪", locale: "sv-SE",
  scaleLabel: "A–F (A = bäst)", scaleCode: "SE_A_F",
  min: 1, max: 5, step: 1, passingGrade: 3,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Betyg (1–5 → F–A)", supportsHonours: false,
  labels: [
    { min: 5, max: 5, label: "A – Utmärkt",    shortLabel: "A", color: C.best },
    { min: 4, max: 4, label: "B – Mycket bra",  shortLabel: "B", color: C.good },
    { min: 3, max: 3, label: "C – Bra",         shortLabel: "C", color: C.ok },
    { min: 2, max: 2, label: "D – Tillräcklig", shortLabel: "D", color: C.pass },
    { min: 1, max: 1, label: "F – Underkänd",   shortLabel: "F", color: C.fail },
  ],
  ...higherBetter({ min: 1, max: 5, step: 1, passingGrade: 3 }),
};

const PL: GradingSystem = {
  country: "PL", name: "Polska", flag: "🇵🇱", locale: "pl-PL",
  scaleLabel: "2–5 (5 = najlepsza)", scaleCode: "PL_2_5",
  min: 2, max: 5, step: 0.5, passingGrade: 3.0,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Ocena (2–5)", supportsHonours: false,
  labels: [
    { min: 5.0, max: 5.0, label: "bardzo dobry",     shortLabel: "5",  color: C.best },
    { min: 4.5, max: 4.5, label: "dobry plus",        shortLabel: "4+", color: C.good },
    { min: 4.0, max: 4.0, label: "dobry",             shortLabel: "4",  color: C.good },
    { min: 3.5, max: 3.5, label: "dostateczny plus",  shortLabel: "3+", color: C.ok },
    { min: 3.0, max: 3.0, label: "dostateczny",       shortLabel: "3",  color: C.pass },
    { min: 2.0, max: 2.0, label: "niedostateczny",    shortLabel: "2",  color: C.fail },
  ],
  ...higherBetter({ min: 2, max: 5, step: 0.5, passingGrade: 3.0 }),
};

const CZ: GradingSystem = {
  country: "CZ", name: "Česko", flag: "🇨🇿", locale: "cs-CZ",
  scaleLabel: "1–4 (1 = nejlepší)", scaleCode: "CZ_1_4",
  min: 1, max: 4, step: 1, passingGrade: 3,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Známka (1–4)", supportsHonours: false,
  labels: [
    { min: 1, max: 1, label: "výborně",      shortLabel: "A", color: C.best },
    { min: 2, max: 2, label: "velmi dobře",   shortLabel: "B", color: C.good },
    { min: 3, max: 3, label: "dobře",         shortLabel: "C", color: C.pass },
    { min: 4, max: 4, label: "nevyhověl/a",   shortLabel: "F", color: C.fail },
  ],
  ...lowerBetter({ min: 1, max: 4, step: 1, passingGrade: 3 }),
};

const DK: GradingSystem = {
  country: "DK", name: "Danmark", flag: "🇩🇰", locale: "da-DK",
  scaleLabel: "−3 til 12 (12 = bedst)", scaleCode: "DK_M3_12",
  min: -3, max: 12, step: 1, passingGrade: 2,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Karakter (−3 til 12)", supportsHonours: false,
  labels: [
    { min: 12, max: 12, label: "fremragende",     shortLabel: "12", color: C.best },
    { min: 10, max: 10, label: "fortrinlig",       shortLabel: "10", color: C.good },
    { min: 7,  max: 7,  label: "god",              shortLabel: "7",  color: C.ok },
    { min: 4,  max: 4,  label: "jævn",             shortLabel: "4",  color: C.ok },
    { min: 2,  max: 2,  label: "tilstrækkelig",    shortLabel: "02", color: C.pass },
    { min: 0,  max: 0,  label: "utilstrækkelig",   shortLabel: "00", color: C.fail },
    { min: -3, max: -3, label: "uacceptabel",      shortLabel: "-3", color: C.fail },
  ],
  ...higherBetter({ min: -3, max: 12, step: 1, passingGrade: 2 }),
};

const FI: GradingSystem = {
  country: "FI", name: "Suomi", flag: "🇫🇮", locale: "fi-FI",
  scaleLabel: "0–5 (5 = paras)", scaleCode: "FI_0_5",
  min: 0, max: 5, step: 1, passingGrade: 1,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Arvosana (0–5)", supportsHonours: false,
  labels: [
    { min: 5, max: 5, label: "erinomainen",  shortLabel: "5", color: C.best },
    { min: 4, max: 4, label: "kiitettävä",   shortLabel: "4", color: C.good },
    { min: 3, max: 3, label: "hyvä",         shortLabel: "3", color: C.ok },
    { min: 2, max: 2, label: "tyydyttävä",   shortLabel: "2", color: C.pass },
    { min: 1, max: 1, label: "välttävä",     shortLabel: "1", color: C.pass },
    { min: 0, max: 0, label: "hylätty",      shortLabel: "0", color: C.fail },
  ],
  ...higherBetter({ min: 0, max: 5, step: 1, passingGrade: 1 }),
};

const PT: GradingSystem = {
  country: "PT", name: "Portugal", flag: "🇵🇹", locale: "pt-PT",
  scaleLabel: "0–20 (20 = melhor)", scaleCode: "PT_0_20",
  min: 0, max: 20, step: 1, passingGrade: 10,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Nota (0–20)", supportsHonours: false,
  labels: [
    { min: 18, max: 20, label: "excelente",    shortLabel: "A", color: C.best },
    { min: 16, max: 17, label: "muito bom",     shortLabel: "B", color: C.good },
    { min: 14, max: 15, label: "bom",           shortLabel: "C", color: C.ok },
    { min: 10, max: 13, label: "suficiente",    shortLabel: "D", color: C.pass },
    { min: 0,  max: 9,  label: "insuficiente",  shortLabel: "F", color: C.fail },
  ],
  ...higherBetter({ min: 0, max: 20, step: 1, passingGrade: 10 }),
};

const BE: GradingSystem = {
  country: "BE", name: "Belgique / België", flag: "🇧🇪", locale: "fr-BE",
  scaleLabel: "0–20 (20 = meilleur)", scaleCode: "BE_0_20",
  min: 0, max: 20, step: 1, passingGrade: 10,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Note (0–20)", supportsHonours: true,
  labels: [
    { min: 16, max: 20, label: "la plus grande distinction", shortLabel: "A", color: C.best },
    { min: 14, max: 15, label: "grande distinction",         shortLabel: "B", color: C.good },
    { min: 12, max: 13, label: "distinction",                shortLabel: "C", color: C.ok },
    { min: 10, max: 11, label: "satisfaisant",               shortLabel: "D", color: C.pass },
    { min: 0,  max: 9,  label: "échec",                      shortLabel: "F", color: C.fail },
  ],
  ...higherBetter({ min: 0, max: 20, step: 1, passingGrade: 10 }),
};

const NO: GradingSystem = {
  country: "NO", name: "Norge", flag: "🇳🇴", locale: "nb-NO",
  scaleLabel: "A–F (A = best)", scaleCode: "NO_A_F",
  min: 1, max: 5, step: 1, passingGrade: 1,
  usesECTS: true, creditLabel: "ECTS", creditToEcts: 1,
  inputPlaceholder: "Karakter (1–5 → E–A)", supportsHonours: false,
  labels: [
    { min: 5, max: 5, label: "A – Fremragende",   shortLabel: "A", color: C.best },
    { min: 4, max: 4, label: "B – Meget god",     shortLabel: "B", color: C.good },
    { min: 3, max: 3, label: "C – God",           shortLabel: "C", color: C.ok },
    { min: 2, max: 2, label: "D – Nokså god",     shortLabel: "D", color: C.pass },
    { min: 1, max: 1, label: "E – Tilstrekkelig", shortLabel: "E", color: C.pass },
  ],
  ...higherBetter({ min: 1, max: 5, step: 1, passingGrade: 1 }),
};

// ─── Registry ──────────────────────────────────────────────────────

export const GRADING_SYSTEMS: Record<CountryCode, GradingSystem> = {
  CH, DE, AT, FR, IT, NL, ES, UK, US, SE, PL, CZ, DK, FI, PT, BE, NO,
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
  { code: "US", name: "United States",     flag: US.flag },
  { code: "SE", name: "Sverige",           flag: SE.flag },
  { code: "PL", name: "Polska",            flag: PL.flag },
  { code: "CZ", name: "Česko",             flag: CZ.flag },
  { code: "DK", name: "Danmark",           flag: DK.flag },
  { code: "FI", name: "Suomi",             flag: FI.flag },
  { code: "PT", name: "Portugal",          flag: PT.flag },
  { code: "BE", name: "Belgique / België", flag: BE.flag },
  { code: "NO", name: "Norge",             flag: NO.flag },
];

/** Default grading system if none selected */
export const DEFAULT_COUNTRY: CountryCode = "CH";

// ─── Public helpers ────────────────────────────────────────────────

export function getGradingSystem(country?: CountryCode | null): GradingSystem {
  return GRADING_SYSTEMS[country ?? DEFAULT_COUNTRY] ?? GRADING_SYSTEMS[DEFAULT_COUNTRY];
}

export function getGradeLabel(grade: number, country?: CountryCode | null): GradeLabel | null {
  const sys = getGradingSystem(country);
  return sys.labels.find(l => grade >= l.min && grade <= l.max) ?? null;
}

export function getGradeColor(grade: number, country?: CountryCode | null): string {
  const label = getGradeLabel(grade, country);
  if (!label) return "text-surface-500";
  return label.color.split(" ")[0];
}

export function getGradeLabelText(grade: number, country?: CountryCode | null): string {
  const label = getGradeLabel(grade, country);
  return label?.label ?? "";
}

export function formatGrade(grade: number, country?: CountryCode | null): string {
  const sys = getGradingSystem(country);
  const rounded = sys.round(grade);
  const decimals = sys.step < 1 ? (sys.step <= 0.1 ? 1 : Math.ceil(-Math.log10(sys.step))) : 0;
  return rounded.toLocaleString(sys.locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Quick normalization to 0-100 for comparison purposes.
 * For full normalization with confidence tracking, use the academic engine.
 */
export function quickNormalize(grade: number, country?: CountryCode | null): number {
  const sys = getGradingSystem(country);
  if (sys.direction === "higher_better") {
    return ((grade - sys.min) / (sys.max - sys.min)) * 100;
  }
  return ((sys.max - grade) / (sys.max - sys.min)) * 100;
}

/**
 * Get the credit system label and conversion info for a country.
 */
export function getCreditInfo(country?: CountryCode | null): {
  label: CreditSystemLabel;
  toEcts: number;
  perYear: number;
} {
  const sys = getGradingSystem(country);
  const perYear = sys.creditToEcts === 1 ? 60 : (sys.creditLabel === "CATS" ? 120 : 60);
  return { label: sys.creditLabel, toEcts: sys.creditToEcts, perYear };
}
