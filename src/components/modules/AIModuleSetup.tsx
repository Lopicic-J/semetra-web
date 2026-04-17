"use client";

import { useState, memo } from "react";
import { useTranslation } from "@/lib/i18n";
import { Sparkles, Loader2, Check, X, BookOpen, Zap, Link2 } from "lucide-react";

interface Props {
  moduleId: string;
  moduleName: string;
  moduleType?: string;
  ects?: number;
  hasTopics: boolean;
  hasFlashcards: boolean;
  onSetupComplete?: () => void;
}

interface SetupResult {
  topics: { title: string; description: string; difficulty: string }[];
  flashcards: { question: string; answer: string; topic: string }[];
  resources: { title: string; type: string; description: string }[];
  learningRecommendation: string;
}

/**
 * AI Module Setup Button — appears on modules that have no topics/flashcards.
 * One click generates topics, flashcards, and resources via AI.
 */
function AIModuleSetup({ moduleId, moduleName, moduleType, ects, hasTopics, hasFlashcards, onSetupComplete }: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<"idle" | "generating" | "preview" | "applying" | "done">("idle");
  const [result, setResult] = useState<SetupResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Don't show if module already has content
  if (hasTopics && hasFlashcards) return null;

  const generate = async () => {
    setPhase("generating");
    setError(null);

    try {
      const res = await fetch("/api/ai/module-setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleName, moduleType: moduleType ?? "mixed", ects }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.error ?? t("ai.error") ?? "Fehler");
        setPhase("idle");
        return;
      }

      const data = await res.json();
      setResult(data);
      setPhase("preview");
    } catch {
      setError(t("ai.networkError") ?? "Netzwerkfehler");
      setPhase("idle");
    }
  };

  const apply = async () => {
    if (!result) return;
    setPhase("applying");

    try {
      const res = await fetch("/api/ai/module-setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moduleId,
          topics: result.topics,
          flashcards: result.flashcards,
          resources: result.resources,
          learningRecommendation: result.learningRecommendation,
        }),
      });

      if (res.ok) {
        setPhase("done");
        onSetupComplete?.();
      } else {
        setError(t("ai.error") ?? "Fehler beim Anwenden");
        setPhase("preview");
      }
    } catch {
      setError(t("ai.networkError") ?? "Netzwerkfehler");
      setPhase("preview");
    }
  };

  // ── IDLE: Show setup button ──
  if (phase === "idle") {
    return (
      <button
        onClick={generate}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/20 hover:bg-brand-100 dark:hover:bg-brand-950/30 border border-brand-200 dark:border-brand-800/40 transition-colors"
      >
        <Sparkles size={13} />
        {t("modules.aiSetup") || "KI-Setup: Topics & Flashcards generieren"}
      </button>
    );
  }

  // ── GENERATING ──
  if (phase === "generating") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/20 border border-brand-200 dark:border-brand-800/40">
        <Loader2 size={13} className="animate-spin" />
        {t("modules.aiGenerating") || `Topics für "${moduleName}" werden generiert...`}
      </div>
    );
  }

  // ── DONE ──
  if (phase === "done") {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40">
        <Check size={13} />
        {t("modules.aiSetupDone") || "Topics, Flashcards und Ressourcen wurden erstellt!"}
      </div>
    );
  }

  // ── PREVIEW: Show generated content ──
  return (
    <div className="rounded-xl border border-brand-200 dark:border-brand-800/40 bg-brand-50/30 dark:bg-brand-950/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-brand-100 dark:border-brand-800/30 flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-brand-700 dark:text-brand-300">
          <Sparkles size={14} />
          {t("modules.aiPreview") || "KI-Vorschläge"}
        </span>
        <button onClick={() => { setPhase("idle"); setResult(null); }} className="text-surface-400 hover:text-surface-600">
          <X size={14} />
        </button>
      </div>

      <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
        {/* Topics */}
        {result && result.topics.length > 0 && (
          <div>
            <p className="text-xs font-medium text-surface-600 dark:text-surface-400 flex items-center gap-1 mb-1.5">
              <BookOpen size={11} /> {result.topics.length} Topics
            </p>
            <div className="flex flex-wrap gap-1">
              {result.topics.map((t, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400">
                  {t.title}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Flashcards */}
        {result && result.flashcards.length > 0 && (
          <div>
            <p className="text-xs font-medium text-surface-600 dark:text-surface-400 flex items-center gap-1 mb-1">
              <Zap size={11} /> {result.flashcards.length} Flashcards
            </p>
            <p className="text-[10px] text-surface-400">{t("modules.aiFlashcardPreview") || "Starter-Karteikarten für Spaced Repetition"}</p>
          </div>
        )}

        {/* Resources */}
        {result && result.resources.length > 0 && (
          <div>
            <p className="text-xs font-medium text-surface-600 dark:text-surface-400 flex items-center gap-1 mb-1">
              <Link2 size={11} /> {result.resources.length} {t("modules.aiResources") || "Ressourcen-Vorschläge"}
            </p>
          </div>
        )}

        {/* Learning Recommendation */}
        {result?.learningRecommendation && (
          <p className="text-xs text-brand-600 dark:text-brand-400 italic">
            {result.learningRecommendation}
          </p>
        )}

        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-brand-100 dark:border-brand-800/30 flex gap-2">
        <button
          onClick={apply}
          disabled={phase === "applying"}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-600 text-white text-xs font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {phase === "applying" ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
          {t("modules.aiApply") || "Übernehmen"}
        </button>
        <button onClick={generate} className="px-4 py-2 rounded-lg text-xs text-surface-500 hover:bg-surface-100 dark:hover:bg-surface-800">
          {t("modules.aiRegenerate") || "Neu generieren"}
        </button>
      </div>
    </div>
  );
}

export default memo(AIModuleSetup);
