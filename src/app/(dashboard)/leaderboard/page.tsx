"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import toast from "react-hot-toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Medal, Zap } from "lucide-react";
import Image from "next/image";

interface LeaderboardEntry {
  id: string;
  username: string;
  full_name: string;
  avatar_url: string | null;
  xp_total: number;
  level: number;
}

interface LeaderboardData {
  leaderboard: LeaderboardEntry[];
  currentUser: LeaderboardEntry | null;
  userRank: number | null;
}

export default function LeaderboardPage() {
  const { t } = useTranslation();
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/leaderboard?limit=50");
      if (!res.ok) throw new Error("Failed to load leaderboard");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("[leaderboard] load failed:", err);
      toast.error(t("leaderboard.loadError") || "Fehler beim Laden der Bestenliste");
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const podium = data?.leaderboard?.slice(0, 3) || [];
  const rest = data?.leaderboard?.slice(3) || [];

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto animate-pulse">
        <div className="h-8 bg-surface-100 rounded-xl w-48 mb-6" />
        <div className="h-24 bg-surface-100 rounded-2xl mb-6" />
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-16 bg-surface-100 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <ErrorBoundary feature="Leaderboard">
      <div className="p-4 sm:p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Medal className="text-yellow-500" size={26} />
            {t("leaderboard.title")}
          </h1>
          <p className="text-surface-500 text-sm mt-1">{t("leaderboard.subtitle")}</p>
        </div>

        {/* Podium - Top 3 */}
        {podium.length > 0 && (
          <div className="mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {podium.map((entry, idx) => {
                const height = [24, 20, 16];
                const bgColor = ["from-yellow-100 to-yellow-50", "from-slate-100 to-slate-50", "from-amber-100 to-amber-50"];
                return (
                  <div key={entry.id} className={`h-${height[idx]} md:order-${idx === 1 ? 2 : idx === 2 ? 3 : 1}`}>
                    <div className={`bg-gradient-to-b ${bgColor[idx]} rounded-2xl border-2 border-surface-200 p-4 h-full flex flex-col items-center justify-end relative`}>
                      {/* Medal */}
                      <div className="absolute -top-4 text-3xl">{medals[idx]}</div>

                      {/* Avatar */}
                      {entry.avatar_url ? (
                        <img
                          src={entry.avatar_url}
                          alt={entry.username}
                          className="w-16 h-16 rounded-full mb-2 border-2 border-white shadow-md object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full mb-2 border-2 border-white shadow-md bg-surface-200 flex items-center justify-center text-xl font-bold text-surface-600">
                          {entry.username[0]?.toUpperCase()}
                        </div>
                      )}

                      {/* Info */}
                      <h3 className="font-bold text-surface-900 text-center text-sm truncate w-full">
                        {entry.full_name || entry.username}
                      </h3>
                      <p className="text-xs text-surface-500 mt-1">Level {entry.level}</p>
                      <div className="flex items-center gap-1 mt-2 text-xs font-bold text-brand-600">
                        <Zap size={12} />
                        {entry.xp_total.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Leaderboard List 4+ */}
        {rest.length > 0 ? (
          <div className="card overflow-hidden">
            <div className="divide-y divide-surface-100">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-surface-50 font-semibold text-xs text-surface-600 uppercase">
                <div className="col-span-1">{t("leaderboard.rank")}</div>
                <div className="col-span-7">Name</div>
                <div className="col-span-2 text-right">{t("leaderboard.level")}</div>
                <div className="col-span-2 text-right">{t("leaderboard.xp")}</div>
              </div>

              {/* Entries */}
              {rest.map((entry, idx) => {
                const rank = idx + 4;
                const isCurrentUser = data?.currentUser?.id === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`grid grid-cols-12 gap-3 px-4 py-3 items-center hover:bg-surface-50 transition-colors ${
                      isCurrentUser ? "bg-brand-50 border-l-4 border-brand-500" : ""
                    }`}
                  >
                    {/* Rank */}
                    <div className="col-span-1 font-bold text-surface-900">{rank}</div>

                    {/* Name */}
                    <div className="col-span-7 flex items-center gap-2 min-w-0">
                      {entry.avatar_url ? (
                        <img
                          src={entry.avatar_url}
                          alt={entry.username}
                          className="w-8 h-8 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-surface-200 flex items-center justify-center text-xs font-bold text-surface-600 shrink-0">
                          {entry.username[0]?.toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-surface-900 truncate">
                          {entry.full_name || entry.username}
                        </div>
                        <div className="text-xs text-surface-500 truncate">@{entry.username}</div>
                      </div>
                      {isCurrentUser && (
                        <span className="text-xs px-2 py-0.5 bg-brand-100 text-brand-700 rounded-full font-semibold whitespace-nowrap ml-auto md:ml-0">
                          {t("leaderboard.you")}
                        </span>
                      )}
                    </div>

                    {/* Level */}
                    <div className="col-span-2 text-right font-semibold text-surface-900">
                      {entry.level}
                    </div>

                    {/* XP */}
                    <div className="col-span-2 text-right font-semibold text-brand-600 flex items-center justify-end gap-1">
                      <Zap size={12} />
                      {entry.xp_total.toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="card text-center py-12">
            <p className="text-surface-500">{t("leaderboard.empty")}</p>
          </div>
        )}

        {/* Current user info if not in top 50 */}
        {data?.currentUser && data.userRank && data.userRank > 50 && (
          <div className="mt-8">
            <div className="text-xs text-surface-500 mb-2 font-semibold uppercase">{t("leaderboard.you")}</div>
            <div className="card bg-brand-50 border-brand-200">
              <div className="grid grid-cols-12 gap-3 items-center">
                {/* Rank */}
                <div className="col-span-1 font-bold text-brand-700">{data.userRank}</div>

                {/* Name */}
                <div className="col-span-7 flex items-center gap-2">
                  {data.currentUser.avatar_url ? (
                    <img
                      src={data.currentUser.avatar_url}
                      alt={data.currentUser.username}
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-brand-200 flex items-center justify-center text-xs font-bold text-brand-700">
                      {data.currentUser.username[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-surface-900">
                      {data.currentUser.full_name || data.currentUser.username}
                    </div>
                    <div className="text-xs text-surface-600">@{data.currentUser.username}</div>
                  </div>
                </div>

                {/* Level */}
                <div className="col-span-2 text-right font-semibold text-surface-900">
                  {data.currentUser.level}
                </div>

                {/* XP */}
                <div className="col-span-2 text-right font-semibold text-brand-600 flex items-center justify-end gap-1">
                  <Zap size={12} />
                  {data.currentUser.xp_total.toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
