"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import toast from "react-hot-toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import {
  Trophy, Flame, Star, Award, BookOpen, CheckSquare, Clock,
  Layers, FileText, Sunrise, Moon, GraduationCap, CalendarCheck,
  TrendingUp, CheckCircle, Lock, Zap, Medal, ArrowRight,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Achievement {
  id: string;
  category: string;
  name_key: string;
  desc_key: string;
  icon: string;
  tier: string;
  xp_reward: number;
  threshold: number;
  unlocked: boolean;
  unlocked_at: string | null;
  progress: number;
}

interface Stats {
  streakDays: number;
  totalHours: number;
  flashcardCount: number;
}

const ICON_MAP: Record<string, LucideIcon> = {
  flame: Flame, star: Star, award: Award, "book-open": BookOpen,
  "check-square": CheckSquare, clock: Clock, layers: Layers,
  "file-text": FileText, sunrise: Sunrise, moon: Moon,
  "graduation-cap": GraduationCap, "calendar-check": CalendarCheck,
  "trending-up": TrendingUp, "check-circle": CheckCircle, trophy: Trophy,
};

const TIER_COLORS = {
  bronze:  { bg: "bg-amber-100",  text: "text-amber-700",  ring: "ring-amber-300",  gradient: "from-amber-400 to-amber-600" },
  silver:  { bg: "bg-surface-200 dark:bg-surface-700",  text: "text-surface-600 dark:text-surface-300",  ring: "ring-surface-300 dark:ring-surface-600",  gradient: "from-slate-400 to-slate-500" },
  gold:    { bg: "bg-yellow-100", text: "text-yellow-700", ring: "ring-yellow-400", gradient: "from-yellow-400 to-amber-500" },
  diamond: { bg: "bg-cyan-100",   text: "text-cyan-700",   ring: "ring-cyan-400",   gradient: "from-cyan-400 to-blue-500" },
};

const CATEGORY_LABELS: Record<string, string> = {
  streak: "achievement.cat.streak",
  grade: "achievement.cat.grade",
  module: "achievement.cat.module",
  task: "achievement.cat.task",
  time: "achievement.cat.time",
  learning: "achievement.cat.learning",
  special: "achievement.cat.special",
};

export default function AchievementsTabContent() {
  const { t } = useTranslation();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [xp, setXp] = useState(0);
  const [level, setLevel] = useState(1);
  const [currentLevelXp, setCurrentLevelXp] = useState(0);
  const [nextLevelXp, setNextLevelXp] = useState(100);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [stats, setStats] = useState<Stats>({ streakDays: 0, totalHours: 0, flashcardCount: 0 });
  const [recentUnlocks, setRecentUnlocks] = useState<Achievement[]>([]);

  const load = useCallback(async () => {
    try {
      // First check for new achievements
      await fetch("/api/achievements", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      // Then load all
      const res = await fetch("/api/achievements");
      const json = await res.json();
      if (json.achievements) {
        setAchievements(json.achievements);
        setXp(json.xp);
        setLevel(json.level);
        setCurrentLevelXp(json.currentLevelXp);
        setNextLevelXp(json.nextLevelXp);
        setUnlockedCount(json.unlockedCount);
        setTotalCount(json.totalCount);

        // Get recent unlocks (last 3)
        const unlockedAchievements = json.achievements
          .filter((a: Achievement) => a.unlocked)
          .sort((a: Achievement, b: Achievement) => {
            const dateA = new Date(a.unlocked_at || 0).getTime();
            const dateB = new Date(b.unlocked_at || 0).getTime();
            return dateB - dateA;
          })
          .slice(0, 3);
        setRecentUnlocks(unlockedAchievements);
      }

      // Fetch stats
      try {
        const statsRes = await fetch("/api/stats");
        if (statsRes.ok) {
          const statsJson = await statsRes.json();
          setStats({
            streakDays: statsJson.streakDays || 0,
            totalHours: statsJson.totalHours || 0,
            flashcardCount: statsJson.flashcardCount || 0,
          });
        }
      } catch (statsErr) {
        console.warn("[achievements] stats fetch failed:", statsErr);
        // Continue without stats
      }
    } catch (err) {
      console.error("[achievements] load failed:", err);
      toast.error(t("achievements.loadError") || "Fehler beim Laden der Achievements");
    }
    setLoading(false);
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const xpInLevel = xp - currentLevelXp;
  const xpForLevel = nextLevelXp - currentLevelXp;
  const levelPct = xpForLevel > 0 ? Math.min(100, Math.round((xpInLevel / xpForLevel) * 100)) : 0;

  const categories = Array.from(new Set(achievements.map(a => a.category)));
  const filtered = filter === "all" ? achievements : achievements.filter(a => a.category === filter);

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-8 bg-surface-100 rounded-xl w-48 mb-6" />
        <div className="h-24 bg-surface-100 rounded-2xl mb-6" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <div key={i} className="h-32 bg-surface-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary feature="Achievements">
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        {/* XP & Level Card */}
        <div className="card mb-6">
          <div className="flex items-center gap-4 mb-3">
            <div className="w-14 h-14 bg-gradient-to-br from-brand-500 to-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg">
              {level}
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-surface-800">
                  Level {level}
                </span>
                <span className="text-xs text-surface-500">
                  {xp.toLocaleString()} XP
                </span>
              </div>
              <div className="h-3 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-brand-500 to-indigo-500 rounded-full transition-all duration-700"
                  style={{ width: `${levelPct}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-surface-400">{currentLevelXp} XP</span>
                <span className="text-[10px] text-surface-400">{nextLevelXp} XP</span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600">
            <span className="flex items-center gap-1.5">
              <Trophy size={14} className="text-yellow-500" />
              {unlockedCount}/{totalCount} {t("achievements.unlocked")}
            </span>
            <span className="flex items-center gap-1.5">
              <Zap size={14} className="text-brand-500" />
              {xp.toLocaleString()} {t("achievements.totalXp")}
            </span>
          </div>

          {/* Stats row */}
          <div className="border-t border-surface-100 mt-4 pt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="text-center">
              <div className="text-xs text-surface-500 mb-1">{t("achievements.streak")}</div>
              <div className="text-lg font-bold text-surface-900">{stats.streakDays}</div>
              <div className="text-[10px] text-surface-400">Tage</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-surface-500 mb-1">{t("achievements.studyHours")}</div>
              <div className="text-lg font-bold text-surface-900">{Math.round(stats.totalHours)}</div>
              <div className="text-[10px] text-surface-400">Stunden</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-surface-500 mb-1">{t("achievements.flashcardCount")}</div>
              <div className="text-lg font-bold text-surface-900">{stats.flashcardCount}</div>
              <div className="text-[10px] text-surface-400">Karten</div>
            </div>
            <div className="text-center">
              <div className="text-xs text-surface-500 mb-1">Fortschritt</div>
              <div className="text-lg font-bold text-surface-900">{levelPct}%</div>
              <div className="text-[10px] text-surface-400">Level</div>
            </div>
          </div>
        </div>

        {/* Recent Unlocks */}
        {recentUnlocks.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-surface-900 mb-3 flex items-center gap-2">
              <Star className="text-yellow-500" size={16} />
              {t("achievements.recentUnlocks")}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {recentUnlocks.map(a => {
                const Icon = ICON_MAP[a.icon] ?? Trophy;
                const tier = TIER_COLORS[a.tier as keyof typeof TIER_COLORS] ?? TIER_COLORS.bronze;
                const daysAgo = Math.floor(
                  (Date.now() - new Date(a.unlocked_at || Date.now()).getTime()) / (1000 * 60 * 60 * 24)
                );
                let timeText = "";
                if (daysAgo === 0) {
                  timeText = t("achievements.today");
                } else if (daysAgo === 1) {
                  timeText = t("achievements.yesterday");
                } else {
                  timeText = `vor ${daysAgo} Tagen`;
                }

                return (
                  <div key={a.id} className={`card p-4 border-l-4 border-yellow-400 bg-gradient-to-r from-yellow-50 to-white dark:from-yellow-950/30 dark:to-surface-800`}>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-gradient-to-br ${tier.gradient} text-white shadow-sm`}>
                        <Icon size={18} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-surface-900 truncate">{t(a.name_key)}</h3>
                        <p className="text-xs text-surface-500 mt-0.5">{timeText}</p>
                        <p className="text-xs text-brand-600 font-semibold mt-1">+{a.xp_reward} XP</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Category filter */}
        <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filter === "all" ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"
            }`}
          >
            {t("achievements.all")}
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                filter === cat ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"
              }`}
            >
              {t(CATEGORY_LABELS[cat] || cat)}
            </button>
          ))}
        </div>

        {/* Achievement grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(a => {
            const Icon = ICON_MAP[a.icon] ?? Trophy;
            const tier = TIER_COLORS[a.tier as keyof typeof TIER_COLORS] ?? TIER_COLORS.bronze;
            const progressPct = a.threshold > 0 ? Math.min(100, Math.round((a.progress / a.threshold) * 100)) : 0;

            return (
              <div
                key={a.id}
                className={`card p-4 transition-all ${
                  a.unlocked
                    ? "border-yellow-200 dark:border-yellow-800 bg-gradient-to-br from-white to-yellow-50/50 dark:from-surface-800 dark:to-yellow-950/20"
                    : "opacity-70"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                    a.unlocked
                      ? `bg-gradient-to-br ${tier.gradient} text-white shadow-sm`
                      : "bg-surface-100 text-surface-400"
                  }`}>
                    {a.unlocked ? <Icon size={20} /> : <Lock size={18} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-semibold ${a.unlocked ? "text-surface-900" : "text-surface-600"}`}>
                        {t(a.name_key)}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${tier.bg} ${tier.text}`}>
                        {a.tier}
                      </span>
                    </div>
                    <p className="text-xs text-surface-500 mt-0.5">{t(a.desc_key)}</p>

                    {/* Progress bar (if not unlocked) */}
                    {!a.unlocked && a.progress > 0 && (
                      <div className="mt-2">
                        <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-400 rounded-full" style={{ width: `${progressPct}%` }} />
                        </div>
                        <span className="text-[10px] text-surface-400 mt-0.5">
                          {a.progress}/{a.threshold}
                        </span>
                      </div>
                    )}

                    {/* Unlocked date + XP */}
                    {a.unlocked && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-[10px] text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle size={10} />
                          {new Date(a.unlocked_at!).toLocaleDateString("de-CH")}
                        </span>
                        <span className="text-[10px] text-brand-500 font-medium">+{a.xp_reward} XP</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ErrorBoundary>
  );
}
