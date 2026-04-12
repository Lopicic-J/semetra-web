"use client";

import { useState, useEffect } from "react";
import {
  X, UserPlus, MessageCircle, Trophy, BookOpen,
  Clock, Award, GraduationCap, Crown, Star, Shield,
  Globe, Calendar, Wifi, WifiOff, Moon, Loader2,
  ChevronRight, TrendingUp, Users,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import Link from "next/link";
import toast from "react-hot-toast";

interface UserProfile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  institution_name: string | null;
  program_name: string | null;
  degree_level: string | null;
  current_semester: number | null;
  study_mode: string | null;
  user_role: string;
  language: string | null;
  plan: string | null;
  xp_total: number;
  level: number;
  online_status: string;
  member_since: string;
}

interface UserStats {
  rank: number | null;
  achievements: number;
  total_study_hours: number;
  module_count: number;
}

interface Props {
  userId: string | null;
  onClose: () => void;
}

const LANGUAGE_NAMES: Record<string, string> = {
  de: "Deutsch", en: "English", fr: "Français",
  it: "Italiano", es: "Español", nl: "Nederlands",
};

const LANGUAGE_FLAGS: Record<string, string> = {
  de: "🇩🇪", en: "🇬🇧", fr: "🇫🇷", it: "🇮🇹", es: "🇪🇸", nl: "🇳🇱",
};

export default function UserProfileModal({ userId, onClose }: Props) {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [friendshipStatus, setFriendshipStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);

    fetch(`/api/community/profile?user_id=${userId}`)
      .then(res => {
        if (!res.ok) throw new Error(res.status === 403 ? "private" : "error");
        return res.json();
      })
      .then(data => {
        setProfile(data.profile);
        setStats(data.stats);
        setFriendshipStatus(data.friendship_status);
      })
      .catch(err => {
        setError(err.message === "private" ? "private" : "error");
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const handleAddFriend = async () => {
    if (!userId) return;
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Fehler");
        return;
      }
      setFriendshipStatus("pending");
      toast.success(t("community.friendRequestSent") || "Freundschaftsanfrage gesendet!");
    } catch {
      toast.error("Fehler");
    }
  };

  if (!userId) return null;

  const statusColors: Record<string, string> = {
    online: "bg-green-500",
    away: "bg-amber-500",
    dnd: "bg-red-500",
    offline: "bg-surface-400 dark:bg-surface-600",
  };

  const statusLabels: Record<string, string> = {
    online: t("settings.statusOnline") || "Online",
    away: t("settings.statusAway") || "Abwesend",
    dnd: t("settings.statusDnd") || "Nicht stören",
    offline: t("settings.statusOffline") || "Offline",
  };

  const degreeBadge = (level: string | null) => {
    if (!level) return null;
    const labels: Record<string, { label: string; color: string }> = {
      bachelor: { label: "B.Sc.", color: "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" },
      master: { label: "M.Sc.", color: "bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300" },
      phd: { label: "Ph.D.", color: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" },
      diploma: { label: "Dipl.", color: "bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300" },
    };
    const config = labels[level] || { label: level, color: "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300" };
    return (
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${config.color}`}>
        <GraduationCap size={12} className="mr-1" />
        {config.label}
      </span>
    );
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("de-CH", {
        month: "long", year: "numeric",
      });
    } catch {
      return "";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-surface-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-1.5 rounded-lg bg-white/80 dark:bg-surface-700/80 hover:bg-white dark:hover:bg-surface-700 text-surface-500 dark:text-surface-400 transition-colors"
        >
          <X size={18} />
        </button>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-brand-500 mb-3" />
            <p className="text-sm text-surface-500">{t("common.loading") || "Laden..."}</p>
          </div>
        ) : error === "private" ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <Shield size={40} className="text-surface-300 dark:text-surface-600 mb-3" />
            <p className="text-surface-600 dark:text-surface-400 font-medium text-center">
              {t("profile.private") || "Dieses Profil ist privat"}
            </p>
            <p className="text-sm text-surface-400 dark:text-surface-500 mt-1 text-center">
              {t("profile.privateDesc") || "Der Benutzer hat sein Profil in der Community verborgen."}
            </p>
          </div>
        ) : error || !profile ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <p className="text-surface-600 dark:text-surface-400">{t("profile.loadError") || "Profil konnte nicht geladen werden"}</p>
          </div>
        ) : (
          <>
            {/* Header / Banner */}
            <div className="relative h-28 bg-gradient-to-br from-brand-500 via-brand-600 to-indigo-600">
              {/* Decorative pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-2 right-8 w-20 h-20 rounded-full border-2 border-white" />
                <div className="absolute bottom-4 left-12 w-12 h-12 rounded-full border-2 border-white" />
              </div>

              {/* Status indicator */}
              <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-black/20 backdrop-blur-sm rounded-full px-2.5 py-1">
                <span className={`w-2 h-2 rounded-full ${statusColors[profile.online_status] || statusColors.offline}`} />
                <span className="text-[11px] text-white/90 font-medium">
                  {statusLabels[profile.online_status] || "Offline"}
                </span>
              </div>

              {/* Degree badge */}
              {profile.degree_level && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2">
                  {degreeBadge(profile.degree_level)}
                </div>
              )}
            </div>

            {/* Avatar — overlapping banner */}
            <div className="relative px-5 -mt-12">
              <div className="relative inline-block">
                {profile.avatar_url ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.username}
                    className="w-24 h-24 rounded-full object-cover border-4 border-white dark:border-surface-800 shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-brand-100 dark:bg-brand-900/40 border-4 border-white dark:border-surface-800 shadow-lg flex items-center justify-center">
                    <span className="text-brand-600 dark:text-brand-400 font-bold text-3xl">
                      {(profile.full_name || profile.username || "?")[0].toUpperCase()}
                    </span>
                  </div>
                )}
                {/* Level badge on avatar */}
                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center border-2 border-white dark:border-surface-800 shadow">
                  {profile.level}
                </div>
              </div>
            </div>

            {/* Name & Info */}
            <div className="px-5 pt-2 pb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-bold text-surface-900 dark:text-white">
                  {profile.full_name || profile.username}
                </h2>
                {profile.language && (
                  <span className="text-base" title={LANGUAGE_NAMES[profile.language] || profile.language}>
                    {LANGUAGE_FLAGS[profile.language] || "🌐"}
                  </span>
                )}
                {/* Role badge */}
                {profile.user_role === "admin" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium flex items-center gap-0.5">
                    <Shield size={10} /> Admin
                  </span>
                )}
                {profile.user_role === "institution" && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium flex items-center gap-0.5">
                    <GraduationCap size={10} /> Institution
                  </span>
                )}
              </div>
              <p className="text-sm text-surface-500 dark:text-surface-400">@{profile.username}</p>

              {/* Plan badge */}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {profile.plan === "lifetime" ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-1">
                    <Crown size={12} /> Lifetime
                  </span>
                ) : profile.plan === "pro" ? (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 font-medium flex items-center gap-1">
                    <Star size={12} /> Pro
                  </span>
                ) : (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 font-medium">
                    Free
                  </span>
                )}
                {profile.member_since && (
                  <span className="text-xs text-surface-400 dark:text-surface-500 flex items-center gap-1">
                    <Calendar size={12} />
                    {t("profile.memberSince") || "Dabei seit"} {formatDate(profile.member_since)}
                  </span>
                )}
              </div>
            </div>

            {/* Study Info */}
            <div className="px-5 pb-3 space-y-1.5">
              {profile.institution_name && (
                <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                  <GraduationCap size={15} className="text-surface-400 dark:text-surface-500 flex-shrink-0" />
                  <span className="truncate">{profile.institution_name}</span>
                </div>
              )}
              {profile.program_name && (
                <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                  <BookOpen size={15} className="text-surface-400 dark:text-surface-500 flex-shrink-0" />
                  <span className="truncate">
                    {profile.program_name}
                    {profile.current_semester && (
                      <span className="text-surface-400 dark:text-surface-500"> · Sem. {profile.current_semester}</span>
                    )}
                  </span>
                </div>
              )}
              {profile.study_mode && (
                <div className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-400">
                  <Clock size={15} className="text-surface-400 dark:text-surface-500 flex-shrink-0" />
                  <span>{profile.study_mode === "full_time" ? (t("profile.fullTime") || "Vollzeit") : (t("profile.partTime") || "Teilzeit")}</span>
                </div>
              )}
            </div>

            {/* Stats Grid */}
            {stats && (
              <div className="px-5 pb-4">
                <div className="grid grid-cols-4 gap-2">
                  <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-2.5 text-center">
                    <Trophy size={16} className="mx-auto text-amber-500 mb-1" />
                    <div className="text-base font-bold text-surface-900 dark:text-white">
                      {stats.rank ? `#${stats.rank}` : "—"}
                    </div>
                    <div className="text-[10px] text-surface-500 dark:text-surface-400">{t("profile.rank") || "Rang"}</div>
                  </div>
                  <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-2.5 text-center">
                    <TrendingUp size={16} className="mx-auto text-brand-500 mb-1" />
                    <div className="text-base font-bold text-surface-900 dark:text-white">
                      {profile.xp_total.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-surface-500 dark:text-surface-400">XP</div>
                  </div>
                  <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-2.5 text-center">
                    <Clock size={16} className="mx-auto text-blue-500 mb-1" />
                    <div className="text-base font-bold text-surface-900 dark:text-white">
                      {stats.total_study_hours}h
                    </div>
                    <div className="text-[10px] text-surface-500 dark:text-surface-400">{t("profile.studyTime") || "Lernzeit"}</div>
                  </div>
                  <div className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-2.5 text-center">
                    <Award size={16} className="mx-auto text-emerald-500 mb-1" />
                    <div className="text-base font-bold text-surface-900 dark:text-white">
                      {stats.achievements}
                    </div>
                    <div className="text-[10px] text-surface-500 dark:text-surface-400">{t("profile.achievements") || "Erfolge"}</div>
                  </div>
                </div>
              </div>
            )}

            {/* XP Progress Bar */}
            {profile.level > 0 && (
              <div className="px-5 pb-4">
                <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400 mb-1">
                  <span>Level {profile.level}</span>
                  <span>Level {profile.level + 1}</span>
                </div>
                <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(((profile.xp_total % 1000) / 1000) * 100, 100)}%` }}
                  />
                </div>
                <p className="text-[10px] text-surface-400 dark:text-surface-500 mt-0.5">
                  {profile.xp_total % 1000} / 1000 XP
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-2">
              {friendshipStatus === "accepted" ? (
                <div className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 text-sm font-semibold">
                  <Users size={16} />
                  {t("profile.friends") || "Befreundet"}
                </div>
              ) : friendshipStatus === "pending" ? (
                <div className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-500 dark:text-surface-400 text-sm font-semibold">
                  <Clock size={16} />
                  {t("profile.requestPending") || "Anfrage gesendet"}
                </div>
              ) : (
                <button
                  onClick={handleAddFriend}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold transition-colors"
                >
                  <UserPlus size={16} />
                  {t("community.addFriend") || "Hinzufügen"}
                </button>
              )}
              <Link
                href={`/messages?user=${profile.id}`}
                onClick={onClose}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 text-surface-700 dark:text-surface-300 text-sm font-semibold transition-colors"
              >
                <MessageCircle size={16} />
                {t("community.message") || "Nachricht"}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
