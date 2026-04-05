"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  Plus, Loader2, AlertCircle, ChevronLeft, Save, Trash2,
  CheckCircle, AlertTriangle, Send
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import type { Module, AssessmentComponent } from "@/types/database";

interface ModuleWithDetails extends Module {
  components?: AssessmentComponent[];
  prerequisites?: any[];
}

const GRADE_SCALES = ["0.0-6.0", "0.0-5.0", "0-100", "A-F"];
const PASS_POLICIES = ["min_grade", "points_threshold", "percentage"];

export default function ModuleEditorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const programId = searchParams.get("program_id") || "";

  const [module, setModule] = useState<ModuleWithDetails | null>(null);
  const [components, setComponents] = useState<AssessmentComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showComponentForm, setShowComponentForm] = useState(false);
  const [editingComponent, setEditingComponent] = useState<AssessmentComponent | null>(null);

  // Form fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [ects, setEcts] = useState("5");
  const [gradeScale, setGradeScale] = useState("0.0-6.0");
  const [passPolicy, setPassPolicy] = useState("min_grade");
  const [minGrade, setMinGrade] = useState("4.0");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  // Component form fields
  const [componentName, setComponentName] = useState("");
  const [componentType, setComponentType] = useState("exam");
  const [componentWeight, setComponentWeight] = useState("1");

  useEffect(() => {
    const fetchModule = async () => {
      try {
        setLoading(true);
        setError(null);

        if (id === "new") {
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/academic/modules/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch module");
        }
        const data = await response.json();
        setModule(data.module);
        setCode(data.module.module_code || data.module.code || "");
        setName(data.module.name || "");
        setEcts((data.module.ects || data.module.ects_equivalent || 5).toString());
        setGradeScale(data.module.grade_scale || "0.0-6.0");
        setPassPolicy(data.module.pass_policy || "min_grade");
        setMinGrade(data.module.min_grade?.toString() || "4.0");
        setDescription(data.module.description || "");
        setIsPublished(data.module.is_published || false);

        // Fetch components
        const compsResponse = await fetch(`/api/academic/modules/${id}/components`);
        if (compsResponse.ok) {
          const compsData = await compsResponse.json();
          setComponents(compsData.components || []);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fehler beim Laden des Moduls";
        setError(message);
        console.error("Error fetching module:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchModule();
  }, [id]);

  const handleSave = async () => {
    try {
      setSaving(true);

      if (id === "new") {
        if (!programId) {
          toast.error("Programm erforderlich");
          return;
        }

        const response = await fetch("/api/academic/modules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            program_id: programId,
            module_code: code,
            name,
            ects: parseInt(ects),
            ects_equivalent: parseInt(ects),
            grade_scale: gradeScale,
            pass_policy: passPolicy,
            min_grade: parseFloat(minGrade),
            description,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create module");
        }

        const data = await response.json();
        toast.success("Modul erstellt");
        router.push(`/builder/module/${data.module.id}`);
      } else {
        const response = await fetch(`/api/academic/modules/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            module_code: code,
            name,
            ects: parseInt(ects),
            ects_equivalent: parseInt(ects),
            grade_scale: gradeScale,
            pass_policy: passPolicy,
            min_grade: parseFloat(minGrade),
            description,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update module");
        }

        const data = await response.json();
        setModule(data.module);
        toast.success("Modul aktualisiert");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Speichern";
      toast.error(message);
      console.error("Error saving module:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleAddComponent = async () => {
    try {
      if (id === "new") {
        toast.error("Bitte speichern Sie das Modul zuerst");
        return;
      }

      if (!componentName) {
        toast.error("Komponentenname erforderlich");
        return;
      }

      // Map frontend types to DB component_type values
      const typeMap: Record<string, string> = {
        exam: "written_exam",
        assignment: "homework",
        project: "project",
        participation: "participation",
      };

      const response = await fetch(`/api/academic/modules/${id}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: componentName,
          component_type: typeMap[componentType] || componentType,
          weight_percent: parseInt(componentWeight),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create component");
      }

      const data = await response.json();
      setComponents([...components, data.component]);
      setComponentName("");
      setComponentType("exam");
      setComponentWeight("1");
      setShowComponentForm(false);
      toast.success("Komponente hinzugefügt");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Hinzufügen";
      toast.error(message);
    }
  };

  const handleDeleteComponent = async (compId: string) => {
    if (!confirm("Komponente wirklich löschen?")) return;

    try {
      const response = await fetch(
        `/api/academic/modules/${id}/components/${compId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        throw new Error("Failed to delete component");
      }

      setComponents(components.filter((c) => c.id !== compId));
      toast.success("Komponente gelöscht");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Löschen";
      toast.error(message);
    }
  };

  const handleValidate = async () => {
    try {
      setValidating(true);
      setValidationErrors([]);

      const response = await fetch(`/api/academic/modules/${id}/validate`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setValidationErrors(data.errors || ["Validierungsfehler"]);
        toast.error("Modul hat Fehler");
      } else {
        toast.success("Modul ist gültig!");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Validieren";
      toast.error(message);
    } finally {
      setValidating(false);
    }
  };

  const handlePublish = async () => {
    try {
      if (validationErrors.length > 0) {
        toast.error("Bitte beheben Sie die Validierungsfehler zuerst");
        return;
      }

      setPublishing(true);

      const response = await fetch(`/api/academic/modules/${id}/publish`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to publish module");
      }

      const data = await response.json();
      setModule(data.module);
      setIsPublished(true);
      toast.success("Modul veröffentlicht");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Veröffentlichen";
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  const totalWeight = components.reduce((sum, c) => sum + (c.weight_percent || 0), 0);
  const weightPercentage = totalWeight > 0 ? (totalWeight / 100) * 100 : 0;
  const isWeightValid = totalWeight === 100;

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

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={programId ? `/builder/program/${programId}` : "/builder"}>
          <button className="p-2 hover:bg-surface-100 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6 text-surface-600" />
          </button>
        </Link>
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-surface-900">
            {id === "new" ? "Neues Modul" : "Modul"}
          </h1>
        </div>
        {isPublished && id !== "new" && (
          <div className="inline-block px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium">
            Veröffentlicht
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <Card className="bg-red-50 border-red-200 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        </Card>
      )}

      {/* Validation Errors */}
      {validationErrors.length > 0 && (
        <Card className="bg-amber-50 border-amber-200 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-amber-900 mb-2">Validierungsfehler:</p>
              <ul className="list-disc list-inside space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i} className="text-amber-700 text-sm">{err}</li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Module Info Form */}
      <Card padding="lg">
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                Code *
              </label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="z.B. CS101"
                className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Einführung in die Informatik"
                className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                ECTS *
              </label>
              <input
                type="number"
                value={ects}
                onChange={(e) => setEcts(e.target.value)}
                className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                Notenskala
              </label>
              <select
                value={gradeScale}
                onChange={(e) => setGradeScale(e.target.value)}
                className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {GRADE_SCALES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                Min. Note zum Bestehen
              </label>
              <input
                type="number"
                step="0.1"
                value={minGrade}
                onChange={(e) => setMinGrade(e.target.value)}
                className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-900 mb-2">
              Beschreibung
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Modulbeschreibung…"
              className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={handleSave}
              disabled={saving || !name || !code}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              {saving ? "Speichern..." : "Speichern"}
            </button>
            <Link href={programId ? `/builder/program/${programId}` : "/builder"}>
              <button className="px-4 py-2 bg-surface-200 text-surface-900 rounded-lg hover:bg-surface-300 transition-colors font-medium">
                Abbrechen
              </button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Assessment Components */}
      {id !== "new" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-surface-900">Bewertungskomponenten</h2>
            <button
              onClick={() => setShowComponentForm(!showComponentForm)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Komponente
            </button>
          </div>

          {/* Add Component Form */}
          {showComponentForm && (
            <Card padding="md" className="bg-blue-50">
              <div className="space-y-3">
                <input
                  type="text"
                  value={componentName}
                  onChange={(e) => setComponentName(e.target.value)}
                  placeholder="z.B. Schlussprüfung"
                  className="w-full px-4 py-2 bg-white border border-blue-200 rounded-lg text-surface-900 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <select
                    value={componentType}
                    onChange={(e) => setComponentType(e.target.value)}
                    className="px-4 py-2 bg-white border border-blue-200 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="exam">Prüfung</option>
                    <option value="assignment">Hausaufgabe</option>
                    <option value="project">Projekt</option>
                    <option value="participation">Teilnahme</option>
                  </select>
                  <input
                    type="number"
                    value={componentWeight}
                    onChange={(e) => setComponentWeight(e.target.value)}
                    placeholder="Gewicht"
                    className="px-4 py-2 bg-white border border-blue-200 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddComponent}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    Hinzufügen
                  </button>
                  <button
                    onClick={() => setShowComponentForm(false)}
                    className="flex-1 px-4 py-2 bg-surface-200 text-surface-900 rounded-lg hover:bg-surface-300 transition-colors font-medium"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            </Card>
          )}

          {/* Weight Indicator */}
          {components.length > 0 && (
            <Card padding="md" className={isWeightValid ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-surface-900">Gesamtgewicht</p>
                  <p className="text-sm text-surface-600">{totalWeight}/100</p>
                </div>
                {isWeightValid ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                )}
              </div>
            </Card>
          )}

          {/* Components List */}
          {components.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-surface-600">Noch keine Komponenten</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {components.map((comp) => (
                <Card key={comp.id} padding="md">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-surface-900">{comp.name}</h3>
                      <p className="text-sm text-surface-600">
                        {comp.component_type} · Gewicht: {comp.weight_percent}%
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteComponent(comp.id)}
                      className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      {id !== "new" && (
        <div className="flex gap-3">
          <button
            onClick={handleValidate}
            disabled={validating}
            className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors font-medium"
          >
            {validating ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
            {validating ? "Validieren..." : "Validieren"}
          </button>
          {!isPublished && (
            <button
              onClick={handlePublish}
              disabled={publishing || !isWeightValid || validationErrors.length > 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
            >
              {publishing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
              {publishing ? "Veröffentlichen..." : "Veröffentlichen"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
