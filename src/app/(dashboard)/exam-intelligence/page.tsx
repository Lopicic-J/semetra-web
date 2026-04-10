"use client";
import { useState, useMemo, useCallback } from "react";
import { clsx } from "clsx";
import {
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Loader2,
  Target,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
  Lightbulb,
  Calculator,
  ChevronDown,
  ChevronUp,
  BookOpen,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  useExamIntelligence,
  type ExamIntelligenceItem,
  type ExamRisk,
} from "@/lib/hooks/useExamIntelligence";

// ── Traffic Light Colors ─────────────────────────────────────────────────────

const TRAFFIC: Record<string, { bg: string; ring: string; text: string; label: string }> = {
  critical: { bg: "bg-red-500", ring: "ring-red-300", text: "text-red-700", label: "Kritisch" },
  high:     { bg: "bg-orange-500", ring: "ring-orange-300", text: "text-orange-700", label: "Hoch" },
  medium:   { bg: "bg-amber-400", ring: "ring-amber-200", text: "text-amber-700", label: "Achtung" },
  low:      { bg: "bg-green-500", ring: "ring-green-300", text: "text-green-700", label: "Gut" },
  none:     { bg: "bg-green-400", ring: "ring-green-200", text: "text-green-600", label: "Sicher" },
};

function TrendBadge({ trend }: { trend: string }) {
  if (trend === "improving") return <span className="flex items-center gap-0.5 text-xs text-green-600"><TrendingUp size={12} />Besser</span>;
  if (trend === "worsening") return <span className="flex items-center gap-0.5 text-xs text-red-600"><TrendingDown size={12} />Schlechter</span>;
  return <span className="flex items-center gap-0.5 text-xs text-surface-400"><Minus size={12} />Stabil</span>;
}

// ── Traffic Light Component ──────────────────────────────────────────────────

function TrafficLight({ risk }: { risk: ExamRisk | null }) {
  const level = risk?.level ?? "none";
  const t = TRAFFIC[level] || TRAFFIC.none;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={clsx("w-5 h-5 rounded-full ring-2 ring-offset-1", t.bg, t.ring)} />
      <span className={clsx("text-[10px] font-semibold", t.text)}>{t.label}</span>
    </div>
  );
}

// ── Exam Card with Traffic Light ─────────────────────────────────────────────

function ExamCard({
  exam,
  expanded,
  onToggle,
  onSimulate,
}: {
  exam: ExamIntelligenceItem;
  expanded: boolean;
  onToggle: () => void;
  onSimulate: () => void;
}) {
  const risk = exam.risk;
  const pred = exam.prediction;
  const t = TRAFFIC[risk?.level ?? "none"] || TRAFFIC.none;

  const passColor = pred
    ? pred.pass_prob >= 0.8 ? "text-green-600"
    : pred.pass_prob >= 0.6 ? "text-blue-600"
    : pred.pass_prob >= 0.4 ? "text-amber-600"
    : "text-red-600"
    : "text-surface-400";

  return (
    <Card padding="none" className="overflow-hidden">
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-surface-50/50 transition-colors"
      >
        {/* Module color bar */}
        <div
          className="w-1.5 h-12 rounded-full shrink-0"
          style={{ backgroundColor: exam.module_color || "rgb(var(--surface-300))" }}
        />

        {/* Traffic light */}
        <TrafficLight risk={risk} />

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-surface-800 truncate">{exam.title}</p>
          <p className="text-xs text-surface-500">
            {exam.module_name && <span>{exam.module_name} · </span>}
            {new Date(exam.date).toLocaleDateString("de-CH", { weekday: "short", day: "numeric", month: "short" })}
          </p>
        </div>

        {/* Days countdown */}
        <div className="text-center shrink-0">
          <p className={clsx(
            "text-lg font-bold",
            exam.days_until <= 3 ? "text-red-600" : exam.days_until <= 7 ? "text-amber-600" : "text-surface-700"
          )}>
            {exam.days_until}
          </p>
          <p className="text-[10px] text-surface-400">Tage</p>
        </div>

        {/* Readiness */}
        <div className="text-center shrink-0 w-14">
          <p className={clsx("text-sm font-bold", t.text)}>
            {risk ? `${Math.round(risk.readiness)}%` : "–"}
          </p>
          <p className="text-[10px] text-surface-400">Bereit</p>
        </div>

        {/* Pass probability */}
        <div className="text-center shrink-0 w-14">
          <p className={clsx("text-sm font-bold", passColor)}>
            {pred ? `${Math.round(pred.pass_prob * 100)}%` : "–"}
          </p>
          <p className="text-[10px] text-surface-400">Bestehen</p>
        </div>

        {/* Trend */}
        {risk && <TrendBadge trend={risk.trend} />}

        <div className="shrink-0 text-surface-400">
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-surface-100 p-4 bg-surface-50/30 space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Prediction */}
            {pred && (
              <>
                <div className="text-center">
                  <p className="text-xs text-surface-500">Prognose</p>
                  <p className="text-lg font-bold text-surface-800">{pred.grade.toFixed(1)}</p>
                  <p className="text-[10px] text-surface-400">{pred.worst.toFixed(1)} – {pred.best.toFixed(1)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-surface-500">Konfidenz</p>
                  <p className="text-lg font-bold text-surface-800">{Math.round(pred.confidence * 100)}%</p>
                </div>
              </>
            )}

            {/* Risk details */}
            {risk && (
              <>
                <div className="text-center">
                  <p className="text-xs text-surface-500">Risiko-Score</p>
                  <p className="text-lg font-bold text-surface-800">{Math.round(risk.score)}</p>
                  <p className="text-[10px] text-surface-400">von 100</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-surface-500">Wissensstand</p>
                  <p className="text-lg font-bold text-surface-800">{Math.round(risk.readiness)}%</p>
                </div>
              </>
            )}
          </div>

          {/* Exam metadata */}
          <div className="flex items-center gap-4 text-xs text-surface-500">
            <span>Format: {exam.exam_format === "written" ? "Schriftlich" : exam.exam_format === "oral" ? "Mündlich" : exam.exam_format === "practical" ? "Praktisch" : exam.exam_format}</span>
            <span>Schwierigkeit: {"★".repeat(exam.difficulty)}{"☆".repeat(5 - exam.difficulty)}</span>
          </div>

          {/* Action button */}
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onSimulate}>
              <Calculator size={14} />
              Was-wäre-wenn
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Scenario Simulator Modal ─────────────────────────────────────────────────

function ScenarioSimulator({
  exam,
  onClose,
}: {
  exam: ExamIntelligenceItem;
  onClose: () => void;
}) {
  const pred = exam.prediction;
  const [additionalHours, setAdditionalHours] = useState(10);
  const [knowledgeTarget, setKnowledgeTarget] = useState(70);
  const [componentGrade, setComponentGrade] = useState(pred?.grade ?? 4.0);

  // Simulate new prediction based on what-if inputs
  const simulated = useMemo(() => {
    const base = pred?.grade ?? 4.0;

    // Additional study hours boost (diminishing returns)
    const studyBoost = Math.min(0.6, additionalHours / 30);

    // Knowledge improvement boost
    const currentKnowledge = exam.risk?.readiness ?? 50;
    const knowledgeBoost = ((knowledgeTarget - currentKnowledge) / 100) * 0.5;

    // Component grade influence (if user enters a specific grade for next assignment)
    const componentInfluence = (componentGrade - base) * 0.3;

    const newGrade = Math.max(1, Math.min(6, base + studyBoost + knowledgeBoost + componentInfluence));
    const newPassProb = Math.max(0.05, Math.min(0.95,
      (pred?.pass_prob ?? 0.5) + studyBoost * 0.3 + knowledgeBoost * 0.2 + componentInfluence * 0.15
    ));

    return {
      grade: Math.round(newGrade * 10) / 10,
      passProb: Math.round(newPassProb * 100),
      improvementGrade: Math.round((newGrade - base) * 10) / 10,
      improvementProb: Math.round((newPassProb - (pred?.pass_prob ?? 0.5)) * 100),
    };
  }, [pred, exam, additionalHours, knowledgeTarget, componentGrade]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-[rgb(var(--card-bg))] rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900 flex items-center gap-2">
            <Calculator size={18} className="text-brand-500" />
            Szenario-Simulator
          </h2>
          <p className="text-xs text-surface-500 mt-1">{exam.title}</p>
        </div>

        <div className="p-5 space-y-5">
          {/* Slider: Additional study hours */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-surface-700">Zusätzliche Lernstunden</span>
              <span className="font-semibold text-brand-600">{additionalHours}h</span>
            </div>
            <input type="range" min={0} max={50} step={2} value={additionalHours}
              onChange={(e) => setAdditionalHours(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
          </div>

          {/* Slider: Knowledge target */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-surface-700">Wissensstand-Ziel</span>
              <span className="font-semibold text-brand-600">{knowledgeTarget}%</span>
            </div>
            <input type="range" min={20} max={100} step={5} value={knowledgeTarget}
              onChange={(e) => setKnowledgeTarget(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
          </div>

          {/* Slider: Next component grade */}
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-surface-700">Note nächste Teilleistung</span>
              <span className="font-semibold text-brand-600">{componentGrade.toFixed(1)}</span>
            </div>
            <input type="range" min={1} max={6} step={0.1} value={componentGrade}
              onChange={(e) => setComponentGrade(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none bg-surface-200 accent-brand-500" />
          </div>

          {/* Results */}
          <div className="bg-surface-50 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-semibold text-surface-700">Prognostiziertes Ergebnis</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-surface-800">{simulated.grade.toFixed(1)}</p>
                <p className="text-xs text-surface-500">Neue Prognose</p>
                <p className={clsx("text-xs font-medium mt-0.5", simulated.improvementGrade > 0 ? "text-green-600" : simulated.improvementGrade < 0 ? "text-red-600" : "text-surface-400")}>
                  {simulated.improvementGrade > 0 ? "+" : ""}{simulated.improvementGrade.toFixed(1)} vs aktuell
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-surface-800">{simulated.passProb}%</p>
                <p className="text-xs text-surface-500">Bestehens-Chance</p>
                <p className={clsx("text-xs font-medium mt-0.5", simulated.improvementProb > 0 ? "text-green-600" : simulated.improvementProb < 0 ? "text-red-600" : "text-surface-400")}>
                  {simulated.improvementProb > 0 ? "+" : ""}{simulated.improvementProb}% vs aktuell
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 border-t border-surface-100 flex justify-end">
          <Button variant="secondary" size="sm" onClick={onClose}>Schliessen</Button>
        </div>
      </div>
    </div>
  );
}

// ── Recommendation Card ──────────────────────────────────────────────────────

function RecommendationCard({
  title,
  message,
  urgency,
  type,
  onDismiss,
}: {
  title: string;
  message: string;
  urgency: string;
  type: string;
  onDismiss: () => void;
}) {
  const urgencyColors: Record<string, string> = {
    now: "border-red-200 bg-red-50",
    today: "border-orange-200 bg-orange-50",
    this_week: "border-amber-200 bg-amber-50",
    soon: "border-blue-200 bg-blue-50",
  };

  const urgencyLabels: Record<string, string> = {
    now: "Jetzt", today: "Heute", this_week: "Diese Woche", soon: "Bald",
  };

  return (
    <div className={clsx("flex items-start gap-3 p-3 rounded-xl border", urgencyColors[urgency] || urgencyColors.soon)}>
      <Lightbulb size={16} className="mt-0.5 shrink-0 text-surface-500" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-surface-800">{title}</p>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/60 text-surface-600 font-medium">
            {urgencyLabels[urgency] || urgency}
          </span>
        </div>
        <p className="text-xs text-surface-600 mt-0.5">{message}</p>
      </div>
      <button onClick={onDismiss} className="text-surface-400 hover:text-surface-600 text-xs shrink-0">
        <XCircle size={14} />
      </button>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ExamIntelligencePage() {
  const { data, loading, refreshing, error, refresh, dismissRecommendation } = useExamIntelligence();
  const [expandedExam, setExpandedExam] = useState<string | null>(null);
  const [simulatingExam, setSimulatingExam] = useState<ExamIntelligenceItem | null>(null);

  // Split exams by time horizon
  const { thisWeek, thisMonth, later } = useMemo(() => {
    if (!data) return { thisWeek: [], thisMonth: [], later: [] };
    const tw: ExamIntelligenceItem[] = [];
    const tm: ExamIntelligenceItem[] = [];
    const lt: ExamIntelligenceItem[] = [];
    for (const e of data.exams) {
      if (e.days_until <= 7) tw.push(e);
      else if (e.days_until <= 30) tm.push(e);
      else lt.push(e);
    }
    return { thisWeek: tw, thisMonth: tm, later: lt };
  }, [data]);

  // Summary stats
  const summary = useMemo(() => {
    if (!data || data.exams.length === 0) return null;
    const critCount = data.exams.filter((e) => e.risk?.level === "critical" || e.risk?.level === "high").length;
    const avgReadiness = data.exams.reduce((sum, e) => sum + (e.risk?.readiness ?? 0), 0) / data.exams.length;
    const avgPassProb = data.exams.reduce((sum, e) => sum + (e.prediction?.pass_prob ?? 0.5), 0) / data.exams.length;
    return { total: data.exams.length, critical: critCount, avgReadiness, avgPassProb };
  }, [data]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 size={24} className="animate-spin text-brand-500" />
      </div>
    );
  }

  const renderExamGroup = (title: string, exams: ExamIntelligenceItem[]) => {
    if (exams.length === 0) return null;
    return (
      <div className="space-y-2">
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wide">{title}</h3>
        {exams.map((exam) => (
          <ExamCard
            key={exam.event_id}
            exam={exam}
            expanded={expandedExam === exam.event_id}
            onToggle={() => setExpandedExam((prev) => prev === exam.event_id ? null : exam.event_id)}
            onSimulate={() => setSimulatingExam(exam)}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-100 text-brand-600 flex items-center justify-center">
            <Shield size={20} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-surface-800">Prüfungs-Intelligence</h1>
            <p className="text-sm text-surface-500">Risiko, Prognosen & Empfehlungen</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={refresh} loading={refreshing} disabled={refreshing}>
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
          Analyse starten
        </Button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-danger-50 border border-danger-100 text-sm text-danger-700">{error}</div>
      )}

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card padding="md" className="text-center">
            <p className="text-2xl font-bold text-surface-800">{summary.total}</p>
            <p className="text-xs text-surface-500">Prüfungen</p>
          </Card>
          <Card padding="md" className="text-center">
            <p className={clsx("text-2xl font-bold", summary.critical > 0 ? "text-red-600" : "text-green-600")}>
              {summary.critical}
            </p>
            <p className="text-xs text-surface-500">Gefährdet</p>
          </Card>
          <Card padding="md" className="text-center">
            <p className="text-2xl font-bold text-surface-800">{Math.round(summary.avgReadiness)}%</p>
            <p className="text-xs text-surface-500">Ø Bereitschaft</p>
          </Card>
          <Card padding="md" className="text-center">
            <p className={clsx("text-2xl font-bold", summary.avgPassProb >= 0.7 ? "text-green-600" : summary.avgPassProb >= 0.5 ? "text-amber-600" : "text-red-600")}>
              {Math.round(summary.avgPassProb * 100)}%
            </p>
            <p className="text-xs text-surface-500">Ø Bestehens-Chance</p>
          </Card>
        </div>
      )}

      {/* Recommendations */}
      {data && data.recommendations.length > 0 && (
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-surface-700">Empfehlungen</h3>
          </div>
          <div className="space-y-2">
            {data.recommendations.slice(0, 5).map((rec) => (
              <RecommendationCard
                key={rec.id}
                title={rec.title}
                message={rec.message}
                urgency={rec.urgency}
                type={rec.type}
                onDismiss={() => dismissRecommendation(rec.id)}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Exam Lists */}
      {data && data.exams.length === 0 ? (
        <Card padding="lg" className="text-center">
          <div className="py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-surface-100 text-surface-400 flex items-center justify-center mx-auto">
              <Shield size={32} />
            </div>
            <h2 className="text-lg font-semibold text-surface-700">Keine anstehenden Prüfungen</h2>
            <p className="text-sm text-surface-500">Trage Prüfungen im Kalender ein, damit Semetra Prognosen erstellen kann.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {renderExamGroup("Diese Woche", thisWeek)}
          {renderExamGroup("Diesen Monat", thisMonth)}
          {renderExamGroup("Später", later)}
        </div>
      )}

      {/* Prediction Accuracy */}
      {data?.accuracy && data.accuracy.with_outcome > 0 && (
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={16} className="text-brand-500" />
            <h3 className="text-sm font-semibold text-surface-700">Prognose-Genauigkeit</h3>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-lg font-bold text-surface-800">{data.accuracy.with_outcome}</p>
              <p className="text-xs text-surface-500">Bewertete Prognosen</p>
            </div>
            <div>
              <p className="text-lg font-bold text-surface-800">
                {data.accuracy.avg_error != null ? `±${data.accuracy.avg_error}` : "–"}
              </p>
              <p className="text-xs text-surface-500">Ø Noten-Abweichung</p>
            </div>
            <div>
              <p className="text-lg font-bold text-surface-800">
                {data.accuracy.calibration_rate != null ? `${data.accuracy.calibration_rate}%` : "–"}
              </p>
              <p className="text-xs text-surface-500">Kalibrierungs-Rate</p>
            </div>
          </div>
        </Card>
      )}

      {/* Scenario Simulator Modal */}
      {simulatingExam && (
        <ScenarioSimulator exam={simulatingExam} onClose={() => setSimulatingExam(null)} />
      )}
    </div>
  );
}
