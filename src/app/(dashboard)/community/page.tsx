"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, Search, Filter, UserPlus, MessageCircle,
  ChevronDown, Globe, GraduationCap, Wifi, WifiOff,
  Moon, Crown, Star, Shield,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useProfile } from "@/lib/hooks/useProfile";
import toast from "react-hot-toast";
import Link from "next/link";
import UserProfileModal from "@/components/community/UserProfileModal";

interface CommunityMember {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  institution_id: string;
  active_program_id: string | null;
  program_name: string | null;
  institution_name: string | null;
  current_semester: number | null;
  user_role: string;
  language: string | null;
  country: string | null;
  plan: string | null;
  xp_total: number;
  level: number;
  online_status: string;
  last_seen_at: string | null;
}

interface ProgramOption {
  id: string;
  name: string;
  degree_level: string;
}

export default function CommunityPage() {
  const { t } = useTranslation();
  const { profile } = useProfile();
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedProgram, setSelectedProgram] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const PAGE_SIZE = 30;

  const loadMembers = useCallback(async (reset = false) => {
    try {
      const params = new URLSearchParams();
      if (selectedProgram) params.set("program_id", selectedProgram);
      if (selectedSemester) params.set("semester", selectedSemester);
      if (search.trim()) params.set("search", search.trim());
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(reset ? 0 : page * PAGE_SIZE));

      const res = await fetch(`/api/community?${params}`);
      const json = await res.json();

      if (json.members) {
        setMembers(reset ? json.members : [...members, ...json.members]);
        setTotal(json.total ?? 0);
        if (json.programs) setPrograms(json.programs);
      }
    } catch {
      toast.error(t("community.loadError") || "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [selectedProgram, selectedSemester, search, page, members, t]);

  // Initial load
  useEffect(() => {
    setLoading(true);
    setPage(0);
    loadMembers(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram, selectedSemester]);

  // Search debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      setPage(0);
      loadMembers(true);
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const onlineCount = members.filter(m => m.online_status === "online").length;
  const maxSemester = Math.max(
    ...(members.map(m => m.current_semester ?? 0).filter(s => s > 0)),
    6
  );

  const handleAddFriend = async (userId: string) => {
    try {
      const res = await fetch("/api/friends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || "Fehler");
        return;
      }
      toast.success(t("community.friendRequestSent") || "Freundschaftsanfrage gesendet!");
    } catch {
      toast.error("Fehler");
    }
  };

  const StatusDot = ({ status }: { status: string }) => {
    const colors: Record<string, string> = {
      online: "bg-green-500",
      away: "bg-amber-500",
      dnd: "bg-red-500",
 offline:"bg-surface-400",
    };
    return (
      <span
 className={`absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white ${colors[status] || colors.offline}`}
        title={status === "dnd" ? (t("community.dnd") || "Nicht stören") : status}
      />
    );
  };

  const PlanBadge = ({ plan }: { plan: string | null }) => {
    if (!plan || plan === "free") return (
 <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-200 text-surface-500 font-medium">
        Free
      </span>
    );
    if (plan === "lifetime") return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 font-medium flex items-center gap-0.5">
        <Crown size={10} /> Lifetime
      </span>
    );
    return (
      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-brand-100 dark:bg-brand-900/50 text-brand-700 dark:text-brand-300 font-medium flex items-center gap-0.5">
        <Star size={10} /> Pro
      </span>
    );
  };

  const RoleBadge = ({ role }: { role: string }) => {
    const roleConfig: Record<string, { label: string; icon: typeof Shield; bgClass: string }> = {
      admin: { label: "Admin", icon: Shield, bgClass: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" },
      institution: { label: "Institution", icon: GraduationCap, bgClass: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" },
      dozent: { label: "Dozent", icon: GraduationCap, bgClass: "bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300" },
      student: { label: "Student", icon: Users, bgClass: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300" },
 non_student: { label:"Gast", icon: Globe, bgClass:"bg-surface-200 text-surface-600" },
    };
    const config = roleConfig[role];
    if (!config) return null;
    const Icon = config.icon;
    return (
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex items-center gap-0.5 ${config.bgClass}`}>
        <Icon size={10} /> {config.label}
      </span>
    );
  };

  const CountryFlag = ({ country }: { country: string | null }) => {
    const flags: Record<string, string> = {
      CH: "🇨🇭", DE: "🇩🇪", AT: "🇦🇹", FR: "🇫🇷", IT: "🇮🇹", ES: "🇪🇸", NL: "🇳🇱", UK: "🇬🇧", GB: "🇬🇧",
    };
    return country ? <span className="text-xs" title={country}>{flags[country] || "🌐"}</span> : null;
  };

  if (!profile?.institution_id) {
    return (
      <div className="px-2 sm:px-4 py-6 max-w-4xl mx-auto">
        <div className="card text-center py-12">
          <Users className="mx-auto text-surface-400 mb-4" size={48} />
          <h2 className="text-lg font-semibold text-surface-900 dark:text-white mb-2">
            {t("community.noInstitution") || "Keine Institution ausgewählt"}
          </h2>
 <p className="text-sm text-surface-500 max-w-md mx-auto">
            {t("community.noInstitutionDesc") || "Wähle in den Einstellungen deine Hochschule aus, um die Community zu sehen."}
          </p>
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-xl bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 transition-colors"
          >
            {t("community.goToSettings") || "Zu den Einstellungen"}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-4 py-4 sm:py-6 max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-100 dark:bg-brand-900/30 rounded-xl">
            <Users className="text-brand-600 dark:text-brand-400" size={26} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-900 dark:text-white">
              {t("community.title") || "Community"}
            </h1>
 <p className="text-sm text-surface-500">
              {total} {t("community.members") || "Mitglieder"} · {onlineCount} {t("community.online") || "online"}
            </p>
          </div>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="card space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={18} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("community.searchPlaceholder") || "Nach Name oder Benutzername suchen..."}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-surface-100 border border-surface-200 text-sm text-surface-900 placeholder:text-surface-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${
              showFilters || selectedProgram || selectedSemester
                ? "border-brand-300 dark:border-brand-700 bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300"
 :"border-surface-200 text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800"
            }`}
          >
            <Filter size={16} />
            <span className="hidden sm:inline">{t("community.filter") || "Filter"}</span>
            {(selectedProgram || selectedSemester) && (
              <span className="w-2 h-2 rounded-full bg-brand-500" />
            )}
          </button>
        </div>

        {showFilters && (
          <div className="flex flex-wrap gap-3 pt-1">
            {/* Program filter */}
            <div className="relative min-w-[200px]">
              <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" size={16} />
              <select
                value={selectedProgram}
                onChange={e => { setSelectedProgram(e.target.value); setPage(0); }}
                className="w-full appearance-none pl-9 pr-8 py-2 rounded-xl bg-surface-100 border border-surface-200 text-sm text-surface-900 focus:ring-2 focus:ring-brand-500"
              >
                <option value="">{t("community.allPrograms") || "Alle Studiengänge"}</option>
                {programs.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.degree_level})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" size={14} />
            </div>

            {/* Semester filter */}
            <div className="relative min-w-[160px]">
              <select
                value={selectedSemester}
                onChange={e => { setSelectedSemester(e.target.value); setPage(0); }}
                className="w-full appearance-none px-4 pr-8 py-2 rounded-xl bg-surface-100 border border-surface-200 text-sm text-surface-900 focus:ring-2 focus:ring-brand-500"
              >
                <option value="">{t("community.allSemesters") || "Alle Semester"}</option>
                {Array.from({ length: maxSemester }, (_, i) => i + 1).map(s => (
                  <option key={s} value={s}>
                    {t("community.semester") || "Semester"} {s}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" size={14} />
            </div>

            {/* Clear filters */}
            {(selectedProgram || selectedSemester) && (
              <button
                onClick={() => { setSelectedProgram(""); setSelectedSemester(""); }}
                className="px-3 py-2 rounded-xl text-sm text-brand-600 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
              >
                {t("community.clearFilters") || "Filter zurücksetzen"}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Members Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-surface-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-24 bg-surface-200 rounded" />
                  <div className="h-3 w-32 bg-surface-200 rounded" />
                  <div className="h-3 w-20 bg-surface-200 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="card text-center py-12">
          <Users className="mx-auto text-surface-400 mb-4" size={40} />
 <p className="text-surface-600 font-medium">
            {search
              ? (t("community.noResults") || "Keine Ergebnisse gefunden")
              : (t("community.empty") || "Noch keine Mitglieder in deiner Community")}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {members.map(member => (
              <div
                key={member.id}
                className="card hover:shadow-md transition-shadow group cursor-pointer"
                onClick={() => setSelectedUserId(member.id)}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar with status */}
                  <div className="relative shrink-0">
                    {member.avatar_url ? (
                      <img
                        src={member.avatar_url}
                        alt={member.username}
                        className="w-12 h-12 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                        <span className="text-brand-600 dark:text-brand-400 font-bold text-lg">
                          {(member.full_name || member.username || "?")[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <StatusDot status={member.online_status} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-semibold text-sm text-surface-900 dark:text-white truncate">
                        {member.full_name || member.username}
                      </span>
                      <CountryFlag country={member.country} />
                    </div>

 <p className="text-xs text-surface-500 truncate">
                      @{member.username}
                    </p>

                    {member.program_name && (
 <p className="text-xs text-surface-600 mt-0.5 truncate" title={member.program_name}>
                        {member.program_name}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      {member.current_semester && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-100 text-surface-600 font-medium">
                          Sem. {member.current_semester}
                        </span>
                      )}
                      <PlanBadge plan={member.plan} />
                      <RoleBadge role={member.user_role} />
                      {member.level > 1 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 font-medium">
                          Lv. {member.level}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
 <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-100">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleAddFriend(member.id); }}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 dark:bg-brand-900/20 text-brand-600 dark:text-brand-400 text-xs font-semibold hover:bg-brand-100 dark:hover:bg-brand-900/40 transition-colors"
                  >
                    <UserPlus size={14} />
                    {t("community.addFriend") || "Hinzufügen"}
                  </button>
                  <Link
                    href={`/messages?user=${member.id}`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-100 text-surface-600 text-xs font-semibold hover:bg-surface-200 transition-colors"
                  >
                    <MessageCircle size={14} />
                    {t("community.message") || "Nachricht"}
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Load more */}
          {members.length < total && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => {
                  setPage(p => p + 1);
                  loadMembers(false);
                }}
                className="px-6 py-2.5 rounded-xl bg-surface-100 text-surface-700 text-sm font-semibold hover:bg-surface-200 transition-colors"
              >
                {t("community.loadMore") || "Mehr laden"} ({members.length}/{total})
              </button>
            </div>
          )}
        </>
      )}
      {/* Profile Modal */}
      <UserProfileModal
        userId={selectedUserId}
        onClose={() => setSelectedUserId(null)}
      />
    </div>
  );
}
