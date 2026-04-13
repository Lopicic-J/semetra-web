"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { Plus, Loader2, AlertCircle, Search, X, Building2, BookOpen, GraduationCap } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import { Card } from "@/components/ui/Card";
import { useProfile } from "@/lib/hooks/useProfile";
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
  const { profile, loading: profileLoading, canAccessBuilder, isAdmin, userRole } = useProfile();

  const [institutions, setInstitutions] = useState<InstitutionWithCounts[]>([]);
  const [managedInstitutionIds, setManagedInstitutionIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("all");

  const fetchInstitutions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all institutions
      const response = await fetch("/api/academic/institutions");
      if (!response.ok) throw new Error("Failed to fetch institutions");
      const data = await response.json();
      let allInstitutions: InstitutionWithCounts[] = data.institutions || [];

      // For institution admins, also fetch their assigned institution IDs
      if (userRole === "institution" && profile?.id) {
        const { data: assignments } = await supabase
          .from("institution_admins")
          .select("institution_id")
          .eq("user_id", profile.id);

        const ids = new Set((assignments || []).map((a: { institution_id: string }) => a.institution_id));
        setManagedInstitutionIds(ids);
        // Filter to only show their managed institutions
        allInstitutions = allInstitutions.filter((inst) => ids.has(inst.id));
      }

      setInstitutions(allInstitutions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Fehler beim Laden der Institutionen";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!profileLoading && canAccessBuilder) {
      fetchInstitutions();
    }
  }, [profileLoading, canAccessBuilder, userRole]);

  // Redirect students away from builder
  useEffect(() => {
    if (!profileLoading && !canAccessBuilder) {
      router.replace("/dashboard");
    }
  }, [profileLoading, canAccessBuilder, router]);

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

  // Derived: available countries from loaded institutions
  const availableCountries = useMemo(() => {
    const codes = new Set(institutions.map(i => i.country_code).filter(Boolean));
    return Array.from(codes).sort((a, b) => {
      const nameA = COUNTRY_NAMES[a!] ?? a!;
      const nameB = COUNTRY_NAMES[b!] ?? b!;
      return nameA.localeCompare(nameB, "de");
    }) as string[];
  }, [institutions]);

  // Derived: filtered + sorted institutions
  const filtered = useMemo(() => {
    let list = [...institutions];

    // Country filter
    if (countryFilter !== "all") {
      list = list.filter(i => i.country_code === countryFilter);
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.code ?? "").toLowerCase().includes(q) ||
        (i.country_code ?? "").toLowerCase().includes(q) ||
        (COUNTRY_NAMES[i.country_code ?? ""] ?? "").toLowerCase().includes(q)
      );
    }

    // Alphabetical sort
    list.sort((a, b) => a.name.localeCompare(b.name, "de"));

    return list;
  }, [institutions, countryFilter, search]);

  if (loading || profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-brand-500" />
          <p className="text-surface-600">{t("common.loading") || "Wird geladen..."}</p>
        </div>
      </div>
    );
  }

  if (!canAccessBuilder) return null;

  return (
    <div className="p-3 sm:p-5 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-surface-900 dark:text-white">
            {t("nav.builder") || "Academic Builder"}
          </h1>
 <p className="text-surface-600 mt-1">
            {t("builder.subtitle") || "Verwalte Institutionen, Programme und Module"}
          </p>
        </div>
        {canAccessBuilder && (
          <button
            onClick={handleNewInstitution}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 dark:bg-brand-700 text-white rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors font-medium whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            {t("builder.newInstitution") || "Neue Institution"}
          </button>
        )}
      </div>

      {/* Search & Country Filter */}
      {institutions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
 <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Institution suchen..."
 className="input w-full pl-9 pr-9 bg-surface-100 text-surface-900 dark:text-white border-surface-200"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
 className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-400 hover:text-surface-600 dark:hover:text-surface-400"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Country filter */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setCountryFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                countryFilter === "all"
                  ? "bg-brand-600 dark:bg-brand-700 text-white"
 :"bg-surface-100 text-surface-600 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              Alle ({institutions.length})
            </button>
            {availableCountries.map(code => {
              const count = institutions.filter(i => i.country_code === code).length;
              return (
                <button
                  key={code}
                  onClick={() => setCountryFilter(code === countryFilter ? "all" : code)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    countryFilter === code
                      ? "bg-brand-600 dark:bg-brand-700 text-white"
 :"bg-surface-100 text-surface-600 hover:bg-surface-200 dark:hover:bg-surface-700"
                  }`}
                >
                  {COUNTRY_FLAGS[code] || ""} {COUNTRY_NAMES[code] || code} ({count})
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats Summary */}
      {institutions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
 <Card padding="sm" className="">
            <div className="flex items-center gap-3 px-1">
              <div className="p-2 rounded-lg bg-brand-50 dark:bg-brand-900/30">
                <Building2 className="w-5 h-5 text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-surface-900 dark:text-white">{institutions.length}</div>
 <div className="text-xs text-surface-500">Institutionen</div>
              </div>
            </div>
          </Card>
 <Card padding="sm" className="">
            <div className="flex items-center gap-3 px-1">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/30">
                <GraduationCap className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-surface-900 dark:text-white">
                  {institutions.reduce((sum, i) => sum + (i.program_count ?? 0), 0)}
                </div>
 <div className="text-xs text-surface-500">Programme</div>
              </div>
            </div>
          </Card>
 <Card padding="sm" className=" col-span-2 sm:col-span-1">
            <div className="flex items-center gap-3 px-1">
              <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                <BookOpen className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <div className="text-xl font-bold text-surface-900 dark:text-white">
                  {availableCountries.length}
                </div>
 <div className="text-xs text-surface-500">Länder</div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium text-red-900 dark:text-red-300">Fehler</p>
              <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Institutions Grid */}
      {institutions.length === 0 ? (
 <Card className="text-center py-12">
 <Building2 size={36} className="mx-auto mb-3 text-surface-300" />
 <p className="text-surface-600 mb-4">
            {t("builder.noInstitutions") || "Noch keine Institutionen angelegt"}
          </p>
          <button
            onClick={handleNewInstitution}
            className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 dark:bg-brand-700 text-white rounded-lg hover:bg-brand-700 dark:hover:bg-brand-600 transition-colors font-medium"
          >
            <Plus className="w-5 h-5" />
            {t("builder.newInstitution") || "Neue Institution"}
          </button>
        </Card>
      ) : filtered.length === 0 ? (
 <Card className="text-center py-12">
 <Search size={36} className="mx-auto mb-3 text-surface-300 opacity-50" />
 <p className="text-surface-600 mb-1 font-medium">Keine Ergebnisse</p>
 <p className="text-surface-400 text-sm">
            {search ? `Keine Institution für "${search}" gefunden.` : "Keine Institutionen in diesem Land."}
          </p>
          <button
            onClick={() => { setSearch(""); setCountryFilter("all"); }}
            className="mt-3 text-sm text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium"
          >
            Filter zurücksetzen
          </button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map((inst) => {
            const typeLabel = inst.institution_type === "university_of_applied_sciences" ? "Fachhochschule"
              : inst.institution_type === "university" ? "Universität"
              : inst.institution_type === "college" ? "Hochschule"
              : inst.institution_type === "polytechnic" ? "Polytechnikum"
              : inst.institution_type || "";
            return (
              <Link key={inst.id} href={`/builder/institution/${inst.id}`}>
 <Card interactive padding="md" className=" h-full">
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-3xl">{getCountryFlag(inst.country_code)}</div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-brand-600 dark:text-brand-400">
                          {inst.program_count ?? 0}
                        </div>
 <div className="text-[10px] text-surface-500 uppercase tracking-wide">
                          {(inst.program_count ?? 0) === 1 ? "Programm" : "Programme"}
                        </div>
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-surface-900 dark:text-white leading-tight">{inst.name}</h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
 <span className="text-xs text-surface-500">
                          {getCountryName(inst.country_code)}
                        </span>
                        {typeLabel && (
                          <>
 <span className="text-surface-300">·</span>
 <span className="text-xs text-surface-500">{typeLabel}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
