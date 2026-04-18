"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { Zap, Check, X, ArrowRight, RotateCcw, Clock, Brain } from "lucide-react";
import Link from "next/link";
import MobileFlashcardReview from "@/components/flashcards/MobileFlashcardReview";

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
    // First try: exam-relevant flashcards due for review
    const { data: examRelevantCards } = await supabase
      .from("flashcards")
      .select("id, question, answer, module_id, deck_name, next_review, topics!inner(is_exam_relevant)")
      .eq("topics.is_exam_relevant", true)
      .or(`next_review.lte.${new Date().toISOString()},next_review.is.null`)
      .order("next_review", { ascending: true, nullsFirst: true })
      .limit(5);

    if (examRelevantCards && examRelevantCards.length >= 3) {
      setCards(examRelevantCards);
      setPhase("review");
      return;
    }

    // Fallback: all due flashcards (including those with NULL next_review)
    const { data } = await supabase
      .from("flashcards")
      .select("id, question, answer, module_id, deck_name, next_review")
      .or(`next_review.lte.${new Date().toISOString()},next_review.is.null`)
      .order("next_review", { ascending: true, nullsFirst: true })
      .limit(5);

    if (data && data.length > 0) {
      setCards(data);
      setPhase("review");
    } else {
      // Last fallback: get any 5 recent flashcards
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

  // ── REVIEW PHASE — Mobile-optimized fullscreen card review ──
  return (
    <MobileFlashcardReview
      cards={cards}
      moduleName={moduleName}
      moduleColor={moduleColor}
      onComplete={(r) => { setResults(r); setPhase("done"); }}
      onClose={() => setPhase("done")}
    />
  );
}
