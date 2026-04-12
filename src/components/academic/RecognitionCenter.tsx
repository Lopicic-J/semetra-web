"use client";

import { useMemo, useState } from "react";
import {
  ArrowRightLeft, CheckCircle, Clock, XCircle, AlertTriangle,
  Plus, Search, Globe, Award, FileText, Building2, ChevronDown,
  ChevronRight, Info,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import {
  convertGrade,
  convertCredits,
  formatGradeValue,
  getGradeBand,
} from "@/lib/academic";
import type {
  GradeScale,
  GradeBand,
  CreditScheme,
  Institution,
} from "@/lib/academic";

// ─────────────────────────────────────────────────────────────────────────────
// Types — flexible to handle both camelCase (types) and snake_case (DB rows)
// ─────────────────────────────────────────────────────────────────────────────

/* eslint-disable @typescript-eslint/no-explicit-any */
interface RecognitionRow {
  id: string;
  [key: string]: any;
}

/** Safe accessor that handles both snake_case and camelCase fields */
function field(row: RecognitionRow, camelKey: string, snakeKey: string): any {
  return row[camelKey] ?? row[snakeKey] ?? null;
}

interface RecognitionCenterProps {
  recognitions: RecognitionRow[];
  gradeScales: GradeScale[];
  gradeBands: GradeBand[];
  creditSchemes: CreditScheme[];
  institutions: Institution[];
  currentGradeScale: GradeScale;
  currentCreditScheme: CreditScheme;
  onRequestRecognition?: () => void;
}

type StatusFilter = "all" | "approved" | "pending" | "rejected" | "accepted";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getRecStatus(rec: RecognitionRow): string {
  return (rec.recognitionStatus ?? rec.recognition_status ?? rec.status ?? "pending") as string;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle; color: string; bg: string; label: string }> = {
  accepted:    { icon: CheckCircle,   color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20",  label: "Anerkannt" },
  approved:    { icon: CheckCircle,   color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/20",  label: "Anerkannt" },
  pending:     { icon: Clock,         color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-900/20",     label: "In Prüfung" },
  rejected:    { icon: XCircle,       color: "text-red-600",     bg: "bg-red-50 dark:bg-red-900/20",         label: "Abgelehnt" },
  partial:     { icon: AlertTriangle, color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/20",       label: "Teilweise" },
};

function getStatusConfig(status: string) {
  return STATUS_CONFIG[status] ?? STATUS_CONFIG.pending;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

function RecognitionCard({
  recognition,
  gradeScales,
  gradeBands,
  creditSchemes,
  currentGradeScale,
  currentCreditScheme,
}: {
  recognition: RecognitionRow;
  gradeScales: GradeScale[];
  gradeBands: GradeBand[];
  creditSchemes: CreditScheme[];
  currentGradeScale: GradeScale;
  currentCreditScheme: CreditScheme;
}) {
  const [expanded, setExpanded] = useState(false);
  const { t } = useTranslation();
  const gs = useGradingSystem();

  const status = getRecStatus(recognition);
  const statusCfg = getStatusConfig(status);
  const StatusIcon = statusCfg.icon;

  // Field accessors (handles both DB snake_case and TS camelCase)
  const sourceInstitution = field(recognition, "sourceInstitution", "source_institution") as string | null;
  const sourceModuleName = field(recognition, "sourceModuleName", "source_module_name") as string | null;
  const sourceModuleCode = field(recognition, "sourceModuleCode", "source_module_code") as string | null;
  const sourceGradeValue = field(recognition, "sourceGradeValue", "source_grade_value") as number | null;
  const sourceGradeScale = field(recognition, "sourceGradeScale", "source_grade_scale") as string | null;
  const sourceCreditValue = field(recognition, "sourceCreditValue", "source_credit_value") as number | null;
  const sourceCreditScheme = field(recognition, "sourceCreditScheme", "source_credit_scheme") as string | null;
  const recognizedEcts = field(recognition, "recognizedEcts", "recognized_ects") as number | null;
  const decisionNotes = field(recognition, "decisionNotes", "decision_notes") as string | null;

  // Source grade scale
  const srcScale = gradeScales.find(s => s.id === sourceGradeScale || s.code === sourceGradeScale);
  const targetBands = gradeBands.filter(b => b.gradeScaleId === currentGradeScale.id);

  // Grade conversion
  const convertedGrade = useMemo(() => {
    if (sourceGradeValue == null || !srcScale) return null;
    try {
      return convertGrade(sourceGradeValue, srcScale, currentGradeScale);
    } catch {
      return null;
    }
  }, [sourceGradeValue, srcScale, currentGradeScale]);

  // Credit conversion
  const displayCredits = useMemo(() => {
    if (recognizedEcts != null) return recognizedEcts;
    if (sourceCreditValue == null) return null;
    const srcCreditScheme = creditSchemes.find(cs => cs.id === sourceCreditScheme || cs.code === sourceCreditScheme);
    if (!srcCreditScheme || srcCreditScheme.id === currentCreditScheme.id) return sourceCreditValue;
    try {
      return convertCredits(sourceCreditValue, srcCreditScheme, currentCreditScheme);
    } catch {
      return sourceCreditValue;
    }
  }, [recognizedEcts, sourceCreditValue, sourceCreditScheme, creditSchemes, currentCreditScheme]);

  const gradeBand = convertedGrade != null
    ? getGradeBand(convertedGrade.grade, targetBands)
    : null;

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-surface-50/50 dark:hover:bg-surface-800/50 transition-colors"
      >
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${statusCfg.bg}`}>
          <StatusIcon size={18} className={statusCfg.color} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">
            {sourceModuleName ?? "Unbekanntes Modul"}
          </p>
          <p className="text-xs text-surface-400 mt-0.5">
            {sourceInstitution ?? "Externe Hochschule"}
            {sourceModuleCode && ` · ${sourceModuleCode}`}
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {sourceCreditValue != null && displayCredits != null && (
            <span className="text-xs font-medium text-surface-500">
              {sourceCreditValue} → {Math.round(displayCredits * 10) / 10} {gs.creditLabel}
            </span>
          )}
          <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${statusCfg.bg} ${statusCfg.color}`}>
            {statusCfg.label}
          </span>
          {expanded ? <ChevronDown size={14} className="text-surface-400" /> : <ChevronRight size={14} className="text-surface-400" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-surface-100 dark:border-surface-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
            {/* Source Info */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                {t("academic.sourceModule") || "Quellmodul"}
              </p>
              <div className="space-y-1.5">
                {sourceInstitution && (
                  <div className="flex items-center gap-2">
                    <Building2 size={13} className="text-surface-400" />
                    <span className="text-sm text-surface-600 dark:text-surface-500">{sourceInstitution}</span>
                  </div>
                )}
                {sourceModuleName && (
                  <div className="flex items-center gap-2">
                    <FileText size={13} className="text-surface-400" />
                    <span className="text-sm text-surface-600 dark:text-surface-500">{sourceModuleName}</span>
                  </div>
                )}
                {sourceGradeValue != null && srcScale && (
                  <div className="flex items-center gap-2">
                    <Award size={13} className="text-surface-400" />
                    <span className="text-sm text-surface-600 dark:text-surface-500">
                      {formatGradeValue(sourceGradeValue, srcScale)} ({srcScale.name})
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Conversion Result */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider">
                {t("academic.conversion") || "Umrechnung"}
              </p>
              <div className="space-y-1.5">
                {convertedGrade != null && (
                  <div className="flex items-center gap-2">
                    <ArrowRightLeft size={13} className="text-brand-500" />
                    <span className="text-sm font-medium text-surface-800 dark:text-surface-800">
                      {formatGradeValue(convertedGrade.grade, currentGradeScale)}
                      {" "}({currentGradeScale.name})
                    </span>
                  </div>
                )}
                {gradeBand && (
                  <div className="flex items-center gap-2">
                    <Award size={13} className="text-surface-400" />
                    <span className="text-sm text-surface-600 dark:text-surface-500">{gradeBand.label}</span>
                  </div>
                )}
                {convertedGrade != null && (
                  <div className="flex items-center gap-2">
                    <Info size={13} className="text-surface-400" />
                    <span className="text-xs text-surface-400">
                      Konfidenz: {(convertedGrade.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {decisionNotes && (
            <div className="mt-4 p-3 rounded-xl bg-surface-50 dark:bg-surface-800">
              <p className="text-xs text-surface-400 mb-1">{t("academic.notes") || "Anmerkungen"}</p>
              <p className="text-sm text-surface-600 dark:text-surface-500">{decisionNotes}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

export function RecognitionCenter({
  recognitions,
  gradeScales,
  gradeBands,
  creditSchemes,
  institutions,
  currentGradeScale,
  currentCreditScheme,
  onRequestRecognition,
}: RecognitionCenterProps) {
  const { t } = useTranslation();
  const gs = useGradingSystem();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");

  // Stats
  const stats = useMemo(() => {
    const approved = recognitions.filter(r => {
      const s = getRecStatus(r);
      return s === "accepted" || s === "approved";
    });
    const pending = recognitions.filter(r => getRecStatus(r) === "pending");
    const totalCredits = approved.reduce((sum, r) => {
      return sum + (field(r, "recognizedEcts", "recognized_ects") ?? field(r, "sourceCreditValue", "source_credit_value") ?? 0);
    }, 0);

    return {
      total: recognitions.length,
      approved: approved.length,
      pending: pending.length,
      rejected: recognitions.filter(r => getRecStatus(r) === "rejected").length,
      totalCredits,
    };
  }, [recognitions]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = recognitions;
    if (filter !== "all") {
      list = list.filter(r => {
        const s = getRecStatus(r);
        if (filter === "approved") return s === "accepted" || s === "approved";
        return s === filter;
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r => {
        const name = (field(r, "sourceModuleName", "source_module_name") ?? "") as string;
        const inst = (field(r, "sourceInstitution", "source_institution") ?? "") as string;
        const code = (field(r, "sourceModuleCode", "source_module_code") ?? "") as string;
        return name.toLowerCase().includes(q) || inst.toLowerCase().includes(q) || code.toLowerCase().includes(q);
      });
    }
    return list;
  }, [recognitions, filter, search]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="card p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <ArrowRightLeft className="text-purple-600" size={24} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-surface-900 dark:text-white">
                {t("academic.recognitionCenter") || "Anrechnungszentrum"}
              </h2>
              <p className="text-sm text-surface-500">
                {t("academic.recognitionSubtitle") || "Transfer Credits und Modul-Anrechnungen verwalten"}
              </p>
            </div>
          </div>
          {onRequestRecognition && (
            <button
              onClick={onRequestRecognition}
              className="btn-primary text-sm gap-1.5"
            >
              <Plus size={15} />
              {t("academic.requestRecognition") || "Anrechnung beantragen"}
            </button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
          <div className="text-center p-3 rounded-xl bg-surface-50 dark:bg-surface-800">
            <p className="text-2xl font-bold text-surface-900 dark:text-white">{stats.total}</p>
            <p className="text-xs text-surface-500">{t("academic.totalRequests") || "Gesamt"}</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20">
            <p className="text-2xl font-bold text-emerald-600">{stats.approved}</p>
            <p className="text-xs text-surface-500">{t("academic.approved") || "Anerkannt"}</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20">
            <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
            <p className="text-xs text-surface-500">{t("academic.pending") || "In Prüfung"}</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-brand-50 dark:bg-brand-900/20">
            <p className="text-2xl font-bold text-brand-600">{stats.totalCredits}</p>
            <p className="text-xs text-surface-500">{gs.creditLabel} {t("academic.credited") || "angerechnet"}</p>
          </div>
        </div>
      </div>

      {/* Filter + Search */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "approved", "pending", "rejected"] as StatusFilter[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                filter === f
                  ? "bg-brand-600 text-white"
                  : "bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-500 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {f === "all" ? (t("academic.filterAll") || "Alle") :
               f === "approved" ? (t("academic.filterApproved") || "Anerkannt") :
               f === "pending" ? (t("academic.filterPending") || "In Prüfung") :
               (t("academic.filterRejected") || "Abgelehnt")}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            type="text"
            placeholder={t("academic.searchRecognitions") || "Modul oder Hochschule suchen..."}
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input pl-8 py-1.5 text-sm w-full"
          />
        </div>
      </div>

      {/* Recognition List */}
      <div className="space-y-3">
        {filtered.map(rec => (
          <RecognitionCard
            key={rec.id}
            recognition={rec}
            gradeScales={gradeScales}
            gradeBands={gradeBands}
            creditSchemes={creditSchemes}
            currentGradeScale={currentGradeScale}
            currentCreditScheme={currentCreditScheme}
          />
        ))}

        {filtered.length === 0 && (
          <div className="card p-8 text-center">
            <Globe size={32} className="mx-auto text-surface-300 mb-3" />
            <p className="text-sm text-surface-500">
              {recognitions.length === 0
                ? (t("academic.noRecognitions") || "Noch keine Anrechnungen vorhanden")
                : (t("academic.noFilteredRecognitions") || "Keine Anrechnungen für diesen Filter")}
            </p>
            {recognitions.length === 0 && onRequestRecognition && (
              <button
                onClick={onRequestRecognition}
                className="btn-secondary text-sm gap-1.5 mt-4"
              >
                <Plus size={14} />
                {t("academic.firstRecognition") || "Erste Anrechnung beantragen"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default RecognitionCenter;
