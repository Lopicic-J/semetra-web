"use client";

import { useState, useEffect, useCallback } from "react";
import { useModules } from "@/lib/hooks/useModules";
import { useTranslation } from "@/lib/i18n";
import {
  Users, Zap, Download, Search, Check, BookOpen,
  ArrowLeft, Loader2, Star,
} from "lucide-react";
import Link from "next/link";

interface SharedDeck {
  deckName: string;
  moduleName: string;
  moduleColor: string;
  moduleId: string;
  authorUsername: string;
  authorAvatar: string | null;
  cardCount: number;
  authorId: string;
}

export default function CommunityFlashcardsPage() {
  const { t } = useTranslation();
  const { modules } = useModules();
  const [decks, setDecks] = useState<SharedDeck[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [importing, setImporting] = useState<string | null>(null);
  const [imported, setImported] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (filterModule) params.set("module", filterModule);

    try {
      const res = await fetch(`/api/flashcards/community?${params}`);
      if (res.ok) {
        const data = await res.json();
        setDecks(data.decks ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [search, filterModule]);

  useEffect(() => { load(); }, [load]);

  const importDeck = async (deck: SharedDeck) => {
    const key = `${deck.authorId}-${deck.deckName}`;
    if (imported.has(key)) return;

    setImporting(key);
    try {
      const res = await fetch("/api/flashcards/community", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deckName: deck.deckName,
          moduleId: deck.moduleId,
          authorId: deck.authorId,
        }),
      });
      if (res.ok) {
        setImported(prev => new Set([...prev, key]));
      }
    } finally {
      setImporting(null);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
            <Users size={28} className="text-brand-500" />
            {t("community.flashcards") || "Community Karteikarten"}
          </h1>
          <p className="text-surface-500 text-sm mt-1">
            {t("community.flashcardsSubtitle") || "Karteikarten-Decks von anderen Studierenden entdecken und importieren"}
          </p>
        </div>
        <Link href="/flashcards" className="flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700 no-underline">
          <ArrowLeft size={14} /> {t("nav.flashcards") || "Karteikarten"}
        </Link>
      </div>

      {/* Search + Filter */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("community.searchDecks") || "Decks durchsuchen..."}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm"
          />
        </div>
        <select
          value={filterModule}
          onChange={e => setFilterModule(e.target.value)}
          className="px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm"
        >
          <option value="">{t("community.allModules") || "Alle Module"}</option>
          {modules.map(m => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-surface-400">
          <Loader2 size={20} className="animate-spin mr-2" />
          {t("community.loading") || "Wird geladen..."}
        </div>
      )}

      {/* Deck List */}
      {!loading && decks.length === 0 && (
        <div className="text-center py-12 text-surface-400">
          <Users size={40} className="mx-auto mb-3 opacity-30" />
          <p>{t("community.noDecks") || "Keine geteilten Decks gefunden"}</p>
          <p className="text-xs mt-1">{t("community.noDecksHint") || "Teile deine eigenen Decks um die Community zu starten!"}</p>
        </div>
      )}

      {!loading && decks.length > 0 && (
        <div className="space-y-3">
          {decks.map(deck => {
            const key = `${deck.authorId}-${deck.deckName}`;
            const isImported = imported.has(key);
            const isImporting = importing === key;

            return (
              <div key={key} className="flex items-center gap-4 p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] hover:border-surface-300 dark:hover:border-surface-600 transition-colors">
                {/* Module Color */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white shrink-0"
                  style={{ background: deck.moduleColor }}
                >
                  <Zap size={18} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-surface-900 dark:text-surface-50 text-sm truncate">
                    {deck.deckName}
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5 flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <BookOpen size={10} /> {deck.moduleName}
                    </span>
                    <span>·</span>
                    <span>{deck.cardCount} {t("community.cards") || "Karten"}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Users size={10} /> {deck.authorUsername}
                    </span>
                  </p>
                </div>

                {/* Import Button */}
                <button
                  onClick={() => importDeck(deck)}
                  disabled={isImported || isImporting}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors shrink-0 ${
                    isImported
                      ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400"
                      : "bg-brand-50 dark:bg-brand-950/20 text-brand-600 dark:text-brand-400 hover:bg-brand-100 dark:hover:bg-brand-950/30"
                  } disabled:opacity-60`}
                >
                  {isImporting ? <Loader2 size={12} className="animate-spin" /> :
                   isImported ? <Check size={12} /> :
                   <Download size={12} />}
                  {isImported ? (t("community.imported") || "Importiert") :
                   isImporting ? (t("community.importing") || "...") :
                   (t("community.import") || "Importieren")}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
