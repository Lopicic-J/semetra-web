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
  if (grade >= 5.5) return "text-green-600";
  if (grade >= 4.0) return "text-blue-600";
  if (grade >= 3.0) return "text-yellow-600";
  return "text-red-600";
}

export function gradeAvg(grades: { grade: number | null; weight?: number | null }[]): number {
  const valid = grades.filter((g): g is typeof g & { grade: number } => g.grade !== null);
  if (!valid.length) return 0;
  const totalWeight = valid.reduce((s, g) => s + (g.weight ?? 1), 0);
  const weighted = valid.reduce((s, g) => s + g.grade * (g.weight ?? 1), 0);
  return totalWeight > 0 ? weighted / totalWeight : 0;
}

export const MODULE_COLORS = [
  "#6d28d9","#2563eb","#059669","#dc2626","#d97706",
  "#db2777","#0891b2","#7c3aed","#16a34a","#ea580c",
];
