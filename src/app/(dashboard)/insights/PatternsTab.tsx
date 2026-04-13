"use client";

import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { useStudyPatterns } from "@/lib/hooks/useStudyPatterns";
import { useStreaks } from "@/lib/hooks/useStreaks";
import { formatDuration } from "@/lib/utils";
import {
  Brain, Clock, Flame, Zap, Sun, Moon, Coffee,
  TrendingUp, Calendar, BookOpen, BarChart3, Target,
} from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════
// Lernmuster Tab
// Study patterns, productivity peaks, optimal times, habits
// Data: Schedule Engine → pattern-analyzer
// ═══════════════════════════════════════════════════════════════════════════

export default function PatternsTab() {
  const { t } = useTranslation();
  const { patterns, insights, loading } = useStudyPatterns(30);
  const streaks = useStreaks();

  // ── Derived analytics (hooks MUST be called before any return) ─────────

  // Best hours (from hour patterns)
  const bestHours = useMemo(() => {
    if (!patterns?.allHours?.length) return [];
    return [...patterns.allHours]
      .sort((a, b) => b.avgMinutes - a.avgMinutes)
      .slice(0, 3);
  }, [patterns?.allHours]);

  // Best days
  const bestDays = useMemo(() => {
    if (!patterns?.dayPatterns?.length) return [];
    const dayNames = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
    return [...patterns.dayPatterns]
      .sort((a, b) => b.avgMinutes - a.avgMinutes)
      .slice(0, 3)
      .map(d => ({ ...d, label: dayNames[d.day] || `Tag ${d.day}` }));
  }, [patterns?.dayPatterns]);

  // Time of day preference
  const timePreference = useMemo(() => {
    if (!bestHours.length) return "keine Daten";
    const topHour = bestHours[0].hour;
    if (topHour < 10) return "Frühaufsteher";
    if (topHour < 14) return "Vormittags-Lerner";
    if (topHour < 18) return "Nachmittags-Lerner";
    return "Nachtmensch";
  }, [bestHours]);

  // ── Early returns (after all hooks) ────────────────────────────────────

  if (loading || streaks.loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!patterns) {
    return (
      <div className="text-center py-20 text-surface-400">
        <Brain size={40} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">Noch nicht genug Lerndaten vorhanden — starte ein paar Timer-Sessions!</p>
      </div>
    );
  }

  // Average session length
  const avgSessionMinutes = patterns.avgSessionMinutes || 0;

  const TimeIcon = timePreference === "Frühaufsteher" || timePreference === "Vormittags-Lerner"
    ? Sun : timePreference === "Nachtmensch" ? Moon : Coffee;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">

      {/* Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <PatternCard
          icon={<TimeIcon size={20} className="text-amber-500" />}
          label="Lerntyp"
          value={timePreference}
        />
        <PatternCard
          icon={<Clock size={20} className="text-blue-500" />}
          label="Ø Sitzungslänge"
          value={`${Math.round(avgSessionMinutes)} Min.`}
        />
        <PatternCard
          icon={<Flame size={20} className="text-orange-500" />}
          label="Streak"
          value={`${streaks.currentStreak} Tage`}
          sublabel={`Rekord: ${streaks.longestStreak}`}
        />
        <PatternCard
          icon={<Calendar size={20} className="text-green-500" />}
          label="Lerntage gesamt"
          value={String(streaks.totalDays)}
          sublabel={formatDuration(streaks.totalSeconds)}
        />
      </div>

      {/* Best Hours */}
      {bestHours.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
            <Zap size={16} className="text-amber-500" /> Produktivste Uhrzeiten
          </h3>
          <div className="space-y-2">
            {bestHours.map((h, i) => (
              <div key={h.hour} className="flex items-center gap-3">
                <span className="w-6 text-center text-xs font-bold text-surface-400">#{i + 1}</span>
                <span className="text-sm font-medium text-surface-700 w-16">
                  {String(h.hour).padStart(2, "0")}:00
                </span>
 <div className="flex-1 h-6 rounded-lg bg-surface-100 overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all"
                    style={{
                      width: `${Math.min(100, (h.avgMinutes / (bestHours[0].avgMinutes || 1)) * 100)}%`,
                      background: i === 0 ? "#f59e0b" : i === 1 ? "#fbbf24" : "#fde68a",
                    }}
                  />
                </div>
                <span className="text-xs text-surface-500 w-16 text-right">
                  Ø {Math.round(h.avgMinutes)} Min.
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Best Days */}
      {bestDays.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
            <Calendar size={16} className="text-blue-500" /> Produktivste Wochentage
          </h3>
          <div className="flex gap-3">
            {bestDays.map((d, i) => (
 <div key={d.day} className="flex-1 text-center p-3 rounded-xl bg-surface-50">
                <p className="text-lg font-bold text-surface-800">{d.label}</p>
                <p className="text-xs text-surface-400">Ø {Math.round(d.avgMinutes)} Min.</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pattern Insights from engine */}
      {insights && insights.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
            <Brain size={16} className="text-purple-500" /> Erkenntnisse
          </h3>
          <div className="space-y-2">
            {insights.map((insight, i) => (
              <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20">
                <Target size={14} className="text-purple-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-surface-700">{insight.descriptionKey || insight.titleKey}</p>
                  {insight.data?.recommendation && (
                    <p className="text-xs text-surface-500 mt-1">{insight.data.recommendation}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Module patterns */}
      {patterns.modulePatterns && patterns.modulePatterns.length > 0 && (
        <div className="card">
          <h3 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
            <BookOpen size={16} className="text-brand-500" /> Lernzeit nach Modul
          </h3>
          <div className="space-y-2">
            {patterns.modulePatterns
              .sort((a, b) => b.totalMinutes - a.totalMinutes)
              .slice(0, 8)
              .map(mp => {
                const maxMin = patterns.modulePatterns![0].totalMinutes || 1;
                return (
                  <div key={mp.moduleId} className="flex items-center gap-3">
                    <span className="text-sm text-surface-700 truncate w-40">{mp.moduleName}</span>
 <div className="flex-1 h-5 rounded-lg bg-surface-100 overflow-hidden">
                      <div
                        className="h-full rounded-lg bg-brand-400"
                        style={{ width: `${(mp.totalMinutes / maxMin) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-surface-500 w-20 text-right">
                      {formatDuration(mp.totalMinutes * 60)}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}

function PatternCard({ icon, label, value, sublabel }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sublabel?: string;
}) {
  return (
    <div className="card text-center">
      <div className="flex justify-center mb-2">{icon}</div>
      <p className="text-xl font-bold text-surface-800">{value}</p>
      <p className="text-xs text-surface-500 mt-1">{label}</p>
      {sublabel && <p className="text-[10px] text-surface-400 mt-0.5">{sublabel}</p>}
    </div>
  );
}
