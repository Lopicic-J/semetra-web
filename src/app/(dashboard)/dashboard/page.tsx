"use client";
/**
 * Dashboard Page
 *
 * Zeigt das klassische Dashboard mit Übersicht über Module,
 * Aufgaben und Statistiken. Command Center ist als eigener
 * Sidebar-Eintrag verfügbar (/command-center).
 */
import dynamic from "next/dynamic";

const ClassicDashboard = dynamic(
  () => import("@/components/dashboard/ClassicDashboard"),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center min-h-[300px] text-sm text-surface-500">
        <div className="w-6 h-6 border-2 border-surface-200 border-t-brand-500 rounded-full animate-spin mr-2" />
      </div>
    ),
  }
);

export default function DashboardPage() {
  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <ClassicDashboard />
    </div>
  );
}
