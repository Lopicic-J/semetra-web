"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  Plus, Loader2, AlertCircle, ChevronLeft, Save, GripVertical,
  Trash2, ChevronDown, ChevronUp, X
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { useBuilderGuard } from "@/lib/hooks/useBuilderGuard";
import type { Studiengang, Module, RequirementGroup, Faculty } from "@/types/database";

interface ProgramWithDetails extends Studiengang {
  requirement_groups?: RequirementGroup[];
  modules?: Module[];
}

interface FacultyOption {
  id: string;
  name: string;
}

const DEGREE_LEVELS = [
  { value: "short_cycle", label: "Kurzstudium", defaultEcts: 120, defaultTerms: 4 },
  { value: "bachelor", label: "Bachelor", defaultEcts: 180, defaultTerms: 6 },
  { value: "master", label: "Master", defaultEcts: 120, defaultTerms: 4 },
  { value: "phd", label: "Doktorat", defaultEcts: 180, defaultTerms: 6 },
  { value: "diploma", label: "Diplom", defaultEcts: 180, defaultTerms: 6 },
];

const GROUP_TYPES = [
  { value: "compulsory", label: "Pflicht" },
  { value: "elective_required", label: "Wahlpflicht" },
  { value: "elective_free", label: "Wahlfrei" },
  { value: "specialisation", label: "Spezialisierung" },
  { value: "minor", label: "Minor" },
  { value: "thesis", label: "Thesis" },
  { value: "internship", label: "Praktikum" },
];

export default function ProgramDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const institutionId = searchParams.get("institution_id") || "";

  // Access control: verify builder access + institution ownership
  const { authorized, loading: guardLoading } = useBuilderGuard(institutionId || null);

  const [program, setProgram] = useState<ProgramWithDetails | null>(null);
  const [requirementGroups, setRequirementGroups] = useState<RequirementGroup[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [faculties, setFaculties] = useState<FacultyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [showNewGroupForm, setShowNewGroupForm] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [newGroupType, setNewGroupType] = useState("compulsory");
  const [newGroupMinCredits, setNewGroupMinCredits] = useState("0");

  // Form fields
  const [name, setName] = useState("");
  const [degreeLevel, setDegreeLevel] = useState("bachelor");
  const [totalEcts, setTotalEcts] = useState("180");
  const [durationTerms, setDurationTerms] = useState("6");
  const [facultyId, setFacultyId] = useState("");
  const [thesisRequired, setThesisRequired] = useState(false);
  const [internshipRequired, setInternshipRequired] = useState(false);
  const [finalExamRequired, setFinalExamRequired] = useState(false);
  const [isPublished, setIsPublished] = useState(false);
  // Study mode (TZ/VZ) config
  const [studyModeAvailable, setStudyModeAvailable] = useState<"full_time" | "part_time" | "both">("both");
  const [durationTermsPartTime, setDurationTermsPartTime] = useState("");

  useEffect(() => {
    const fetchProgram = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch faculties for the institution
        if (institutionId) {
          const facultyResponse = await fetch(`/api/academic/institutions/${institutionId}`);
          if (facultyResponse.ok) {
            const facultyData = await facultyResponse.json();
            setFaculties(facultyData.faculties || []);
          }
        }

        if (id === "new") {
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/academic/programs/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch program");
        }
        const data = await response.json();
        setProgram(data.program);
        setName(data.program.name);
        setDegreeLevel(data.program.degree_level || "bachelor");
        setTotalEcts(data.program.required_total_credits?.toString() || "180");
        setDurationTerms(data.program.duration_standard_terms?.toString() || "6");
        setFacultyId(data.program.faculty_id || "");
        setThesisRequired(data.program.thesis_required || false);
        setInternshipRequired(data.program.internship_required || false);
        setFinalExamRequired(data.program.final_exam_required || false);
        setIsPublished(data.program.is_published || false);
        setStudyModeAvailable(data.program.study_mode_available || "both");
        setDurationTermsPartTime(data.program.duration_terms_part_time?.toString() || "");

        // Requirement groups and modules are already included in the program GET response
        setRequirementGroups(data.requirementGroups || []);
        setModules(data.modules || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fehler beim Laden des Programms";
        setError(message);
        console.error("Error fetching program:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProgram();
  }, [id, institutionId]);

  // Auto-adjust ECTS and duration when degree level changes
  const handleDegreeLevelChange = (newLevel: string) => {
    setDegreeLevel(newLevel);
    const degreeConfig = DEGREE_LEVELS.find((d) => d.value === newLevel);
    if (degreeConfig) {
      setTotalEcts(degreeConfig.defaultEcts.toString());
      setDurationTerms(degreeConfig.defaultTerms.toString());
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (id === "new") {
        if (!institutionId) {
          toast.error("Institution erforderlich");
          return;
        }

        const response = await fetch("/api/academic/programs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            institution_id: institutionId,
            name,
            degree_level: degreeLevel,
            required_total_credits: parseInt(totalEcts),
            duration_standard_terms: parseInt(durationTerms),
            study_mode_available: studyModeAvailable,
            duration_terms_part_time: durationTermsPartTime ? parseInt(durationTermsPartTime) : null,
            faculty_id: facultyId || null,
            thesis_required: thesisRequired,
            internship_required: internshipRequired,
            final_exam_required: finalExamRequired,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create program");
        }

        const data = await response.json();
        toast.success("Programm erstellt");
        router.push(`/builder/program/${data.program.id}`);
      } else {
        const response = await fetch(`/api/academic/programs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            degree_level: degreeLevel,
            required_total_credits: parseInt(totalEcts),
            duration_standard_terms: parseInt(durationTerms),
            study_mode_available: studyModeAvailable,
            duration_terms_part_time: durationTermsPartTime ? parseInt(durationTermsPartTime) : null,
            faculty_id: facultyId || null,
            thesis_required: thesisRequired,
            internship_required: internshipRequired,
            final_exam_required: finalExamRequired,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update program");
        }

        const data = await response.json();
        setProgram(data.program);
        toast.success("Programm aktualisiert");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Speichern";
      toast.error(message);
      console.error("Error saving program:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleNewModule = () => {
    if (id === "new") {
      toast.error("Bitte speichern Sie das Programm zuerst");
      return;
    }
    router.push(`/builder/module/new?program_id=${id}`);
  };

  const handleNewGroup = async () => {
    if (id === "new") {
      toast.error("Bitte speichern Sie das Programm zuerst");
      return;
    }

    try {
      const response = await fetch(`/api/academic/programs/${id}/requirement-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newGroupName,
          group_type: newGroupType,
          min_credits_required: parseInt(newGroupMinCredits),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create group");
      }

      const data = await response.json();
      setRequirementGroups([...requirementGroups, data.requirement_group]);
      toast.success("Gruppe erstellt");
      setShowNewGroupForm(false);
      setNewGroupName("");
      setNewGroupType("compulsory");
      setNewGroupMinCredits("0");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Erstellen der Gruppe";
      toast.error(message);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("Gruppe wirklich löschen?")) return;

    try {
      const response = await fetch(
        `/api/academic/programs/${id}/requirement-groups/${groupId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete group");
      }

      setRequirementGroups(requirementGroups.filter((g) => g.id !== groupId));
      toast.success("Gruppe gelöscht");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Löschen";
      toast.error(message);
    }
  };

  if (guardLoading || !authorized) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-surface-600">Zugriff wird geprüft...</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-surface-600">Wird geladen...</p>
        </div>
      </div>
    );
  }

  const groupModules = (groupId: string) =>
    modules.filter((m) => m.requirement_group_id === groupId);

  const calculateGroupEcts = (groupId: string): number => {
    return groupModules(groupId).reduce((sum, mod) => sum + (mod.ects || 0), 0);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={institutionId ? `/builder/institution/${institutionId}` : "/builder"}>
          <button className="p-2 hover:bg-surface-100 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6 text-surface-600" />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">
            {id === "new" ? "Neues Programm" : "Programm"}
          </h1>
        </div>
        {!isPublished && id !== "new" && (
          <div className="inline-block px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
            Entwurf
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        </Card>
      )}

      {/* Program Info Form */}
      <Card padding="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Informatik Bachelor"
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                Studienabschluss *
              </label>
              <select
                value={degreeLevel}
                onChange={(e) => handleDegreeLevelChange(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEGREE_LEVELS.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                Fakultät
              </label>
              <select
                value={facultyId}
                onChange={(e) => setFacultyId(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Keine Auswahl</option>
                {faculties.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                Gesamt ECTS *
              </label>
              <input
                type="number"
                value={totalEcts}
                onChange={(e) => setTotalEcts(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                Standard Semester *
              </label>
              <input
                type="number"
                value={durationTerms}
                onChange={(e) => setDurationTerms(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Study Mode (TZ/VZ) */}
 <div className="pt-2 border-t border-surface-200">
            <label className="block text-sm font-medium text-surface-900 dark:text-white mb-3">
              Studienmodell
            </label>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {([
                { value: "both", label: "Vollzeit & Teilzeit" },
                { value: "full_time", label: "Nur Vollzeit" },
                { value: "part_time", label: "Nur Teilzeit" },
              ] as const).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setStudyModeAvailable(opt.value)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium border-2 transition ${
                    studyModeAvailable === opt.value
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300"
 :"border-surface-200 bg-surface-50 text-surface-600 hover:border-surface-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Part-time duration — shown when part-time is available */}
            {(studyModeAvailable === "both" || studyModeAvailable === "part_time") && (
              <div className="grid grid-cols-2 gap-4">
                <div>
 <label className="block text-xs font-medium text-surface-600 mb-1">
                    Vollzeit-Semester
                  </label>
                  <input
                    type="number"
                    value={durationTerms}
                    onChange={(e) => setDurationTerms(e.target.value)}
 className="w-full px-3 py-1.5 bg-surface-50 border border-surface-300 rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
 <label className="block text-xs font-medium text-surface-600 mb-1">
                    Teilzeit-Semester
                  </label>
                  <input
                    type="number"
                    value={durationTermsPartTime}
                    onChange={(e) => setDurationTermsPartTime(e.target.value)}
                    placeholder={durationTerms ? `z.B. ${Math.ceil(parseInt(durationTerms) * 1.5)}` : ""}
 className="w-full px-3 py-1.5 bg-surface-50 border border-surface-300 rounded-lg text-sm text-surface-900 dark:text-white placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={thesisRequired}
                onChange={(e) => setThesisRequired(e.target.checked)}
 className="w-4 h-4 rounded border-surface-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-surface-900 dark:text-white">
                Thesis erforderlich
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={internshipRequired}
                onChange={(e) => setInternshipRequired(e.target.checked)}
 className="w-4 h-4 rounded border-surface-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-surface-900 dark:text-white">
                Praktikum erforderlich
              </span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={finalExamRequired}
                onChange={(e) => setFinalExamRequired(e.target.checked)}
 className="w-4 h-4 rounded border-surface-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm font-medium text-surface-900 dark:text-white">
                Abschlussprüfung erforderlich
              </span>
            </label>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving || !name}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? "Speichern..." : "Speichern"}
            </button>
            <Link href={institutionId ? `/builder/institution/${institutionId}` : "/builder"}>
              <button className="px-4 py-2 bg-surface-200 text-surface-900 rounded-lg hover:bg-surface-300 transition-colors font-medium">
                Abbrechen
              </button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Requirement Groups */}
      {id !== "new" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Anforderungsgruppen</h2>
            {!showNewGroupForm && (
              <button
                onClick={() => setShowNewGroupForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Gruppe hinzufügen
              </button>
            )}
          </div>

          {/* New Group Form */}
          {showNewGroupForm && (
            <Card padding="lg" className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Gruppennname *
                  </label>
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="z.B. Pflichtmodule Semester 1"
                    className="w-full px-4 py-2 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                      Gruppentyp *
                    </label>
                    <select
                      value={newGroupType}
                      onChange={(e) => setNewGroupType(e.target.value)}
                      className="w-full px-4 py-2 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      {GROUP_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                      Min. ECTS erforderlich
                    </label>
                    <input
                      type="number"
                      value={newGroupMinCredits}
                      onChange={(e) => setNewGroupMinCredits(e.target.value)}
                      min="0"
                      className="w-full px-4 py-2 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleNewGroup}
                    disabled={!newGroupName.trim()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Erstellen
                  </button>
                  <button
                    onClick={() => {
                      setShowNewGroupForm(false);
                      setNewGroupName("");
                      setNewGroupType("compulsory");
                      setNewGroupMinCredits("0");
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-surface-200 text-surface-900 rounded-lg hover:bg-surface-300 transition-colors font-medium"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </Card>
          )}

          {requirementGroups.length === 0 ? (
            <Card className="text-center py-8">
 <p className="text-surface-600 mb-4">Noch keine Anforderungsgruppen</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {requirementGroups.map((group) => {
                const groupModuleList = groupModules(group.id);
                const groupEcts = calculateGroupEcts(group.id);
                const minCreditsRequired = (group as any).min_credits_required || 0;
                const ectsPercentage = minCreditsRequired > 0 ? (groupEcts / minCreditsRequired) * 100 : 100;
                const isExpanded = expandedGroup === group.id;
                const groupTypeLabel = GROUP_TYPES.find((t) => t.value === (group as any).group_type)?.label || (group as any).group_type;

                return (
                  <Card key={group.id} padding="md">
                    <div
                      className="flex items-center justify-between cursor-pointer"
                      onClick={() =>
                        setExpandedGroup(isExpanded ? null : group.id)
                      }
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <GripVertical className="w-5 h-5 text-surface-400 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-surface-900 dark:text-white">
                              {group.name}
                            </h3>
                            {groupTypeLabel && (
                              <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-medium rounded">
                                {groupTypeLabel}
                              </span>
                            )}
                          </div>
 <p className="text-sm text-surface-600 mt-1">
                            {groupModuleList.length} Module · {groupEcts} ECTS
                            {minCreditsRequired > 0 && ` / ${minCreditsRequired} erforderlich`}
                          </p>
                          {minCreditsRequired > 0 && (
 <div className="mt-2 h-2 bg-surface-200 rounded-full overflow-hidden w-32">
                              <div
                                className={`h-full transition-all ${
                                  ectsPercentage >= 100 ? "bg-green-500" : "bg-amber-500"
                                }`}
                                style={{ width: `${Math.min(ectsPercentage, 100)}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(group.id);
                          }}
                          className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="w-5 h-5 text-surface-600" />
                        ) : (
                          <ChevronDown className="w-5 h-5 text-surface-600" />
                        )}
                      </div>
                    </div>

                    {isExpanded && (
 <div className="mt-4 pt-4 border-t border-surface-200 space-y-2">
                        {groupModuleList.length === 0 ? (
 <p className="text-sm text-surface-600">Keine Module in dieser Gruppe</p>
                        ) : (
                          groupModuleList.map((mod) => (
                            <Link key={mod.id} href={`/builder/module/${mod.id}`}>
 <div className="flex items-center justify-between p-3 hover:bg-surface-100 dark:hover:bg-surface-700 rounded transition-colors border border-surface-200">
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-surface-900 dark:text-white">
                                    {mod.code && `[${mod.code}] `}
                                    {mod.name}
                                  </p>
 <p className="text-xs text-surface-600 mt-1">
                                    {mod.ects} ECTS
                                    {mod.semester && ` · Semester ${mod.semester}`}
                                    {mod.status === "active" && ` · Veröffentlicht`}
                                  </p>
                                </div>
                                <ChevronLeft className="w-4 h-4 text-surface-400 rotate-180" />
                              </div>
                            </Link>
                          ))
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* All Modules */}
      {id !== "new" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-surface-900 dark:text-white">Module</h2>
            <button
              onClick={handleNewModule}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Neues Modul
            </button>
          </div>

          {modules.length === 0 ? (
            <Card className="text-center py-8">
 <p className="text-surface-600 mb-4">Noch keine Module angelegt</p>
              <button
                onClick={handleNewModule}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Neues Modul
              </button>
            </Card>
          ) : (
            <div className="space-y-3">
              {modules.map((mod) => (
                <Link key={mod.id} href={`/builder/module/${mod.id}`}>
                  <Card interactive padding="md">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-semibold text-surface-900 dark:text-white">{mod.name}</h3>
 <p className="text-sm text-surface-600 mt-1">
                          {mod.code} · {mod.ects} ECTS
                        </p>
                      </div>
                      <div className="text-right text-sm">
                        {mod.status === 'active' ? (
                          <span className="text-green-600 font-medium">Veröffentlicht</span>
                        ) : (
                          <span className="text-amber-600 font-medium">Entwurf</span>
                        )}
                      </div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
