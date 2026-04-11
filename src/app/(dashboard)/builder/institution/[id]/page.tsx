"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { Plus, Loader2, AlertCircle, ChevronLeft, Save, Globe } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { useBuilderGuard } from "@/lib/hooks/useBuilderGuard";
import type { Institution, Program } from "@/types/database";

interface InstitutionWithPrograms extends Institution {
  programs?: Program[];
}

interface CountryDefaults {
  country_code: string;
  grade_scale_name?: string;
  grade_scale_min?: number;
  grade_scale_max?: number;
  credits_system?: string;
  rounding_increment?: number;
  passing_grade?: number;
  max_attempts?: number;
}

const COUNTRY_OPTIONS = [
  { code: "CH", name: "Schweiz" },
  { code: "DE", name: "Deutschland" },
  { code: "AT", name: "Österreich" },
  { code: "FR", name: "Frankreich" },
  { code: "IT", name: "Italien" },
  { code: "ES", name: "Spanien" },
  { code: "NL", name: "Niederlande" },
  { code: "BE", name: "Belgien" },
  { code: "SE", name: "Schweden" },
  { code: "NO", name: "Norwegen" },
  { code: "DK", name: "Dänemark" },
  { code: "FI", name: "Finnland" },
  { code: "PL", name: "Polen" },
  { code: "CZ", name: "Tschechien" },
  { code: "PT", name: "Portugal" },
  { code: "GB", name: "Grossbritannien" },
  { code: "US", name: "USA" },
];

const INSTITUTION_TYPES = [
  { value: "university", label: "Universität" },
  { value: "university_of_applied_sciences", label: "Fachhochschule" },
  { value: "college", label: "Hochschule" },
  { value: "polytechnic", label: "Polytechnikum" },
];

const LANGUAGE_OPTIONS = [
  { code: "de", label: "Deutsch" },
  { code: "en", label: "English" },
  { code: "fr", label: "Français" },
  { code: "it", label: "Italiano" },
  { code: "es", label: "Español" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "sv", label: "Svenska" },
  { code: "no", label: "Norsk" },
  { code: "da", label: "Dansk" },
  { code: "fi", label: "Suomi" },
  { code: "pl", label: "Polski" },
  { code: "cs", label: "Čeština" },
];

export default function InstitutionDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  // Access control: only admins, institution_admins for their own institution
  const { authorized, loading: guardLoading } = useBuilderGuard(id === "new" ? null : id);

  const [institution, setInstitution] = useState<InstitutionWithPrograms | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countryDefaults, setCountryDefaults] = useState<CountryDefaults | null>(null);
  const [loadingDefaults, setLoadingDefaults] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [website, setWebsite] = useState("");
  const [countryCode, setCountryCode] = useState("CH");
  const [institutionType, setInstitutionType] = useState("university_of_applied_sciences");
  const [officialLanguage, setOfficialLanguage] = useState("de");
  const [academicYearStartMonth, setAcademicYearStartMonth] = useState(9);

  // Fetch institution data
  useEffect(() => {
    const fetchInstitution = async () => {
      try {
        setLoading(true);
        setError(null);

        if (id === "new") {
          // Create new institution mode
          // Fetch defaults for default country (CH)
          await fetchCountryDefaults("CH");
          setLoading(false);
          return;
        }

        const response = await fetch(`/api/academic/institutions/${id}`);
        if (!response.ok) {
          throw new Error("Failed to fetch institution");
        }
        const data = await response.json();
        setInstitution(data.institution);
        setName(data.institution.name);
        setWebsite(data.institution.website || "");
        setCountryCode(data.institution.country_code || "CH");
        setInstitutionType(data.institution.institution_type || "university_of_applied_sciences");
        setOfficialLanguage(data.institution.official_language || "de");
        setAcademicYearStartMonth(data.institution.academic_year_start_month || 9);

        // Programs are already included in the institution GET response
        setPrograms(data.programs || []);

        // Fetch country defaults
        await fetchCountryDefaults(data.institution.country_code || "CH");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Fehler beim Laden der Institution";
        setError(message);
        console.error("Error fetching institution:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInstitution();
  }, [id]);

  // Fetch country defaults
  const fetchCountryDefaults = async (code: string) => {
    try {
      setLoadingDefaults(true);
      const response = await fetch(`/api/academic/country-defaults?country=${code}`);
      if (response.ok) {
        const data = await response.json();
        setCountryDefaults(data);
      }
    } catch (err) {
      console.error("Error fetching country defaults:", err);
    } finally {
      setLoadingDefaults(false);
    }
  };

  // Handle country change and fetch defaults
  const handleCountryChange = (newCode: string) => {
    setCountryCode(newCode);
    fetchCountryDefaults(newCode);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (id === "new") {
        // Create new institution
        const response = await fetch("/api/academic/institutions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            website: website || null,
            country_code: countryCode,
            institution_type: institutionType,
            official_language: officialLanguage,
            academic_year_start_month: academicYearStartMonth,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to create institution");
        }

        const data = await response.json();
        toast.success("Institution erstellt");
        router.push(`/builder/institution/${data.institution.id}`);
      } else {
        // Update institution
        const response = await fetch(`/api/academic/institutions/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            website: website || null,
            country_code: countryCode,
            institution_type: institutionType,
            official_language: officialLanguage,
            academic_year_start_month: academicYearStartMonth,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to update institution");
        }

        const data = await response.json();
        setInstitution(data.institution);
        toast.success("Institution aktualisiert");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Speichern";
      toast.error(message);
      console.error("Error saving institution:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleNewProgram = () => {
    if (id === "new") {
      toast.error("Bitte speichern Sie die Institution zuerst");
      return;
    }
    router.push(`/builder/program/new?institution_id=${id}`);
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
        <Link href="/builder">
          <button className="p-2 hover:bg-surface-100 rounded-lg transition-colors">
            <ChevronLeft className="w-6 h-6 text-surface-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-surface-900">
            {id === "new" ? "Neue Institution" : "Institution"}
          </h1>
        </div>
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

      {/* Form */}
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
              placeholder="z.B. ETH Zürich"
              className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-900 mb-2">
              Website
            </label>
            <input
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://www.beispiel.ch"
              className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                Land *
              </label>
              <select
                value={countryCode}
                onChange={(e) => handleCountryChange(e.target.value)}
                className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                Typ *
              </label>
              <select
                value={institutionType}
                onChange={(e) => setInstitutionType(e.target.value)}
                className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {INSTITUTION_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                Unterrichtssprache *
              </label>
              <select
                value={officialLanguage}
                onChange={(e) => setOfficialLanguage(e.target.value)}
                className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                Akademisches Jahr Start *
              </label>
              <select
                value={academicYearStartMonth}
                onChange={(e) => setAcademicYearStartMonth(parseInt(e.target.value))}
                className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={1}>Januar</option>
                <option value={2}>Februar</option>
                <option value={3}>März</option>
                <option value={4}>April</option>
                <option value={5}>Mai</option>
                <option value={6}>Juni</option>
                <option value={7}>Juli</option>
                <option value={8}>August</option>
                <option value={9}>September</option>
                <option value={10}>Oktober</option>
                <option value={11}>November</option>
                <option value={12}>Dezember</option>
              </select>
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
            <Link href="/builder">
              <button className="px-4 py-2 bg-surface-200 text-surface-900 rounded-lg hover:bg-surface-300 transition-colors font-medium">
                Abbrechen
              </button>
            </Link>
          </div>
        </div>
      </Card>

      {/* Country Defaults Info */}
      {countryDefaults && (
        <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-start gap-3">
            <Globe className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Länderspezifische Defaults:
              </p>
              <div className="flex flex-wrap gap-3 text-sm text-blue-800">
                {countryDefaults.grade_scale_name && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                    {countryDefaults.grade_scale_name}
                    {countryDefaults.grade_scale_min && countryDefaults.grade_scale_max && (
                      <span className="ml-1">({countryDefaults.grade_scale_min}-{countryDefaults.grade_scale_max})</span>
                    )}
                  </span>
                )}
                {countryDefaults.credits_system && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                    {countryDefaults.credits_system}
                  </span>
                )}
                {countryDefaults.rounding_increment && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                    Rundung {countryDefaults.rounding_increment}
                  </span>
                )}
                {countryDefaults.passing_grade && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                    Bestehen {countryDefaults.passing_grade}
                  </span>
                )}
                {countryDefaults.max_attempts && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300">
                    {countryDefaults.max_attempts} Versuche
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Programs Section */}
      {id !== "new" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-surface-900">Programme</h2>
            <button
              onClick={handleNewProgram}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <Plus className="w-5 h-5" />
              Neues Programm
            </button>
          </div>

          {programs.length === 0 ? (
            <Card className="text-center py-8">
              <p className="text-surface-600 mb-4">Noch keine Programme angelegt</p>
              <button
                onClick={handleNewProgram}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Plus className="w-5 h-5" />
                Neues Programm
              </button>
            </Card>
          ) : (
            <div className="space-y-3">
              {programs.map((prog) => (
                <Link key={prog.id} href={`/builder/program/${prog.id}`}>
                  <Card interactive padding="md">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h3 className="font-semibold text-surface-900">{prog.name}</h3>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {prog.degree_level && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-surface-100 text-surface-700">
                              {prog.degree_level}
                            </span>
                          )}
                          {prog.required_total_credits && (
                            <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-surface-100 text-surface-700">
                              {prog.required_total_credits} ECTS
                            </span>
                          )}
                          {/* Module count badge would go here if available in Program type */}
                        </div>
                      </div>
                      <div className="text-right text-sm text-surface-600">
                        {/* Additional metadata could go here */}
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
