import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export function gradeColor(grade: number): string {
  if (grade >= 5.5) return "text-green-600";   // sehr gut
  if (grade >= 5.0) return "text-emerald-600"; // gut
  if (grade >= 4.5) return "text-blue-600";    // befriedigend
  if (grade >= 4.0) return "text-sky-600";     // genügend
  if (grade >= 3.5) return "text-amber-600";   // knapp ungenügend
  return "text-red-600";                       // ungenügend
}

/** Grade label for Swiss system */
export function gradeLabel(grade: number): string {
  if (grade >= 5.5) return "sehr gut";
  if (grade >= 5.0) return "gut";
  if (grade >= 4.5) return "befriedigend";
  if (grade >= 4.0) return "genügend";
  return "ungenügend";
}

/** Round to nearest 0.25 (Swiss standard) */
export function roundGrade(grade: number): number {
  return Math.round(grade * 4) / 4;
}

/** Weighted average of sub-grades within a module (weight field) */
export function gradeAvg(grades: { grade: number | null; weight?: number | null }[]): number {
  const valid = grades.filter((g): g is typeof g & { grade: number } => g.grade !== null);
  if (!valid.length) return 0;
  const totalWeight = valid.reduce((s, g) => s + (g.weight ?? 1), 0);
  const weighted = valid.reduce((s, g) => s + g.grade * (g.weight ?? 1), 0);
  return totalWeight > 0 ? weighted / totalWeight : 0;
}

/** ECTS-weighted average across modules (official GPA) */
export function ectsWeightedAvg(
  moduleGrades: { grade: number; ects: number }[]
): number {
  const valid = moduleGrades.filter(m => m.ects > 0);
  if (!valid.length) return 0;
  const totalEcts = valid.reduce((s, m) => s + m.ects, 0);
  const weighted = valid.reduce((s, m) => s + m.grade * m.ects, 0);
  return totalEcts > 0 ? weighted / totalEcts : 0;
}

export const MODULE_COLORS = [
  "#6d28d9","#2563eb","#059669","#dc2626","#d97706",
  "#db2777","#0891b2","#7c3aed","#16a34a","#ea580c",
];
