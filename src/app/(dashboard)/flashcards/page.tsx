"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { FREE_LIMITS, withinFreeLimit } from "@/lib/gates";
import { LimitNudge, LimitCounter, UpgradeModal } from "@/components/ui/ProGate";
import {
  Plus, Trash2, BookOpen, Brain, Sparkles, ChevronLeft, ChevronRight,
  Eye, EyeOff, RotateCcw, Check, X, Upload, Loader2, Filter
} from "lucide-react";
import type { Flashcard, Module } from "@/types/database";

// ── SM-2 Spaced Repetition ────────────────────────────────────────────────────
function sm2(card: Flashcard, quality: number): Partial<Flashcard> {
  // quality: 0-2 = fail, 3 = hard, 4 = good, 5 = easy
  let { ease_factor, interval_days, repetitions } = card;

  if (quality < 3) {
    repetitions = 0;
    interval_days = 0;
  } else {
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 3;
    else interval_days = Math.round(interval_days * ease_factor);
    repetitions += 1;
  }

  ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));

  const next = new Date();
  next.setDate(next.getDate() + interval_days);

  return {
    ease_factor,
    interval_days,
    repetitions,
    next_review: next.toISOString(),
    last_reviewed: new Date().toISOString(),
  };
}

// ── Card Create/Edit Dialog ─────────────────────────────────────────────────
function CardDialog({
  card,
  modules,
  onSave,
  onClose,
}: {
  card?: Flashcard;
  modules: Module[];
  onSave: (data: Partial<Flashcard>) => void;
  onClose: () => void;
}) {
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [moduleId, setModuleId] = useState(card?.module_id ?? "");
  const [deckName, setDeckName] = useState(card?.deck_name ?? "Standard");

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
        <h3 className="text-lg font-bold text-surface-900 mb-4">
          {card ? "Karteikarte bearbeiten" : "Neue Karteikarte"}
        </h3>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-surface-500 mb-1 block">Modul</label>
              <select
                className="input w-full"
                value={moduleId}
                onChange={(e) => setModuleId(e.target.value)}
              >
                <option value="">Kein Modul</option>
                {modules.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-surface-500 mb-1 block">Deck</label>
              <input
                className="input w-full"
                value={deckName}
                onChange={(e) => setDeckName(e.target.value)}
                placeholder="z.B. Kapitel 3"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-surface-500 mb-1 block">Vorderseite (Frage)</label>
            <textarea
              className="input w-full min-h-[80px] resize-y"
              value={front}
              onChange={(e) => setFront(e.target.value)}
              placeholder="Was ist...?"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-surface-500 mb-1 block">Rückseite (Antwort)</label>
            <textarea
              className="input w-full min-h-[80px] resize-y"
              value={back}
              onChange={(e) => setBack(e.target.value)}
              placeholder="Die Antwort ist..."
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="btn-secondary text-sm">Abbrechen</button>
          <button
            onClick={() => {
              if (!front.trim() || !back.trim()) return;
              onSave({
                front: front.trim(),
                back: back.trim(),
                module_id: moduleId || null,
                deck_name: deckName.trim() || "Standard",
              });
            }}
            disabled={!front.trim() || !back.trim()}
            className="btn-primary text-sm"
          >
            {card ? "Speichern" : "Erstellen"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Study Mode (Karteikarten lernen) ──────────────────────────────────────────
function StudyMode({
  cards,
  onRate,
  onClose,
}: {
  cards: Flashcard[];
  onRate: (id: string, quality: number) => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const card = cards[idx];

  if (!card) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
          <Check className="text-green-600" size={36} />
        </div>
        <h2 className="text-xl font-bold text-surface-900 mb-2">Geschafft!</h2>
        <p className="text-surface-500 mb-6">Alle Karteikarten für heute wiederholt.</p>
        <button onClick={onClose} className="btn-primary">Zurück</button>
      </div>
    );
  }

  const handleRate = (quality: number) => {
    onRate(card.id, quality);
    setFlipped(false);
    setIdx((i) => i + 1);
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button onClick={onClose} className="btn-ghost text-sm gap-1">
          <ChevronLeft size={14} /> Zurück
        </button>
        <span className="text-sm text-surface-400">{idx + 1} / {cards.length}</span>
      </div>

      <div
        onClick={() => setFlipped(!flipped)}
        className="card p-8 min-h-[240px] flex items-center justify-center cursor-pointer
          hover:shadow-lg transition-all select-none"
      >
        <div className="text-center">
          <p className="text-xs font-semibold text-brand-600 mb-3">
            {flipped ? "ANTWORT" : "FRAGE"}
          </p>
          <p className="text-lg text-surface-800 whitespace-pre-wrap">
            {flipped ? card.back : card.front}
          </p>
          {!flipped && (
            <p className="text-xs text-surface-400 mt-4 flex items-center justify-center gap-1">
              <Eye size={12} /> Tippe zum Aufdecken
            </p>
          )}
        </div>
      </div>

      {flipped && (
        <div className="flex justify-center gap-3 mt-6">
          <button
            onClick={() => handleRate(1)}
            className="px-5 py-2.5 rounded-xl bg-red-50 text-red-700 font-semibold text-sm hover:bg-red-100 transition-colors"
          >
            Nochmal
          </button>
          <button
            onClick={() => handleRate(3)}
            className="px-5 py-2.5 rounded-xl bg-amber-50 text-amber-700 font-semibold text-sm hover:bg-amber-100 transition-colors"
          >
            Schwer
          </button>
          <button
            onClick={() => handleRate(4)}
            className="px-5 py-2.5 rounded-xl bg-green-50 text-green-700 font-semibold text-sm hover:bg-green-100 transition-colors"
          >
            Gut
          </button>
          <button
            onClick={() => handleRate(5)}
            className="px-5 py-2.5 rounded-xl bg-blue-50 text-blue-700 font-semibold text-sm hover:bg-blue-100 transition-colors"
          >
            Leicht
          </button>
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-6 h-1.5 bg-surface-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-brand-500 rounded-full transition-all"
          style={{ width: `${((idx) / cards.length) * 100}%` }}
        />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function FlashcardsPage() {
  const supabase = createClient();
  const { profile, isPro } = useProfile();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editCard, setEditCard] = useState<Flashcard | undefined>();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [filterModule, setFilterModule] = useState<string>("");
  const [filterSource, setFilterSource] = useState<"all" | "user" | "ai">("all");
  const [selectedDeck, setSelectedDeck] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const [genModuleId, setGenModuleId] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    const [cardsRes, modsRes] = await Promise.all([
      supabase.from("flashcards").select("*, module:modules(id,name,color)").order("created_at", { ascending: false }),
      supabase.from("modules").select("id,name,color").order("name"),
    ]);
    setCards(cardsRes.data ?? []);
    setModules(modsRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Filter
  const filtered = useMemo(() => {
    let result = cards;
    if (filterModule) result = result.filter((c) => c.module_id === filterModule);
    if (filterSource !== "all") result = result.filter((c) => c.source === filterSource);
    if (selectedDeck) result = result.filter((c) => c.deck_name === selectedDeck);
    return result;
  }, [cards, filterModule, filterSource, selectedDeck]);

  // Decks
  const decks = useMemo(() => {
    const set = new Set(cards.map((c) => c.deck_name));
    return Array.from(set).sort();
  }, [cards]);

  // Due for review
  const dueCards = useMemo(() => {
    const now = new Date();
    return filtered.filter((c) => !c.next_review || new Date(c.next_review) <= now);
  }, [filtered]);

  // Stats
  const userCount = cards.filter((c) => c.source === "user").length;
  const aiCount = cards.filter((c) => c.source === "ai").length;

  async function handleSave(data: Partial<Flashcard>) {
    if (editCard) {
      const { error } = await supabase.from("flashcards").update(data).eq("id", editCard.id);
      if (error) { console.error("Update error:", error); alert("Fehler beim Speichern."); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { alert("Bitte einloggen."); return; }
      const { error } = await supabase.from("flashcards").insert({
        ...data,
        user_id: user.id,
        source: "user",
      });
      if (error) { console.error("Insert error:", error); alert("Fehler beim Erstellen."); return; }
    }
    setShowDialog(false);
    setEditCard(undefined);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("flashcards").delete().eq("id", id);
    load();
  }

  async function handleDeleteAiBatch(docName: string) {
    await supabase.from("flashcards").delete().eq("source", "ai").eq("source_document", docName);
    load();
  }

  async function handleDocUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = ""; // reset

    setGenerating(true);
    try {
      // Read file as text
      const text = await file.text();
      if (text.length < 50) {
        alert("Das Dokument ist zu kurz (min. 50 Zeichen).");
        return;
      }

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert("Bitte einloggen.");
        return;
      }

      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          text,
          module_id: genModuleId || undefined,
          filename: file.name,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Fehler bei der KI-Generierung.");
        return;
      }

      load();
      alert(`${data.count} Karteikarten aus "${file.name}" erstellt!`);
    } catch (err) {
      alert("Fehler beim Hochladen.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRate(id: string, quality: number) {
    const card = cards.find((c) => c.id === id);
    if (!card) return;
    const updates = sm2(card, quality);
    await supabase.from("flashcards").update(updates).eq("id", id);
  }

  if (studyMode && dueCards.length > 0) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <StudyMode
          cards={dueCards}
          onRate={handleRate}
          onClose={() => { setStudyMode(false); load(); }}
        />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <BookOpen className="text-brand-600" size={26} />
            Karteikarten
          </h1>
          <p className="text-surface-500 text-sm mt-1">
            {cards.length} Karten · {userCount} eigene · {aiCount} KI-generiert
            {dueCards.length > 0 && (
              <span className="text-brand-600 font-medium"> · {dueCards.length} fällig</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <LimitCounter current={decks.length} max={FREE_LIMITS.flashcardSets} isPro={isPro} />
          {dueCards.length > 0 && (
            <button
              onClick={() => setStudyMode(true)}
              className="btn-primary gap-2"
            >
              <Brain size={16} />
              Lernen ({dueCards.length})
            </button>
          )}
          <label className={`btn-secondary gap-2 cursor-pointer ${generating ? "opacity-60 pointer-events-none" : ""}`}>
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {generating ? "Generiere…" : "KI-Import"}
            <input
              type="file"
              accept=".txt,.md,.pdf,.docx,.csv"
              className="hidden"
              onChange={handleDocUpload}
              disabled={generating}
            />
          </label>
          <button
            onClick={() => {
              const check = withinFreeLimit("flashcardSets", decks.length, isPro);
              if (!check.allowed) { setShowUpgrade(true); return; }
              setEditCard(undefined); setShowDialog(true);
            }}
            className="btn-primary gap-2"
          >
            <Plus size={16} />
            Neue Karte
          </button>
        </div>
      </div>

      <LimitNudge current={decks.length} max={FREE_LIMITS.flashcardSets} isPro={isPro} label="Karteikarten-Sets" />

      {showUpgrade && (
        <UpgradeModal feature="unlimitedFlashcards" onClose={() => setShowUpgrade(false)} />
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select
          className="input text-sm py-1.5"
          value={filterModule}
          onChange={(e) => setFilterModule(e.target.value)}
        >
          <option value="">Alle Module</option>
          {modules.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <select
          className="input text-sm py-1.5"
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value as "all" | "user" | "ai")}
        >
          <option value="all">Alle Quellen</option>
          <option value="user">Eigene</option>
          <option value="ai">KI-generiert</option>
        </select>

        {decks.length > 1 && (
          <select
            className="input text-sm py-1.5"
            value={selectedDeck}
            onChange={(e) => setSelectedDeck(e.target.value)}
          >
            <option value="">Alle Decks</option>
            {decks.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}
      </div>

      {/* AI-generated batches (grouped by source_document) */}
      {filterSource === "ai" && (() => {
        const docs = new Map<string, Flashcard[]>();
        for (const c of filtered) {
          if (c.source === "ai" && c.source_document) {
            if (!docs.has(c.source_document)) docs.set(c.source_document, []);
            docs.get(c.source_document)!.push(c);
          }
        }
        if (docs.size === 0) return null;
        return (
          <div className="mb-6 space-y-2">
            {Array.from(docs.entries()).map(([doc, docCards]) => (
              <div key={doc} className="flex items-center justify-between bg-brand-50 rounded-xl px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Sparkles size={14} className="text-brand-600" />
                  <span className="text-sm font-medium text-brand-800">{doc}</span>
                  <span className="text-xs text-brand-500">({docCards.length} Karten)</span>
                </div>
                <button
                  onClick={() => handleDeleteAiBatch(doc)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium"
                >
                  Alle löschen
                </button>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Cards list */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="animate-spin mx-auto text-brand-400" size={32} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-surface-400">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Keine Karteikarten</p>
          <p className="text-sm mt-1">Erstelle deine erste Karteikarte oder lade ein Dokument hoch.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filtered.map((card) => (
            <div
              key={card.id}
              className="card p-4 hover:shadow-md transition-all group relative"
            >
              {/* Source badge */}
              <div className="flex items-center gap-2 mb-2">
                {card.source === "ai" ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                    <Sparkles size={10} /> KI
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-surface-500 bg-surface-50 px-2 py-0.5 rounded-full">
                    Eigene
                  </span>
                )}
                {card.module && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${card.module.color}15`, color: card.module.color }}
                  >
                    {card.module.name}
                  </span>
                )}
                {card.deck_name !== "Standard" && (
                  <span className="text-[10px] text-surface-400">{card.deck_name}</span>
                )}
              </div>

              {/* Content */}
              <p className="text-sm font-medium text-surface-800 mb-1 line-clamp-2">{card.front}</p>
              <p className="text-xs text-surface-500 line-clamp-2">{card.back}</p>

              {/* Actions */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <button
                  onClick={() => { setEditCard(card); setShowDialog(true); }}
                  className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600"
                >
                  <BookOpen size={14} />
                </button>
                <button
                  onClick={() => handleDelete(card.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Review status */}
              {card.next_review && new Date(card.next_review) > new Date() ? (
                <p className="text-[10px] text-green-600 mt-2">
                  Nächste Wiederholung: {new Date(card.next_review).toLocaleDateString("de-CH")}
                </p>
              ) : (
                <p className="text-[10px] text-amber-600 mt-2 font-medium">Fällig</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Dialog */}
      {showDialog && (
        <CardDialog
          card={editCard}
          modules={modules}
          onSave={handleSave}
          onClose={() => { setShowDialog(false); setEditCard(undefined); }}
        />
      )}
    </div>
  );
}
