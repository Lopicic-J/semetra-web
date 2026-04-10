"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
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
  comparison: Record<string, number> | null;
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
    <svg viewBox={`0 0 ${size} ${size}`} className="w-full max-w-[280px] mx-auto">
      {/* Grid */}
      {gridLines.map((points, i) => (
        <polygon
          key={i}
          points={points}
          fill="none"
          stroke="rgb(var(--surface-200))"
          strokeWidth={0.5}
          opacity={0.6}
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
            stroke="rgb(var(--surface-200))"
            strokeWidth={0.5}
            opacity={0.4}
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
            className="text-[10px] fill-surface-600 font-medium"
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
    ? "text-surface-400"
    : dimension.change > 0 ? "text-green-500" : "text-red-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon size={16} className={dimension.color} />
          <span className="text-sm font-medium text-surface-700">{dimension.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-surface-800">{Math.round(dimension.score)}%</span>
          {dimension.change !== null && (
            <span className={clsx("flex items-center gap-0.5 text-xs", trendColor)}>
              <TrendIcon size={12} />
              {Math.abs(dimension.change).toFixed(0)}%
            </span>
          )}
        </div>
      </div>
      <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
        <div
          className={clsx("h-full rounded-full transition-all duration-700", dimension.color.replace("text-", "bg-"))}
          style={{ width: `${Math.min(100, dimension.score)}%` }}
        />
      </div>
      <p className="text-xs text-surface-500">{dimension.description}</p>
    </div>
  );
}

// ── Insight Card ─────────────────────────────────────────────────────────────

function InsightCard({ type, severity, data }: { type: string; severity: string; data: Record<string, any> }) {
  const severityColors: Record<string, string> = {
    positive: "border-green-200 bg-green-50",
    info: "border-blue-200 bg-blue-50",
    warning: "border-amber-200 bg-amber-50",
    critical: "border-red-200 bg-red-50",
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
    <div className={clsx("flex items-start gap-3 p-3 rounded-xl border", severityColors[severity] || severityColors.info)}>
      <Icon size={16} className="mt-0.5 shrink-0" />
      <p className="text-sm text-surface-700">{getText()}</p>
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
  const { state, modules } = useCommandCenter();

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
    const entries: { name: string; code: string; risk: RiskLevel; color?: string }[] = [];
    for (const mod of modules) {
      const risk = state.risks.modules.get(mod.moduleId);
      if (risk && (risk.overall === "critical" || risk.overall === "high" || risk.overall === "medium")) {
        entries.push({
          name: mod.moduleName,
          code: mod.moduleCode,
          risk: risk.overall,
          color: mod.color,
        });
      }
    }
    return entries.slice(0, 3);
  }, [modules, state.risks]);

  // Top actions from today's plan
  const topActions = today.actions.slice(0, 3);

  return (
    <Card padding="lg">
      <div className="flex items-center gap-2 mb-4">
        <Brain size={16} className="text-brand-500" />
        <h3 className="text-sm font-semibold text-surface-700">DNA trifft Decision Engine</h3>
      </div>

      <div className="space-y-4">
        {/* DNA-based recommendations */}
        {dnaRecommendations.length > 0 && (
          <div className="space-y-2">
            {dnaRecommendations.map((rec, i) => (
              <div
                key={i}
                className={clsx(
                  "flex items-start gap-2 p-2.5 rounded-lg border text-xs",
                  rec.severity === "positive" ? "border-green-200 bg-green-50 text-green-700"
                  : rec.severity === "warning" ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
                )}
              >
                {rec.severity === "positive" ? <TrendingUp size={12} className="mt-0.5 shrink-0" />
                  : rec.severity === "warning" ? <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  : <Lightbulb size={12} className="mt-0.5 shrink-0" />}
                <span>{rec.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* At-risk modules (from engine) */}
        {topRiskModules.length > 0 && (
          <div>
            <p className="text-xs font-medium text-surface-500 mb-2">Gefährdete Module</p>
            <div className="space-y-1.5">
              {topRiskModules.map((mod, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div
                    className="w-2 h-6 rounded-full shrink-0"
                    style={{ backgroundColor: mod.color || "rgb(var(--surface-300))" }}
                  />
                  <span className="text-xs text-surface-700 flex-1 truncate">{mod.name}</span>
                  <span className={clsx("text-[10px] px-1.5 py-0.5 rounded font-medium", RISK_BADGE[mod.risk])}>
                    {RISK_LABELS[mod.risk]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Today's top actions from engine */}
        {topActions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-surface-500 mb-2">Empfohlene Aktionen heute</p>
            <div className="space-y-1">
              {topActions.map((action, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-surface-600">
                  <Zap size={10} className="shrink-0 text-brand-400" />
                  <span className="truncate">{action.title}</span>
                  {action.estimatedMinutes && (
                    <span className="text-surface-400 shrink-0">{action.estimatedMinutes}min</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Link to Command Center */}
        <Link
          href="/command-center"
          className="flex items-center gap-1 text-xs text-brand-500 hover:text-brand-600 pt-1"
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
      change: snapshot.comparison?.consistency_score ?? null,
      icon: CalendarCheck, color: "text-blue-500",
      description: "Wie regelmässig du lernst",
    },
    {
      key: "focus", label: "Fokus", score: snapshot.focus_score,
      change: snapshot.comparison?.focus_score ?? null,
      icon: Target, color: "text-purple-500",
      description: "Konzentration während der Lerneinheiten",
    },
    {
      key: "endurance", label: "Ausdauer", score: snapshot.endurance_score,
      change: snapshot.comparison?.endurance_score ?? null,
      icon: Flame, color: "text-orange-500",
      description: "Wie lange du produktiv bleibst",
    },
    {
      key: "adaptability", label: "Anpassung", score: snapshot.adaptability_score,
      change: snapshot.comparison?.adaptability_score ?? null,
      icon: Zap, color: "text-green-500",
      description: "Flexibilität bei veränderten Plänen",
    },
    {
      key: "planning", label: "Planung", score: snapshot.planning_score,
      change: snapshot.comparison?.planning_score ?? null,
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
            <Dna size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Deine Lern-DNA</h1>
            <p className="text-sm text-surface-500">Dein persönliches Lernprofil</p>
          </div>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={createSnapshot}
          loading={creating}
          disabled={creating}
        >
          <RefreshCw size={14} className={creating ? "animate-spin" : ""} />
          Aktualisieren
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger-50 border border-danger-100 text-sm text-danger-700">
          {error}
        </div>
      )}

      {!snapshot ? (
        <Card padding="lg" className="text-center">
          <div className="py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-100 text-surface-400 flex items-center justify-center mx-auto">
              <Dna size={32} />
            </div>
            <h2 className="text-lg font-semibold text-surface-700">Noch keine Lern-DNA</h2>
            <p className="text-sm text-surface-500 max-w-md mx-auto">
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
            <Card padding="md" className="flex items-center gap-4">
              <span className="text-3xl">{learnerInfo.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-surface-800">{learnerInfo.label}</h2>
                  <span className="px-2 py-0.5 text-xs rounded-full bg-brand-100 text-brand-700 font-medium">
                    {Math.round(snapshot.overall_score)}% Gesamt
                  </span>
                </div>
                <p className="text-sm text-surface-500">{learnerInfo.description}</p>
              </div>
              <div className="text-right text-xs text-surface-400">
                <p>{snapshot.sessions_analyzed} Sessions</p>
                <p>{Math.round(snapshot.total_study_minutes / 60)}h total</p>
              </div>
            </Card>
          )}

          {/* DNA Radar + Scores */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card padding="lg">
              <h3 className="text-sm font-semibold text-surface-700 mb-4">DNA-Profil</h3>
              <DnaRadar dimensions={dimensions} />
            </Card>

            <Card padding="lg">
              <h3 className="text-sm font-semibold text-surface-700 mb-4">Dimensionen im Detail</h3>
              <div className="space-y-4">
                {dimensions.map((d) => (
                  <ScoreBar key={d.key} dimension={d} />
                ))}
              </div>
            </Card>
          </div>

          {/* Decision Engine Bridge — NEW INTEGRATION */}
          <EngineContextSection snapshot={snapshot} />

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card padding="md" className="text-center">
              <p className="text-2xl font-bold text-surface-800">
                {patterns?.currentStreakDays ?? 0}
              </p>
              <p className="text-xs text-surface-500 mt-1">Tage Serie</p>
            </Card>
            <Card padding="md" className="text-center">
              <p className="text-2xl font-bold text-surface-800">
                {Math.round(snapshot.avg_daily_minutes)} min
              </p>
              <p className="text-xs text-surface-500 mt-1">Ø pro Tag</p>
            </Card>
            <Card padding="md" className="text-center">
              <p className="text-2xl font-bold text-surface-800">
                {patterns?.avgSessionMinutes ? Math.round(patterns.avgSessionMinutes) : "–"} min
              </p>
              <p className="text-xs text-surface-500 mt-1">Ø Session</p>
            </Card>
            <Card padding="md" className="text-center">
              <p className="text-2xl font-bold text-surface-800">
                {snapshot.data_quality === "strong" ? "Stark" :
                 snapshot.data_quality === "reliable" ? "Gut" :
                 snapshot.data_quality === "emerging" ? "Wachsend" : "Wenig"}
              </p>
              <p className="text-xs text-surface-500 mt-1">Datenqualität</p>
            </Card>
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <Card padding="lg">
              <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} className="text-brand-500" />
                <h3 className="text-sm font-semibold text-surface-700">Erkenntnisse</h3>
              </div>
              <div className="space-y-2">
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
          <p className="text-xs text-surface-400 text-center">
            Zeitraum: {new Date(snapshot.period_start).toLocaleDateString("de-CH")} –{" "}
            {new Date(snapshot.period_end).toLocaleDateString("de-CH")} | Erstellt:{" "}
            {new Date(snapshot.created_at).toLocaleDateString("de-CH", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </>
      )}
    </div>
  );
}
