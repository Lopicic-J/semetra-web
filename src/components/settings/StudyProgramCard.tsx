"use client";
import { useState, useEffect, useCallback } from "react";
import { GraduationCap, Building2, BookOpen, ChevronDown, Check, Loader2 } from "lucide-react";
import { useStudentProgram, type InstitutionRef, type ProgramRef } from "@/lib/hooks/useStudentProgram";
import { useTranslation } from "@/lib/i18n";

interface Props {
  country: string | null;
  onEnrolled?: () => Promise<void>;
}

/**
 * "Mein Studium" card for Settings page.
 * Lets users select their institution and program from the academic DB,
 * replacing the old freetext university/study_program fields.
 */
export default function StudyProgramCard({ country, onEnrolled }: Props) {
  const { t } = useTranslation();
  const { active, enrollmentProfile, enroll, loading: enrollLoading } = useStudentProgram();

  const [institutions, setInstitutions] = useState<InstitutionRef[]>([]);
  const [programs, setPrograms] = useState<ProgramRef[]>([]);
  const [loadingInst, setLoadingInst] = useState(false);
  const [loadingProg, setLoadingProg] = useState(false);

  const [selectedInst, setSelectedInst] = useState<string>("");
  const [selectedProg, setSelectedProg] = useState<string>("");
  const [selectedSemester, setSelectedSemester] = useState<number>(1);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Pre-fill if already enrolled
  useEffect(() => {
    if (active) {
      setSelectedInst(active.institution_id || "");
      setSelectedProg(active.program_id || "");
      setSelectedSemester(active.current_semester || enrollmentProfile?.current_semester || 1);
    } else if (enrollmentProfile) {
      if (enrollmentProfile.institution_id) setSelectedInst(enrollmentProfile.institution_id);
      if (enrollmentProfile.active_program_id) setSelectedProg(enrollmentProfile.active_program_id);
      if (enrollmentProfile.current_semester) setSelectedSemester(enrollmentProfile.current_semester);
    }
  }, [active, enrollmentProfile]);

  // Load institutions when country changes
  const loadInstitutions = useCallback(async () => {
    if (!country) return;
    setLoadingInst(true);
    try {
      const res = await fetch(`/api/academic/institutions?country=${country}`);
      const data = await res.json();
      setInstitutions(data.institutions || []);
    } catch {
      setInstitutions([]);
    } finally {
      setLoadingInst(false);
    }
  }, [country]);

  useEffect(() => {
    loadInstitutions();
  }, [loadInstitutions]);

  // Load programs when institution changes
  useEffect(() => {
    if (!selectedInst) {
      setPrograms([]);
      return;
    }
    setLoadingProg(true);
    fetch(`/api/academic/programs?institution_id=${selectedInst}`)
      .then((r) => r.json())
      .then((data) => setPrograms(data.programs || []))
      .catch(() => setPrograms([]))
      .finally(() => setLoadingProg(false));
  }, [selectedInst]);

  async function handleSave() {
    if (!selectedInst || !selectedProg) {
      setMsg({ type: "error", text: t("settings.studySelectBoth") || "Bitte Institution und Studiengang waehlen" });
      return;
    }
    setSaving(true);
    setMsg(null);

    const success = await enroll(selectedInst, selectedProg, selectedSemester);

    if (success) {
      setMsg({ type: "success", text: t("settings.studyEnrolled") || "Einschreibung gespeichert" });
      if (onEnrolled) await onEnrolled();
    } else {
      setMsg({ type: "error", text: t("settings.studyError") || "Fehler beim Speichern" });
    }
    setSaving(false);
  }

  const isChanged =
    selectedInst !== (active?.institution_id || enrollmentProfile?.institution_id || "") ||
    selectedProg !== (active?.program_id || enrollmentProfile?.active_program_id || "") ||
    selectedSemester !== (active?.current_semester || enrollmentProfile?.current_semester || 1);

  if (enrollLoading) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 text-surface-400">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">Lade Studium-Daten...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center gap-2 mb-1">
        <GraduationCap size={18} className="text-brand-600" />
        <h2 className="font-semibold text-surface-900">
          {t("settings.studyTitle") || "Mein Studium"}
        </h2>
      </div>
      <p className="text-xs text-surface-400 mb-4">
        {t("settings.studyDesc") || "Verknuepfe dein Profil mit deiner Hochschule und deinem Studiengang."}
      </p>

      {/* Current enrollment badge */}
      {active && (
        <div className="flex items-center gap-2 bg-brand-50 dark:bg-brand-950/30 border border-brand-100 dark:border-brand-800 rounded-xl px-3 py-2 mb-4">
          <Check size={14} className="text-brand-600 dark:text-brand-400" />
          <span className="text-sm text-brand-700 dark:text-brand-300 font-medium">
            {active.program?.name} @ {active.institution?.name}
          </span>
          <span className="text-xs text-brand-500 dark:text-brand-400 ml-auto">
            Semester {active.current_semester || enrollmentProfile?.current_semester || "?"}
          </span>
        </div>
      )}

      <div className="space-y-3">
        {/* Institution */}
        <div>
 <label className="block text-sm font-medium text-surface-700 mb-1">
            <Building2 size={13} className="inline mr-1.5 -mt-0.5" />
            {t("settings.studyInstitution") || "Hochschule / Universitaet"}
          </label>
          <div className="relative">
            <select
              value={selectedInst}
              onChange={(e) => {
                setSelectedInst(e.target.value);
                setSelectedProg(""); // reset program when institution changes
              }}
              className="input w-full appearance-none pr-8"
              disabled={loadingInst}
            >
              <option value="">
                {loadingInst
                  ? "Lade..."
                  : institutions.length === 0
                  ? (t("settings.studyNoInstitutions") || "Keine Institutionen fuer dieses Land")
                  : (t("settings.studySelectInstitution") || "-- Institution waehlen --")}
              </option>
              {institutions.map((inst) => (
                <option key={inst.id} value={inst.id}>
                  {inst.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
          </div>
        </div>

        {/* Program */}
        <div>
 <label className="block text-sm font-medium text-surface-700 mb-1">
            <BookOpen size={13} className="inline mr-1.5 -mt-0.5" />
            {t("settings.studyProgram") || "Studiengang"}
          </label>
          <div className="relative">
            <select
              value={selectedProg}
              onChange={(e) => setSelectedProg(e.target.value)}
              className="input w-full appearance-none pr-8"
              disabled={!selectedInst || loadingProg}
            >
              <option value="">
                {!selectedInst
                  ? (t("settings.studySelectInstFirst") || "Zuerst Institution waehlen")
                  : loadingProg
                  ? "Lade..."
                  : programs.length === 0
                  ? (t("settings.studyNoPrograms") || "Keine Studiengaenge verfuegbar")
                  : (t("settings.studySelectProgram") || "-- Studiengang waehlen --")}
              </option>
              {programs.map((prog) => (
                <option key={prog.id} value={prog.id}>
                  {prog.name} ({prog.degree_level})
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
          </div>
        </div>

        {/* Semester */}
        <div>
 <label className="block text-sm font-medium text-surface-700 mb-1">
            {t("settings.studySemester") || "Aktuelles Semester"}
          </label>
          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(Number(e.target.value))}
            className="input w-24"
          >
            {Array.from({ length: 14 }, (_, i) => i + 1).map((s) => (
              <option key={s} value={s}>
                {s}. Semester
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Save */}
      <div className="flex items-center gap-3 mt-4">
        <button
          onClick={handleSave}
          disabled={saving || !isChanged || !selectedInst || !selectedProg}
          className="btn-primary"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" />
              {t("common.saving") || "Speichere..."}
            </span>
          ) : active ? (
            t("settings.studyUpdate") || "Studium aktualisieren"
          ) : (
            t("settings.studyEnroll") || "Einschreiben"
          )}
        </button>
      </div>

      {msg && (
        <p
          className={`text-sm px-3 py-2 rounded-lg mt-3 ${
            msg.type === "success"
              ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400"
              : "bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400"
          }`}
        >
          {msg.text}
        </p>
      )}

      {/* Info about builder */}
      {institutions.length === 0 && !loadingInst && (
        <p className="text-xs text-surface-400 mt-3">
          {t("settings.studyBuilderHint") || "Keine Institutionen gefunden? Erstelle sie im Academic Builder unter /builder."}
        </p>
      )}
    </div>
  );
}
