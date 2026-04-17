"use client";

import { useState, useCallback, memo } from "react";
import { useTranslation } from "@/lib/i18n";
import { Brain, ChevronDown, ChevronUp, Loader2, Sparkles, X } from "lucide-react";

interface Props {
  /** What to analyze — determines which API endpoint to call */
  mode: "grade-analysis" | "explain" | "summary-coach";
  /** Module ID for context */
  moduleId?: string;
  /** Additional context (e.g., flashcard question for explain mode) */
  context?: {
    concept?: string;
    question?: string;
    answer?: string;
    topicId?: string;
  };
  /** Compact mode — smaller UI for inline embedding */
  compact?: boolean;
}

/**
 * Reusable inline AI panel that can be embedded on any page.
 * Fetches AI analysis on demand (not on mount) to save API credits.
 */
function InlineAIPanel({ mode, moduleId, context, compact }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState("");

  const labels = {
    "grade-analysis": {
      button: t("ai.analyzeGrades") || "KI-Notenanalyse",
      title: t("ai.gradeAnalysis") || "Notenanalyse",
    },
    explain: {
      button: t("ai.explainThis") || "Erklär mir das",
      title: t("ai.explanation") || "Erklärung",
    },
    "summary-coach": {
      button: t("ai.summarize") || "Zusammenfassung bewerten",
      title: t("ai.summaryFeedback") || "Feedback",
    },
  };

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let res: Response;

      if (mode === "grade-analysis") {
        const params = moduleId ? `?moduleId=${moduleId}` : "";
        res = await fetch(`/api/ai/grade-analysis${params}`);
      } else if (mode === "explain") {
        res = await fetch("/api/ai/explain-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            concept: context?.concept ?? context?.question ?? "",
            explanation: userInput || (context?.answer ?? ""),
            moduleId,
            topicId: context?.topicId,
          }),
        });
      } else {
        res = await fetch("/api/ai/summary-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topicTitle: context?.concept ?? "",
            summary: userInput,
            moduleId,
          }),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? t("ai.error") ?? "Fehler bei der Analyse");
        return;
      }

      setResult(await res.json());
    } catch {
      setError(t("ai.networkError") || "Netzwerkfehler");
    } finally {
      setLoading(false);
    }
  }, [mode, moduleId, context, userInput, t]);

  const handleOpen = () => {
    setOpen(true);
    if (mode === "grade-analysis" && !result) {
      fetchAnalysis();
    }
  };

  if (!open) {
    return (
      <button
        onClick={handleOpen}
        className={`flex items-center gap-2 text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors ${
          compact ? "text-xs px-2 py-1" : "text-sm px-3 py-1.5"
        } rounded-lg hover:bg-brand-50 dark:hover:bg-brand-950/20`}
      >
        <Sparkles size={compact ? 12 : 14} />
        {labels[mode].button}
      </button>
    );
  }

  return (
    <div className={`rounded-xl border border-brand-200 dark:border-brand-800/40 bg-brand-50/30 dark:bg-brand-950/10 overflow-hidden ${compact ? "mt-2" : "mt-4"}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-brand-100 dark:border-brand-800/30">
        <span className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
          <Brain size={14} />
          {labels[mode].title}
        </span>
        <button onClick={() => { setOpen(false); setResult(null); }} className="text-surface-400 hover:text-surface-600">
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Input field for explain / summary modes */}
        {(mode === "explain" || mode === "summary-coach") && !result && (
          <div className="space-y-3">
            {mode === "explain" && context?.question && (
              <div className="text-sm text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-800 rounded-lg p-3">
                <p className="text-xs font-medium text-surface-500 mb-1">{t("ai.concept") || "Konzept"}:</p>
                <p>{context.question}</p>
              </div>
            )}
            <textarea
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              placeholder={mode === "explain"
                ? (t("ai.explainPlaceholder") || "Erkläre das Konzept in deinen eigenen Worten...")
                : (t("ai.summaryPlaceholder") || "Schreibe deine Zusammenfassung...")}
              className="w-full p-3 rounded-lg border border-surface-200 dark:border-surface-700 bg-[rgb(var(--card-bg))] text-sm min-h-[80px] resize-none"
            />
            <button
              onClick={fetchAnalysis}
              disabled={loading || userInput.trim().length < 20}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {t("ai.evaluate") || "Bewerten"}
            </button>
          </div>
        )}

        {/* Loading */}
        {loading && mode === "grade-analysis" && (
          <div className="flex items-center gap-3 py-4">
            <Loader2 size={18} className="animate-spin text-brand-500" />
            <span className="text-sm text-surface-500">{t("ai.analyzing") || "Wird analysiert..."}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-sm text-red-600 dark:text-red-400 py-2">{error}</p>
        )}

        {/* Grade Analysis Result */}
        {result && mode === "grade-analysis" && result.analysis && (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-lg bg-surface-100 dark:bg-surface-800 p-2">
                <p className="text-lg font-bold text-surface-900 dark:text-surface-50">{result.analysis.overview?.average?.toFixed(1) ?? "—"}</p>
                <p className="text-[10px] text-surface-500">{t("ai.average") || "Durchschnitt"}</p>
              </div>
              <div className="rounded-lg bg-surface-100 dark:bg-surface-800 p-2">
                <p className="text-lg font-bold text-surface-900 dark:text-surface-50">{result.analysis.overview?.passed ?? 0}</p>
                <p className="text-[10px] text-surface-500">{t("ai.passed") || "Bestanden"}</p>
              </div>
              <div className="rounded-lg bg-surface-100 dark:bg-surface-800 p-2">
                <p className={`text-lg font-bold ${result.analysis.overview?.trend === "improving" ? "text-emerald-600" : result.analysis.overview?.trend === "declining" ? "text-red-600" : "text-surface-900 dark:text-surface-50"}`}>
                  {result.analysis.overview?.trend === "improving" ? "↑" : result.analysis.overview?.trend === "declining" ? "↓" : "→"}
                </p>
                <p className="text-[10px] text-surface-500">{t("ai.trend") || "Trend"}</p>
              </div>
            </div>

            {result.analysis.recommendations?.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-surface-600 dark:text-surface-400">{t("ai.recommendations") || "Empfehlungen"}:</p>
                {result.analysis.recommendations.map((rec: string, i: number) => (
                  <p key={i} className="text-xs text-surface-700 dark:text-surface-300 pl-3 border-l-2 border-brand-300 dark:border-brand-700">
                    {rec}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Explain / Summary Result */}
        {result && (mode === "explain" || mode === "summary-coach") && (
          <div className="space-y-3">
            {/* Score */}
            {result.score && (
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
                  result.score >= 4 ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600" :
                  result.score >= 3 ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600" :
                  "bg-red-100 dark:bg-red-900/30 text-red-600"
                }`}>
                  {result.score}/5
                </div>
                <p className="text-sm text-surface-700 dark:text-surface-300 flex-1">{result.feedback}</p>
              </div>
            )}

            {/* Missing points */}
            {result.missing?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-surface-500 mb-1">{t("ai.missing") || "Fehlende Punkte"}:</p>
                <ul className="text-xs text-surface-600 dark:text-surface-400 space-y-0.5 list-disc pl-4">
                  {result.missing.map((m: string, i: number) => <li key={i}>{m}</li>)}
                </ul>
              </div>
            )}

            {/* Suggestions */}
            {result.suggestions && (
              <p className="text-xs text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/20 rounded-lg p-2">
                {result.suggestions}
              </p>
            )}

            {/* Try again */}
            <button
              onClick={() => { setResult(null); setUserInput(""); }}
              className="text-xs text-surface-400 hover:text-surface-600"
            >
              {t("ai.tryAgain") || "Nochmal versuchen"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(InlineAIPanel);
