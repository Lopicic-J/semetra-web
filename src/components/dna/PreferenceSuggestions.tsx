"use client";

import { useState, useEffect, useCallback } from "react";
import { clsx } from "clsx";
import {
  Lightbulb,
  Check,
  X,
  Loader2,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Clock,
  Target,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

// ── Types ────────────────────────────────────────────────────────────────────

interface Suggestion {
  id: string;
  user_id: string;
  preference_key: string;
  current_value: string | number | null;
  suggested_value: string | number;
  reason: string;
  confidence: number;
  status: "pending" | "accepted" | "dismissed";
  created_at: string;
}

// ── Human-readable labels for preference keys ───────────────────────────────

const PREFERENCE_LABELS: Record<string, { label: string; icon: typeof Clock; unit?: string }> = {
  preferred_session_duration: { label: "Bevorzugte Session-Dauer", icon: Clock, unit: "min" },
  preferred_start_hour: { label: "Bevorzugte Startzeit", icon: Clock, unit: "Uhr" },
  preferred_end_hour: { label: "Bevorzugte Endzeit", icon: Clock, unit: "Uhr" },
  break_duration: { label: "Pausendauer", icon: Clock, unit: "min" },
  daily_goal_minutes: { label: "Tagesziel", icon: Target, unit: "min" },
  weekly_goal_hours: { label: "Wochenziel", icon: Target, unit: "h" },
  focus_mode_duration: { label: "Focus-Modus Dauer", icon: Zap, unit: "min" },
  max_daily_sessions: { label: "Max. Sessions pro Tag", icon: Target },
  min_break_between_sessions: { label: "Min. Pause zwischen Sessions", icon: Clock, unit: "min" },
};

function getPreferenceInfo(key: string) {
  return PREFERENCE_LABELS[key] ?? { label: key, icon: Lightbulb };
}

function formatValue(key: string, value: string | number | null): string {
  if (value === null || value === undefined) return "–";
  const info = PREFERENCE_LABELS[key];
  if (info?.unit) return `${value} ${info.unit}`;
  return String(value);
}

// ── Main Component ──────────────────────────────────────────────────────────

export function PreferenceSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [actioning, setActioning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState<Map<string, "accept" | "dismiss">>(new Map());

  // ── Fetch pending suggestions ──
  const fetchSuggestions = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/preferences/suggestions");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      setSuggestions(data.suggestions ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Laden fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuggestions();
  }, [fetchSuggestions]);

  // ── Generate new suggestions ──
  const generateSuggestions = async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/preferences/suggestions", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler");
      setSuggestions(data.suggestions ?? []);
      setResolved(new Map());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generierung fehlgeschlagen");
    } finally {
      setGenerating(false);
    }
  };

  // ── Accept / Dismiss ──
  const handleAction = async (suggestionId: string, action: "accept" | "dismiss") => {
    setActioning(suggestionId);
    try {
      const res = await fetch("/api/preferences/suggestions", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestion_id: suggestionId, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler");

      setResolved((prev) => new Map(prev).set(suggestionId, action));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen");
    } finally {
      setActioning(null);
    }
  };

  // ── Pending (not yet resolved in this session) ──
  const pending = suggestions.filter((s) => !resolved.has(s.id));
  const resolvedList = suggestions.filter((s) => resolved.has(s.id));

  // ── Empty state ──
  if (!loading && suggestions.length === 0) {
    return (
      <Card padding="lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0">
            <Sparkles size={18} className="text-brand-500" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-surface-800">
              Lernpräferenz-Vorschläge
            </h3>
            <p className="text-xs text-surface-500 mt-0.5">
              Basierend auf deinen Lernmustern kann Semetra Verbesserungen vorschlagen.
              Starte eine Analyse, um personalisierte Empfehlungen zu erhalten.
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={generateSuggestions}
            loading={generating}
          >
            <Sparkles size={14} />
            Analyse starten
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
            <Lightbulb size={16} className="text-brand-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-surface-800">
              Empfohlene Anpassungen
            </h3>
            {pending.length > 0 && (
              <p className="text-xs text-surface-500">
                {pending.length} {pending.length === 1 ? "Vorschlag" : "Vorschläge"} basierend auf deinen Lernmustern
              </p>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={generateSuggestions}
          loading={generating}
          title="Neue Vorschläge generieren"
        >
          <RefreshCw size={14} />
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-3 p-2.5 rounded-lg bg-danger-50 dark:bg-danger-900/20 text-xs text-danger-700 dark:text-danger-400 border border-danger-200 dark:border-danger-800">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="animate-pulse flex gap-3 p-3 rounded-xl bg-surface-50">
              <div className="w-8 h-8 rounded-lg bg-surface-200" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-surface-200 rounded w-1/3" />
                <div className="h-2.5 bg-surface-200 rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pending suggestions */}
      {!loading && pending.length > 0 && (
        <div className="space-y-2">
          {pending.map((s) => {
            const info = getPreferenceInfo(s.preference_key);
            const Icon = info.icon;
            const isActioning = actioning === s.id;

            return (
              <div
                key={s.id}
                className="group p-3 rounded-xl bg-surface-50 border border-surface-200/40 transition-all hover:border-brand-200 dark:hover:border-brand-800"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon size={15} className="text-brand-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-surface-800">
                      {info.label}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-surface-500">
                        {formatValue(s.preference_key, s.current_value)}
                      </span>
                      <ChevronRight size={12} className="text-surface-400" />
                      <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                        {formatValue(s.preference_key, s.suggested_value)}
                      </span>
                    </div>
                    {s.reason && (
                      <p className="text-xs text-surface-500 mt-1.5 leading-relaxed">
                        {s.reason}
                      </p>
                    )}
                    {/* Confidence indicator */}
                    {s.confidence > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <div
                              key={i}
                              className={clsx(
                                "w-1.5 h-1.5 rounded-full",
                                i <= Math.round(s.confidence * 5)
                                  ? "bg-brand-400"
                                  : "bg-surface-200"
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-[10px] text-surface-400">
                          {Math.round(s.confidence * 100)}% Konfidenz
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action buttons */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => handleAction(s.id, "accept")}
                      disabled={isActioning}
                      className={clsx(
                        "p-2 rounded-lg transition-all",
                        "bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:hover:bg-green-900/30",
                        "disabled:opacity-50"
                      )}
                      title="Vorschlag annehmen"
                    >
                      {isActioning ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button
                      onClick={() => handleAction(s.id, "dismiss")}
                      disabled={isActioning}
                      className={clsx(
                        "p-2 rounded-lg transition-all",
                        "bg-surface-100 text-surface-500 hover:bg-surface-200 hover:text-surface-700",
                        "disabled:opacity-50"
                      )}
                      title="Vorschlag verwerfen"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Resolved feedback */}
      {resolvedList.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {resolvedList.map((s) => {
            const action = resolved.get(s.id);
            const info = getPreferenceInfo(s.preference_key);
            return (
              <div
                key={s.id}
                className={clsx(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-all",
                  action === "accept"
                    ? "bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400"
                    : "bg-surface-50 text-surface-500 line-through"
                )}
              >
                {action === "accept" ? (
                  <Check size={12} className="shrink-0" />
                ) : (
                  <X size={12} className="shrink-0" />
                )}
                <span>
                  {info.label}
                  {action === "accept" && (
                    <span className="ml-1 font-medium">
                      → {formatValue(s.preference_key, s.suggested_value)}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* All resolved message */}
      {!loading && pending.length === 0 && resolvedList.length > 0 && (
        <div className="mt-3 text-center py-3">
          <p className="text-xs text-surface-500">
            Alle Vorschläge bearbeitet. Du kannst jederzeit neue generieren.
          </p>
        </div>
      )}
    </Card>
  );
}
