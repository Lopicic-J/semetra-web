"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { GraduationCap, BookOpen, CheckCircle, ChevronRight, Plus, Loader2, X } from "lucide-react";
import type { Studiengang, StudiengangModuleTemplate } from "@/types/database";

const MODULE_COLORS = [
  "#6d28d9","#2563eb","#dc2626","#059669","#d97706","#db2777","#0891b2","#65a30d"
];

export default function StudiengaengePage() {
  const supabase = createClient();
  const [programmes, setProgrammes] = useState<Studiengang[]>([]);
  const [selected, setSelected] = useState<Studiengang | null>(null);
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState(false);
  const [customSemester, setCustomSemester] = useState<Record<string, string>>({});
  const [step, setStep] = useState<"choose" | "preview" | "done">("choose");

  const load = useCallback(async () => {
    const { data } = await supabase.from("studiengaenge").select("*").order("name");
    setProgrammes(data ?? []);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function pickProgram(p: Studiengang) {
    setSelected(p);
    // Init custom semester values from template
    const init: Record<string, string> = {};
    (p.modules_json ?? []).forEach((m, i) => { init[i] = m.semester; });
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

  const SEMESTER_OPTIONS = ["HS1","FS2","HS3","FS4","HS5","FS6","HS7","FS8"];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <GraduationCap className="text-violet-600" size={26} />
          Studiengänge
        </h1>
        <p className="text-gray-500 text-sm mt-1">
          Wähle deinen FFHS-Studiengang — alle Pflichtmodule werden automatisch importiert.
        </p>
      </div>

      {step === "choose" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {programmes.map(p => (
            <button
              key={p.id}
              onClick={() => pickProgram(p)}
              className="card p-5 text-left hover:shadow-md hover:border-violet-200 border border-transparent transition-all group"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                  <BookOpen className="text-violet-600" size={22} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{p.name}</p>
                  <p className="text-sm text-gray-500 mt-0.5">{p.fh} · {p.abschluss} · {p.semester_count} Semester</p>
                  <p className="text-xs text-violet-600 font-medium mt-1">{p.ects_total} ECTS · {(p.modules_json ?? []).length} Module</p>
                </div>
                <ChevronRight size={18} className="text-gray-300 group-hover:text-violet-500 mt-1 transition-colors" />
              </div>
            </button>
          ))}

          {programmes.length === 0 && (
            <div className="col-span-2 text-center py-12 text-gray-400">
              <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
              <p>Keine Studiengänge gefunden. Migration 002 ausführen?</p>
            </div>
          )}
        </div>
      )}

      {step === "preview" && selected && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setStep("choose")} className="btn-ghost text-sm gap-1">
              <X size={14} /> Abbrechen
            </button>
            <h2 className="font-semibold text-gray-800">{selected.name} — Module-Vorschau</h2>
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
                    <span className="text-sm font-medium text-gray-800">{m.name}</span>
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
            Alle Module von <strong>{selected?.name}</strong> wurden importiert.
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => { setStep("choose"); setSelected(null); }} className="btn-secondary">
              Weiteren Studiengang
            </button>
            <a href="/modules" className="btn-primary">
              Module ansehen →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
