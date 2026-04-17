"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { Trophy, Plus, Users, Clock, Target, Flame, BookOpen, Zap, Copy, Check } from "lucide-react";

interface Challenge {
  id: string;
  title: string;
  description: string | null;
  challenge_type: string;
  target_value: number | null;
  starts_at: string;
  ends_at: string;
  invite_code: string;
  is_public: boolean;
  participantCount: number;
  leaderboard: { userId: string; username: string; avatarUrl: string | null; value: number; rank: number; isCurrentUser: boolean }[];
  userProgress: number | null;
  userRank: number | null;
  isJoined: boolean;
  isCreator: boolean;
  daysLeft: number;
}

const TYPE_LABELS: Record<string, { label: string; icon: typeof Trophy; unit: string }> = {
  study_time: { label: "Lernzeit", icon: Clock, unit: "Min" },
  streak: { label: "Streak", icon: Flame, unit: "Tage" },
  tasks_completed: { label: "Aufgaben", icon: Target, unit: "Tasks" },
  flashcards_reviewed: { label: "Flashcards", icon: Zap, unit: "Karten" },
  topics_mastered: { label: "Themen", icon: BookOpen, unit: "Themen" },
};

export default function ChallengesPage() {
  const { t } = useTranslation();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/challenges");
      if (res.ok) {
        const data = await res.json();
        setChallenges(data.challenges ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleJoin = async () => {
    if (!joinCode.trim()) return;
    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", inviteCode: joinCode.trim() }),
    });
    if (res.ok) { setJoinCode(""); load(); }
  };

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/challenges", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: fd.get("title"),
        description: fd.get("description") || null,
        challengeType: fd.get("type") || "study_time",
        durationDays: Number(fd.get("duration")) || 7,
        isPublic: fd.get("public") === "on",
      }),
    });
    if (res.ok) { setShowCreate(false); load(); }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4 animate-pulse">
        <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-48" />
        {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-surface-200 dark:bg-surface-700 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
          <Trophy size={28} className="text-amber-500" />
          Challenges
        </h1>
        <button onClick={() => setShowCreate(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-brand-600 text-white hover:bg-brand-700">
          <Plus size={16} /> Neue Challenge
        </button>
      </div>

      {/* Join */}
      <div className="flex gap-2">
        <input
          type="text"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value)}
          placeholder="Einladungscode eingeben..."
          className="flex-1 px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm"
        />
        <button onClick={handleJoin} disabled={!joinCode.trim()} className="px-4 py-2 rounded-xl text-sm font-medium bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 disabled:opacity-50">
          Beitreten
        </button>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] p-5">
          <h2 className="font-semibold text-surface-900 dark:text-surface-50 mb-4">Neue Challenge erstellen</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <input name="title" required placeholder="Challenge-Name" className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-transparent text-sm" />
            <input name="description" placeholder="Beschreibung (optional)" className="w-full px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-transparent text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <select name="type" className="px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm">
                <option value="study_time">Lernzeit</option>
                <option value="streak">Streak</option>
                <option value="tasks_completed">Aufgaben</option>
                <option value="flashcards_reviewed">Flashcards</option>
                <option value="topics_mastered">Themen</option>
              </select>
              <select name="duration" className="px-3 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm">
                <option value="7">7 Tage</option>
                <option value="14">14 Tage</option>
                <option value="30">30 Tage</option>
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-surface-600">
              <input name="public" type="checkbox" className="rounded" /> Öffentlich (alle können beitreten)
            </label>
            <div className="flex gap-2 pt-2">
              <button type="submit" className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700">Erstellen</button>
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg text-sm text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800">Abbrechen</button>
            </div>
          </form>
        </div>
      )}

      {/* Challenge List */}
      {challenges.length === 0 ? (
        <div className="text-center py-12 text-surface-400">
          <Trophy size={40} className="mx-auto mb-3 opacity-30" />
          <p>Keine aktiven Challenges. Erstelle eine oder tritt einer bei!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {challenges.map(ch => {
            const typeInfo = TYPE_LABELS[ch.challenge_type] ?? TYPE_LABELS.study_time;
            const Icon = typeInfo.icon;

            return (
              <div key={ch.id} className="rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] overflow-hidden">
                {/* Challenge Header */}
                <div className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                    <Icon size={20} className="text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-surface-900 dark:text-surface-50 truncate">{ch.title}</h3>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {typeInfo.label} · {ch.daysLeft} Tage verbleibend · <Users size={11} className="inline" /> {ch.participantCount}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    {ch.isJoined && ch.userRank && (
                      <p className="text-lg font-bold text-amber-600">#{ch.userRank}</p>
                    )}
                    {ch.isJoined && ch.userProgress !== null && (
                      <p className="text-xs text-surface-500">{ch.userProgress} {typeInfo.unit}</p>
                    )}
                  </div>
                </div>

                {/* Target Progress */}
                {ch.target_value && ch.isJoined && (
                  <div className="px-4 pb-2">
                    <div className="h-1.5 bg-surface-100 dark:bg-surface-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${Math.min(100, ((ch.userProgress ?? 0) / ch.target_value) * 100)}%` }} />
                    </div>
                    <p className="text-[10px] text-surface-400 mt-1">{ch.userProgress ?? 0} / {ch.target_value} {typeInfo.unit}</p>
                  </div>
                )}

                {/* Leaderboard */}
                <div className="border-t border-surface-100 dark:border-surface-800 px-4 py-3">
                  <div className="space-y-1.5">
                    {ch.leaderboard.slice(0, 5).map(p => (
                      <div key={p.userId} className={`flex items-center gap-2 text-sm ${p.isCurrentUser ? "font-semibold text-brand-600" : "text-surface-700 dark:text-surface-300"}`}>
                        <span className="w-5 text-xs text-surface-400 text-right">{p.rank}.</span>
                        <span className="flex-1 truncate">{p.username}{p.isCurrentUser ? " (du)" : ""}</span>
                        <span className="text-xs font-medium">{p.value} {typeInfo.unit}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Invite Code */}
                {ch.isCreator && (
                  <div className="border-t border-surface-100 dark:border-surface-800 px-4 py-2 flex items-center gap-2">
                    <span className="text-xs text-surface-400">Code:</span>
                    <code className="text-xs font-mono bg-surface-100 dark:bg-surface-800 px-2 py-0.5 rounded">{ch.invite_code}</code>
                    <button onClick={() => copyCode(ch.invite_code)} className="text-xs text-brand-600 hover:text-brand-700">
                      {copiedCode === ch.invite_code ? <Check size={12} /> : <Copy size={12} />}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
