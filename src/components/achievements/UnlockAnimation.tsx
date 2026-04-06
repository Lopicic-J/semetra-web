"use client";

import { useEffect, useState, useCallback } from "react";
import { Trophy } from "lucide-react";

interface Achievement {
  name: string;
  icon: string;
  tier: string;
  xp_reward: number;
}

const UNLOCK_EVENT = "semetra:achievement-unlock";

/**
 * Trigger an achievement unlock animation
 */
export function triggerAchievementUnlock(achievement: Achievement) {
  window.dispatchEvent(new CustomEvent(UNLOCK_EVENT, { detail: achievement }));
}

/**
 * Individual achievement unlock toast
 */
function AchievementToastItem({ achievement, onDismiss }: { achievement: Achievement; onDismiss: () => void }) {
  const TIER_COLORS = {
    bronze: { bg: "from-amber-400 to-amber-600", light: "bg-amber-100", text: "text-amber-700" },
    silver: { bg: "from-slate-400 to-slate-600", light: "bg-surface-200 dark:bg-surface-700", text: "text-surface-700 dark:text-surface-300" },
    gold: { bg: "from-yellow-400 to-amber-500", light: "bg-yellow-100", text: "text-yellow-700" },
    diamond: { bg: "from-cyan-400 to-blue-500", light: "bg-cyan-100", text: "text-cyan-700" },
  };

  const tierColor = TIER_COLORS[achievement.tier as keyof typeof TIER_COLORS] ?? TIER_COLORS.bronze;

  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className="animate-in slide-in-from-right-full duration-500 ease-out"
      onClick={onDismiss}
    >
      <div className="bg-[rgb(var(--card-bg))] rounded-2xl shadow-2xl p-4 max-w-sm border border-surface-100 overflow-hidden relative">
        {/* Animated confetti background */}
        <div className="absolute inset-0 opacity-20 pointer-events-none">
          <div className="absolute top-2 left-2 w-2 h-2 bg-yellow-400 rounded-full animate-bounce" style={{ animationDelay: "0s" }} />
          <div className="absolute top-1 right-4 w-1.5 h-1.5 bg-pink-400 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }} />
          <div className="absolute bottom-3 left-5 w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }} />
          <div className="absolute bottom-2 right-3 w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }} />
        </div>

        {/* Content */}
        <div className="relative z-10 flex items-center gap-3">
          {/* Icon badge */}
          <div className={`w-16 h-16 bg-gradient-to-br ${tierColor.bg} rounded-xl flex items-center justify-center shrink-0 shadow-lg scale-in`}>
            <Trophy className="text-white" size={24} />
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-surface-900 text-sm truncate">
                {achievement.name}
              </h3>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${tierColor.light} ${tierColor.text}`}>
                {achievement.tier}
              </span>
            </div>
            <p className="text-xs text-brand-600 font-semibold">
              +{achievement.xp_reward} XP
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Portal component that renders all achievement unlock toasts
 * Place this in your layout/dashboard layout once
 */
export function AchievementUnlockPortal() {
  const [achievements, setAchievements] = useState<(Achievement & { id: string })[]>([]);

  const handleUnlock = useCallback((event: Event) => {
    const customEvent = event as CustomEvent;
    const achievement = customEvent.detail as Achievement;
    const id = Math.random().toString(36).substring(2);

    setAchievements(prev => [...prev, { ...achievement, id }]);
  }, []);

  const dismissAchievement = useCallback((id: string) => {
    setAchievements(prev => prev.filter(a => a.id !== id));
  }, []);

  useEffect(() => {
    window.addEventListener(UNLOCK_EVENT, handleUnlock);
    return () => window.removeEventListener(UNLOCK_EVENT, handleUnlock);
  }, [handleUnlock]);

  if (achievements.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 pointer-events-auto max-w-sm">
      {achievements.map(achievement => (
        <AchievementToastItem
          key={achievement.id}
          achievement={achievement}
          onDismiss={() => dismissAchievement(achievement.id)}
        />
      ))}
    </div>
  );
}
