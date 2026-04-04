"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { useModules } from "@/lib/hooks/useModules";
import { FREE_LIMITS, withinFreeLimit } from "@/lib/gates";
import { LimitNudge, LimitCounter, UpgradeModal } from "@/components/ui/ProGate";
import {
  Plus, Trash2, BookOpen, Brain, Sparkles, ChevronLeft,
  Eye, Check, X, Loader2, Keyboard, Maximize2, Minimize2,
  Flame, AlertTriangle, CheckCircle2, XCircle, BarChart3,
  Calendar, Tag, FileText, Zap, Copy, Clock, Target,
  TrendingUp, ArrowRight, type LucideIcon,
} from "lucide-react";
import type { Flashcard, Module, CalendarEvent } from "@/types/database";
import { useTranslation } from "@/lib/i18n";

/* ═══════════════════════════════════════════════════════════════════════
   SM-2 SPACED REPETITION — Enhanced with Exam Mode
   ═══════════════════════════════════════════════════════════════════════ */

function sm2(
  card: Flashcard,
  quality: number,          // 0=fail, 1=hard, 2=good, 3=perfect
  daysUntilExam?: number,   // if exam linked → compress intervals
): Partial<Flashcard> {
  // Map 0-3 to SM-2 scale (0-5)
  const q = quality === 0 ? 1 : quality === 1 ? 3 : quality === 2 ? 4 : 5;

  let { ease_factor, interval_days, repetitions, streak, total_reviews, correct_count } = card;
  total_reviews = (total_reviews ?? 0) + 1;

  if (q < 3) {
    // Failed
    repetitions = 0;
    interval_days = 0;
    streak = 0;
  } else {
    // Passed
    correct_count = (correct_count ?? 0) + 1;
    streak = (streak ?? 0) + 1;
    if (repetitions === 0) interval_days = 1;
    else if (repetitions === 1) interval_days = 3;
    else interval_days = Math.round(interval_days * ease_factor);
    repetitions += 1;
  }

  ease_factor = Math.max(1.3, ease_factor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  // ── Exam Mode: compress intervals when exam is near ──
  if (daysUntilExam !== undefined && daysUntilExam > 0) {
    // Cap interval to not exceed exam date
    interval_days = Math.min(interval_days, Math.max(1, Math.floor(daysUntilExam * 0.7)));
    // If exam < 3 days, review everything daily
    if (daysUntilExam <= 3) interval_days = Math.min(interval_days, 1);
    // Failed cards come back even faster
    if (q < 3 && daysUntilExam <= 7) interval_days = 0;
  }

  const next = new Date();
  next.setDate(next.getDate() + interval_days);

  return {
    ease_factor,
    interval_days,
    repetitions,
    streak,
    total_reviews,
    correct_count,
    next_review: next.toISOString(),
    last_reviewed: new Date().toISOString(),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   CLOZE HELPERS
   ═══════════════════════════════════════════════════════════════════════ */

function parseCloze(text: string): { display: string; answer: string } {
  const match = text.match(/\{\{c\d+::(.+?)\}\}/);
  if (!match) return { display: text, answer: "" };
  const answer = match[1];
  const display = text.replace(/\{\{c\d+::(.+?)\}\}/, "[...]");
  return { display, answer };
}

function hasCloze(text: string): boolean {
  return /\{\{c\d+::(.+?)\}\}/.test(text);
}

/* ═══════════════════════════════════════════════════════════════════════
   REVIEW HISTORY (localStorage for heatmap)
   ═══════════════════════════════════════════════════════════════════════ */

function recordReview() {
  if (typeof window === "undefined") return;
  const today = new Date().toISOString().slice(0, 10);
  const key = "semetra_fc_history";
  const raw = localStorage.getItem(key);
  const data: Record<string, number> = raw ? JSON.parse(raw) : {};
  data[today] = (data[today] ?? 0) + 1;
  // Keep 90 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  for (const k of Object.keys(data)) {
    if (k < cutoffStr) delete data[k];
  }
  localStorage.setItem(key, JSON.stringify(data));
}

function getReviewHistory(): Record<string, number> {
  if (typeof window === "undefined") return {};
  const raw = localStorage.getItem("semetra_fc_history");
  return raw ? JSON.parse(raw) : {};
}

function getTodayReviews(): number {
  const h = getReviewHistory();
  return h[new Date().toISOString().slice(0, 10)] ?? 0;
}

/* ═══════════════════════════════════════════════════════════════════════
   RATING BUTTONS CONFIG
   ═══════════════════════════════════════════════════════════════════════ */

const RATINGS = [
  { quality: 0, key: "1", label: "fc.rateFail", icon: XCircle, color: "bg-red-50 text-red-700 hover:bg-red-100", shortLabel: "1" },
  { quality: 1, key: "2", label: "fc.rateHard", icon: AlertTriangle, color: "bg-amber-50 text-amber-700 hover:bg-amber-100", shortLabel: "2" },
  { quality: 2, key: "3", label: "fc.rateGood", icon: CheckCircle2, color: "bg-green-50 text-green-700 hover:bg-green-100", shortLabel: "3" },
  { quality: 3, key: "4", label: "fc.ratePerfect", icon: Flame, color: "bg-blue-50 text-blue-700 hover:bg-blue-100", shortLabel: "4" },
];

/* ═══════════════════════════════════════════════════════════════════════
   STUDY MODE — Keyboard-first, Focus Mode
   ═══════════════════════════════════════════════════════════════════════ */

function StudyMode({
  cards,
  exams,
  onRate,
  onClose,
}: {
  cards: Flashcard[];
  exams: CalendarEvent[];
  onRate: (id: string, quality: number, daysUntilExam?: number) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [mcSelected, setMcSelected] = useState<number | null>(null);
  const [clozeInput, setClozeInput] = useState("");
  const [clozeChecked, setClozeChecked] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const clozeInputRef = useRef<HTMLInputElement>(null);

  const card = cards[idx];
  const todayCount = getTodayReviews();

  // Calculate days until exam for this card
  const daysUntilExam = useMemo(() => {
    if (!card) return undefined;
    const exam = exams.find(e =>
      e.id === card.exam_id ||
      (card.module_id && e.title?.toLowerCase().includes("prüfung"))
    );
    if (!exam?.start_dt) return undefined;
    const diff = Math.ceil((new Date(exam.start_dt).getTime() - Date.now()) / 86400000);
    return diff > 0 ? diff : undefined;
  }, [card, exams]);

  // Keyboard handler
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement) return;

      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!flipped) setFlipped(true);
      } else if (e.key === "Escape") {
        if (focusMode) setFocusMode(false);
        else onClose();
      } else if (e.key === "f" || e.key === "F") {
        if (!flipped) return;
        setFocusMode(f => !f);
      } else if (flipped && !card?.choices) {
        const num = parseInt(e.key);
        if (num >= 1 && num <= 4) {
          e.preventDefault();
          handleRate(num - 1);
        }
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [flipped, idx, focusMode, card]);

  // Focus cloze input on card change
  useEffect(() => {
    if (card?.card_type === "cloze") {
      setClozeInput("");
      setClozeChecked(false);
      setTimeout(() => clozeInputRef.current?.focus(), 100);
    }
    setMcSelected(null);
  }, [idx, card?.card_type]);

  if (!card) {
    return (
      <div className={`${focusMode ? "fixed inset-0 z-50 bg-white" : ""} flex items-center justify-center min-h-[60vh]`}>
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check className="text-green-600" size={36} />
          </div>
          <h2 className="text-xl font-bold text-surface-900 mb-2">{t("fc.sessionComplete")}</h2>
          <p className="text-surface-500 mb-2">{t("fc.reviewedCards", { count: String(idx) })}</p>
          <p className="text-sm text-surface-400 mb-6">{t("fc.todayTotal", { count: String(todayCount) })}</p>
          <button onClick={onClose} className="btn-primary">{t("fc.backToOverview")}</button>
        </div>
      </div>
    );
  }

  function handleRate(quality: number) {
    onRate(card.id, quality, daysUntilExam);
    recordReview();
    setFlipped(false);
    setMcSelected(null);
    setClozeInput("");
    setClozeChecked(false);
    setIdx(i => i + 1);
  }

  function handleMcSelect(choiceIdx: number) {
    setMcSelected(choiceIdx);
    setFlipped(true);
  }

  function handleClozeCheck() {
    setClozeChecked(true);
    setFlipped(true);
  }

  const cloze = card.card_type === "cloze" ? parseCloze(card.front) : null;
  const isCorrectCloze = cloze && clozeInput.trim().toLowerCase() === cloze.answer.toLowerCase();
  const isCorrectMc = card.choices && mcSelected !== null && card.choices[mcSelected] === card.back;

  const progress = idx / cards.length;

  return (
    <div
      ref={containerRef}
      className={`${focusMode ? "fixed inset-0 z-50 bg-white flex flex-col items-center justify-center p-6" : "max-w-2xl mx-auto"}`}
    >
      {/* Header */}
      <div className={`flex items-center justify-between mb-6 w-full ${focusMode ? "max-w-2xl" : ""}`}>
        <button onClick={onClose} className="text-surface-500 hover:text-surface-900 transition flex items-center gap-1 text-sm">
          <ChevronLeft size={14} /> {t("fc.backToOverview")}
        </button>
        <div className="flex items-center gap-3">
          {daysUntilExam !== undefined && (
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-red-50 text-red-600 flex items-center gap-1">
              <Calendar size={10} /> {t("fc.examIn", { days: String(daysUntilExam) })}
            </span>
          )}
          <span className="text-sm text-surface-400">{idx + 1} / {cards.length}</span>
          <button
            onClick={() => setFocusMode(f => !f)}
            className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-700 transition"
            title="Focus Mode (F)"
          >
            {focusMode ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
        </div>
      </div>

      {/* Card */}
      <div className={`w-full ${focusMode ? "max-w-2xl" : ""}`}>
        {/* ── Basic card ── */}
        {card.card_type === "basic" && (
          <div
            onClick={() => !flipped && setFlipped(true)}
            className={`bg-white border border-surface-200 rounded-2xl p-8 sm:p-12 min-h-[280px] flex items-center justify-center cursor-pointer
              hover:shadow-lg transition-all select-none ${focusMode ? "min-h-[360px]" : ""}`}
          >
            <div className="text-center max-w-lg">
              <p className="text-xs font-semibold text-brand-600 mb-4 tracking-wider uppercase">
                {flipped ? t("flashcards.answer") : t("flashcards.question")}
              </p>
              <p className={`text-surface-800 whitespace-pre-wrap leading-relaxed ${focusMode ? "text-2xl" : "text-lg"}`}>
                {flipped ? card.back : card.front}
              </p>
              {!flipped && (
                <p className="text-xs text-surface-400 mt-6 flex items-center justify-center gap-1.5">
                  <Keyboard size={12} /> {t("fc.pressSpace")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Cloze card ── */}
        {card.card_type === "cloze" && cloze && (
          <div className={`bg-white border border-surface-200 rounded-2xl p-8 sm:p-12 min-h-[280px] flex flex-col items-center justify-center ${focusMode ? "min-h-[360px]" : ""}`}>
            <p className="text-xs font-semibold text-purple-600 mb-4 tracking-wider uppercase">{t("fc.cloze")}</p>
            <p className={`text-surface-800 whitespace-pre-wrap leading-relaxed text-center mb-6 ${focusMode ? "text-2xl" : "text-lg"}`}>
              {cloze.display}
            </p>
            {!clozeChecked ? (
              <div className="flex gap-2 w-full max-w-sm">
                <input
                  ref={clozeInputRef}
                  value={clozeInput}
                  onChange={e => setClozeInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") handleClozeCheck(); }}
                  placeholder={t("fc.clozeInputPlaceholder")}
                  className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-4 py-2.5 text-sm text-surface-900 focus:border-brand-500 focus:outline-none"
                  autoFocus
                />
                <button onClick={handleClozeCheck} className="btn-primary text-sm px-4">{t("fc.check")}</button>
              </div>
            ) : (
              <div className="text-center">
                <p className={`text-sm font-medium mb-1 ${isCorrectCloze ? "text-green-600" : "text-red-600"}`}>
                  {isCorrectCloze ? t("fc.correct") : t("fc.incorrect")}
                </p>
                <p className="text-sm text-surface-600">
                  {t("fc.correctAnswer")}: <strong>{cloze.answer}</strong>
                </p>
                {clozeInput && !isCorrectCloze && (
                  <p className="text-xs text-surface-400 mt-1">{t("fc.yourAnswer")}: {clozeInput}</p>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Multiple Choice card ── */}
        {card.card_type === "mc" && card.choices && (
          <div className={`bg-white border border-surface-200 rounded-2xl p-8 sm:p-12 min-h-[280px] ${focusMode ? "min-h-[360px]" : ""}`}>
            <p className="text-xs font-semibold text-cyan-600 mb-4 tracking-wider uppercase text-center">{t("fc.multipleChoice")}</p>
            <p className={`text-surface-800 whitespace-pre-wrap leading-relaxed text-center mb-8 ${focusMode ? "text-2xl" : "text-lg"}`}>
              {card.front}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg mx-auto">
              {card.choices.map((choice, ci) => {
                const isCorrect = choice === card.back;
                const isSelected = mcSelected === ci;
                let style = "bg-surface-50 border-surface-200 text-surface-800 hover:border-surface-300";
                if (flipped && isCorrect) style = "bg-green-50 border-green-300 text-green-800";
                else if (flipped && isSelected && !isCorrect) style = "bg-red-50 border-red-300 text-red-800";
                return (
                  <button
                    key={ci}
                    onClick={() => !flipped && handleMcSelect(ci)}
                    disabled={flipped}
                    className={`px-4 py-3 rounded-xl border text-sm font-medium text-left transition ${style}`}
                  >
                    <span className="text-xs text-surface-400 mr-2">{String.fromCharCode(65 + ci)}</span>
                    {choice}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Rating buttons */}
        {flipped && (
          <div className="mt-6">
            {/* For MC/Cloze: auto-suggest rating based on correctness */}
            <div className="flex justify-center gap-3">
              {RATINGS.map(r => (
                <button
                  key={r.quality}
                  onClick={() => handleRate(r.quality)}
                  className={`px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 ${r.color}`}
                >
                  <r.icon size={14} />
                  <span className="hidden sm:inline">{t(r.label)}</span>
                  <kbd className="text-xs opacity-50 ml-1">{r.shortLabel}</kbd>
                </button>
              ))}
            </div>
            <p className="text-center text-xs text-surface-400 mt-3">{t("fc.rateHint")}</p>
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-6 h-1.5 bg-surface-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-brand-500 rounded-full transition-all duration-300"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        {/* Keyboard hints */}
        {!flipped && card.card_type === "basic" && (
          <div className="mt-4 flex justify-center gap-4 text-xs text-surface-400">
            <span><kbd className="px-1.5 py-0.5 bg-surface-100 rounded text-surface-500">Space</kbd> {t("fc.flip")}</span>
            <span><kbd className="px-1.5 py-0.5 bg-surface-100 rounded text-surface-500">F</kbd> {t("fc.focus") || "Focus"}</span>
            <span><kbd className="px-1.5 py-0.5 bg-surface-100 rounded text-surface-500">Esc</kbd> {t("fc.exit")}</span>
          </div>
        )}
        {flipped && (
          <div className="mt-3 flex justify-center gap-4 text-xs text-surface-400">
            <span><kbd className="px-1.5 py-0.5 bg-surface-100 rounded text-surface-500">1-4</kbd> {t("fc.rateKeys")}</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   CARD DIALOG — Enhanced with card types
   ═══════════════════════════════════════════════════════════════════════ */

function CardDialog({
  card,
  modules,
  exams,
  onSave,
  onClose,
}: {
  card?: Flashcard;
  modules: Module[];
  exams: CalendarEvent[];
  onSave: (data: Partial<Flashcard>) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [cardType, setCardType] = useState<"basic" | "cloze" | "mc">(card?.card_type ?? "basic");
  const [front, setFront] = useState(card?.front ?? "");
  const [back, setBack] = useState(card?.back ?? "");
  const [moduleId, setModuleId] = useState(card?.module_id ?? "");
  const [examId, setExamId] = useState(card?.exam_id ?? "");
  const [deckName, setDeckName] = useState(card?.deck_name ?? (t("flashcards.defaultDeck") || "Standard"));
  const [tags, setTags] = useState(card?.tags?.join(", ") ?? "");
  const [choices, setChoices] = useState<string[]>(card?.choices ?? ["", "", "", ""]);

  const filteredExams = moduleId
    ? exams.filter(e => {
        const mod = modules.find(m => m.id === moduleId);
        return mod && e.title?.toLowerCase().includes(mod.name.toLowerCase().slice(0, 5));
      })
    : exams;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-surface-900">
            {card ? t("flashcards.editCard") : t("flashcards.newCard")}
          </h3>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-900"><X size={20} /></button>
        </div>

        {/* Card type selector */}
        <div className="flex gap-2 mb-4">
          {[
            { type: "basic" as const, label: t("fc.typeBasic"), color: "brand" },
            { type: "cloze" as const, label: t("fc.typeCloze"), color: "purple" },
            { type: "mc" as const, label: t("fc.typeMC"), color: "cyan" },
          ].map(ct => (
            <button
              key={ct.type}
              onClick={() => setCardType(ct.type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                cardType === ct.type
                  ? "bg-brand-600 text-white"
                  : "bg-surface-100 text-surface-600 hover:bg-surface-200"
              }`}
            >
              {ct.label}
            </button>
          ))}
        </div>

        {/* Module + Deck + Exam */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs font-medium text-surface-500 mb-1 block">{t("nav.modules")}</label>
            <select className="input w-full" value={moduleId} onChange={e => { setModuleId(e.target.value); setExamId(""); }}>
              <option value="">— {t("tasks.modal.moduleEmpty")} —</option>
              {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-500 mb-1 block">{t("flashcards.deck")}</label>
            <input className="input w-full" value={deckName} onChange={e => setDeckName(e.target.value)} placeholder={t("flashcards.deckPlaceholder")} />
          </div>
        </div>

        {moduleId && filteredExams.length > 0 && (
          <div className="mb-4">
            <label className="text-xs font-medium text-surface-500 mb-1 block">{t("fc.linkExam")}</label>
            <select className="input w-full" value={examId} onChange={e => setExamId(e.target.value)}>
              <option value="">— {t("fc.noExamLink")} —</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title} ({new Date(e.start_dt).toLocaleDateString(undefined)})</option>)}
            </select>
          </div>
        )}

        {/* Front */}
        <div className="mb-4">
          <label className="text-xs font-medium text-surface-500 mb-1 block">
            {cardType === "cloze" ? t("fc.clozeHelp") : t("flashcards.question")}
          </label>
          <textarea
            className="input w-full min-h-[80px] resize-y"
            value={front}
            onChange={e => setFront(e.target.value)}
            placeholder={cardType === "cloze" ? (t("flashcards.clozePlaceholder") || "Die Hauptstadt der Schweiz ist {{c1::Bern}}.") : t("flashcards.newCardFront")}
          />
        </div>

        {/* Back (for basic/cloze) or Correct Answer (for MC) */}
        {cardType !== "mc" ? (
          <div className="mb-4">
            <label className="text-xs font-medium text-surface-500 mb-1 block">{t("flashcards.answer")}</label>
            <textarea
              className="input w-full min-h-[80px] resize-y"
              value={back}
              onChange={e => setBack(e.target.value)}
              placeholder={t("flashcards.newCardBack")}
            />
          </div>
        ) : (
          <div className="mb-4 space-y-2">
            <label className="text-xs font-medium text-surface-500 mb-1 block">{t("fc.mcChoices")}</label>
            {choices.map((ch, ci) => (
              <div key={ci} className="flex items-center gap-2">
                <span className={`text-xs font-bold w-5 h-5 flex items-center justify-center rounded-full ${
                  back === ch && ch ? "bg-green-100 text-green-700" : "bg-surface-100 text-surface-500"
                }`}>{String.fromCharCode(65 + ci)}</span>
                <input
                  className="input flex-1"
                  value={ch}
                  onChange={e => {
                    const newC = [...choices];
                    newC[ci] = e.target.value;
                    setChoices(newC);
                  }}
                  placeholder={`${t("fc.choice")} ${String.fromCharCode(65 + ci)}`}
                />
                <button
                  onClick={() => setBack(ch)}
                  className={`text-xs px-2 py-1 rounded ${back === ch ? "bg-green-100 text-green-700" : "bg-surface-100 text-surface-500 hover:bg-surface-200"}`}
                  title={t("fc.markCorrect")}
                >
                  <Check size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Tags */}
        <div className="mb-4">
          <label className="text-xs font-medium text-surface-500 mb-1 block">{t("fc.tags")}</label>
          <input
            className="input w-full"
            value={tags}
            onChange={e => setTags(e.target.value)}
            placeholder={t("fc.tagsPlaceholder")}
          />
        </div>

        {/* Save */}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-sm">{t("tasks.modal.cancel")}</button>
          <button
            onClick={() => {
              const isValid = cardType === "mc"
                ? front.trim() && back.trim() && choices.filter(c => c.trim()).length >= 2
                : front.trim() && (cardType === "cloze" ? hasCloze(front) : back.trim());
              if (!isValid) return;
              onSave({
                front: front.trim(),
                back: cardType === "cloze" ? parseCloze(front).answer : back.trim(),
                card_type: cardType,
                module_id: moduleId || null,
                exam_id: examId || null,
                deck_name: deckName.trim() || (t("flashcards.defaultDeck") || "Standard"),
                tags: tags.split(",").map(t => t.trim()).filter(Boolean),
                choices: cardType === "mc" ? choices.filter(c => c.trim()) : null,
              });
            }}
            className="btn-primary text-sm"
          >
            {card ? t("knowledge.save") : t("flashcards.creating")}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   BULK CREATE MODE
   ═══════════════════════════════════════════════════════════════════════ */

function BulkCreatePanel({
  modules,
  onCreated,
  onClose,
}: {
  modules: Module[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [text, setText] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [deckName, setDeckName] = useState(t("flashcards.defaultDeck") || "Standard");
  const [saving, setSaving] = useState(false);

  // Format: Question? | Answer (one per line)
  async function handleBulkCreate() {
    const lines = text.split("\n").filter(l => l.includes("|"));
    if (lines.length === 0) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const rows = lines.map(line => {
      const [front, back] = line.split("|").map(s => s.trim());
      return {
        user_id: user.id,
        front: front || "",
        back: back || "",
        card_type: hasCloze(front || "") ? "cloze" : "basic",
        module_id: moduleId || null,
        deck_name: deckName || (t("flashcards.defaultDeck") || "Standard"),
        source: "user" as const,
        tags: [] as string[],
      };
    }).filter(r => r.front && r.back);

    if (rows.length > 0) {
      await supabase.from("flashcards").insert(rows);
    }
    setSaving(false);
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-surface-900">{t("fc.bulkCreate")}</h3>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-900"><X size={20} /></button>
        </div>

        <p className="text-xs text-surface-500 mb-3">{t("fc.bulkHelp")}</p>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <select className="input" value={moduleId} onChange={e => setModuleId(e.target.value)}>
            <option value="">— {t("tasks.modal.moduleEmpty")} —</option>
            {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input className="input" value={deckName} onChange={e => setDeckName(e.target.value)} placeholder={t("flashcards.deckPlaceholder") || "Deck"} />
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={`Was ist HTTP? | Hypertext Transfer Protocol\nWas ist DNS? | Domain Name System\n...`}
          className="input w-full min-h-[240px] resize-y font-mono text-sm"
          autoFocus
        />

        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-surface-500">
            {text.split("\n").filter(l => l.includes("|")).length} {t("fc.cardsDetected")}
          </span>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary text-sm">{t("tasks.modal.cancel")}</button>
            <button onClick={handleBulkCreate} disabled={saving} className="btn-primary text-sm">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {t("fc.createAll")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   TEXT-TO-CARDS (AI) Panel
   ═══════════════════════════════════════════════════════════════════════ */

function AIGeneratePanel({
  modules,
  onCreated,
  onClose,
}: {
  modules: Module[];
  onCreated: () => void;
  onClose: () => void;
}) {
  const { t, locale } = useTranslation();
  const supabase = createClient();
  const [text, setText] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState("");

  async function handleGenerate() {
    if (text.length < 50) return;
    setGenerating(true);
    setResult("");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ text, module_id: moduleId || undefined, filename: t("flashcards.textInput") || "Texteingabe", language: locale }),
      });

      const data = await res.json();
      if (!res.ok) {
        setResult(data.error || t("flashcards.aiGenerationError"));
        return;
      }
      setResult(t("flashcards.cardsCreated", { count: String(data.count), filename: t("flashcards.textInput") || "Texteingabe" }));
      onCreated();
    } catch {
      setResult(t("flashcards.aiGenerationError"));
    }
    setGenerating(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    try {
      const fileText = await file.text();
      setText(fileText.slice(0, 12000));
    } catch {
      setResult(t("flashcards.uploadError"));
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-surface-900 flex items-center gap-2">
            <Sparkles size={20} className="text-brand-600" /> {t("fc.aiGenerate")}
          </h3>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-900"><X size={20} /></button>
        </div>

        <p className="text-xs text-surface-500 mb-3">{t("fc.aiGenerateHelp")}</p>

        <div className="flex gap-3 mb-4">
          <select className="input flex-1" value={moduleId} onChange={e => setModuleId(e.target.value)}>
            <option value="">— {t("tasks.modal.moduleEmpty")} —</option>
            {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <label className="btn-secondary text-sm cursor-pointer flex items-center gap-1.5">
            <FileText size={14} /> {t("fc.uploadFile")}
            <input type="file" accept=".txt,.md,.csv" className="hidden" onChange={handleFileUpload} />
          </label>
        </div>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={t("fc.aiTextPlaceholder")}
          className="input w-full min-h-[200px] resize-y text-sm"
          autoFocus
        />

        {result && (
          <div className={`mt-3 p-3 rounded-lg text-sm ${result.includes("❌") || result.includes("Error") || result.includes("error") || result.includes("Fehler") || result.startsWith("⚠") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}>
            {result}
          </div>
        )}

        <div className="flex justify-between items-center mt-4">
          <span className="text-xs text-surface-500">{text.length} / 12000</span>
          <div className="flex gap-3">
            <button onClick={onClose} className="btn-secondary text-sm">{t("tasks.modal.cancel")}</button>
            <button onClick={handleGenerate} disabled={generating || text.length < 50} className="btn-primary text-sm flex items-center gap-1.5">
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? t("flashcards.generateAi") : t("fc.generateCards")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   HEATMAP Component (90 days)
   ═══════════════════════════════════════════════════════════════════════ */

function Heatmap() {
  const { t } = useTranslation();
  const history = getReviewHistory();
  const today = new Date();
  const days: { date: string; count: number }[] = [];

  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push({ date: key, count: history[key] ?? 0 });
  }

  const maxCount = Math.max(...days.map(d => d.count), 1);

  function getColor(count: number): string {
    if (count === 0) return "bg-surface-100";
    const ratio = count / maxCount;
    if (ratio > 0.75) return "bg-green-600";
    if (ratio > 0.5) return "bg-green-500";
    if (ratio > 0.25) return "bg-green-400";
    return "bg-green-300";
  }

  const totalReviewed = days.reduce((s, d) => s + d.count, 0);
  const activeDays = days.filter(d => d.count > 0).length;
  // Current streak
  let currentStreak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) currentStreak++;
    else break;
  }

  return (
    <div className="bg-white border border-surface-200 rounded-xl p-4">
      <h3 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
        <BarChart3 size={14} className="text-brand-600" /> {t("fc.activity")}
      </h3>

      <div className="flex gap-[3px] flex-wrap mb-4">
        {days.map(d => (
          <div
            key={d.date}
            className={`w-3 h-3 rounded-sm ${getColor(d.count)}`}
            title={`${d.date}: ${d.count} ${t("fc.cardsReviewed")}`}
          />
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-lg font-bold text-surface-900">{totalReviewed}</p>
          <p className="text-xs text-surface-500">{t("fc.totalReviewed")}</p>
        </div>
        <div>
          <p className="text-lg font-bold text-green-600">{activeDays}</p>
          <p className="text-xs text-surface-500">{t("fc.activeDays")}</p>
        </div>
        <div>
          <p className="text-lg font-bold text-brand-600">{currentStreak}</p>
          <p className="text-xs text-surface-500">{t("fc.currentStreak")}</p>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */

export default function FlashcardsPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { isPro } = useProfile();
  const { modules } = useModules();
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // UI state
  const [showDialog, setShowDialog] = useState(false);
  const [editCard, setEditCard] = useState<Flashcard | undefined>();
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [studyMode, setStudyMode] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showAiGen, setShowAiGen] = useState(false);
  const [showStats, setShowStats] = useState(true);

  // Filters
  const [filterModule, setFilterModule] = useState("");
  const [filterDeck, setFilterDeck] = useState("");
  const [filterType, setFilterType] = useState<"all" | "basic" | "cloze" | "mc">("all");

  const load = useCallback(async () => {
    setLoading(true);
    const [cardsRes, examsRes] = await Promise.all([
      supabase.from("flashcards").select("*, module:modules(id,name,color)").order("created_at", { ascending: false }),
      supabase.from("events").select("*").eq("event_type", "exam"),
    ]);
    setCards(cardsRes.data ?? []);
    setExams(examsRes.data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Filtered cards
  const filtered = useMemo(() => {
    let result = cards;
    if (filterModule) result = result.filter(c => c.module_id === filterModule);
    if (filterDeck) result = result.filter(c => c.deck_name === filterDeck);
    if (filterType !== "all") result = result.filter(c => (c.card_type ?? "basic") === filterType);
    return result;
  }, [cards, filterModule, filterDeck, filterType]);

  // Decks
  const decks = useMemo(() => Array.from(new Set(cards.map(c => c.deck_name))).sort(), [cards]);

  // Due cards
  const dueCards = useMemo(() => {
    const now = new Date();
    return filtered.filter(c => !c.next_review || new Date(c.next_review) <= now);
  }, [filtered]);

  // Stats
  const stats = useMemo(() => {
    const total = cards.length;
    const mastered = cards.filter(c => (c.repetitions ?? 0) >= 5).length;
    const learning = cards.filter(c => (c.repetitions ?? 0) > 0 && (c.repetitions ?? 0) < 5).length;
    const newCards = cards.filter(c => (c.repetitions ?? 0) === 0).length;
    const avgEase = total > 0 ? cards.reduce((s, c) => s + c.ease_factor, 0) / total : 2.5;
    const avgStreak = total > 0 ? cards.reduce((s, c) => s + (c.streak ?? 0), 0) / total : 0;
    return { total, mastered, learning, newCards, avgEase, avgStreak, due: dueCards.length };
  }, [cards, dueCards]);

  // Exam prognosis: cards linked to upcoming exams
  const examProgress = useMemo(() => {
    return exams
      .filter(e => new Date(e.start_dt) > new Date())
      .map(e => {
        const examCards = cards.filter(c => c.exam_id === e.id || (c.module_id && e.title?.toLowerCase().includes(
          modules.find(m => m.id === c.module_id)?.name?.toLowerCase().slice(0, 5) ?? "---"
        )));
        const mastered = examCards.filter(c => (c.repetitions ?? 0) >= 3).length;
        const total = examCards.length;
        const days = Math.ceil((new Date(e.start_dt).getTime() - Date.now()) / 86400000);
        return { exam: e, cards: total, mastered, days, readiness: total > 0 ? Math.round(mastered / total * 100) : 0 };
      })
      .filter(ep => ep.cards > 0)
      .sort((a, b) => a.days - b.days)
      .slice(0, 3);
  }, [exams, cards, modules]);

  async function handleSave(data: Partial<Flashcard>) {
    if (editCard) {
      await supabase.from("flashcards").update(data).eq("id", editCard.id);
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      await supabase.from("flashcards").insert({ ...data, user_id: user.id, source: "user" });
    }
    setShowDialog(false);
    setEditCard(undefined);
    load();
  }

  async function handleDelete(id: string) {
    await supabase.from("flashcards").delete().eq("id", id);
    load();
  }

  async function handleRate(id: string, quality: number, daysUntilExam?: number) {
    const card = cards.find(c => c.id === id);
    if (!card) return;
    const updates = sm2(card, quality, daysUntilExam);
    await supabase.from("flashcards").update(updates).eq("id", id);
  }

  // Study mode
  if (studyMode && dueCards.length > 0) {
    return (
      <div className="p-3 sm:p-6 max-w-4xl mx-auto">
        <StudyMode
          cards={dueCards}
          exams={exams}
          onRate={handleRate}
          onClose={() => { setStudyMode(false); load(); }}
        />
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 flex items-center gap-2">
            <BookOpen className="text-brand-600" size={24} /> {t("flashcards.title")}
          </h1>
          <p className="text-surface-500 text-xs sm:text-sm mt-1">
            {stats.total} {t("fc.cardsTotal")} · {stats.due} {t("fc.cardsDue")}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <LimitCounter current={decks.length} max={FREE_LIMITS.flashcardSets} isPro={isPro} />
          {dueCards.length > 0 && (
            <button onClick={() => setStudyMode(true)} className="btn-primary gap-2 text-sm">
              <Brain size={16} /> {t("fc.study")} ({dueCards.length})
            </button>
          )}
        </div>
      </div>

      <LimitNudge current={decks.length} max={FREE_LIMITS.flashcardSets} isPro={isPro} label={t("flashcards.sets")} />
      {showUpgrade && <UpgradeModal feature="unlimitedFlashcards" onClose={() => setShowUpgrade(false)} />}

      {/* ── Stats Dashboard ── */}
      {showStats && stats.total > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Progress overview */}
          <div className="bg-white border border-surface-200 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
              <Target size={14} className="text-brand-600" /> {t("fc.progress")}
            </h3>
            <div className="grid grid-cols-4 gap-3 text-center mb-4">
              <div>
                <p className="text-xl font-bold text-surface-900">{stats.total}</p>
                <p className="text-xs text-surface-500">{t("fc.totalCards")}</p>
              </div>
              <div>
                <p className="text-xl font-bold text-green-600">{stats.mastered}</p>
                <p className="text-xs text-surface-500">{t("fc.mastered")}</p>
              </div>
              <div>
                <p className="text-xl font-bold text-amber-500">{stats.learning}</p>
                <p className="text-xs text-surface-500">{t("fc.learning")}</p>
              </div>
              <div>
                <p className="text-xl font-bold text-surface-400">{stats.newCards}</p>
                <p className="text-xs text-surface-500">{t("fc.new")}</p>
              </div>
            </div>
            {/* Mastery bar */}
            <div className="h-3 bg-surface-100 rounded-full overflow-hidden flex">
              {stats.total > 0 && (
                <>
                  <div className="bg-green-500 h-full" style={{ width: `${stats.mastered / stats.total * 100}%` }} />
                  <div className="bg-amber-400 h-full" style={{ width: `${stats.learning / stats.total * 100}%` }} />
                  <div className="bg-surface-300 h-full" style={{ width: `${stats.newCards / stats.total * 100}%` }} />
                </>
              )}
            </div>
            <div className="flex justify-between mt-2 text-xs text-surface-400">
              <span>{Math.round(stats.mastered / Math.max(stats.total, 1) * 100)}% {t("fc.mastered")}</span>
              <span>{t("fc.todayReviewed", { count: String(getTodayReviews()) })}</span>
            </div>
          </div>

          {/* Heatmap */}
          <Heatmap />
        </div>
      )}

      {/* ── Exam Prognosis ── */}
      {examProgress.length > 0 && (
        <div className="mb-6 space-y-2">
          {examProgress.map(ep => (
            <div key={ep.exam.id} className="bg-white border border-surface-200 rounded-xl p-3 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                ep.days <= 3 ? "bg-red-100 text-red-700" : ep.days <= 7 ? "bg-amber-100 text-amber-700" : "bg-surface-100 text-surface-700"
              }`}>
                {ep.days}d
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-surface-800 truncate">{ep.exam.title}</p>
                <p className="text-xs text-surface-500">{ep.cards} {t("fc.cardsLinked")} · {ep.readiness}% {t("fc.ready")}</p>
              </div>
              <div className="w-24 h-2 bg-surface-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${ep.readiness >= 70 ? "bg-green-500" : ep.readiness >= 40 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ width: `${ep.readiness}%` }}
                />
              </div>
              <button
                onClick={() => {
                  setFilterModule(ep.exam.id);
                  setStudyMode(true);
                }}
                className="text-xs text-brand-600 font-medium hover:text-brand-500 flex items-center gap-1"
              >
                {t("fc.studyNow")} <ArrowRight size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Action buttons ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => {
            const check = withinFreeLimit("flashcardSets", decks.length, isPro);
            if (!check.allowed) { setShowUpgrade(true); return; }
            setEditCard(undefined); setShowDialog(true);
          }}
          className="btn-primary text-sm gap-1.5"
        >
          <Plus size={14} /> {t("flashcards.newCard")}
        </button>
        <button onClick={() => setShowBulk(true)} className="btn-secondary text-sm gap-1.5">
          <Copy size={14} /> {t("fc.bulkCreate")}
        </button>
        <button onClick={() => setShowAiGen(true)} className="btn-secondary text-sm gap-1.5">
          <Sparkles size={14} /> {t("fc.aiGenerate")}
        </button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 mb-6">
        <select className="input text-sm py-1.5" value={filterModule} onChange={e => setFilterModule(e.target.value)}>
          <option value="">— {t("nav.modules")} —</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {decks.length > 1 && (
          <select className="input text-sm py-1.5" value={filterDeck} onChange={e => setFilterDeck(e.target.value)}>
            <option value="">{t("flashcards.allDecks") || "— Deck —"}</option>
            {decks.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        )}
        <select className="input text-sm py-1.5" value={filterType} onChange={e => setFilterType(e.target.value as any)}>
          <option value="all">— {t("fc.allTypes")} —</option>
          <option value="basic">{t("fc.typeBasic")}</option>
          <option value="cloze">{t("fc.typeCloze")}</option>
          <option value="mc">{t("fc.typeMC")}</option>
        </select>
      </div>

      {/* ── Cards grid ── */}
      {loading ? (
        <div className="text-center py-12"><Loader2 className="animate-spin mx-auto text-brand-400" size={32} /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-surface-400">
          <BookOpen size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("fc.noCards")}</p>
          <p className="text-sm mt-1">{t("fc.noCardsHint")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(card => {
            const isDue = !card.next_review || new Date(card.next_review) <= new Date();
            const cardType = card.card_type ?? "basic";
            const typeColor = cardType === "cloze" ? "purple" : cardType === "mc" ? "cyan" : "brand";

            return (
              <div
                key={card.id}
                className="bg-white border border-surface-200 rounded-xl p-4 hover:shadow-md transition-all group relative"
              >
                {/* Badges */}
                <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full bg-${typeColor}-50 text-${typeColor}-700`}>
                    {cardType === "cloze" ? "Cloze" : cardType === "mc" ? "MC" : "Q&A"}
                  </span>
                  {card.source === "ai" && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-brand-600 bg-brand-50 px-2 py-0.5 rounded-full">
                      <Sparkles size={8} /> KI
                    </span>
                  )}
                  {card.module && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full" style={{ background: `${card.module.color}15`, color: card.module.color }}>
                      {card.module.name}
                    </span>
                  )}
                  {card.deck_name !== "Standard" && (
                    <span className="text-[10px] text-surface-400">{card.deck_name}</span>
                  )}
                </div>

                {/* Content */}
                <p className="text-sm font-medium text-surface-800 mb-1 line-clamp-2">{card.front}</p>
                <p className="text-xs text-surface-500 line-clamp-1">{card.back}</p>

                {/* Tags */}
                {card.tags && card.tags.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {card.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-surface-100 text-surface-600 rounded"># {tag}</span>
                    ))}
                  </div>
                )}

                {/* Stats row */}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-surface-100">
                  <div className="flex items-center gap-2 text-[10px] text-surface-400">
                    {(card.streak ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-green-600"><Flame size={10} /> {card.streak}</span>
                    )}
                    <span>{card.repetitions ?? 0}x</span>
                  </div>
                  {isDue ? (
                    <span className="text-[10px] text-amber-600 font-medium">{t("flashcards.dueLabel")}</span>
                  ) : (
                    <span className="text-[10px] text-green-600">
                      {new Date(card.next_review!).toLocaleDateString(undefined)}
                    </span>
                  )}
                </div>

                {/* Hover actions */}
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
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modals ── */}
      {showDialog && (
        <CardDialog
          card={editCard}
          modules={modules}
          exams={exams}
          onSave={handleSave}
          onClose={() => { setShowDialog(false); setEditCard(undefined); }}
        />
      )}
      {showBulk && <BulkCreatePanel modules={modules} onCreated={load} onClose={() => setShowBulk(false)} />}
      {showAiGen && <AIGeneratePanel modules={modules} onCreated={load} onClose={() => setShowAiGen(false)} />}
    </div>
  );
}
