"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import {
  Plus, Loader2, AlertCircle, ChevronLeft, Save, Trash2,
  CheckCircle, AlertTriangle, Send, ChevronDown, ChevronUp, X
} from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { useBuilderGuard } from "@/lib/hooks/useBuilderGuard";
import type { Module, AssessmentComponent } from "@/types/database";

interface ModuleWithDetails extends Module {
  components?: AssessmentComponent[];
  prerequisites?: any[];
}

interface RefEntry {
  id: string;
  name: string;
  code: string;
  description?: string;
  _custom?: boolean;
}

interface CountryDefaults {
  grade_scales: RefEntry[];
  pass_policies: RefEntry[];
  retake_policies: RefEntry[];
  rounding_policies: RefEntry[];
}

interface RequirementGroup {
  id: string;
  name: string;
  code?: string;
  group_type?: string;
}

const COMPONENT_TYPES = {
  written_exam: "Schriftliche Prüfung",
  oral_exam: "Mündliche Prüfung",
  project: "Projekt",
  lab: "Labor",
  homework: "Hausaufgabe",
  presentation: "Präsentation",
  participation: "Teilnahme",
  thesis: "Thesis",
  pass_fail_requirement: "Bestanden/Nicht bestanden",
};

const LANGUAGES = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "sv", label: "Svenska" },
];

const DELIVERY_MODES = [
  { key: "onsite", label: "Präsenz" },
  { key: "online", label: "Online" },
  { key: "hybrid", label: "Hybrid" },
];

const DAYS_OF_WEEK = [
  "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"
];

const TERM_TYPES = [
  { key: "semester", label: "Semester" },
  { key: "trimester", label: "Trimester" },
  { key: "block", label: "Blockveranstaltung" },
];

const MODULE_TYPES = [
  { key: "pflicht", label: "Pflichtmodul" },
  { key: "wahl", label: "Wahlmodul" },
  { key: "vertiefung", label: "Vertiefungsmodul" },
  { key: "projekt", label: "Projektmodul" },
  { key: "seminar", label: "Seminar" },
];

const REQUIREMENT_GROUP_TYPES = [
  { key: "compulsory", label: "Pflicht" },
  { key: "elective_required", label: "Wahlpflicht" },
  { key: "elective_free", label: "Freie Wahl" },
  { key: "specialisation", label: "Vertiefung / Schwerpunkt" },
  { key: "minor", label: "Nebenfach" },
  { key: "thesis", label: "Thesis / Abschlussarbeit" },
  { key: "internship", label: "Praktikum" },
];

export default function ModuleEditorPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const programId = searchParams.get("program_id") || "";

  // Access control: verify builder access (granular institution check done by API)
  const { authorized, loading: guardLoading } = useBuilderGuard();

  const [module, setModule] = useState<ModuleWithDetails | null>(null);
  const [components, setComponents] = useState<AssessmentComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [showComponentForm, setShowComponentForm] = useState(false);

  // Dropdown data from country defaults
  const [countryDefaults, setCountryDefaults] = useState<CountryDefaults | null>(null);
  const [requirementGroups, setRequirementGroups] = useState<RequirementGroup[]>([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(false);
  const [currentInstitutionId, setCurrentInstitutionId] = useState<string | null>(null);

  // Custom entry creation modal (for academic reference data)
  const [customEntryModal, setCustomEntryModal] = useState<{
    table: string;
    label: string;
  } | null>(null);
  const [customEntryName, setCustomEntryName] = useState("");
  const [customEntryDesc, setCustomEntryDesc] = useState("");
  const [customEntrySaving, setCustomEntrySaving] = useState(false);

  // Inline requirement group creation
  const [showReqGroupForm, setShowReqGroupForm] = useState(false);
  const [reqGroupName, setReqGroupName] = useState("");
  const [reqGroupType, setReqGroupType] = useState("compulsory");
  const [reqGroupMinCredits, setReqGroupMinCredits] = useState("");
  const [reqGroupSaving, setReqGroupSaving] = useState(false);

  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    grunddaten: true,
    lehre: true,
    zeitplan: false,
    akademisch: false,
    regeln: false,
    beschreibung: false,
    bewertung: false,
  });

  // Section 1: Grunddaten
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [ects, setEcts] = useState("5");

  // Section 2: Lehre
  const [professor, setProfessor] = useState("");
  const [language, setLanguage] = useState("de");
  const [deliveryMode, setDeliveryMode] = useState("onsite");
  const [semester, setSemester] = useState("");
  const [semesterPartTime, setSemesterPartTime] = useState("");
  const [termType, setTermType] = useState("semester");
  const [defaultTermNumber, setDefaultTermNumber] = useState("1");

  // Section 3: Zeitplan
  const [day, setDay] = useState("");
  const [timeStart, setTimeStart] = useState("");
  const [timeEnd, setTimeEnd] = useState("");
  const [room, setRoom] = useState("");

  // Section 4: Akademische Einstellungen
  const [gradeScaleId, setGradeScaleId] = useState("");
  const [passPolicyId, setPassPolicyId] = useState("");
  const [retakePolicyId, setRetakePolicyId] = useState("");
  const [roundingPolicyId, setRoundingPolicyId] = useState("");
  const [minGrade, setMinGrade] = useState("4.0");

  // Section 5: Modulregeln
  const [isCompulsory, setIsCompulsory] = useState(true);
  const [attendanceRequired, setAttendanceRequired] = useState(false);
  const [isRepeatable, setIsRepeatable] = useState(true);
  const [maxRetakes, setMaxRetakes] = useState("2");
  const [moduleType, setModuleType] = useState("pflicht");
  const [requirementGroupId, setRequirementGroupId] = useState("");

  // Section 6: Beschreibung (4 separate Textblöcke)
  const [description, setDescription] = useState("");
  const [learningObjectives, setLearningObjectives] = useState("");
  const [moduleContents, setModuleContents] = useState("");
  const [remarks, setRemarks] = useState("");
  const [isPublished, setIsPublished] = useState(false);

  // Component form fields
  const [componentName, setComponentName] = useState("");
  const [componentType, setComponentType] = useState("written_exam");
  const [componentWeight, setComponentWeight] = useState("100");
  const [minPassRequired, setMinPassRequired] = useState(false);
  const [minGradeValue, setMinGradeValue] = useState("4.0");
  const [mandatoryToPass, setMandatoryToPass] = useState(false);

  // Helper function to fetch country defaults and requirement groups
  const fetchDropdownData = async (countryCode: string, progId: string, instId?: string) => {
    try {
      setDropdownsLoading(true);

      // Always set a non-null countryDefaults so dropdowns are enabled
      // even if API fails — users can then still manually pick from whatever loaded
      let mapped: CountryDefaults = {
        grade_scales: [],
        pass_policies: [],
        retake_policies: [],
        rounding_policies: [],
      };

      try {
        let url = `/api/academic/country-defaults?country=${countryCode}`;
        if (instId) url += `&institution_id=${instId}`;
        const defaultsResponse = await fetch(url);
        if (defaultsResponse.ok) {
          const raw = await defaultsResponse.json();
          // API returns camelCase keys — map to snake_case for frontend
          mapped = {
            grade_scales: raw.gradeScales || raw.grade_scales || [],
            pass_policies: raw.passPolicies || raw.pass_policies || [],
            retake_policies: raw.retakePolicies || raw.retake_policies || [],
            rounding_policies: raw.roundingPolicies || raw.rounding_policies || [],
          };

          // Auto-select country defaults if not already set
          const def = raw.defaults;
          if (def?.grade_scale?.id) setGradeScaleId((prev) => prev || def.grade_scale.id);
          else if (mapped.grade_scales.length > 0) setGradeScaleId((prev) => prev || mapped.grade_scales[0].id);

          if (def?.pass_policy?.id) setPassPolicyId((prev) => prev || def.pass_policy.id);
          else if (mapped.pass_policies.length > 0) setPassPolicyId((prev) => prev || mapped.pass_policies[0].id);

          if (def?.retake_policy?.id) setRetakePolicyId((prev) => prev || def.retake_policy.id);
          else if (mapped.retake_policies.length > 0) setRetakePolicyId((prev) => prev || mapped.retake_policies[0].id);

          if (def?.rounding_policy?.id) setRoundingPolicyId((prev) => prev || def.rounding_policy.id);
          else if (mapped.rounding_policies.length > 0) setRoundingPolicyId((prev) => prev || mapped.rounding_policies[0].id);
        } else {
          console.error("Country defaults API error:", defaultsResponse.status, await defaultsResponse.text().catch(() => ""));
        }
      } catch (err) {
        console.error("Error fetching country defaults:", err);
      }

      // Always set countryDefaults (even if empty) so dropdowns are enabled
      setCountryDefaults(mapped);

      // Fetch requirement groups for program
      if (progId) {
        try {
          const groupsResponse = await fetch(
            `/api/academic/programs/${progId}/requirement-groups`
          );
          if (groupsResponse.ok) {
            const groupsData = await groupsResponse.json();
            setRequirementGroups(groupsData.requirementGroups || groupsData.groups || []);
          } else {
            console.error("Requirement groups API error:", groupsResponse.status);
          }
        } catch (err) {
          console.error("Error fetching requirement groups:", err);
        }
      }
    } finally {
      setDropdownsLoading(false);
    }
  };

  // Helper function to get country code from program
  const fetchCountryAndLoadDefaults = async (progId: string) => {
    try {
      const progResponse = await fetch(`/api/academic/programs/${progId}`);
      if (!progResponse.ok) throw new Error("Failed to fetch program");

      const progData = await progResponse.json();
      const institutionId = progData.program.institution_id;
      setCurrentInstitutionId(institutionId);

      const instResponse = await fetch(`/api/academic/institutions/${institutionId}`);
      if (!instResponse.ok) throw new Error("Failed to fetch institution");

      const instData = await instResponse.json();
      const countryCode = instData.institution.country_code || "CH";

      await fetchDropdownData(countryCode, progId, institutionId);
    } catch (err) {
      console.error("Error fetching country:", err);
      // Fallback to CH defaults
      await fetchDropdownData("CH", progId);
    }
  };

  useEffect(() => {
    const fetchModule = async () => {
      try {
        setLoading(true);
        setError(null);

        if (id === "new") {
          // For new modules, load defaults from program
          if (programId) {
            await fetchCountryAndLoadDefaults(programId);
          }
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
        setMinGrade(data.module.min_grade?.toString() || "4.0");
        setDescription(data.module.description || "");
        if (data.module.learning_objectives) setLearningObjectives(data.module.learning_objectives);
        if (data.module.module_contents) setModuleContents(data.module.module_contents);
        if (data.module.remarks) setRemarks(data.module.remarks);
        setIsPublished(data.module.status === "active");

        // Load other section fields if available
        if (data.module.professor) setProfessor(data.module.professor);
        if (data.module.language) setLanguage(data.module.language);
        if (data.module.delivery_mode) setDeliveryMode(data.module.delivery_mode);
        if (data.module.semester) setSemester(data.module.semester);
        if (data.module.semester_part_time) setSemesterPartTime(data.module.semester_part_time);
        if (data.module.term_type) setTermType(data.module.term_type);
        if (data.module.default_term_number) setDefaultTermNumber(data.module.default_term_number.toString());
        if (data.module.day) setDay(data.module.day);
        if (data.module.time_start) setTimeStart(data.module.time_start);
        if (data.module.time_end) setTimeEnd(data.module.time_end);
        if (data.module.room) setRoom(data.module.room);
        if (data.module.grade_scale_id) setGradeScaleId(data.module.grade_scale_id);
        if (data.module.pass_policy_id) setPassPolicyId(data.module.pass_policy_id);
        if (data.module.retake_policy_id) setRetakePolicyId(data.module.retake_policy_id);
        if (data.module.rounding_policy_id) setRoundingPolicyId(data.module.rounding_policy_id);
        if (data.module.is_compulsory !== undefined) setIsCompulsory(data.module.is_compulsory);
        if (data.module.attendance_required !== undefined) setAttendanceRequired(data.module.attendance_required);
        if (data.module.is_repeatable !== undefined) setIsRepeatable(data.module.is_repeatable);
        if (data.module.max_retakes !== undefined && data.module.max_retakes !== null) setMaxRetakes(data.module.max_retakes.toString());
        if (data.module.module_type) setModuleType(data.module.module_type);
        if (data.module.requirement_group_id) setRequirementGroupId(data.module.requirement_group_id);

        // Fetch components
        const compsResponse = await fetch(`/api/academic/modules/${id}/components`);
        if (compsResponse.ok) {
          const compsData = await compsResponse.json();
          setComponents(compsData.components || []);
        }

        // Load country defaults
        const progId = data.module.program_id;
        if (progId) {
          await fetchCountryAndLoadDefaults(progId);
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
  }, [id, programId]);

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
            min_grade: parseFloat(minGrade),
            description: description || null,
            learning_objectives: learningObjectives || null,
            module_contents: moduleContents || null,
            remarks: remarks || null,
            professor: professor || null,
            language: language || null,
            delivery_mode: deliveryMode || null,
            semester: semester || null,
            semester_part_time: semesterPartTime || null,
            term_type: termType || null,
            default_term_number: defaultTermNumber ? parseInt(defaultTermNumber) : null,
            day: day || null,
            time_start: timeStart || null,
            time_end: timeEnd || null,
            room: room || null,
            grade_scale_id: gradeScaleId || null,
            pass_policy_id: passPolicyId || null,
            retake_policy_id: retakePolicyId || null,
            rounding_policy_id: roundingPolicyId || null,
            is_compulsory: isCompulsory,
            attendance_required: attendanceRequired,
            is_repeatable: isRepeatable,
            max_retakes: isRepeatable ? parseInt(maxRetakes) || 2 : null,
            module_type: moduleType || null,
            requirement_group_id: requirementGroupId || null,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || "Failed to create module");
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
            min_grade: parseFloat(minGrade),
            description: description || null,
            learning_objectives: learningObjectives || null,
            module_contents: moduleContents || null,
            remarks: remarks || null,
            professor: professor || null,
            language: language || null,
            delivery_mode: deliveryMode || null,
            semester: semester || null,
            semester_part_time: semesterPartTime || null,
            term_type: termType || null,
            default_term_number: defaultTermNumber ? parseInt(defaultTermNumber) : null,
            day: day || null,
            time_start: timeStart || null,
            time_end: timeEnd || null,
            room: room || null,
            grade_scale_id: gradeScaleId || null,
            pass_policy_id: passPolicyId || null,
            retake_policy_id: retakePolicyId || null,
            rounding_policy_id: roundingPolicyId || null,
            is_compulsory: isCompulsory,
            attendance_required: attendanceRequired,
            is_repeatable: isRepeatable,
            max_retakes: isRepeatable ? parseInt(maxRetakes) || 2 : null,
            module_type: moduleType || null,
            requirement_group_id: requirementGroupId || null,
          }),
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || "Failed to update module");
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

      const weightNum = parseInt(componentWeight);
      if (isNaN(weightNum) || weightNum < 1 || weightNum > 100) {
        toast.error("Gewichtung muss zwischen 1% und 100% liegen");
        return;
      }

      const response = await fetch(`/api/academic/modules/${id}/components`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: componentName,
          component_type: componentType,
          weight_percent: weightNum,
          min_pass_required: minPassRequired,
          min_grade: minPassRequired ? parseFloat(minGradeValue) || null : null,
          mandatory_to_pass: mandatoryToPass,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Fehler beim Hinzufügen der Komponente");
      }

      setComponents([...components, data.component]);
      setComponentName("");
      setComponentType("written_exam");
      setComponentWeight("100");
      setMinPassRequired(false);
      setMinGradeValue("4.0");
      setMandatoryToPass(false);
      setShowComponentForm(false);
      toast.success("Komponente hinzugefügt");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Hinzufügen";
      toast.error(message);
    }
  };

  const refreshComponents = async () => {
    try {
      const res = await fetch(`/api/academic/modules/${id}/components`);
      if (res.ok) {
        const data = await res.json();
        setComponents(data.components || []);
      }
    } catch { /* ignore */ }
  };

  const handleDeleteComponent = async (compId: string) => {
    if (!confirm("Komponente wirklich löschen?")) return;

    try {
      const response = await fetch(
        `/api/academic/modules/${id}/components/${compId}`,
        { method: "DELETE" }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "Fehler beim Löschen der Komponente");
      }

      // Remove from local state immediately, then refresh from server
      setComponents((prev) => prev.filter((c) => c.id !== compId));
      toast.success("Komponente gelöscht");
      // Refresh from server to ensure consistency
      await refreshComponents();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Löschen";
      toast.error(message);
      // Refresh from server in case of error to restore correct state
      await refreshComponents();
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Modul konnte nicht veröffentlicht werden");
      }

      setModule(data.module);
      setIsPublished(true);
      toast.success("Modul veröffentlicht");

      // Navigate back to program builder
      if (programId) {
        router.push(`/builder/program/${programId}`);
      } else if (data.module?.program_id) {
        router.push(`/builder/program/${data.module.program_id}`);
      } else {
        router.push("/builder");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Veröffentlichen";
      toast.error(message);
    } finally {
      setPublishing(false);
    }
  };

  // Handle creating a custom reference entry for the institution
  const handleCreateCustomEntry = async () => {
    if (!customEntryModal || !currentInstitutionId || !customEntryName.trim()) return;

    try {
      setCustomEntrySaving(true);
      const response = await fetch(
        `/api/academic/institutions/${currentInstitutionId}/reference`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            table: customEntryModal.table,
            data: {
              name: customEntryName.trim(),
              description: customEntryDesc.trim() || null,
            },
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "Fehler beim Erstellen");
      }

      const result = await response.json();
      const newEntry: RefEntry = {
        id: result.entry.id,
        name: result.entry.name,
        code: result.entry.code,
        description: result.entry.description,
        _custom: true,
      };

      // Add the new entry to the appropriate dropdown list and select it
      setCountryDefaults((prev) => {
        if (!prev) return prev;
        const table = customEntryModal.table;
        const key = table as keyof CountryDefaults;
        return {
          ...prev,
          [key]: [...prev[key], newEntry],
        };
      });

      // Auto-select the newly created entry
      const table = customEntryModal.table;
      if (table === "grade_scales") setGradeScaleId(newEntry.id);
      else if (table === "pass_policies") setPassPolicyId(newEntry.id);
      else if (table === "retake_policies") setRetakePolicyId(newEntry.id);
      else if (table === "rounding_policies") setRoundingPolicyId(newEntry.id);

      toast.success(`"${newEntry.name}" erstellt und ausgewählt`);
      setCustomEntryModal(null);
      setCustomEntryName("");
      setCustomEntryDesc("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler";
      toast.error(msg);
    } finally {
      setCustomEntrySaving(false);
    }
  };

  // Handle creating a new requirement group inline
  const handleCreateReqGroup = async () => {
    if (!reqGroupName.trim() || !programId) return;

    try {
      setReqGroupSaving(true);
      const response = await fetch(
        `/api/academic/programs/${programId}/requirement-groups`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: reqGroupName.trim(),
            group_type: reqGroupType,
            min_credits_required: reqGroupMinCredits ? parseFloat(reqGroupMinCredits) : null,
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || "Fehler beim Erstellen");
      }

      const result = await response.json();
      const newGroup: RequirementGroup = {
        id: result.requirementGroup.id,
        name: result.requirementGroup.name,
        group_type: result.requirementGroup.group_type,
      };

      setRequirementGroups((prev) => [...prev, newGroup]);
      setRequirementGroupId(newGroup.id);
      toast.success(`Anforderungsgruppe "${newGroup.name}" erstellt`);
      setShowReqGroupForm(false);
      setReqGroupName("");
      setReqGroupType("compulsory");
      setReqGroupMinCredits("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Fehler";
      toast.error(msg);
    } finally {
      setReqGroupSaving(false);
    }
  };

  const totalWeight = components.reduce((sum, c) => sum + (c.weight_percent || 0), 0);
  const weightPercentage = totalWeight > 0 ? (totalWeight / 100) * 100 : 0;
  const isWeightValid = totalWeight === 100;

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
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
          <h1 className="text-3xl font-bold text-surface-900 dark:text-white">
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

      {/* Collapsible Sections */}
      <div className="space-y-3">
        {/* SECTION 1: Grunddaten */}
        <Card padding="none">
          <button
            onClick={() => toggleSection("grunddaten")}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
          >
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white">1. Grunddaten</h2>
            {expandedSections.grunddaten ? (
              <ChevronUp className="w-5 h-5 text-surface-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-surface-600" />
            )}
          </button>
          {expandedSections.grunddaten && (
            <div className="px-6 py-4 border-t border-surface-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Code *
                  </label>
                  <input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="z.B. CS101"
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="z.B. Einführung in die Informatik"
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                  ECTS *
                </label>
                <input
                  type="number"
                  value={ects}
                  onChange={(e) => setEcts(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </Card>

        {/* SECTION 2: Lehre */}
        <Card padding="none">
          <button
            onClick={() => toggleSection("lehre")}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
          >
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white">2. Lehre</h2>
            {expandedSections.lehre ? (
              <ChevronUp className="w-5 h-5 text-surface-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-surface-600" />
            )}
          </button>
          {expandedSections.lehre && (
            <div className="px-6 py-4 border-t border-surface-200 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                  Dozent / Professor
                </label>
                <input
                  type="text"
                  value={professor}
                  onChange={(e) => setProfessor(e.target.value)}
                  placeholder="z.B. Prof. Dr. Max Mustermann"
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Sprache
                  </label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.code} value={l.code}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Unterrichtsmodus
                  </label>
                  <select
                    value={deliveryMode}
                    onChange={(e) => setDeliveryMode(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {DELIVERY_MODES.map((m) => (
                      <option key={m.key} value={m.key}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Semester (Vollzeit)
                  </label>
                  <input
                    type="text"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    placeholder="z.B. 1 oder HS2025"
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Semester (Teilzeit)
                  </label>
                  <input
                    type="text"
                    value={semesterPartTime}
                    onChange={(e) => setSemesterPartTime(e.target.value)}
                    placeholder="z.B. 2 (leer = gleich wie VZ)"
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Art der Unterrichtsperiode
                  </label>
                  <select
                    value={termType}
                    onChange={(e) => setTermType(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {TERM_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Standard Periodennummer
                  </label>
                  <input
                    type="number"
                    value={defaultTermNumber}
                    onChange={(e) => setDefaultTermNumber(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* SECTION 3: Zeitplan */}
        <Card padding="none">
          <button
            onClick={() => toggleSection("zeitplan")}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
          >
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white">3. Zeitplan</h2>
            {expandedSections.zeitplan ? (
              <ChevronUp className="w-5 h-5 text-surface-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-surface-600" />
            )}
          </button>
          {expandedSections.zeitplan && (
            <div className="px-6 py-4 border-t border-surface-200 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Wochentag
                  </label>
                  <select
                    value={day}
                    onChange={(e) => setDay(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Wählen --</option>
                    {DAYS_OF_WEEK.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
                <div />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Startzeit
                  </label>
                  <input
                    type="time"
                    value={timeStart}
                    onChange={(e) => setTimeStart(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Endzeit
                  </label>
                  <input
                    type="time"
                    value={timeEnd}
                    onChange={(e) => setTimeEnd(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                  Raum
                </label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  placeholder="z.B. A-201"
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </Card>

        {/* SECTION 4: Akademische Einstellungen */}
        <Card padding="none">
          <button
            onClick={() => toggleSection("akademisch")}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
          >
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white">4. Akademische Einstellungen</h2>
            {expandedSections.akademisch ? (
              <ChevronUp className="w-5 h-5 text-surface-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-surface-600" />
            )}
          </button>
          {expandedSections.akademisch && (
            <div className="px-6 py-4 border-t border-surface-200 space-y-4">
              {dropdownsLoading && (
                <div className="flex items-center gap-2 text-sm text-surface-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Landesstandards werden geladen…
                </div>
              )}
              {!dropdownsLoading && countryDefaults && countryDefaults.grade_scales.length === 0 &&
                countryDefaults.pass_policies.length === 0 && (
                <p className="text-sm text-amber-600">
                  Keine akademischen Referenzdaten für dieses Land gefunden. Bitte prüfe, ob die Landesstandards in der Datenbank konfiguriert sind.
                </p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Notenskala
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={gradeScaleId}
                      onChange={(e) => setGradeScaleId(e.target.value)}
                      disabled={dropdownsLoading}
 className="flex-1 px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">-- Wählen --</option>
                      {countryDefaults?.grade_scales.map((scale) => (
                        <option key={scale.id} value={scale.id}>
                          {scale._custom ? "★ " : ""}{scale.name}{scale.description ? ` — ${scale.description.substring(0, 50)}` : ""}
                        </option>
                      ))}
                    </select>
                    {currentInstitutionId && (
                      <button
                        type="button"
                        onClick={() => setCustomEntryModal({ table: "grade_scales", label: "Notenskala" })}
                        className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-sm whitespace-nowrap"
                        title="Eigene Notenskala erstellen"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {gradeScaleId && countryDefaults?.grade_scales.find(s => s.id === gradeScaleId)?.description && (
                    <p className="text-xs text-surface-500 mt-1">
                      {countryDefaults.grade_scales.find(s => s.id === gradeScaleId)?.description}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Min. Note zum Bestehen
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    value={minGrade}
                    onChange={(e) => setMinGrade(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Bestehensregel
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={passPolicyId}
                      onChange={(e) => setPassPolicyId(e.target.value)}
                      disabled={dropdownsLoading}
 className="flex-1 px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">-- Wählen --</option>
                      {countryDefaults?.pass_policies.map((policy) => (
                        <option key={policy.id} value={policy.id}>
                          {policy._custom ? "★ " : ""}{policy.name}
                        </option>
                      ))}
                    </select>
                    {currentInstitutionId && (
                      <button
                        type="button"
                        onClick={() => setCustomEntryModal({ table: "pass_policies", label: "Bestehensregel" })}
                        className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-sm whitespace-nowrap"
                        title="Eigene Bestehensregel erstellen"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {passPolicyId && countryDefaults?.pass_policies.find(p => p.id === passPolicyId)?.description && (
                    <p className="text-xs text-surface-500 mt-1">
                      {countryDefaults.pass_policies.find(p => p.id === passPolicyId)?.description}
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Wiederholungsregel
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={retakePolicyId}
                      onChange={(e) => setRetakePolicyId(e.target.value)}
                      disabled={dropdownsLoading}
 className="flex-1 px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      <option value="">-- Wählen --</option>
                      {countryDefaults?.retake_policies.map((policy) => (
                        <option key={policy.id} value={policy.id}>
                          {policy._custom ? "★ " : ""}{policy.name}
                        </option>
                      ))}
                    </select>
                    {currentInstitutionId && (
                      <button
                        type="button"
                        onClick={() => setCustomEntryModal({ table: "retake_policies", label: "Wiederholungsregel" })}
                        className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-sm whitespace-nowrap"
                        title="Eigene Wiederholungsregel erstellen"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {retakePolicyId && countryDefaults?.retake_policies.find(p => p.id === retakePolicyId)?.description && (
                    <p className="text-xs text-surface-500 mt-1">
                      {countryDefaults.retake_policies.find(p => p.id === retakePolicyId)?.description}
                    </p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                  Rundungsregel
                </label>
                <div className="flex gap-2">
                  <select
                    value={roundingPolicyId}
                    onChange={(e) => setRoundingPolicyId(e.target.value)}
                    disabled={dropdownsLoading}
 className="flex-1 px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  >
                    <option value="">-- Wählen --</option>
                    {countryDefaults?.rounding_policies.map((policy) => (
                      <option key={policy.id} value={policy.id}>
                        {policy._custom ? "★ " : ""}{policy.name}
                      </option>
                    ))}
                  </select>
                  {currentInstitutionId && (
                    <button
                      type="button"
                      onClick={() => setCustomEntryModal({ table: "rounding_policies", label: "Rundungsregel" })}
                      className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-sm whitespace-nowrap"
                      title="Eigene Rundungsregel erstellen"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {roundingPolicyId && countryDefaults?.rounding_policies.find(p => p.id === roundingPolicyId)?.description && (
                  <p className="text-xs text-surface-500 mt-1">
                    {countryDefaults.rounding_policies.find(p => p.id === roundingPolicyId)?.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* SECTION 5: Modulregeln */}
        <Card padding="none">
          <button
            onClick={() => toggleSection("regeln")}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
          >
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white">5. Modulregeln</h2>
            {expandedSections.regeln ? (
              <ChevronUp className="w-5 h-5 text-surface-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-surface-600" />
            )}
          </button>
          {expandedSections.regeln && (
            <div className="px-6 py-4 border-t border-surface-200 space-y-4">
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isCompulsory}
                    onChange={(e) => setIsCompulsory(e.target.checked)}
                    className="w-4 h-4 rounded border-surface-300"
                  />
                  <span className="text-sm font-medium text-surface-900 dark:text-white">
                    Pflichtmodul
                  </span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={attendanceRequired}
                    onChange={(e) => setAttendanceRequired(e.target.checked)}
                    className="w-4 h-4 rounded border-surface-300"
                  />
                  <span className="text-sm font-medium text-surface-900 dark:text-white">
                    Anwesenheit erforderlich
                  </span>
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRepeatable}
                      onChange={(e) => setIsRepeatable(e.target.checked)}
                      className="w-4 h-4 rounded border-surface-300"
                    />
                    <span className="text-sm font-medium text-surface-900 dark:text-white">
                      Wiederholbar
                    </span>
                  </label>
                  {isRepeatable && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-surface-600">max.</span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={maxRetakes}
                        onChange={(e) => setMaxRetakes(e.target.value)}
 className="w-20 px-3 py-1 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <span className="text-sm text-surface-600">Versuche</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Modultyp
                  </label>
                  <select
                    value={moduleType}
                    onChange={(e) => setModuleType(e.target.value)}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {MODULE_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                    Anforderungsgruppe
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={requirementGroupId}
                      onChange={(e) => setRequirementGroupId(e.target.value)}
                      className="flex-1 px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">-- Wählen --</option>
                      {requirementGroups.map((group) => {
                        const gType = group.group_type || group.code;
                        const typeLabel = REQUIREMENT_GROUP_TYPES.find(t => t.key === gType)?.label;
                        return (
                          <option key={group.id} value={group.id}>
                            {group.name}{typeLabel ? ` (${typeLabel})` : ""}
                          </option>
                        );
                      })}
                    </select>
                    {programId && (
                      <button
                        type="button"
                        onClick={() => setShowReqGroupForm(!showReqGroupForm)}
                        className="px-3 py-2 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-sm whitespace-nowrap"
                        title="Neue Anforderungsgruppe erstellen"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  {requirementGroups.length === 0 && !showReqGroupForm && (
                    <p className="text-sm text-surface-500 italic mt-2">
                      Keine Gruppen vorhanden — klicke auf + um eine neue zu erstellen.
                    </p>
                  )}

                  {/* Inline requirement group creation form */}
                  {showReqGroupForm && (
                    <div className="mt-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg space-y-3">
                      <p className="text-sm font-medium text-blue-900">Neue Anforderungsgruppe</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-surface-700 mb-1">
                            Name *
                          </label>
                          <input
                            type="text"
                            value={reqGroupName}
                            onChange={(e) => setReqGroupName(e.target.value)}
                            placeholder="z.B. Pflichtmodule Informatik"
                            className="w-full px-3 py-1.5 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white placeholder-surface-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-surface-700 mb-1">
                            Gruppentyp *
                          </label>
                          <select
                            value={reqGroupType}
                            onChange={(e) => setReqGroupType(e.target.value)}
                            className="w-full px-3 py-1.5 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {REQUIREMENT_GROUP_TYPES.map((t) => (
                              <option key={t.key} value={t.key}>
                                {t.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-surface-700 mb-1">
                          Min. ECTS erforderlich
                        </label>
                        <input
                          type="number"
                          value={reqGroupMinCredits}
                          onChange={(e) => setReqGroupMinCredits(e.target.value)}
                          placeholder="Optional"
                          className="w-full max-w-[200px] px-3 py-1.5 bg-white dark:bg-surface-800 border border-surface-300 dark:border-surface-600 rounded-lg text-surface-900 dark:text-white placeholder-surface-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => { setShowReqGroupForm(false); setReqGroupName(""); }}
                          className="px-3 py-1.5 bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-500 border border-surface-300 dark:border-surface-600 rounded-lg hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors text-sm"
                        >
                          Abbrechen
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateReqGroup}
                          disabled={!reqGroupName.trim() || reqGroupSaving}
                          className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm flex items-center gap-1.5"
                        >
                          {reqGroupSaving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Plus className="w-3.5 h-3.5" />
                          )}
                          Erstellen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </Card>

        {/* SECTION 6: Beschreibung */}
        <Card padding="none">
          <button
            onClick={() => toggleSection("beschreibung")}
            className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
          >
            <h2 className="text-lg font-semibold text-surface-900 dark:text-white">6. Beschreibung</h2>
            {expandedSections.beschreibung ? (
              <ChevronUp className="w-5 h-5 text-surface-600" />
            ) : (
              <ChevronDown className="w-5 h-5 text-surface-600" />
            )}
          </button>
          {expandedSections.beschreibung && (
            <div className="px-6 py-4 border-t border-surface-200 space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                  Modulbeschreibung
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Allgemeine Beschreibung des Moduls…"
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                  Lernziele
                </label>
                <textarea
                  value={learningObjectives}
                  onChange={(e) => setLearningObjectives(e.target.value)}
                  rows={3}
                  placeholder="Was die Studierenden nach Abschluss des Moduls können…"
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                  Inhalte
                </label>
                <textarea
                  value={moduleContents}
                  onChange={(e) => setModuleContents(e.target.value)}
                  rows={3}
                  placeholder="Themen, Kapitel, Schwerpunkte des Moduls…"
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-900 dark:text-white mb-2">
                  Bemerkungen
                </label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={2}
                  placeholder="Zusätzliche Hinweise, Voraussetzungen, Literatur…"
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          )}
        </Card>

        {/* SECTION 7: Bewertungskomponenten */}
        {id !== "new" && (
          <Card padding="none">
            <button
              onClick={() => toggleSection("bewertung")}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
            >
              <h2 className="text-lg font-semibold text-surface-900 dark:text-white">7. Bewertungskomponenten</h2>
              {expandedSections.bewertung ? (
                <ChevronUp className="w-5 h-5 text-surface-600" />
              ) : (
                <ChevronDown className="w-5 h-5 text-surface-600" />
              )}
            </button>
            {expandedSections.bewertung && (
              <div className="px-6 py-4 border-t border-surface-200 space-y-4">
                {/* Add Component Form */}
                {!showComponentForm && (
                  <button
                    onClick={() => setShowComponentForm(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                  >
                    <Plus className="w-5 h-5" />
                    Komponente hinzufügen
                  </button>
                )}

                {showComponentForm && (
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                    <input
                      type="text"
                      value={componentName}
                      onChange={(e) => setComponentName(e.target.value)}
                      placeholder="z.B. Schlussprüfung"
                      className="w-full px-4 py-2 bg-white dark:bg-surface-800 border border-blue-200 dark:border-blue-800 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <select
                        value={componentType}
                        onChange={(e) => setComponentType(e.target.value)}
                        className="px-4 py-2 bg-white dark:bg-surface-800 border border-blue-200 dark:border-blue-800 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        {Object.entries(COMPONENT_TYPES).map(([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={componentWeight}
                          onChange={(e) => setComponentWeight(e.target.value)}
                          placeholder="100"
                          className="w-full px-4 py-2 pr-10 bg-white dark:bg-surface-800 border border-blue-200 dark:border-blue-800 rounded-lg text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-surface-500">%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={minPassRequired}
                          onChange={(e) => setMinPassRequired(e.target.checked)}
                          className="w-4 h-4 rounded border-blue-300"
                        />
                        <span className="text-sm font-medium text-surface-900 dark:text-white">
                          Min. Note erforderlich
                        </span>
                      </label>
                      {minPassRequired && (
                        <div className="ml-7 flex items-center gap-2">
 <label className="text-xs text-surface-600">Mindestnote:</label>
                          <input
                            type="number"
                            step="0.1"
                            min="1"
                            max="6"
                            value={minGradeValue}
                            onChange={(e) => setMinGradeValue(e.target.value)}
                            className="w-20 px-3 py-1.5 bg-white dark:bg-surface-800 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-surface-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={mandatoryToPass}
                          onChange={(e) => setMandatoryToPass(e.target.checked)}
                          className="w-4 h-4 rounded border-blue-300"
                        />
                        <span className="text-sm font-medium text-surface-900 dark:text-white">
                          Muss zum Bestehen erforderlich sein
                        </span>
                      </label>
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
 className="flex-1 px-4 py-2 bg-surface-200 text-surface-900 dark:text-white rounded-lg hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors font-medium"
                      >
                        Abbrechen
                      </button>
                    </div>
                  </div>
                )}

                {/* Weight Indicator */}
                {components.length > 0 && (
                  <div className={`flex items-center justify-between p-4 rounded-lg ${isWeightValid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                    <div>
                      <p className="font-medium text-surface-900 dark:text-white">Gesamtgewicht</p>
                      <p className="text-sm text-surface-600">{totalWeight}/100</p>
                    </div>
                    {isWeightValid ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    )}
                  </div>
                )}

                {/* Components List */}
                {components.length === 0 ? (
                  <div className="text-center py-8 text-surface-600">
                    Noch keine Komponenten
                  </div>
                ) : (
                  <div className="space-y-2">
                    {components.map((comp) => (
 <div key={comp.id} className="flex justify-between items-start p-4 bg-surface-50 rounded-lg border border-surface-200">
                        <div>
                          <h3 className="font-semibold text-surface-900 dark:text-white">{comp.name}</h3>
                          <p className="text-sm text-surface-600">
                            {COMPONENT_TYPES[comp.component_type as keyof typeof COMPONENT_TYPES] || comp.component_type} · Gewicht: {comp.weight_percent}%
                          </p>
                          {(comp.min_pass_required || comp.mandatory_to_pass) && (
                            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                              {comp.min_pass_required && `✓ Min. Note: ${comp.min_grade ?? "–"}`}
                              {comp.min_pass_required && comp.mandatory_to_pass && " · "}
                              {comp.mandatory_to_pass && "✓ Muss bestanden werden"}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleDeleteComponent(comp.id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Save Actions */}
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
 <button className="px-4 py-2 bg-surface-200 text-surface-900 dark:text-white rounded-lg hover:bg-surface-300 dark:hover:bg-surface-600 transition-colors font-medium">
            Abbrechen
          </button>
        </Link>
      </div>


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
      {/* Custom Entry Creation Modal */}
      {customEntryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-surface-800 rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-surface-900 dark:text-white">
                Eigene {customEntryModal.label} erstellen
              </h3>
              <button
                onClick={() => { setCustomEntryModal(null); setCustomEntryName(""); setCustomEntryDesc(""); }}
                className="p-1 hover:bg-surface-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-surface-600" />
              </button>
            </div>
            <p className="text-sm text-surface-500 mb-4">
              Dieser Eintrag wird nur für Ihre Institution erstellt und steht neben den Systemvorgaben zur Verfügung.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-surface-900 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={customEntryName}
                  onChange={(e) => setCustomEntryName(e.target.value)}
                  placeholder={`z.B. Eigene ${customEntryModal.label}`}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-surface-900 mb-1">
                  Beschreibung
                </label>
                <textarea
                  value={customEntryDesc}
                  onChange={(e) => setCustomEntryDesc(e.target.value)}
                  placeholder="Kurze Beschreibung (optional)"
                  rows={2}
 className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 dark:text-white placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setCustomEntryModal(null); setCustomEntryName(""); setCustomEntryDesc(""); }}
                className="flex-1 px-4 py-2 bg-surface-100 text-surface-700 rounded-lg hover:bg-surface-200 transition-colors font-medium"
              >
                Abbrechen
              </button>
              <button
                onClick={handleCreateCustomEntry}
                disabled={!customEntryName.trim() || customEntrySaving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium flex items-center justify-center gap-2"
              >
                {customEntrySaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                Erstellen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
