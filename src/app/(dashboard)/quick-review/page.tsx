"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { Zap, Check, X, ArrowRight, RotateCcw, Clock, Brain } from "lucide-react";
import Link from "next/link";

interface Flashcard {
  id: string;
  question: string;
  answer: string;
  module_id: string;
  deck_name: string;
}

type Phase = "loading" | "review" | "done";

/**
 * Quick Review — 5-minute micro-learning session
 * Automatically picks the most urgent flashcards from modules with upcoming exams.
 */
export default function QuickReviewPage() {
  const supabase = createClient();
  const { modules } = useModules();
  const [phase, setPhase] = useState<Phase>("loading");
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<{ correct: number; wrong: number }>({ correct: 0, wrong: 0 });
  const [startTime] = useState(Date.now());

  const loadCards = useCallback(async () => {
    // Get flashcards due for review, prioritizing modules with upcoming exams
    const { data } = await supabase
      .from("flashcards")
      .select("id, question, answer, module_id, deck_name, next_review")
      .lte("next_review", new Date().toISOString())
      .order("next_review", { ascending: true })
      .limit(5);

    if (data && data.length > 0) {
      setCards(data);
      setPhase("review");
    } else {
      // Fallback: get any 5 random flashcards
      const { data: fallback } = await supabase
        .from("flashcards")
        .select("id, question, answer, module_id, deck_name")
        .order("created_at", { ascending: false })
        .limit(5);

      setCards(fallback ?? []);
      setPhase(fallback && fallback.length > 0 ? "review" : "done");
    }
  }, [supabase]);

  useEffect(() => { loadCards(); }, [loadCards]);

  const handleRating = (correct: boolean) => {
    setResults(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      wrong: prev.wrong + (correct ? 0 : 1),
    }));

    if (currentIndex < cards.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      setPhase("done");
    }
  };

  const currentCard = cards[currentIndex];
  const moduleName = modules.find(m => m.id === currentCard?.module_id)?.name;
  const moduleColor = modules.find(m => m.id === currentCard?.module_id)?.color;
  const elapsed = Math.round((Date.now() - startTime) / 1000);

  if (phase === "loading") {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="w-14 h-14 rounded-2xl bg-violet-50 dark:bg-violet-950/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Zap size={28} className="text-violet-500" />
        </div>
        <p className="text-surface-500">Karten werden geladen...</p>
      </div>
    );
  }

  if (phase === "done") {
    const total = results.correct + results.wrong;
    const score = total > 0 ? Math.round((results.correct / total) * 100) : 0;
    const mins = Math.round(elapsed / 60);

    return (
      <div className="max-w-lg mx-auto px-4 py-8 text-center space-y-6">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto ${
          score >= 80 ? "bg-emerald-100 dark:bg-emerald-900/30" :
          score >= 50 ? "bg-amber-100 dark:bg-amber-900/30" :
          "bg-red-100 dark:bg-red-900/30"
        }`}>
          {score >= 80 ? <Check size={32} className="text-emerald-600" /> :
           score >= 50 ? <Brain size={32} className="text-amber-600" /> :
           <RotateCcw size={32} className="text-red-600" />}
        </div>

        <div>
          <p className="text-2xl font-bold text-surface-900 dark:text-surface-50">{total > 0 ? `${score}%` : "Keine Karten"}</p>
          <p className="text-surface-500 mt-1">
            {total > 0 ? `${results.correct} richtig · ${results.wrong} falsch · ${mins || "<1"} Min` : "Erstelle Flashcards um Quick Review zu nutzen"}
          </p>
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={() => { setPhase("loading"); setCurrentIndex(0); setResults({ correct: 0, wrong: 0 }); setShowAnswer(false); loadCards(); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-surface-200 dark:border-surface-700 text-sm font-medium hover:bg-surface-50 dark:hover:bg-surface-800">
            <RotateCcw size={14} /> Nochmal
          </button>
          <Link href="/flashcards" className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 no-underline">
            <ArrowRight size={14} /> Alle Flashcards
          </Link>
        </div>
      </div>
    );
  }

  // ── REVIEW PHASE ──
  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Zap size={20} className="text-violet-500" />
          <h1 className="text-lg font-bold text-surface-900 dark:text-surface-50">Quick Review</h1>
        </div>
        <div className="flex items-center gap-3 text-xs text-surface-400">
          <span>{currentIndex + 1}/{cards.length}</span>
          <span className="flex items-center gap-1"><Clock size={11} /> {Math.round(elapsed / 60) || "<1"} Min</span>
        </div>
      </div>

      {/* Progress */}
      <div className="h-1.5 bg-surface-200 dark:bg-surface-700 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-violet-500 rounded-full transition-all duration-300" style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }} />
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] overflow-hidden">
        {/* Module badge */}
        {moduleName && (
          <div className="px-4 py-2 border-b border-surface-100 dark:border-surface-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: moduleColor ?? "#6d28d9" }} />
            <span className="text-xs text-surface-500">{moduleName}</span>
          </div>
        )}

        {/* Question */}
        <div className="p-6 min-h-[120px] flex items-center justify-center">
          <p className="text-center text-lg font-medium text-surface-900 dark:text-surface-50">
            {currentCard?.question}
          </p>
        </div>

        {/* Answer (toggle) */}
        {showAnswer ? (
          <div className="border-t border-surface-200 dark:border-surface-700 p-6 bg-surface-50 dark:bg-surface-800/50">
            <p className="text-center text-surface-700 dark:text-surface-300">
              {currentCard?.answer}
            </p>
          </div>
        ) : (
          <button
            onClick={() => setShowAnswer(true)}
            className="w-full border-t border-surface-200 dark:border-surface-700 py-4 text-sm font-medium text-brand-600 dark:text-brand-400 hover:bg-surface-50 dark:hover:bg-surface-800/50 transition-colors"
          >
            Antwort anzeigen
          </button>
        )}
      </div>

      {/* Rating Buttons */}
      {showAnswer && (
        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={() => handleRating(false)}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 font-medium hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors"
          >
            <X size={16} /> Nicht gewusst
          </button>
          <button
            onClick={() => handleRating(true)}
            className="flex items-center justify-center gap-2 py-3 rounded-xl border border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-950/20 transition-colors"
          >
            <Check size={16} /> Gewusst
          </button>
        </div>
      )}
    </div>
  );
}
