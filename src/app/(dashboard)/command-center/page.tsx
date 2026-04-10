"use client";
import { useState, useMemo } from "react";
import { clsx } from "clsx";
import {
  Radar,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Clock,
  BookOpen,
  CheckCircle2,
  XCircle,
  Zap,
  Calendar,
  GraduationCap,
  RefreshCw,
  Loader2,
  ChevronRight,
  Flame,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useCommandCenter } from "@/lib/hooks/useCommandCenter";
import type { RiskLevel, ActionUrgency, TrendDirection } from "@/lib/decision/types";
import Link from "next/link";

// ── Helper maps ──────────────────────────────────────────────────────────────

const RISK_COLORS: Record<RiskLevel, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-400",
  low: "bg-green-400",
  none: "bg-surface-200",
};

const RISK_LABELS: Record<RiskLevel, string> = {
  critical: "Kritisch",
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
  none: "Kein Risiko",
};

const RISK_BG: Record<RiskLevel, string> = {
  critical: "bg-red-50 border-red-200 text-red-800",
  high: "bg-orange-50 border-orange-200 text-orange-800",
  medium: "bg-amber-50 border-amber-200 text-amber-800",
  low: "bg-green-50 border-green-200 text-green-800",
  none: "bg-surface-50 border-surface-200 text-surface-700",
};

const URGENCY_LABELS: Record<ActionUrgency, string> = {
  now: "Jetzt",
  today: "Heute",
  this_week: "Diese Woche",
  soon: "Bald",
  later: "Später",
};

const URGENCY_COLORS: Record<ActionUrgency, string> = {
  now: "bg-red-100 text-red-700",
  today: "bg-orange-100 text-orange-700",
  this_week: "bg-amber-100 text-amber-700",
  soon: "bg-blue-100 text-blue-700",
  later: "bg-surface-100 text-surface-600",
};

function TrendIcon({ trend }: { trend: TrendDirection }) {
  switch (trend) {
    case "improving": return <TrendingUp size={14} className="text-green-500" />;
    case "declining": return <TrendingDown size={14} className="text-red-500" />;
    case "stable": return <Minus size={14} className="text-surface-400" />;
    default: return null;
  }
}

// ── Metric Card ──────────────────────────────────────────────────────────────

function MetricCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: typeof Target;
  color?: string;
  subtitle?: string;
}) {
  return (
    <Card padding="md" className="text-center">
      <div className={clsx("w-8 h-8 rounded-lg flex items-center justify-center mx-auto mb-2", color || "bg-brand-100 text-brand-600")}>
        <Icon size={16} />
      </div>
      <p className="text-2xl font-bold text-surface-800">{value}</p>
      <p className="text-xs text-surface-500 mt-0.5">{label}</p>
      {subtitle && <p className="text-xs text-surface-400 mt-0.5">{subtitle}</p>}
    </Card>
  );
}

// ── Module Risk Row ──────────────────────────────────────────────────────────

function ModuleRiskRow({
  name,
  code,
  risk,
  color,
  daysUntilExam,
  trend,
}: {
  name: string;
  code?: string;
  risk: RiskLevel;
  color?: string;
  daysUntilExam?: number | null;
  trend?: TrendDirection;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div
        className="w-2 h-8 rounded-full shrink-0"
        style={{ backgroundColor: color || "rgb(var(--surface-300))" }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-surface-800 truncate">{name}</p>
        {code && <p className="text-xs text-surface-400">{code}</p>}
      </div>
      {trend && <TrendIcon trend={trend} />}
      {daysUntilExam != null && daysUntilExam <= 14 && (
        <span className="text-xs text-surface-500 shrink-0">
          {daysUntilExam}d
        </span>
      )}
      <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border", RISK_BG[risk])}>
        {RISK_LABELS[risk]}
      </span>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const { state, modules, loading, refetch } = useCommandCenter();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Sort modules by risk
  const sortedByRisk = useMemo(() => {
    if (!state) return [];
    return [...state.moduleRankings].sort((a, b) => {
      const riskOrder: Record<RiskLevel, number> = { critical: 0, high: 1, medium: 2, low: 3, none: 4 };
      const aRisk = state.risks.modules.get(a.moduleId)?.level ?? "none";
      const bRisk = state.risks.modules.get(b.moduleId)?.level ?? "none";
      return riskOrder[aRisk] - riskOrder[bRisk];
    });
  }, [state]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card padding="lg" className="text-center">
          <div className="py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-100 text-surface-400 flex items-center justify-center mx-auto">
              <Radar size={32} />
            </div>
            <h2 className="text-lg font-semibold text-surface-700">Kein Command Center verfügbar</h2>
            <p className="text-sm text-surface-500 max-w-md mx-auto">
              Füge Module hinzu und starte Lerneinheiten, damit das Command Center deine Daten analysieren kann.
            </p>
            <Link href="/modules">
              <Button variant="primary">Module hinzufügen</Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const { today, overview, risks } = state;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
            <Radar size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Command Center</h1>
            <p className="text-sm text-surface-500">Dein Studium auf einen Blick</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={refetch}>
          <RefreshCw size={14} />
          Aktualisieren
        </Button>
      </div>

      {/* Alerts */}
      {today.alerts.length > 0 && (
        <div className="space-y-2">
          {today.alerts.map((alert, i) => (
            <div
              key={i}
              className={clsx(
                "flex items-start gap-3 p-3 rounded-xl border",
                RISK_BG[alert.level]
              )}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">{alert.title}</p>
                <p className="text-xs opacity-80 mt-0.5">{alert.message}</p>
              </div>
              {alert.actionRequired && (
                <span className="text-xs font-medium px-2 py-0.5 rounded bg-white/50">
                  Aktion nötig
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Overview Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Module aktiv"
          value={overview.activeModules}
          icon={BookOpen}
          subtitle={`${overview.atRiskModules} gefährdet`}
        />
        <MetricCard
          label="ECTS"
          value={`${overview.ectsEarned}/${overview.ectsTarget}`}
          icon={GraduationCap}
          color="bg-purple-100 text-purple-600"
        />
        <MetricCard
          label="Lernserie"
          value={`${overview.studyStreak} Tage`}
          icon={Flame}
          color="bg-orange-100 text-orange-600"
        />
        <MetricCard
          label="Lernzeit/Woche"
          value={`${Math.round(overview.totalStudyMinutesThisWeek / 60)}h`}
          icon={Clock}
          color="bg-cyan-100 text-cyan-600"
          subtitle={`${overview.tasksOverdue} Aufgaben überfällig`}
        />
      </div>

      {/* Today's Focus */}
      {today.focusModule && (
        <Card padding="md" className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
            <Target size={24} />
          </div>
          <div className="flex-1">
            <p className="text-xs text-surface-500 uppercase tracking-wide font-medium">Fokus heute</p>
            <p className="text-lg font-bold text-surface-800">{today.focusModule.name}</p>
            <p className="text-sm text-surface-500">{today.focusModule.reason}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-brand-600">{today.totalMinutes} min</p>
            <p className="text-xs text-surface-400">geplant</p>
          </div>
        </Card>
      )}

      {/* Today's Actions */}
      {today.actions.length > 0 && (
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Zap size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-surface-700">Empfohlene Aktionen</h3>
          </div>
          <div className="space-y-2">
            {today.actions.slice(0, 6).map((action, i) => (
              <div key={i} className="flex items-center gap-3 py-2 border-b border-surface-50 last:border-0">
                <span className={clsx("px-2 py-0.5 rounded text-xs font-medium", URGENCY_COLORS[action.urgency])}>
                  {URGENCY_LABELS[action.urgency]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-surface-700 truncate">{action.title}</p>
                  {action.reason && (
                    <p className="text-xs text-surface-400 truncate">{action.reason}</p>
                  )}
                </div>
                {action.estimatedMinutes && (
                  <span className="text-xs text-surface-400 shrink-0">{action.estimatedMinutes}min</span>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Risk Overview + Module Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Risk summary */}
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <AlertCircle size={16} className="text-red-500" />
            <h3 className="text-sm font-semibold text-surface-700">Risiko-Übersicht</h3>
          </div>

          {/* Risk bar */}
          <div className="flex h-3 rounded-full overflow-hidden mb-4">
            {(["critical", "high", "medium", "low"] as RiskLevel[]).map((level) => {
              const count = level === "critical" ? risks.critical.length
                : level === "high" ? risks.high.length
                : level === "medium" ? risks.medium.length
                : Math.max(0, overview.activeModules - risks.critical.length - risks.high.length - risks.medium.length);
              if (count === 0) return null;
              return (
                <div
                  key={level}
                  className={clsx(RISK_COLORS[level], "transition-all")}
                  style={{ width: `${(count / Math.max(1, overview.activeModules)) * 100}%` }}
                  title={`${count} ${RISK_LABELS[level]}`}
                />
              );
            })}
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-surface-600">Kritisch: {risks.critical.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-surface-600">Hoch: {risks.high.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-400" />
              <span className="text-surface-600">Mittel: {risks.medium.length}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400" />
              <span className="text-surface-600">Niedrig: {Math.max(0, overview.activeModules - risks.critical.length - risks.high.length - risks.medium.length)}</span>
            </div>
          </div>
        </Card>

        {/* Exams coming up */}
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-4">
            <Calendar size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-surface-700">Anstehende Prüfungen</h3>
          </div>
          {overview.examsThisMonth.length === 0 ? (
            <p className="text-sm text-surface-400">Keine Prüfungen diesen Monat</p>
          ) : (
            <div className="space-y-2">
              {overview.examsThisMonth.slice(0, 5).map((exam, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-surface-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-surface-700">{exam.title}</p>
                    <p className="text-xs text-surface-400">{exam.moduleName}</p>
                  </div>
                  <span className="text-xs text-surface-500">
                    {new Date(exam.date).toLocaleDateString("de-CH", { day: "numeric", month: "short" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Module Rankings */}
      <Card padding="lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-surface-700">Module nach Risiko</h3>
          </div>
          <Link href="/modules" className="text-xs text-brand-500 hover:text-brand-600 flex items-center gap-1">
            Alle Module <ChevronRight size={12} />
          </Link>
        </div>
        <div className="divide-y divide-surface-50">
          {sortedByRisk.map((mp) => {
            const mod = modules.find((m) => m.moduleId === mp.moduleId);
            const risk = state.risks.modules.get(mp.moduleId);
            if (!mod) return null;
            return (
              <ModuleRiskRow
                key={mp.moduleId}
                name={mod.moduleName}
                code={mod.moduleCode}
                risk={risk?.level ?? "none"}
                color={mod.color}
                daysUntilExam={mod.exams.daysUntilNext}
                trend={mod.grades.trend}
              />
            );
          })}
        </div>
      </Card>

      {/* GPA if available */}
      {overview.overallGPA !== null && (
        <p className="text-xs text-surface-400 text-center">
          Aktueller Durchschnitt: {overview.overallGPA.toFixed(2)} | Stand: {new Date(state.computedAt).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
        </p>
      )}
    </div>
  );
}
