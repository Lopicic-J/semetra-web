"use client";

import { useState, useCallback, memo } from "react";
import { useTranslation } from "@/lib/i18n";
import { Check, X, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";

interface Card {
  id: string;
  question: string;
  answer: string;
  deck_name?: string;
}

interface Props {
  cards: Card[];
  moduleName?: string;
  moduleColor?: string;
  onComplete: (results: { correct: number; wrong: number }) => void;
  onClose: () => void;
}

/**
 * Mobile-optimized flashcard review with large touch targets
 * and swipe-friendly card flip animation.
 */
function MobileFlashcardReview({ cards, moduleName, moduleColor, onComplete, onClose }: Props) {
  const { t } = useTranslation();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [results, setResults] = useState<{ correct: number; wrong: number }>({ correct: 0, wrong: 0 });
  const [isFlipping, setIsFlipping] = useState(false);

  const currentCard = cards[currentIndex];
  const progress = cards.length > 0 ? ((currentIndex + 1) / cards.length) * 100 : 0;
  const isDone = currentIndex >= cards.length;

  const flipCard = useCallback(() => {
    setIsFlipping(true);
    setTimeout(() => {
      setShowAnswer(true);
      setIsFlipping(false);
    }, 150);
  }, []);

  const rate = useCallback((correct: boolean) => {
    setResults(prev => ({
      correct: prev.correct + (correct ? 1 : 0),
      wrong: prev.wrong + (correct ? 0 : 1),
    }));

    if (currentIndex < cards.length - 1) {
      setShowAnswer(false);
      setCurrentIndex(prev => prev + 1);
    } else {
      // Done
      const finalResults = {
        correct: results.correct + (correct ? 1 : 0),
        wrong: results.wrong + (correct ? 0 : 1),
      };
      onComplete(finalResults);
    }
  }, [currentIndex, cards.length, results, onComplete]);

  if (isDone || !currentCard) return null;

  return (
    <div className="fixed inset-0 z-50 bg-surface-50 dark:bg-surface-900 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-surface-200 dark:border-surface-800">
        <button onClick={onClose} className="text-surface-500 hover:text-surface-700 p-1">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <p className="text-xs text-surface-500">{currentIndex + 1} / {cards.length}</p>
          {moduleName && (
            <p className="text-[10px] text-surface-400 flex items-center gap-1 justify-center">
              <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: moduleColor ?? "#6d28d9" }} />
              {moduleName}
            </p>
          )}
        </div>
        <div className="text-xs text-surface-400 w-8 text-right">
          {results.correct}✓
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-1 bg-surface-200 dark:bg-surface-800">
        <div
          className="h-full bg-brand-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div
          onClick={() => !showAnswer && flipCard()}
          className={`w-full max-w-sm aspect-[3/4] rounded-2xl border-2 flex items-center justify-center p-8 cursor-pointer select-none transition-all duration-150 ${
            showAnswer
              ? "border-brand-300 dark:border-brand-700 bg-brand-50/30 dark:bg-brand-950/10"
              : "border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] active:scale-[0.98]"
          } ${isFlipping ? "scale-95 opacity-80" : ""}`}
        >
          <div className="text-center">
            {!showAnswer ? (
              <>
                <p className="text-xs text-surface-400 mb-4 uppercase tracking-wider">
                  {t("flashcards.question") || "Frage"}
                </p>
                <p className="text-lg font-medium text-surface-900 dark:text-surface-50 leading-relaxed">
                  {currentCard.question}
                </p>
                <p className="text-xs text-surface-400 mt-6">
                  {t("flashcards.tapToFlip") || "Tippen zum Umdrehen"}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs text-brand-500 mb-4 uppercase tracking-wider">
                  {t("flashcards.answer") || "Antwort"}
                </p>
                <p className="text-lg text-surface-800 dark:text-surface-200 leading-relaxed">
                  {currentCard.answer}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Rating Buttons — Large Touch Targets */}
      {showAnswer ? (
        <div className="px-4 pb-8 pt-4 grid grid-cols-2 gap-4">
          <button
            onClick={() => rate(false)}
            className="flex flex-col items-center gap-1.5 py-5 rounded-2xl border-2 border-red-200 dark:border-red-800/40 text-red-600 dark:text-red-400 active:bg-red-50 dark:active:bg-red-950/20 transition-colors"
          >
            <X size={28} />
            <span className="text-sm font-medium">{t("flashcards.wrong") || "Nicht gewusst"}</span>
          </button>
          <button
            onClick={() => rate(true)}
            className="flex flex-col items-center gap-1.5 py-5 rounded-2xl border-2 border-emerald-200 dark:border-emerald-800/40 text-emerald-600 dark:text-emerald-400 active:bg-emerald-50 dark:active:bg-emerald-950/20 transition-colors"
          >
            <Check size={28} />
            <span className="text-sm font-medium">{t("flashcards.correct") || "Gewusst"}</span>
          </button>
        </div>
      ) : (
        <div className="px-4 pb-8 pt-4">
          <button
            onClick={flipCard}
            className="w-full py-5 rounded-2xl bg-brand-600 text-white font-semibold text-base active:bg-brand-700 transition-colors"
          >
            {t("flashcards.showAnswer") || "Antwort zeigen"}
          </button>
        </div>
      )}
    </div>
  );
}

export default memo(MobileFlashcardReview);
