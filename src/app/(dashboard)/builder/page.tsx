"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { Plus, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import type { Institution } from "@/types/database";

// Country code to flag emoji mapping
const COUNTRY_FLAGS: Record<string, string> = {
  CH: "🇨🇭",
  DE: "🇩🇪",
  AT: "🇦🇹",
  FR: "🇫🇷",
  IT: "🇮🇹",
  ES: "🇪🇸",
  NL: "🇳🇱",
  BE: "🇧🇪",
  SE: "🇸🇪",
  NO: "🇳🇴",
  DK: "🇩🇰",
  GB: "🇬🇧",
  US: "🇺🇸",
  CA: "🇨🇦",
  AU: "🇦🇺",
};

const COUNTRY_NAMES: Record<string, string> = {
  CH: "Schweiz",
  DE: "Deutschland",
  AT: "Österreich",
  FR: "Frankreich",
  IT: "Italien",
  ES: "Spanien",
  NL: "Niederlande",
  BE: "Belgien",
  SE: "Schweden",
  NO: "Norwegen",
  DK: "Dänemark",
  GB: "Großbritannien",
  US: "USA",
  CA: "Kanada",
  AU: "Australien",
};

interface InstitutionWithCounts extends Institution {
  program_count?: number;
}

export default function BuilderPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const supabase = createClient();

  const [institutions, setInstitutions] = useState<InstitutionWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInstitutions = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/academic/institutions");
      if (!response.ok) {
        throw new Error("Failed to fetch institutions");
      }
      const data = await response.json();
      setInstitutions(data.institutions || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Laden der Institutionen";
      setError(message);
      console.error("Error fetching institutions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInstitutions();
  }, []);

  const handleNewInstitution = () => {
    router.push("/builder/institution/new");
  };

  const getCountryFlag = (code: string | null) => {
    if (!code) return "🏛️";
    return COUNTRY_FLAGS[code] || "🏛️";
  };

  const getCountryName = (code: string | null) => {
    if (!code) return "Unknown";
    return COUNTRY_NAMES[code] || code;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-500" />
          <p className="text-surface-600">{t("common.loading") || "Wird geladen..."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-surface-900">
            {t("nav.builder") || "Academic Builder"}
          </h1>
          <p className="text-surface-600 mt-1">
            {t("builder.subtitle") || "Verwalte Institutionen, Programme und Module"}
          </p>
        </div>
        <button
          onClick={handleNewInstitution}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Plus className="w-5 h-5" />
          {t("builder.newInstitution") || "Neue Institution"}
        </button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="bg-red-50 border-red-200 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900">Fehler</p>
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Institutions Grid */}
      {institutions.length === 0 ? (
        <Card className="text-center py-12">
          <p className="text-surface-600 mb-4">
            {t("builder.noInstitutions") || "Noch keine Institutionen angelegt"}
          </p>
          <button
            onClick={handleNewInstitution}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            {t("builder.newInstitution") || "Neue Institution"}
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {institutions.map((inst) => (
            <Link key={inst.id} href={`/builder/institution/${inst.id}`}>
              <Card interactive padding="md">
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="text-4xl">{getCountryFlag(inst.country_code)}</div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">
                        {inst.program_count ?? 0}
                      </div>
                      <div className="text-xs text-surface-600">
                        {inst.program_count === 1 ? "Programm" : "Programme"}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-surface-900">{inst.name}</h3>
                    <p className="text-sm text-surface-600">
                      {getCountryName(inst.country_code)}
                    </p>
                    {inst.institution_type && (
                      <p className="text-xs text-surface-500 mt-1 capitalize">
                        {inst.institution_type}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
