"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  Plus, Loader2, AlertCircle, ChevronLeft, Save, GripVertical,
  Trash2, ChevronDown, ChevronUp
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import type { Studiengang, Module, RequirementGroup } from "@/types/database";

interface ProgramWithDetails extends Studiengang {
  requirement_groups?: RequirementGroup[];
  modules?: Module[];
}

const DEGREE_LEVELS = ["bachelor", "master", "diplom"];

export default function ProgramDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const institutionId = searchParams.get("institution_id") || "";

  const [program, setProgram] = useState<ProgramWithDetails | null>(null);
  const [requirementGroups, setRequirementGroups] = useState<RequirementGroup[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [degreeLevel, setDegreeLevel] = useState("bachelor");
  const [totalEcts, setTotalEcts] = useState("180");
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    const fetchProgram = async () => {
      try {
        setLoading(true);
        setError(null);

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
        setIsPublished(data.program.is_published || false);

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
  }, [id]);

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
      const groupName = prompt("Name der Anforderungsgruppe:");
      if (!groupName) return;

      const response = await fetch(`/api/academic/programs/${id}/requirement-groups`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: groupName }),
      });

      if (!response.ok) {
        throw new Error("Failed to create group");
      }

      const data = await response.json();
      setRequirementGroups([...requirementGroups, data.requirement_group]);
      toast.success("Gruppe erstellt");
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
          <h1 className="text-3xl font-bold text-surface-900">
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
        <Card className="bg-red-50 border-red-200 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-red-700">{error}</p>
          </div>
        </Card>
      )}

      {/* Program Info Form */}
      <Card padding="lg">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-900 mb-2">
              Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. Informatik Bachelor"
              className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                Studienabschluss
              </label>
              <select
                value={degreeLevel}
                onChange={(e) => setDegreeLevel(e.target.value)}
                className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DEGREE_LEVELS.map((l) => (
                  <option key={l} value={l}>
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                Gesamt ECTS
              </label>
              <input
                type="number"
                value={totalEcts}
                onChange={(e) => setTotalEcts(e.target.value)}
                className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
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
            <h2 className="text-2xl font-bold text-surface-900">Anforderungsgruppen</h2>
            <button
              onClick={handleNewGroup}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Gruppe hinzufügen
            </button>
          </div>

          {requirementGroups.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-surface-600 mb-4">Noch keine Anforderungsgruppen</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {requirementGroups.map((group) => {
                const groupModuleList = groupModules(group.id);
                const isExpanded = expandedGroup === group.id;

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
                        <div>
                          <h3 className="font-semibold text-surface-900">
                            {group.name}
                          </h3>
                          <p className="text-sm text-surface-600">
                            {groupModuleList.length} Module
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(group.id);
                          }}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
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
                              <div className="flex items-center justify-between p-2 hover:bg-surface-100 rounded transition-colors">
                                <div>
                                  <p className="text-sm font-medium text-surface-900">
                                    {mod.name}
                                  </p>
                                  <p className="text-xs text-surface-600">
                                    {mod.ects} ECTS
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
            <h2 className="text-2xl font-bold text-surface-900">Module</h2>
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
                        <h3 className="font-semibold text-surface-900">{mod.name}</h3>
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
