/**
 * Feiertags-Kalender — CH / DE / AT
 *
 * Berechnet gesetzliche Feiertage algorithmisch (kein DB nötig).
 * Ostern wird via Gauss-Algorithmus berechnet, alle beweglichen
 * Feiertage leiten sich daraus ab.
 *
 * Usage:
 *   import { getHolidays, isHoliday } from "@/lib/holidays";
 *   const holidays = getHolidays(2026, "CH");
 *   const today = isHoliday("2026-12-25", "CH"); // { name: "Weihnachten", ... }
 */

export type HolidayCountry = "CH" | "DE" | "AT";

export interface Holiday {
  date: string;       // YYYY-MM-DD
  name: string;       // German name
  nameEn: string;     // English name
  country: HolidayCountry[];
}

// ── Easter (Gauss Algorithm) ───────────────────────────────────────────────

function computeEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function fmt(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// ── Holiday Definitions ────────────────────────────────────────────────────

/**
 * Returns all public holidays for a given year and country.
 * Includes only nationally recognized holidays.
 */
export function getHolidays(year: number, country: HolidayCountry = "CH"): Holiday[] {
  const easter = computeEasterSunday(year);

  // All possible holidays with country applicability
  const all: Holiday[] = [
    // ── Fixed holidays ──
    {
      date: `${year}-01-01`,
      name: "Neujahr",
      nameEn: "New Year's Day",
      country: ["CH", "DE", "AT"],
    },
    {
      date: `${year}-01-02`,
      name: "Berchtoldstag",
      nameEn: "Berchtold's Day",
      country: ["CH"],
    },
    {
      date: `${year}-01-06`,
      name: "Heilige Drei Könige",
      nameEn: "Epiphany",
      country: ["AT"],
    },
    {
      date: `${year}-03-19`,
      name: "Josefstag",
      nameEn: "St. Joseph's Day",
      country: ["AT"],
    },
    {
      date: `${year}-05-01`,
      name: "Tag der Arbeit",
      nameEn: "Labour Day",
      country: ["DE", "AT"],
    },
    {
      date: `${year}-08-01`,
      name: "Bundesfeiertag",
      nameEn: "Swiss National Day",
      country: ["CH"],
    },
    {
      date: `${year}-08-15`,
      name: "Mariä Himmelfahrt",
      nameEn: "Assumption Day",
      country: ["AT"],
    },
    {
      date: `${year}-10-03`,
      name: "Tag der Deutschen Einheit",
      nameEn: "German Unity Day",
      country: ["DE"],
    },
    {
      date: `${year}-10-26`,
      name: "Nationalfeiertag",
      nameEn: "Austrian National Day",
      country: ["AT"],
    },
    {
      date: `${year}-11-01`,
      name: "Allerheiligen",
      nameEn: "All Saints' Day",
      country: ["AT"],
    },
    {
      date: `${year}-12-08`,
      name: "Mariä Empfängnis",
      nameEn: "Immaculate Conception",
      country: ["AT"],
    },
    {
      date: `${year}-12-25`,
      name: "Weihnachten",
      nameEn: "Christmas Day",
      country: ["CH", "DE", "AT"],
    },
    {
      date: `${year}-12-26`,
      name: "Stephanstag",
      nameEn: "St. Stephen's Day",
      country: ["CH", "DE", "AT"],
    },

    // ── Easter-based (moveable) holidays ──
    {
      date: fmt(addDays(easter, -2)),
      name: "Karfreitag",
      nameEn: "Good Friday",
      country: ["CH", "DE"],
    },
    {
      date: fmt(easter),
      name: "Ostersonntag",
      nameEn: "Easter Sunday",
      country: ["CH", "DE", "AT"],
    },
    {
      date: fmt(addDays(easter, 1)),
      name: "Ostermontag",
      nameEn: "Easter Monday",
      country: ["CH", "DE", "AT"],
    },
    {
      date: fmt(addDays(easter, 39)),
      name: "Auffahrt",
      nameEn: "Ascension Day",
      country: ["CH", "DE", "AT"],
    },
    {
      date: fmt(addDays(easter, 49)),
      name: "Pfingstsonntag",
      nameEn: "Whit Sunday",
      country: ["CH", "DE", "AT"],
    },
    {
      date: fmt(addDays(easter, 50)),
      name: "Pfingstmontag",
      nameEn: "Whit Monday",
      country: ["CH", "DE", "AT"],
    },
    {
      date: fmt(addDays(easter, 60)),
      name: "Fronleichnam",
      nameEn: "Corpus Christi",
      country: ["AT"],
    },
  ];

  return all.filter((h) => h.country.includes(country));
}

// ── Lookup helpers ─────────────────────────────────────────────────────────

/** Cache: year-country → Map<date, Holiday> */
const cache = new Map<string, Map<string, Holiday>>();

function getHolidayMap(year: number, country: HolidayCountry): Map<string, Holiday> {
  const key = `${year}-${country}`;
  if (!cache.has(key)) {
    const map = new Map<string, Holiday>();
    for (const h of getHolidays(year, country)) {
      map.set(h.date, h);
    }
    cache.set(key, map);
  }
  return cache.get(key)!;
}

/**
 * Check if a specific date is a holiday.
 * Returns the Holiday object or null.
 */
export function isHoliday(dateStr: string, country: HolidayCountry = "CH"): Holiday | null {
  const year = parseInt(dateStr.slice(0, 4), 10);
  return getHolidayMap(year, country).get(dateStr) ?? null;
}

/**
 * Get all holidays in a date range (inclusive).
 */
export function getHolidaysInRange(
  startDate: string,
  endDate: string,
  country: HolidayCountry = "CH"
): Holiday[] {
  const startYear = parseInt(startDate.slice(0, 4), 10);
  const endYear = parseInt(endDate.slice(0, 4), 10);

  const results: Holiday[] = [];
  for (let y = startYear; y <= endYear; y++) {
    for (const h of getHolidays(y, country)) {
      if (h.date >= startDate && h.date <= endDate) {
        results.push(h);
      }
    }
  }
  return results;
}
