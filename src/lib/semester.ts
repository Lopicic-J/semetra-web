/**
 * Semester Utilities
 *
 * Swiss university semester system:
 *   HS (Herbstsemester) = ~Sep 15 – Feb 15
 *   FS (Frühlingssemester) = ~Feb 16 – Sep 14
 *
 * Auto-detection of current semester period and transition logic.
 */

export type SemesterType = "HS" | "FS";

export interface SemesterInfo {
  type: SemesterType;
  label: string;          // e.g. "HS 2025/26" or "FS 2026"
  year: number;           // Academic year start
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
}

/**
 * Determine the current semester period based on date.
 */
export function getCurrentSemester(date: Date = new Date()): SemesterInfo {
  const month = date.getMonth() + 1; // 1-based
  const day = date.getDate();
  const year = date.getFullYear();

  // FS: Feb 16 – Sep 14
  const isFS =
    (month === 2 && day >= 16) ||
    (month >= 3 && month <= 8) ||
    (month === 9 && day <= 14);

  if (isFS) {
    return {
      type: "FS",
      label: `FS ${year}`,
      year,
      startDate: `${year}-02-16`,
      endDate: `${year}-09-14`,
    };
  }

  // HS: Sep 15 – Feb 15 (spans year boundary)
  const hsStartYear = month >= 9 ? year : year - 1;
  const hsEndYear = hsStartYear + 1;
  return {
    type: "HS",
    label: `HS ${hsStartYear}/${String(hsEndYear).slice(2)}`,
    year: hsStartYear,
    startDate: `${hsStartYear}-09-15`,
    endDate: `${hsEndYear}-02-15`,
  };
}

/**
 * Determine the next semester after the current one.
 */
export function getNextSemester(current: SemesterInfo): SemesterInfo {
  if (current.type === "HS") {
    const nextYear = current.year + 1;
    return {
      type: "FS",
      label: `FS ${nextYear}`,
      year: nextYear,
      startDate: `${nextYear}-02-16`,
      endDate: `${nextYear}-09-14`,
    };
  }
  // FS → HS
  return {
    type: "HS",
    label: `HS ${current.year}/${String(current.year + 1).slice(2)}`,
    year: current.year,
    startDate: `${current.year}-09-15`,
    endDate: `${current.year + 1}-02-15`,
  };
}

/**
 * Check if a semester transition is due.
 * Returns the new semester info if the user should transition,
 * or null if no transition is needed.
 */
export function checkSemesterTransition(
  currentSemesterNumber: number | null,
  lastSemesterType: SemesterType | null,
  date: Date = new Date()
): { newSemester: SemesterInfo; newSemesterNumber: number } | null {
  if (!currentSemesterNumber) return null;

  const now = getCurrentSemester(date);

  // If we know the last type and it's the same as current → no transition
  if (lastSemesterType === now.type) return null;

  // If we don't know the last type, this is the first check → store current, no transition
  if (!lastSemesterType) return null;

  // Type changed → transition!
  return {
    newSemester: now,
    newSemesterNumber: currentSemesterNumber + 1,
  };
}

/**
 * Determine whether the transition window is active.
 * The window is the first 2 weeks of a new semester period.
 */
export function isInTransitionWindow(date: Date = new Date()): boolean {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // FS starts Feb 16 → window Feb 16 – Mar 1
  if (month === 2 && day >= 16) return true;
  if (month === 3 && day <= 1) return true;

  // HS starts Sep 15 → window Sep 15 – Sep 30
  if (month === 9 && day >= 15) return true;

  return false;
}
