"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/lib/hooks/useProfile";
import { useGradingSystem } from "@/lib/hooks/useGradingSystem";
import { GraduationCap, BookOpen, CheckCircle, ChevronRight, Plus, Loader2, X, Building2, Lock } from "lucide-react";
import { ProGate } from "@/components/ui/ProGate";
import type { Studiengang, StudiengangModuleTemplate } from "@/types/database";
import { useTranslation } from "@/lib/i18n";
import { useTheme } from "@/components/providers/ThemeProvider";

const MODULE_COLORS = [
  "#6d28d9","#2563eb","#dc2626","#059669","#d97706","#db2777","#0891b2","#65a30d"
];

const FH_INFO: Record<string, { full: string; color: string }> = {
  // CH
  "FFHS":   { full: "Fernfachhochschule Schweiz",                       color: "#6d28d9" },
  "ZHAW":   { full: "Zürcher Hochschule für Angewandte Wissenschaften", color: "#2563eb" },
  "FHNW":   { full: "Fachhochschule Nordwestschweiz",                   color: "#dc2626" },
  "BFH":    { full: "Berner Fachhochschule",                            color: "#059669" },
  "OST":    { full: "Ostschweizer Fachhochschule",                      color: "#d97706" },
  "HES-SO": { full: "Haute École Spécialisée de Suisse Occidentale",    color: "#0891b2" },
  "HSLU":   { full: "Hochschule Luzern",                                color: "#7c3aed" },
  "FHGR":   { full: "Fachhochschule Graubünden",                        color: "#0d9488" },
  "SUPSI":  { full: "Scuola Universitaria della Svizzera Italiana",     color: "#ea580c" },
  // DE
  "TH Köln":     { full: "Technische Hochschule Köln",                  color: "#e11d48" },
  "HAW Hamburg":  { full: "Hochschule für Angewandte Wissenschaften Hamburg", color: "#1d4ed8" },
  "DHBW":         { full: "Duale Hochschule Baden-Württemberg",         color: "#b91c1c" },
  "FH Aachen":    { full: "Fachhochschule Aachen",                      color: "#15803d" },
  // AT
  "FH Technikum Wien": { full: "FH Technikum Wien",                     color: "#7c2d12" },
  "FH Campus Wien":    { full: "FH Campus Wien",                        color: "#4338ca" },
  "FH Joanneum":       { full: "FH Joanneum Graz",                      color: "#0f766e" },
  // FR
  "IUT Paris":   { full: "Institut Universitaire de Technologie Paris",  color: "#1e40af" },
  "INSA Lyon":   { full: "Institut National des Sciences Appliquées Lyon", color: "#9f1239" },
  "École 42":    { full: "École 42 Paris",                               color: "#171717" },
  // IT
  "Politecnico di Milano": { full: "Politecnico di Milano",             color: "#1e3a5f" },
  "Sapienza Roma":         { full: "Sapienza Università di Roma",       color: "#7f1d1d" },
  "Università di Bologna": { full: "Alma Mater Studiorum Bologna",     color: "#92400e" },
  // NL
  "HvA Amsterdam": { full: "Hogeschool van Amsterdam",                  color: "#ea580c" },
  "Fontys":        { full: "Fontys Hogescholen",                        color: "#7c3aed" },
  // ES
  "UPM Madrid":   { full: "Universidad Politécnica de Madrid",          color: "#1e3a5f" },
  "UPC Barcelona": { full: "Universitat Politècnica de Catalunya",      color: "#0369a1" },
  // UK
  "Imperial College":          { full: "Imperial College London",       color: "#1e3a5f" },
  "University of Manchester":  { full: "University of Manchester",      color: "#7c2d12" },
};

const COUNTRY_TABS: { code: string; flag: string; label: string }[] = [
  { code: "CH", flag: "🇨🇭", label: "Schweiz" },
  { code: "DE", flag: "🇩🇪", label: "Deutschland" },
  { code: "AT", flag: "🇦🇹", label: "Österreich" },
  { code: "FR", flag: "🇫🇷", label: "France" },
  { code: "IT", flag: "🇮🇹", label: "Italia" },
  { code: "NL", flag: "🇳🇱", label: "Nederland" },
  { code: "ES", flag: "🇪🇸", label: "España" },
  { code: "UK", flag: "🇬🇧", label: "UK" },
];

export default function StudiengaengePage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { isPro, loading: profileLoading } = useProfile();
  const gs = useGradingSystem();
  const { resolvedMode } = useTheme();
  const isDark = resolvedMode === "dark";

  const [programmes, setProgrammes] = useState<Studiengang[]>([]);
  const [selected, setSelected] = useState<Studiengang | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [customSemester, setCustomSemester] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"choose" | "preview" | "done">("choose");
  const [activeFh, setActiveFh] = useState<string | null>(null);
  const [activeCountry, setActiveCountry] = useState<string>(gs.country);

  const load = useCallback(async () => {
    const { data } = await supabase.from("studiengaenge").select("*").order("fh").order("name");
    setProgrammes(data ?? []);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Filter by country first
  const countryProgrammes = useMemo(() =>
    programmes.filter(p => (p.country ?? "CH") === activeCountry),
    [programmes, activeCountry]
  );

  // Group programmes by FH
  const fhList = useMemo(() => {
    const map = new Map<string, Studiengang[]>();
    for (const p of countryProgrammes) {
      if (!map.has(p.fh)) map.set(p.fh, []);
      map.get(p.fh)!.push(p);
    }
    return Array.from(map.entries());
  }, [countryProgrammes]);

  // Filtered list
  const visibleFhs = activeFh ? fhList.filter(([fh]) => fh === activeFh) : fhList;

  // Map legacy semester codes (HS1, FS2, HS3…) to "Semester N"
  function normalizeSemester(raw: string, semCount: number): string {
    const match = raw.match(/[HF]S?(\d+)/i);
    if (match) {
      const n = parseInt(match[1]);
      if (n >= 1 && n <= semCount) return `Semester ${n}`;
    }
    if (raw.startsWith("Semester ")) return raw;
    return `Semester 1`;
  }

  // Country tabs with translated labels
  const COUNTRY_TABS_LOCALIZED = [
    { code: "CH", flag: "🇨🇭", label: t("studiengaenge.countrySwiss") },
    { code: "DE", flag: "🇩🇪", label: t("studiengaenge.countryGermany") },
    { code: "AT", flag: "🇦🇹", label: t("studiengaenge.countryAustria") },
    { code: "FR", flag: "🇫🇷", label: t("studiengaenge.countryFrance") },
    { code: "IT", flag: "🇮🇹", label: t("studiengaenge.countryItaly") },
    { code: "NL", flag: "🇳🇱", label: t("studiengaenge.countryNetherlands") },
    { code: "ES", flag: "🇪🇸", label: t("studiengaenge.countrySpain") },
    { code: "UK", flag: "🇬🇧", label: t("studiengaenge.countryUk") },
  ];

  function pickProgram(p: Studiengang) {
    setSelected(p);
    const init: Record<string, string> = {};
    const semCount = p.semester_count ?? 6;
    (p.modules_json ?? []).forEach((m, i) => {
      init[i] = normalizeSemester(m.semester, semCount);
    });
    setCustomSemester(init);
    setStep("preview");
    setImported(false);
  }

  async function doImport() {
    if (!selected?.modules_json) return;
    setImporting(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setImporting(false); return; }

    const rows = selected.modules_json.map((m, i) => ({
      user_id: user.id,
      name: m.name,
      code: m.code,
      ects: m.ects,
      semester: customSemester[i] ?? m.semester,
      module_type: m.module_type,
      color: m.color,
      status: "planned",
      in_plan: true,
    }));

    await supabase.from("modules").insert(rows);
    setImporting(false);
    setImported(true);
    setStep("done");
  }

  // Dynamic semester options based on selected program
  const semesterCount = selected?.semester_count ?? 6;
  const SEMESTER_OPTIONS = Array.from({ length: semesterCount }, (_, i) => `Semester ${i + 1}`);

  // Pro gate: FH import is Pro-only
  if (!isPro) {
    return (
 <div className="p-3 sm:p-5 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <GraduationCap className="text-brand-600" size={26} />
            {t("studiengaenge.title")}
          </h1>
 <p className="text-surface-500 text-sm mt-1">
            {t("studiengaenge.subtitle")}
          </p>
        </div>
        <ProGate feature="fhImportAll" isPro={false}>
          <div />
        </ProGate>
      </div>
    );
  }

  // Modul-Katalog ist Pro-Feature. Free-User sehen einen Upgrade-Hinweis.
  if (!profileLoading && !isPro) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <div className="max-w-md text-center bg-[rgb(var(--card-bg))] rounded-2xl border border-surface-200 dark:border-surface-700 p-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white mb-4">
            <Lock size={22} />
          </div>
          <h1 className="text-xl font-bold text-surface-900 dark:text-white mb-2">
            Modul-Katalog
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mb-6">
            Mit Pro wählst du deinen Studiengang aus dem Katalog — wir laden automatisch alle
            Module (Name, Kürzel, ECTS, Semester) für dich ein. Spart dir Stunden manueller Arbeit.
          </p>
          <a
            href="/upgrade"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-600 to-brand-700 hover:from-brand-700 hover:to-brand-800 text-white font-semibold text-sm transition"
          >
            Upgrade zu Pro
          </a>
        </div>
      </div>
    );
  }

  return (
 <div className="p-3 sm:p-5 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
          <GraduationCap className="text-brand-600" size={26} />
          {t("studiengaenge.title")}
        </h1>
 <p className="text-surface-500 text-sm mt-1">
          {t("studiengaenge.subtitle")}
        </p>
      </div>

      {step === "choose" && (
        <>
          {/* Country Tabs */}
 <div className="flex flex-wrap gap-1.5 mb-5 pb-3 border-b border-surface-100">
            {COUNTRY_TABS_LOCALIZED.map(ct => (
              <button
                key={ct.code}
                onClick={() => { setActiveCountry(ct.code); setActiveFh(null); }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeCountry === ct.code
                    ? "bg-brand-600 text-white"
 :"bg-surface-50 text-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700"
                }`}
              >
                {ct.flag} {ct.label}
              </button>
            ))}
          </div>

          {/* FH Filter Chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveFh(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeFh === null
                  ? "bg-brand-600 text-white"
 :"bg-surface-100 text-surface-600 hover:bg-surface-200 dark:hover:bg-surface-700"
              }`}
            >
              {t("studiengaenge.all", { count: countryProgrammes.length })}
            </button>
            {fhList.map(([fh, progs]) => (
              <button
                key={fh}
                onClick={() => setActiveFh(activeFh === fh ? null : fh)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeFh === fh
                    ? "text-white"
 :"bg-surface-100 text-surface-600 hover:bg-surface-200 dark:hover:bg-surface-700"
                }`}
                style={activeFh === fh ? { background: FH_INFO[fh]?.color ?? "#6d28d9" } : undefined}
              >
                {fh} ({progs.length})
              </button>
            ))}
          </div>

          {/* FH Groups */}
          <div className="space-y-8">
            {visibleFhs.map(([fh, progs]) => (
              <div key={fh}>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                    style={{ background: FH_INFO[fh]?.color ?? "#6d28d9" }}
                  >
                    <Building2 size={16} />
                  </div>
                  <div>
                    <p className="font-semibold text-surface-900 dark:text-white text-sm">{fh}</p>
 <p className="text-xs text-surface-400">{FH_INFO[fh]?.full ?? fh}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {progs.map(p => (
                    <button
                      key={p.id}
                      onClick={() => pickProgram(p)}
 className="card p-3 sm:p-4 text-left hover:shadow-md hover:border-brand-200 dark:hover:border-brand-700 border border-transparent transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 opacity-90"
                          style={{ background: `${FH_INFO[fh]?.color ?? "#6d28d9"}${isDark ? "30" : "15"}` }}
                        >
                          <BookOpen style={{ color: FH_INFO[fh]?.color ?? "#6d28d9" }} size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-surface-900 dark:text-white text-sm truncate">{p.name}</p>
 <p className="text-xs text-surface-500 mt-0.5">{p.abschluss} · {p.semester_count} Semester</p>
                          <p className="text-xs font-medium mt-1" style={{ color: isDark ? `${FH_INFO[fh]?.color ?? "#6d28d9"}dd` : (FH_INFO[fh]?.color ?? "#6d28d9") }}>
                            {p.ects_total} {gs.creditLabel} · {(p.modules_json ?? []).length} Module
                          </p>
                        </div>
 <ChevronRight size={16} className="text-surface-300 group-hover:text-brand-500 mt-1 transition-colors shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {countryProgrammes.length === 0 && programmes.length > 0 && (
 <div className="text-center py-12 text-surface-400">
              <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t("studiengaenge.noProgrammes")}</p>
            </div>
          )}

          {programmes.length === 0 && (
 <div className="text-center py-12 text-surface-400">
              <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
              <p>{t("studiengaenge.noProgrammesFound")}</p>
            </div>
          )}

          {/* Legal Disclaimer */}
 <div className="mt-8 pt-6 border-t border-surface-100">
 <p className="text-[11px] text-surface-400 leading-relaxed">
              {t("studiengaenge.disclaimer")}
            </p>
          </div>
        </>
      )}

      {step === "preview" && selected && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep("choose")} className="btn-ghost text-sm gap-1">
              <X size={14} /> {t("studiengaenge.modal.back")}
            </button>
            <div>
              <h2 className="font-semibold text-surface-800 dark:text-white">{selected.name}</h2>
 <p className="text-xs text-surface-500">{selected.fh} · {selected.abschluss} · {selected.semester_count} Semester</p>
            </div>
          </div>

 <div className="card p-0 overflow-hidden mb-6">
 <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-surface-50 text-xs font-semibold text-surface-500 border-b border-surface-100">
              <div className="col-span-4">{t("studiengaenge.modal.module")}</div>
              <div className="col-span-2">{t("studiengaenge.modal.code")}</div>
              <div className="col-span-2">{gs.creditLabel}</div>
              <div className="col-span-2">{t("studiengaenge.modal.type")}</div>
              <div className="col-span-2">Semester</div>
            </div>
 <div className="divide-y divide-surface-50">
              {(selected.modules_json ?? []).map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-surface-50/50 dark:hover:bg-surface-700/50">
                  <div className="col-span-4 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                    <span className="text-sm font-medium text-surface-800 dark:text-white truncate">{m.name}</span>
                  </div>
                  <div className="col-span-2">
 <span className="text-xs font-mono bg-surface-100 text-surface-600 px-1.5 py-0.5 rounded">{m.code}</span>
                  </div>
                  <div className="col-span-2">
 <span className="text-sm text-surface-600">{m.ects}</span>
                  </div>
                  <div className="col-span-2">
                    <span className={`badge text-[10px] ${m.module_type === "pflicht" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                      {m.module_type}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <select
                      className="input py-0.5 text-xs"
                      value={customSemester[i] ?? m.semester}
                      onChange={e => setCustomSemester(s => ({ ...s, [i]: e.target.value }))}
                    >
                      {SEMESTER_OPTIONS.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
 <div className="text-sm text-surface-500">
              {t("studiengaenge.modal.modulesTotal", { count: (selected.modules_json ?? []).length, credits: selected.ects_total, creditLabel: gs.creditLabel })}
            </div>
            <button
              onClick={doImport}
              disabled={importing}
              className="btn-primary gap-2"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {importing ? t("studiengaenge.modal.importing") : t("studiengaenge.modal.import")}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-950 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600 dark:text-green-400" size={36} />
          </div>
          <h2 className="text-xl font-bold text-surface-900 dark:text-white mb-2">{t("studiengaenge.modal.successTitle")}</h2>
 <p className="text-surface-500 mb-6">
            {t("studiengaenge.modal.successSubtitle", { programme: selected?.name ?? "", fh: selected?.fh ?? "" })}
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep("choose"); setSelected(null); }} className="btn-secondary">
              {t("studiengaenge.modal.anotherProgram")}
            </button>
            <a href="/modules" className="btn-primary">
              {t("studiengaenge.modal.viewModules")}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
