"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { clsx } from "clsx";
import {
  Dna,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  Target,
  Clock,
  Zap,
  CalendarCheck,
  Lightbulb,
  RefreshCw,
  Loader2,
  AlertCircle,
  BarChart3,
  Flame,
  BookOpen,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useStudyPatterns } from "@/lib/hooks/useStudyPatterns";
import { useCommandCenter } from "@/lib/hooks/useCommandCenter";
import type { RiskLevel, Action } from "@/lib/decision/types";
import Link from "next/link";
import { PreferenceSuggestions } from "@/components/dna/PreferenceSuggestions";
import { DnaTrendChart } from "@/components/dna/DnaTrendChart";

// ── Error Boundary for Engine Section (prevents page crash) ─────────────────

class EngineErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: Error) {
    console.error("[EngineContextSection] Error caught:", error);
  }
  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

// ── Types ────────────────────────────────────────────────────────────────────

interface DnaSnapshot {
  id: string;
  user_id: string;
  snapshot_type: "weekly" | "monthly" | "on_demand";
  period_start: string;
  period_end: string;
  consistency_score: number;
  focus_score: number;
  endurance_score: number;
  adaptability_score: number;
  planning_score: number;
  overall_score: number;
  learner_type: string;
  sessions_analyzed: number;
  total_study_minutes: number;
  avg_daily_minutes: number;
  data_quality: string;
  vs_previous: Record<string, number | string> | null;
  created_at: string;
}

interface DnaDimension {
  key: string;
  label: string;
  score: number;
  change: number | null;
  icon: typeof Brain;
  color: string;
  description: string;
}

// ── Learner Type Labels ──────────────────────────────────────────────────────

const LEARNER_TYPES: Record<string, { label: string; description: string; emoji: string }> = {
  marathon_learner: { label: "Marathon-Lerner", description: "Lange Sessions, hohe Ausdauer, regelmässig", emoji: "🏃" },
  sprint_learner: { label: "Sprint-Lerner", description: "Intensive Kurzeinheiten mit hohem Fokus", emoji: "⚡" },
  balanced_learner: { label: "Ausgewogener Lerner", description: "Gute Balance aller Dimensionen", emoji: "⚖️" },
  focused_learner: { label: "Fokus-Lerner", description: "Überdurchschnittliche Konzentration", emoji: "🎯" },
  adaptive_learner: { label: "Adaptiver Lerner", description: "Passt sich gut an veränderte Bedingungen an", emoji: "🔄" },
  planner: { label: "Planer", description: "Starke Vorausplanung und Zeiteinhaltung", emoji: "📋" },
  developing: { label: "Im Aufbau", description: "Noch wenig Daten — weiter so!", emoji: "🌱" },
};

// ── Risk helpers ─────────────────────────────────────────────────────────────

const RISK_BADGE: Record<RiskLevel, string> = {
  critical: "bg-red-100 text-red-700",
  high: "bg-orange-100 text-orange-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-green-100 text-green-700",
  none: "bg-surface-100 text-surface-600",
};
const RISK_LABELS: Record<RiskLevel, string> = {
  critical: "Kritisch", high: "Hoch", medium: "Mittel", low: "Niedrig", none: "Okay",
};

// ── DNA Radar Chart (SVG) ────────────────────────────────────────────────────

function DnaRadar({ dimensions }: { dimensions: DnaDimension[] }) {
  const size = 240;
  const center = size / 2;
  const radius = 90;
  const levels = 5;
  const count = dimensions.length;

  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const gridLines = Array.from({ length: levels }, (_, i) => {
    const r = ((i + 1) / levels) * radius;
    const points = Array.from({ length: count }, (_, j) => {
      const angle = (Math.PI * 2 * j) / count - Math.PI / 2;
      return `${center + r * Math.cos(angle)},${center + r * Math.sin(angle)}`;
    }).join(" ");
    return points;
  });

  const dataPoints = dimensions.map((d, i) => getPoint(i, d.score));
  const dataPath = dataPoints.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + "Z";

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-xs mx-auto sm:max-w-sm">
      {/* Grid */}
      {gridLines.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="currentColor"
          strokeWidth={0.5}
          opacity={0.2}
 className="text-surface-400"
        />
      ))}
      {/* Axes */}
      {dimensions.map((_, i) => {
        const end = getPoint(i, 100);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={end.x}
            y2={end.y}
            stroke="currentColor"
            strokeWidth={0.5}
            opacity={0.15}
 className="text-surface-400"
          />
        );
      })}
      {/* Data polygon */}
      <polygon
        points={dataPoints.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="rgb(var(--brand-500))"
        fillOpacity={0.15}
        stroke="rgb(var(--brand-500))"
        strokeWidth={2}
      />
      {/* Data points */}
      {dataPoints.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={4} fill="rgb(var(--brand-500))" />
      ))}
      {/* Labels */}
      {dimensions.map((d, i) => {
        const labelPoint = getPoint(i, 125);
        return (
          <text
            key={i}
            x={labelPoint.x}
            y={labelPoint.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[9px] sm:text-[10px] fill-surface-700 dark:fill-surface-300 font-medium"
          >
            {d.label}
          </text>
        );
      })}
    </svg>
  );
}

// ── Score Bar ────────────────────────────────────────────────────────────────

function ScoreBar({ dimension }: { dimension: DnaDimension }) {
  const Icon = dimension.icon;
  const TrendIcon = dimension.change === null || dimension.change === 0
    ? Minus
    : dimension.change > 0 ? TrendingUp : TrendingDown;
  const trendColor = dimension.change === null || dimension.change === 0
 ?"text-surface-400"
    : dimension.change > 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Icon size={16} className={clsx(dimension.color, "shrink-0")} />
 <span className="text-xs sm:text-sm font-medium text-surface-800 truncate">{dimension.label}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs sm:text-sm font-semibold text-surface-900 dark:text-white">{Math.round(dimension.score)}%</span>
          {dimension.change !== null && (
            <span className={clsx("flex items-center gap-0.5 text-xs", trendColor)}>
              <TrendIcon size={12} />
              {Math.abs(dimension.change).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
 <div className="h-2 bg-surface-200 rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all duration-700", dimension.color.replace("text-", "bg-"))}
          style={{ width: `${Math.min(100, dimension.score)}%` }}
        />
      </div>
 <p className="text-xs text-surface-600">{dimension.description}</p>
    </div>
  );
}

// ── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({ type, severity, data }: { type: string; severity: string; data: Record<string, any> }) {
  const severityColors: Record<string, string> = {
    positive: "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20",
    info: "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20",
    warning: "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20",
    critical: "border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20",
  };

  const severityTextColors: Record<string, string> = {
    positive: "text-green-700 dark:text-green-400",
    info: "text-blue-700 dark:text-blue-400",
    warning: "text-amber-700 dark:text-amber-400",
    critical: "text-red-700 dark:text-red-400",
  };

  const severityIcons: Record<string, typeof Lightbulb> = {
    positive: TrendingUp,
    info: Lightbulb,
    warning: AlertCircle,
    critical: AlertCircle,
  };

  const Icon = severityIcons[severity] || Lightbulb;

  const getText = () => {
    switch (type) {
      case "peak_hours": return `Deine produktivsten Stunden: ${data.hours?.join(", ")} Uhr`;
      case "weak_hours": return `Schwächere Stunden: ${data.hours?.join(", ")} Uhr`;
      case "duration_sweet_spot": return `Ideale Session-Dauer: ${data.minutes} Minuten`;
      case "consistency": return `Konsistenz-Score: ${data.score}% — ${data.trend || "stabil"}`;
      case "streak": return `Aktuelle Lernserie: ${data.current} Tage (Rekord: ${data.longest})`;
      case "improvement": return `Verbesserung in ${data.area}: +${data.change}%`;
      case "decline": return `Rückgang in ${data.area}: ${data.change}%`;
      case "energy_mismatch": return "Dein Stundenplan stimmt nicht mit deinen Energiephasen überein";
      case "procrastination": return `Durchschnittliche Startverzögerung: ${data.minutes} Minuten`;
      default: return JSON.stringify(data);
    }
  };

  return (
    <div className={clsx("flex items-start gap-2 sm:gap-3 p-2.5 sm:p-3 rounded-lg sm:rounded-xl border text-xs sm:text-sm", severityColors[severity] || severityColors.info)}>
      <Icon size={16} className={clsx("mt-0.5 shrink-0", severityTextColors[severity] || severityTextColors.info)} />
      <p className={severityTextColors[severity] || severityTextColors.info}>{getText()}</p>
    </div>
  );
}

// ── Decision Engine Bridge Section ──────────────────────────────────────────
// Connects DNA dimensions to the Decision Engine's risk assessment and actions

function EngineContextSection({
  snapshot,
}: {
  snapshot: DnaSnapshot;
}) {
  const { state, modules } = useCommandCenter(undefined, true);

  if (!state || modules.length === 0) return null;

  const { overview, risks, today } = state;

  // Derive DNA-influenced recommendations
  const dnaRecommendations = useMemo(() => {
    const recs: { text: string; severity: "positive" | "warning" | "info" }[] = [];

    // Consistency-based recommendations
    if (snapshot.consistency_score < 40) {
      recs.push({
        text: `Deine Konsistenz ist niedrig (${Math.round(snapshot.consistency_score)}%). Versuche täglich mindestens 30 Minuten zu lernen.`,
        severity: "warning",
      });
    } else if (snapshot.consistency_score >= 75) {
      recs.push({
        text: `Starke Konsistenz (${Math.round(snapshot.consistency_score)}%)! Das hilft dir bei ${overview.activeModules} aktiven Modulen.`,
        severity: "positive",
      });
    }

    // Planning score vs at-risk modules
    if (snapshot.planning_score < 50 && overview.atRiskModules > 0) {
      recs.push({
        text: `${overview.atRiskModules} Module sind gefährdet und deine Planung liegt bei ${Math.round(snapshot.planning_score)}%. Nutze den Smart Schedule für bessere Struktur.`,
        severity: "warning",
      });
    }

    // Focus score vs study time
    if (snapshot.focus_score >= 70 && overview.totalStudyMinutesThisWeek < 120) {
      recs.push({
        text: `Dein Fokus ist stark (${Math.round(snapshot.focus_score)}%), aber du lernst nur ${Math.round(overview.totalStudyMinutesThisWeek / 60)}h/Woche. Mehr Zeit würde sich auszahlen.`,
        severity: "info",
      });
    }

    // Endurance + study session recommendations
    if (snapshot.endurance_score < 40) {
      recs.push({
        text: "Deine Ausdauer ist noch ausbaubar. Versuche die Pomodoro-Technik mit kürzeren Sessions.",
        severity: "info",
      });
    }

    return recs;
  }, [snapshot, overview]);

  // Top 3 at-risk modules from engine
  const topRiskModules = useMemo(() => {
    const riskModules = state?.risks?.modules;
    if (!riskModules || typeof riskModules.get !== "function") return [];
    const entries: { name: string; code: string; risk: RiskLevel; color?: string }[] = [];
    for (const mod of modules) {
      const risk = riskModules.get(mod.moduleId);
      if (risk && (risk.overall === "critical" || risk.overall === "high" || risk.overall === "medium")) {
        entries.push({
          name: mod.moduleName,
          code: mod.moduleCode ?? "",
          risk: risk.overall,
          color: mod.color,
        });
      }
    }
    return entries.slice(0, 3);
  }, [modules, state?.risks]);

  // Top actions from today's plan
  const topActions = today?.actions?.slice(0, 3) ?? [];

  return (
    <Card padding="lg">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={16} className="text-brand-500 shrink-0" />
 <h3 className="text-xs sm:text-sm font-semibold text-surface-800">DNA trifft Decision Engine</h3>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {/* DNA-based recommendations */}
        {dnaRecommendations.length > 0 && (
          <div className="space-y-2">
            {dnaRecommendations.map((rec, i) => (
              <div
                key={i}
                className={clsx(
                  "flex items-start gap-2 p-2.5 rounded-lg border text-xs sm:text-xs",
                  rec.severity === "positive" ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
                  : rec.severity === "warning" ? "border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"
                  : "border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400"
                )}
              >
                {rec.severity === "positive" ? <TrendingUp size={12} className="mt-0.5 shrink-0" />
                  : rec.severity === "warning" ? <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  : <Lightbulb size={12} className="mt-0.5 shrink-0" />}
                <span className="leading-tight">{rec.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* At-risk modules (from engine) */}
        {topRiskModules.length > 0 && (
 <div className="pt-2 border-t border-surface-200">
 <p className="text-xs font-medium text-surface-600 mb-2">Gefährdete Module</p>
            <div className="space-y-1.5">
              {topRiskModules.map((mod, i) => (
                <div key={i} className="flex items-center gap-2 min-w-0">
                  <div
                    className="w-2 h-6 rounded-full shrink-0"
                    style={{ backgroundColor: mod.color || "rgb(var(--surface-300))" }}
                  />
 <span className="text-xs text-surface-700 flex-1 truncate">{mod.name}</span>
                  <span className={clsx("text-xs px-1.5 py-0.5 rounded font-medium shrink-0", RISK_BADGE[mod.risk])}>
                    {RISK_LABELS[mod.risk]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's top actions from engine */}
        {topActions.length > 0 && (
 <div className={topRiskModules.length > 0 ?"pt-2 border-t border-surface-200" :""}>
 <p className="text-xs font-medium text-surface-600 mb-2">Empfohlene Aktionen heute</p>
            <div className="space-y-1">
              {topActions.map((action, i) => (
 <div key={i} className="flex items-center gap-2 text-xs text-surface-700 min-w-0">
                  <Zap size={10} className="shrink-0 text-brand-400" />
                  <span className="truncate">{action.title}</span>
                  {action.estimatedMinutes && (
 <span className="text-surface-500 shrink-0">{action.estimatedMinutes}min</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link to Command Center */}
        <Link
          href="/command-center"
          className="flex items-center gap-1 text-xs text-brand-500 dark:text-brand-400 hover:text-brand-600 dark:hover:text-brand-300 pt-2"
        >
          Zum Command Center <ChevronRight size={12} />
        </Link>
      </div>
    </Card>
  );
}

// ── Main Page Component ──────────────────────────────────────────────────────

export default function LernDnaPage() {
  const supabase = createClient();
  const [snapshot, setSnapshot] = useState<DnaSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { patterns, insights, loading: patternsLoading, refreshPatterns } = useStudyPatterns(30);

  // Load latest DNA snapshot
  const loadSnapshot = useCallback(async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error: err } = await supabase
        .from("learning_dna_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (err) throw err;
      setSnapshot(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { loadSnapshot(); }, [loadSnapshot]);

  // Create a new snapshot on demand
  const createSnapshot = useCallback(async () => {
    setCreating(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error: rpcErr } = await supabase.rpc("create_dna_snapshot", {
        p_user_id: user.id,
        p_type: "on_demand",
      });

      if (rpcErr) throw rpcErr;
      await loadSnapshot();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Snapshot konnte nicht erstellt werden");
    } finally {
      setCreating(false);
    }
  }, [supabase, loadSnapshot]);

  // Build dimensions from snapshot
  const dimensions: DnaDimension[] = snapshot ? [
    {
      key: "consistency", label: "Konsistenz", score: snapshot.consistency_score,
      change: (snapshot.vs_previous?.consistency_score as number) ?? null,
      icon: CalendarCheck, color: "text-blue-500",
      description: "Wie regelmässig du lernst",
    },
    {
      key: "focus", label: "Fokus", score: snapshot.focus_score,
      change: (snapshot.vs_previous?.focus_score as number) ?? null,
      icon: Target, color: "text-purple-500",
      description: "Konzentration während der Lerneinheiten",
    },
    {
      key: "endurance", label: "Ausdauer", score: snapshot.endurance_score,
      change: (snapshot.vs_previous?.endurance_score as number) ?? null,
      icon: Flame, color: "text-orange-500",
      description: "Wie lange du produktiv bleibst",
    },
    {
      key: "adaptability", label: "Anpassung", score: snapshot.adaptability_score,
      change: (snapshot.vs_previous?.adaptability_score as number) ?? null,
      icon: Zap, color: "text-green-500",
      description: "Flexibilität bei veränderten Plänen",
    },
    {
      key: "planning", label: "Planung", score: snapshot.planning_score,
      change: (snapshot.vs_previous?.planning_score as number) ?? null,
      icon: Clock, color: "text-cyan-500",
      description: "Einhaltung geplanter Lernzeiten",
    },
  ] : [];

  const learnerInfo = snapshot ? LEARNER_TYPES[snapshot.learner_type] || LEARNER_TYPES.developing : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 py-6 sm:py-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 sm:w-10 h-9 sm:h-10 rounded-lg sm:rounded-xl bg-brand-100 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center shrink-0">
            <Dna size={18} className="sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-surface-900 dark:text-white">Deine Lern-DNA</h1>
 <p className="text-xs sm:text-sm text-surface-600">Dein persönliches Lernprofil</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={createSnapshot}
          loading={creating}
          disabled={creating}
          className="w-full sm:w-auto"
        >
          <RefreshCw size={14} className={creating ? "animate-spin" : ""} />
          Aktualisieren
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-lg sm:rounded-xl bg-danger-50 dark:bg-danger-900/20 border border-danger-200 dark:border-danger-800 text-xs sm:text-sm text-danger-700 dark:text-danger-400">
          {error}
        </div>
      )}

      {!snapshot ? (
        <Card padding="lg" className="text-center">
          <div className="py-6 sm:py-8 space-y-4">
 <div className="w-14 sm:w-16 h-14 sm:h-16 rounded-full bg-surface-100 text-surface-400 flex items-center justify-center mx-auto">
              <Dna size={28} className="sm:w-8 sm:h-8" />
            </div>
 <h2 className="text-base sm:text-lg font-semibold text-surface-800">Noch keine Lern-DNA</h2>
 <p className="text-xs sm:text-sm text-surface-600 max-w-md mx-auto">
              Starte ein paar Lerneinheiten mit dem Timer, damit Semetra dein Lernprofil erstellen kann.
              Je mehr Daten, desto genauer werden deine Empfehlungen.
            </p>
            <Button variant="primary" onClick={createSnapshot} loading={creating}>
              Erste Analyse starten
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Learner Type Badge */}
          {learnerInfo && (
            <Card padding="md" className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
              <span className="text-2xl sm:text-3xl shrink-0">{learnerInfo.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                  <h2 className="text-base sm:text-lg font-bold text-surface-900 dark:text-white">{learnerInfo.label}</h2>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400 font-medium w-fit">
                    {Math.round(snapshot.overall_score)}% Gesamt
                  </span>
                </div>
 <p className="text-xs sm:text-sm text-surface-600">{learnerInfo.description}</p>
              </div>
 <div className="text-right text-xs text-surface-500 shrink-0">
                <p>{snapshot.sessions_analyzed} Sessions</p>
                <p>{Math.round(snapshot.total_study_minutes / 60)}h total</p>
              </div>
            </Card>
          )}

          {/* DNA Radar + Scores */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            <Card padding="lg">
 <h3 className="text-xs sm:text-sm font-semibold text-surface-800 mb-4">DNA-Profil</h3>
              <div className="max-w-xs mx-auto">
                <DnaRadar dimensions={dimensions} />
              </div>
            </Card>

            <Card padding="lg">
 <h3 className="text-xs sm:text-sm font-semibold text-surface-800 mb-4">Dimensionen im Detail</h3>
              <div className="space-y-3 sm:space-y-4">
                {dimensions.map((d) => (
                  <ScoreBar key={d.key} dimension={d} />
                ))}
              </div>
            </Card>
          </div>

          {/* DNA Trend History */}
          <DnaTrendChart />

          {/* Preference Suggestions — DNA-based recommendations */}
          <PreferenceSuggestions />

          {/* Decision Engine Bridge — wrapped in error boundary */}
          <EngineErrorBoundary>
            <EngineContextSection snapshot={snapshot} />
          </EngineErrorBoundary>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            <Card padding="md" className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white">
                {patterns?.currentStreakDays ?? 0}
              </p>
 <p className="text-xs text-surface-600 mt-1">Tage Serie</p>
            </Card>
            <Card padding="md" className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white">
                {Math.round(snapshot.avg_daily_minutes)} min
              </p>
 <p className="text-xs text-surface-600 mt-1">Ø pro Tag</p>
            </Card>
            <Card padding="md" className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white">
                {patterns?.avgSessionMinutes ? Math.round(patterns.avgSessionMinutes) : "–"} min
              </p>
 <p className="text-xs text-surface-600 mt-1">Ø Session</p>
            </Card>
            <Card padding="md" className="text-center">
              <p className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-white">
                {snapshot.data_quality === "strong" ? "Stark" :
                 snapshot.data_quality === "reliable" ? "Gut" :
                 snapshot.data_quality === "emerging" ? "Wachsend" : "Wenig"}
              </p>
 <p className="text-xs text-surface-600 mt-1">Datenqualität</p>
            </Card>
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <Card padding="lg">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} className="text-brand-500 shrink-0" />
 <h3 className="text-xs sm:text-sm font-semibold text-surface-800">Erkenntnisse</h3>
              </div>
              <div className="space-y-2 sm:space-y-2.5">
                {insights.map((insight, i) => (
                  <InsightCard
                    key={i}
                    type={insight.type}
                    severity={insight.severity}
                    data={insight.data}
                  />
                ))}
              </div>
            </Card>
          )}

          {/* Period info */}
 <p className="text-xs text-surface-500 text-center px-2">
            Zeitraum: {new Date(snapshot.period_start).toLocaleDateString("de-CH")} –{" "}
            {new Date(snapshot.period_end).toLocaleDateString("de-CH")} | Erstellt:{" "}
            {new Date(snapshot.created_at).toLocaleDateString("de-CH", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </>
      )}
    </div>
  );
}
