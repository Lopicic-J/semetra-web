"use client";
import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { Plus, Loader2, AlertCircle, ChevronLeft, Save } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import type { Institution, Program } from "@/types/database";

interface InstitutionWithPrograms extends Institution {
  programs?: Program[];
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
  { code: "GB", name: "Großbritannien" },
  { code: "US", name: "USA" },
  { code: "CA", name: "Kanada" },
  { code: "AU", name: "Australien" },
];

const INSTITUTION_TYPES = ["universität", "fachhochschule", "hochschule", "akademie"];

export default function InstitutionDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [institution, setInstitution] = useState<InstitutionWithPrograms | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [countryCode, setCountryCode] = useState("CH");
  const [institutionType, setInstitutionType] = useState("fachhochschule");
  const [officialLanguage, setOfficialLanguage] = useState("de");

  useEffect(() => {
    const fetchInstitution = async () => {
      try {
        setLoading(true);
        setError(null);

        if (id === "new") {
          // Create new institution mode
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
        setCountryCode(data.institution.country_code || "CH");
        setInstitutionType(data.institution.institution_type || "fachhochschule");
        setOfficialLanguage(data.institution.official_language || "de");

        // Programs are already included in the institution GET response
        setPrograms(data.programs || []);
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
            country_code: countryCode,
            institution_type: institutionType,
            official_language: officialLanguage,
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
            country_code: countryCode,
            institution_type: institutionType,
            official_language: officialLanguage,
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
        <Card className="bg-red-50 border-red-200 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-900 mb-2">
                Land *
              </label>
              <select
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
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
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-900 mb-2">
              Unterrichtssprache
            </label>
            <select
              value={officialLanguage}
              onChange={(e) => setOfficialLanguage(e.target.value)}
              className="w-full px-4 py-2 bg-surface-50 border border-surface-300 rounded-lg text-surface-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="de">Deutsch</option>
              <option value="en">English</option>
              <option value="fr">Français</option>
              <option value="it">Italiano</option>
            </select>
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
                      <div>
                        <h3 className="font-semibold text-surface-900">{prog.name}</h3>
                        <p className="text-sm text-surface-600 mt-1">
                          {prog.degree_level && `${prog.degree_level} · `}
                          {prog.required_total_credits} ECTS
                        </p>
                      </div>
                      <div className="text-right text-sm text-surface-600">
                        {/* Module count would go here if available */}
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
