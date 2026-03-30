"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { GraduationCap, BookOpen, CheckCircle, ChevronRight, Plus, Loader2, X, Building2 } from "lucide-react";
import type { Studiengang, StudiengangModuleTemplate } from "@/types/database";

const MODULE_COLORS = [
  "#6d28d9","#2563eb","#dc2626","#059669","#d97706","#db2777","#0891b2","#65a30d"
];

const FH_INFO: Record<string, { full: string; color: string }> = {
  "FFHS":   { full: "Fernfachhochschule Schweiz",                       color: "#6d28d9" },
  "ZHAW":   { full: "Zürcher Hochschule für Angewandte Wissenschaften", color: "#2563eb" },
  "FHNW":   { full: "Fachhochschule Nordwestschweiz",                   color: "#dc2626" },
  "BFH":    { full: "Berner Fachhochschule",                            color: "#059669" },
  "OST":    { full: "Ostschweizer Fachhochschule",                      color: "#d97706" },
  "HES-SO": { full: "Haute École Spécialisée de Suisse Occidentale",    color: "#0891b2" },
};

export default function StudiengaengePage() {
  const supabase = createClient();
  const [programmes, setProgrammes] = useState<Studiengang[]>([]);
  const [selected, setSelected] = useState<Studiengang | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [customSemester, setCustomSemester] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"choose" | "preview" | "done">("choose");
  const [activeFh, setActiveFh] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from("studiengaenge").select("*").order("fh").order("name");
    setProgrammes(data ?? []);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  // Group programmes by FH
  const fhList = useMemo(() => {
    const map = new Map<string, Studiengang[]>();
    for (const p of programmes) {
      if (!map.has(p.fh)) map.set(p.fh, []);
      map.get(p.fh)!.push(p);
    }
    return Array.from(map.entries());
  }, [programmes]);

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GraduationCap className="text-violet-600" size={26} />
          FH-Voreinstellungen
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Wähle deine Fachhochschule und deinen Studiengang — alle Module werden als Voreinstellung importiert.
        </p>
      </div>

      {step === "choose" && (
        <>
          {/* FH Filter Chips */}
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setActiveFh(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeFh === null
                  ? "bg-violet-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              Alle FHs ({programmes.length})
            </button>
            {fhList.map(([fh, progs]) => (
              <button
                key={fh}
                onClick={() => setActiveFh(activeFh === fh ? null : fh)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  activeFh === fh
                    ? "text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
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
                    <p className="font-semibold text-gray-900 text-sm">{fh}</p>
                    <p className="text-xs text-gray-400">{FH_INFO[fh]?.full ?? fh}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {progs.map(p => (
                    <button
                      key={p.id}
                      onClick={() => pickProgram(p)}
                      className="card p-4 text-left hover:shadow-md hover:border-violet-200 border border-transparent transition-all group"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 opacity-90"
                          style={{ background: `${FH_INFO[fh]?.color ?? "#6d28d9"}15` }}
                        >
                          <BookOpen style={{ color: FH_INFO[fh]?.color ?? "#6d28d9" }} size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 text-sm truncate">{p.name}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{p.abschluss} · {p.semester_count} Semester</p>
                          <p className="text-xs font-medium mt-1" style={{ color: FH_INFO[fh]?.color ?? "#6d28d9" }}>
                            {p.ects_total} ECTS · {(p.modules_json ?? []).length} Module
                          </p>
                        </div>
                        <ChevronRight size={16} className="text-gray-300 group-hover:text-violet-500 mt-1 transition-colors shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {programmes.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
              <p>Keine Studiengänge gefunden. Bitte Migration 005 ausführen.</p>
            </div>
          )}
        </>
      )}

      {step === "preview" && selected && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep("choose")} className="btn-ghost text-sm gap-1">
              <X size={14} /> Zurück
            </button>
            <div>
              <h2 className="font-semibold text-gray-800">{selected.name}</h2>
              <p className="text-xs text-gray-500">{selected.fh} · {selected.abschluss} · {selected.semester_count} Semester</p>
            </div>
          </div>

          <div className="card p-0 overflow-hidden mb-6">
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 text-xs font-semibold text-gray-500 border-b border-gray-100">
              <div className="col-span-4">Modul</div>
              <div className="col-span-2">Code</div>
              <div className="col-span-2">ECTS</div>
              <div className="col-span-2">Typ</div>
              <div className="col-span-2">Semester</div>
            </div>
            <div className="divide-y divide-gray-50">
              {(selected.modules_json ?? []).map((m, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-gray-50/50">
                  <div className="col-span-4 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: m.color }} />
                    <span className="text-sm font-medium text-gray-800 truncate">{m.name}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-xs font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{m.code}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-sm text-gray-600">{m.ects} ECTS</span>
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
            <div className="text-sm text-gray-500">
              {(selected.modules_json ?? []).length} Module · {selected.ects_total} ECTS total
            </div>
            <button
              onClick={doImport}
              disabled={importing}
              className="btn-primary gap-2"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
              {importing ? "Importiere…" : "Module importieren"}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="text-green-600" size={36} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Import erfolgreich!</h2>
          <p className="text-gray-500 mb-6">
            Alle Module von <strong>{selected?.name}</strong> ({selected?.fh}) wurden importiert.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep("choose"); setSelected(null); }} className="btn-secondary">
              Weiteren Studiengang
            </button>
            <a href="/modules" className="btn-primary">
              Module ansehen
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
