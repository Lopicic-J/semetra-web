"use client";

import { useState, useMemo } from "react";
import { useTranslation } from "@/lib/i18n";
import { useWeeklyReview, useReviewList } from "@/lib/hooks/useWeeklyReview";
import { useStudyPatterns } from "@/lib/hooks/useStudyPatterns";
import { useAutoReschedule } from "@/lib/hooks/useAutoReschedule";
import {
  BarChart3, TrendingUp, TrendingDown, Minus, Clock, Target,
  Calendar, Star, Zap, Brain, AlertTriangle, CheckCircle2,
  ChevronLeft, ChevronRight, RefreshCw, Sparkles, BookOpen,
  Trophy, ArrowRight, Flame, Coffee, MessageSquare, Printer,
} from "lucide-react";

export default function WeeklyReviewPage() {
  const { t } = useTranslation();
  const [selectedWeek, setSelectedWeek] = useState<string>(getMonday(new Date().toISOString().slice(0, 10)));

  const { review, loading, error, generateReview } = useWeeklyReview(selectedWeek);
  const { reviews: reviewList } = useReviewList();
  const { patterns, insights: patternInsights } = useStudyPatterns(30);
  const { missedBlocks, detectMissed, autoReschedule } = useAutoReschedule();

  const weekLabel = useMemo(() => {
    const start = new Date(selectedWeek);
    const end = new Date(selectedWeek);
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString("de-CH", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("de-CH", { day: "numeric", month: "short", year: "numeric" })}`;
  }, [selectedWeek]);

  const navigateWeek = (dir: number) => {
    const d = new Date(selectedWeek);
    d.setDate(d.getDate() + dir * 7);
    setSelectedWeek(d.toISOString().slice(0, 10));
  };

  if (loading) {
    return (
      <div className="p-6 animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 sm:w-7 h-6 sm:h-7 text-violet-500 shrink-0" />
            <span className="truncate">{t("review.title")}</span>
          </h1>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">{t("review.subtitle")}</p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
          <button onClick={() => navigateWeek(-1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 touch-target" title="Previous week">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <span className="text-xs sm:text-sm font-medium text-center flex-1 sm:flex-none sm:min-w-[160px] text-gray-700 dark:text-gray-300">{weekLabel}</span>
          <button onClick={() => navigateWeek(1)} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 touch-target" title="Next week">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={() => generateReview(selectedWeek)}
            className="ml-1 sm:ml-2 px-2 sm:px-3 py-2 bg-violet-600 text-white rounded-lg text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 hover:bg-violet-700 touch-target whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{t("review.generate")}</span>
          </button>
          {review && (
            <button
              onClick={() => window.print()}
              className="px-2 sm:px-3 py-2 bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 rounded-lg text-xs sm:text-sm flex items-center gap-1 sm:gap-1.5 hover:bg-surface-200 dark:hover:bg-surface-600 touch-target whitespace-nowrap print:hidden"
              title="Drucken / PDF"
            >
              <Printer className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Drucken</span>
            </button>
          )}
        </div>
      </div>

      {!review ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p className="text-lg mb-2">{t("review.no_data.title")}</p>
          <p className="text-sm mb-4">{t("review.no_data.desc")}</p>
          <button
            onClick={() => generateReview(selectedWeek)}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm hover:bg-violet-700"
          >
            {t("review.generate")}
          </button>
        </div>
      ) : (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <MetricCard
              icon={<Clock className="w-5 h-5 text-blue-500" />}
              label={t("review.metrics.study_time")}
              value={`${Math.round(review.metrics.totalEffectiveMinutes / 60 * 10) / 10}h`}
              subtext={`${t("review.metrics.of")} ${Math.round(review.metrics.totalPlannedMinutes / 60 * 10) / 10}h ${t("review.metrics.planned")}`}
              trend={review.vsPrevWeek.actualDelta}
            />
            <MetricCard
              icon={<Target className="w-5 h-5 text-green-500" />}
              label={t("review.metrics.adherence")}
              value={`${Math.round(review.metrics.overallAdherence * 100)}%`}
              subtext={`${review.metrics.blocksCompleted}/${review.metrics.blocksCompleted + review.metrics.blocksSkipped} ${t("review.metrics.blocks")}`}
              trend={review.vsPrevWeek.adherenceDelta * 100}
            />
            <MetricCard
              icon={<Zap className="w-5 h-5 text-amber-500" />}
              label={t("review.metrics.sessions")}
              value={String(review.metrics.sessionsCompleted)}
              subtext={`${review.metrics.avgSessionMinutes ?? 0} min ø`}
            />
            <MetricCard
              icon={<Brain className="w-5 h-5 text-violet-500" />}
              label={t("review.metrics.focus")}
              value={review.metrics.avgFocusRating?.toFixed(1) ?? "–"}
              subtext={`${t("review.metrics.efficiency")}: ${Math.round(review.metrics.focusEfficiency * 100)}%`}
            />
          </div>

          {/* Highlights */}
          {review.highlights.length > 0 && (
            <div className="flex gap-3 overflow-x-auto pb-1">
              {review.highlights.map((h, i) => (
                <div
                  key={i}
                  className="flex-shrink-0 px-4 py-3 bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-xl border border-violet-200 dark:border-violet-800 flex items-center gap-2"
                >
                  {h.type === "best_session" && <Star className="w-4 h-4 text-amber-500" />}
                  {h.type === "most_focused" && <Brain className="w-4 h-4 text-violet-500" />}
                  {h.type === "perfect_day" && <Trophy className="w-4 h-4 text-green-500" />}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                    {t(h.titleKey, h.data)}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Main Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Module Performance */}
            <div className="md:col-span-2 lg:col-span-2 bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-violet-500" />
                {t("review.modules.title")}
              </h2>

              {review.moduleStats.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-4">{t("review.modules.empty")}</p>
              ) : (
                <div className="space-y-3">
                  {review.moduleStats.map(mod => (
                    <div key={mod.moduleId} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: mod.moduleColor }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">{mod.moduleName}</span>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{Math.round(mod.actualMinutes)} / {Math.round(mod.plannedMinutes)} min</span>
                            {mod.trend === "improving" && <TrendingUp className="w-3.5 h-3.5 text-green-500" />}
                            {mod.trend === "declining" && <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
                            {mod.trend === "stable" && <Minus className="w-3.5 h-3.5 text-gray-400" />}
                          </div>
                        </div>
                        <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${Math.min(100, mod.adherence * 100)}%`,
                              backgroundColor: mod.adherence >= 0.8 ? "#10b981" : mod.adherence >= 0.5 ? "#f59e0b" : "#ef4444",
                            }}
                          />
                        </div>
                        {mod.daysUntilExam != null && mod.daysUntilExam <= 21 && (
                          <span className="text-xs text-red-500 mt-0.5 inline-flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            {t("review.modules.exam_in", { days: mod.daysUntilExam })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Goals */}
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Target className="w-5 h-5 text-green-500" />
                {t("review.goals.title")}
              </h2>

              <div className="space-y-4">
                {review.goals.map((goal, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600 dark:text-gray-300">{t(goal.label)}</span>
                      {goal.achieved ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <span className="text-xs text-gray-400">{Math.round(goal.actual)}/{goal.target}</span>
                      )}
                    </div>
                    <div className="w-full h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (goal.actual / goal.target) * 100)}%`,
                          backgroundColor: goal.achieved ? "#10b981" : "#6d28d9",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Insights & Recommendations */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Insights */}
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-amber-500" />
                {t("review.insights.title")}
              </h2>

              {review.insights.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("review.insights.empty")}</p>
              ) : (
                <div className="space-y-3">
                  {review.insights.map((insight, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border text-sm ${
                        insight.severity === "positive"
                          ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                          : insight.severity === "warning"
                          ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800"
                          : insight.severity === "critical"
                          ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                          : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                      }`}
                    >
                      <p className="font-medium text-gray-800 dark:text-gray-100">{t(insight.titleKey, insight.data)}</p>
                      <p className="text-gray-600 dark:text-gray-300 mt-0.5">{t(insight.descriptionKey, insight.data)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommendations */}
            <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-violet-500" />
                {t("review.recommendations.title")}
              </h2>

              {review.recommendations.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">{t("review.recommendations.empty")}</p>
              ) : (
                <div className="space-y-3">
                  {review.recommendations.map((rec, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {rec.priority === "high" && <Flame className="w-4 h-4 text-red-500" />}
                        {rec.priority === "medium" && <ArrowRight className="w-4 h-4 text-amber-500" />}
                        {rec.priority === "low" && <Coffee className="w-4 h-4 text-blue-500" />}
                        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{t(rec.actionKey, rec.data)}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t(rec.reasonKey, rec.data)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Comparison */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
            <ComparisonCard
              title={t("review.comparison.vs_prev")}
              comparison={review.vsPrevWeek}
              t={t}
            />
            <ComparisonCard
              title={t("review.comparison.vs_4week")}
              comparison={review.vs4WeekAvg}
              t={t}
            />
          </div>

          {/* Reflection */}
          <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-blue-500 shrink-0" />
              {t("review.reflection.title")}
            </h2>
            <textarea
              className="w-full p-3 rounded-lg sm:rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm resize-none focus:ring-2 focus:ring-violet-500 focus:border-transparent dark:text-white"
              rows={3}
              placeholder={t("review.reflection.placeholder")}
            />
          </div>
        </>
      )}
    </div>
  );
}

// ── Sub-Components ────────────────────────────────────────────────────────────

function MetricCard({ icon, label, value, subtext, trend }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext: string;
  trend?: number;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-gray-600 dark:text-gray-400">{icon}</span>
        {trend !== undefined && trend !== 0 && (
          <span className={`text-xs font-medium flex items-center gap-0.5 ${
            trend > 0 ? "text-green-500" : "text-red-500"
          }`}>
            {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend > 0 ? "+" : ""}{Math.round(trend)}
          </span>
        )}
      </div>
      <div className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">{value}</div>
      <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">{subtext}</div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function ComparisonCard({ title, comparison, t }: {
  title: string;
  comparison: { plannedDelta: number; actualDelta: number; adherenceDelta: number; trendDirection: string };
  t: (key: string, data?: any) => string;
}) {
  const TrendIcon = comparison.trendDirection === "up" ? TrendingUp
    : comparison.trendDirection === "down" ? TrendingDown : Minus;
  const trendColor = comparison.trendDirection === "up" ? "text-green-500"
    : comparison.trendDirection === "down" ? "text-red-500" : "text-gray-400";

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-200">{title}</h3>
        <TrendIcon className={`w-5 h-5 ${trendColor}`} />
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3 text-center">
        <div className="min-w-0">
          <div className={`text-xs sm:text-sm font-bold ${comparison.plannedDelta >= 0 ? "text-blue-500" : "text-gray-500"}`}>
            {comparison.plannedDelta >= 0 ? "+" : ""}{comparison.plannedDelta}min
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{t("review.comparison.planned")}</div>
        </div>
        <div className="min-w-0">
          <div className={`text-xs sm:text-sm font-bold ${comparison.actualDelta >= 0 ? "text-green-500" : "text-red-500"}`}>
            {comparison.actualDelta >= 0 ? "+" : ""}{comparison.actualDelta}min
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{t("review.comparison.actual")}</div>
        </div>
        <div className="min-w-0">
          <div className={`text-xs sm:text-sm font-bold ${comparison.adherenceDelta >= 0 ? "text-green-500" : "text-red-500"}`}>
            {comparison.adherenceDelta >= 0 ? "+" : ""}{Math.round(comparison.adherenceDelta * 100)}%
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{t("review.comparison.adherence_short")}</div>
        </div>
      </div>
    </div>
  );
}

// ── Utility ───────────────────────────────────────────────────────────────────

function getMonday(date: string): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}
