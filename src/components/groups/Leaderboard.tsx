"use client";
/**
 * Leaderboard — Group ranking by study time & streaks
 *
 * Shows top members in a group ranked by weekly study hours.
 * Highlights current user, shows medals for top 3.
 */

import { useState, useEffect } from "react";
import { Trophy, Flame, Clock, Medal, Crown, User } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  isMe: boolean;
  displayName: string;
  avatarUrl: string | null;
  studyHours7d: number;
  currentStreak: number;
  sessions7d: number;
}

interface LeaderboardProps {
  groupId: string;
}

const RANK_STYLES: Record<number, { icon: React.ReactNode; bg: string; text: string }> = {
  1: {
    icon: <Crown size={16} className="text-yellow-500" />,
    bg: "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800",
    text: "text-yellow-700 dark:text-yellow-400",
  },
  2: {
    icon: <Medal size={16} className="text-gray-400" />,
    bg: "bg-gray-50 dark:bg-gray-800/30 border-gray-200 dark:border-gray-700",
    text: "text-gray-600 dark:text-gray-400",
  },
  3: {
    icon: <Medal size={16} className="text-amber-600" />,
    bg: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    text: "text-amber-700 dark:text-amber-400",
  },
};

export function Leaderboard({ groupId }: LeaderboardProps) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/groups/leaderboard?group_id=${groupId}`)
      .then((res) => res.json())
      .then((data) => setEntries(data.leaderboard ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [groupId]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 bg-surface-100 dark:bg-surface-800 rounded-xl" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-surface-400 text-center py-6">
        Noch keine Daten für das Leaderboard vorhanden.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Trophy size={18} className="text-brand-600" />
        <h3 className="font-semibold text-surface-900 dark:text-white text-sm">
          Leaderboard (letzte 7 Tage)
        </h3>
      </div>

      {entries.map((entry) => {
        const rankStyle = RANK_STYLES[entry.rank];
        return (
          <div
            key={entry.userId}
            className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
              entry.isMe
                ? "bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-800 ring-1 ring-brand-300 dark:ring-brand-700"
                : rankStyle?.bg ?? "bg-surface-50 dark:bg-surface-800 border-surface-200 dark:border-surface-700"
            }`}
          >
            {/* Rank */}
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                rankStyle?.text ?? "text-surface-500"
              }`}
            >
              {rankStyle?.icon ?? <span>{entry.rank}</span>}
            </div>

            {/* Avatar + Name */}
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium truncate ${entry.isMe ? "text-brand-700 dark:text-brand-300" : "text-surface-900 dark:text-white"}`}>
                {entry.displayName}
                {entry.isMe && (
                  <span className="ml-1.5 text-[10px] bg-brand-100 dark:bg-brand-800 text-brand-600 dark:text-brand-300 px-1.5 py-0.5 rounded-full font-medium">
                    Du
                  </span>
                )}
              </p>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1 text-surface-600 dark:text-surface-400" title="Lernzeit">
                <Clock size={12} />
                <span className="font-medium">{entry.studyHours7d}h</span>
              </div>
              <div className="flex items-center gap-1 text-surface-600 dark:text-surface-400" title="Streak">
                <Flame size={12} className={entry.currentStreak > 0 ? "text-orange-500" : ""} />
                <span className="font-medium">{entry.currentStreak}d</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
