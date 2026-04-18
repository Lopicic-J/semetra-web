"use client";

import { memo } from "react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";
import { Lightbulb, GitBranch, Calculator, Zap, Brain, Target, FileText, BookOpen, CalendarClock } from "lucide-react";

interface Props {
  moduleId: string;
  moduleName: string;
  moduleColor?: string;
  /** Compact mode for tight spaces */
  compact?: boolean;
}

/**
 * Quick-action bar linking a module to study tools:
 * Brainstorming, Mindmaps, Math, Flashcards, AI, Exam Prep
 */
function ModuleToolsBar({ moduleId, moduleName, moduleColor, compact }: Props) {
  const { t } = useTranslation();

  const tools = [
    { href: `/modules/${moduleId}/learn`, icon: BookOpen, label: "Lernraum", color: "text-brand-600" },
    { href: `/smart-schedule?module=${moduleId}`, icon: CalendarClock, label: t("nav.smartSchedule") || "Lernplan", color: "text-cyan-500" },
    { href: `/flashcards?module=${moduleId}`, icon: Zap, label: t("nav.flashcards") || "Karteikarten", color: "text-violet-500" },
    { href: `/guided-session?module=${moduleId}`, icon: Brain, label: t("nav.guidedSession") || "Lernsession", color: "text-brand-500" },
    { href: `/brainstorming?module=${moduleId}`, icon: Lightbulb, label: "Brainstorming", color: "text-amber-500" },
    { href: `/mindmaps?module=${moduleId}`, icon: GitBranch, label: "Mindmap", color: "text-emerald-500" },
    { href: `/mathe?module=${moduleId}`, icon: Calculator, label: t("nav.math") || "Mathe", color: "text-blue-500" },
    { href: `/exam-simulator?module=${moduleId}`, icon: Target, label: t("nav.examSimulator") || "Prüfungssimulator", color: "text-red-500" },
    { href: `/ki?module=${moduleId}`, icon: FileText, label: t("nav.aiAssistant") || "KI-Assistent", color: "text-purple-500" },
  ];

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {tools.map(tool => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors no-underline"
            title={tool.label}
          >
            <tool.icon size={11} className={tool.color} />
            {tool.label}
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-3">
      <p className="text-xs font-medium text-surface-500 mb-2 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full" style={{ background: moduleColor ?? "#6d28d9" }} />
        {t("modules.tools") || "Lernwerkzeuge"} — {moduleName}
      </p>
      <div className="flex flex-wrap gap-2">
        {tools.map(tool => (
          <Link
            key={tool.href}
            href={tool.href}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 border border-surface-200 dark:border-surface-700 transition-colors no-underline"
          >
            <tool.icon size={13} className={tool.color} />
            {tool.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default memo(ModuleToolsBar);
