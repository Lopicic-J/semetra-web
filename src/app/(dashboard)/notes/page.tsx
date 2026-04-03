"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { FREE_LIMITS, withinFreeLimit } from "@/lib/gates";
import { LimitNudge, LimitCounter, UpgradeModal } from "@/components/ui/ProGate";
import {
  Plus, Trash2, Pencil, X, ArrowLeft, Save, FileText,
  Pin, PinOff, Search, Filter, BookOpen, CheckSquare, Square,
  Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2,
  AlignLeft, AlignCenter, Link2, Strikethrough, GripVertical,
  ChevronDown, Clock, CheckCircle2, FileEdit, LayoutGrid, ListIcon,
  StickyNote, FolderOpen, CircleDot, Timer, GraduationCap,
  GitBranch, ArrowDown, Workflow, Tag, FolderPlus, Layers
} from "lucide-react";
import type {
  Note, NoteStatus, NoteChecklistItem,
  CalendarEvent, Task, Module, TimeLog
} from "@/types/database";
import { useTranslation } from "@/lib/i18n";

/* ── Unified note item for Flow view ─────────────────────────────── */
interface FlowItem {
  id: string;
  type: "note" | "module" | "timer" | "exam";
  title: string;
  content: string;
  date: string;
  module_name?: string;
  module_color?: string;
  color: string;
  status?: NoteStatus;
  source_label: string;
  pinned?: boolean;
  original?: Note;
}

const getStatusConfig = (t: (key: string) => string): Record<NoteStatus, { label: string; color: string; icon: React.ReactNode }> => ({
  draft:       { label: t("notes.statusDraft"),       color: "#a1a1aa", icon: <FileEdit size={12} /> },
  in_progress: { label: t("notes.statusInProgress"),  color: "#f59e0b", icon: <Clock size={12} /> },
  done:        { label: t("notes.statusDone"),        color: "#22c55e", icon: <CheckCircle2 size={12} /> },
});

const NOTE_COLORS = [
  "#6d28d9","#2563eb","#059669","#dc2626","#d97706",
  "#db2777","#0891b2","#7c3aed","#16a34a","#ea580c",
];

const FLOW_ICONS: Record<string, React.ReactNode> = {
  note: <FileText size={14} />,
  module: <BookOpen size={14} />,
  timer: <Timer size={14} />,
  exam: <GraduationCap size={14} />,
};

const FLOW_TYPE_COLORS: Record<string, string> = {
  note: "#a78bfa",
  module: "#60a5fa",
  timer: "#22d3ee",
  exam: "#fbbf24",
};

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function NotesPage() {

  const { t } = useTranslation();
  const supabase = createClient();
  const { modules } = useModules();
  const { isPro } = useProfile();
  const STATUS_CONFIG = getStatusConfig(t);
  const [notes, setNotes] = useState<Note[]>([]);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterStatus, setFilterStatus] = useState<NoteStatus | "">("");
  const [filterSource, setFilterSource] = useState<"" | "note" | "module" | "timer" | "exam">("");
  const [filterUnlinked, setFilterUnlinked] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list" | "flow">("flow");
  const [flowItems, setFlowItems] = useState<FlowItem[]>([]);
  // Custom Rubriken
  const [rubriken, setRubriken] = useState<{ id: string; name: string; color: string }[]>([]);
  const [filterRubrik, setFilterRubrik] = useState("");
  const [showRubrikCreate, setShowRubrikCreate] = useState(false);

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from("notes")
      .select("*, module:modules(id,name,color)")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    setNotes((data ?? []) as Note[]);
    setLoading(false);
  }, [supabase]);

  const fetchRubriken = useCallback(async () => {
    const { data } = await supabase.from("note_categories").select("*").order("sort_order");
    setRubriken(data ?? []);
  }, [supabase]);

  // Fetch all note sources for flow view
  const fetchFlowItems = useCallback(async () => {
    const items: FlowItem[] = [];

    // 1. Own notes (from notes table)
    const { data: ownNotes } = await supabase
      .from("notes")
      .select("*, module:modules(id,name,color)")
      .order("updated_at", { ascending: false });
    (ownNotes ?? []).forEach((n: any) => {
      items.push({
        id: "note-" + n.id,
        type: "note",
        title: n.title,
        content: n.content?.replace(/<[^>]*>/g, "").slice(0, 200) ?? "",
        date: n.updated_at,
        module_name: n.module?.name,
        module_color: n.module?.color,
        color: n.color ?? "#6d28d9",
        status: n.status,
        source_label: "Notizen",
        pinned: n.pinned,
        original: n as Note,
      });
    });

    // 2. Module notes (modules.notes field)
    const { data: mods } = await supabase
      .from("modules")
      .select("id,name,color,notes,updated_at:created_at")
      .not("notes", "is", null)
      .neq("notes", "");
    (mods ?? []).forEach((m: any) => {
      items.push({
        id: "mod-" + m.id,
        type: "module",
        title: `Modul-Notiz: ${m.name}`,
        content: (m.notes ?? "").slice(0, 200),
        date: m.updated_at ?? m.created_at,
        module_name: m.name,
        module_color: m.color,
        color: m.color ?? "#2563eb",
        source_label: "Modul",
      });
    });

    // 3. Timer session notes (time_logs.note field)
    const { data: logs } = await supabase
      .from("time_logs")
      .select("id,note,started_at,duration_seconds,module_id,module:modules(id,name,color)")
      .not("note", "is", null)
      .neq("note", "")
      .order("started_at", { ascending: false })
      .limit(50);
    (logs ?? []).forEach((l: any) => {
      const mins = Math.round((l.duration_seconds ?? 0) / 60);
      items.push({
        id: "timer-" + l.id,
        type: "timer",
        title: `Timer-Notiz (${mins} Min.)`,
        content: (l.note ?? "").slice(0, 200),
        date: l.started_at,
        module_name: l.module?.name,
        module_color: l.module?.color,
        color: "#0891b2",
        source_label: "Timer",
      });
    });

    // 4. Exam attachment notes (exam_attachments with kind='note')
    const { data: examNotes } = await supabase
      .from("exam_attachments")
      .select("id,label,content,created_at,exam_id")
      .eq("kind", "note")
      .order("created_at", { ascending: false });
    (examNotes ?? []).forEach((en: any) => {
      items.push({
        id: "exam-" + en.id,
        type: "exam",
        title: en.label || t("notes.typeExamNote"),
        content: (en.content ?? "").slice(0, 200),
        date: en.created_at,
        color: "#d97706",
        source_label: "Prüfung",
      });
    });

    // Sort by date descending, pinned first
    items.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    setFlowItems(items);
  }, [supabase]);

  useEffect(() => {
    fetchNotes();
    fetchFlowItems();
    fetchRubriken();
    supabase.from("events").select("*").eq("event_type", "exam").then(r => setExams(r.data ?? []));
    supabase.from("tasks").select("*").then(r => setTasks(r.data ?? []));
  }, [supabase, fetchNotes, fetchFlowItems, fetchRubriken]);

  const filtered = useMemo(() => {
    let list = notes;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }
    if (filterModule) list = list.filter(n => n.module_id === filterModule);
    if (filterStatus) list = list.filter(n => n.status === filterStatus);
    return list;
  }, [notes, searchQ, filterModule, filterStatus]);

  // Stats for overview
  const stats = useMemo(() => ({
    total: notes.length,
    draft: notes.filter(n => n.status === "draft").length,
    inProgress: notes.filter(n => n.status === "in_progress").length,
    done: notes.filter(n => n.status === "done").length,
    byModule: modules.map(m => ({
      module: m,
      count: notes.filter(n => n.module_id === m.id).length,
    })).filter(x => x.count > 0).sort((a, b) => b.count - a.count),
    unlinked: notes.filter(n => !n.module_id && !n.exam_id && !n.task_id).length,
    fromModules: flowItems.filter(i => i.type === "module").length,
    fromTimer: flowItems.filter(i => i.type === "timer").length,
    fromExams: flowItems.filter(i => i.type === "exam").length,
  }), [notes, modules, flowItems]);

  if (activeNote) {
    return (
      <NoteEditor
        note={activeNote}
        modules={modules}
        exams={exams}
        tasks={tasks}
        onBack={() => { setActiveNote(null); fetchNotes(); }}
      />
    );
  }

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-0 sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 flex items-center gap-2">
            <FileText className="text-amber-400" /> {t("notes.title")}
          </h1>
          <p className="text-surface-500 text-xs sm:text-sm mt-1">Alle Notizen an einem Ort — geordnet nach Modul, Aufgabe & Prüfung</p>
        </div>
        <div className="flex items-center gap-3">
          <LimitCounter current={notes.length} max={FREE_LIMITS.notes} isPro={isPro} />
          <button
            onClick={() => {
              const check = withinFreeLimit("notes", notes.length, isPro);
              if (!check.allowed) { setShowUpgrade(true); return; }
              setShowCreate(true);
            }}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
          >
            <Plus size={16} /> {t("notes.newNote")}
          </button>
        </div>
      </div>

      <LimitNudge current={notes.length} max={FREE_LIMITS.notes} isPro={isPro} label="Notizen" />

      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
        <button
          onClick={() => setViewMode("flow")}
          className={`bg-white border rounded-xl p-2 sm:p-3 text-center transition ${viewMode === "flow" ? "border-brand-500" : "border-surface-200 hover:border-surface-300"}`}
        >
          <p className="text-lg sm:text-2xl font-bold text-surface-900">{flowItems.length}</p>
          <p className="text-xs text-surface-500">Alle Notizen</p>
          {(stats.fromModules + stats.fromTimer + stats.fromExams) > 0 && (
            <p className="text-xs text-surface-400 mt-0.5">
              +{stats.fromModules + stats.fromTimer + stats.fromExams} aus anderen Quellen
            </p>
          )}
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === "draft" ? "" : "draft")}
          className={`bg-white border rounded-xl p-2 sm:p-3 text-center transition ${filterStatus === "draft" ? "border-surface-300" : "border-surface-200 hover:border-surface-300"}`}
        >
          <p className="text-lg sm:text-2xl font-bold text-surface-500">{stats.draft}</p>
          <p className="text-xs text-surface-500">{t("notes.statusDraft")}</p>
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === "in_progress" ? "" : "in_progress")}
          className={`bg-white border rounded-xl p-2 sm:p-3 text-center transition ${filterStatus === "in_progress" ? "border-amber-500" : "border-surface-200 hover:border-surface-300"}`}
        >
          <p className="text-lg sm:text-2xl font-bold text-amber-400">{stats.inProgress}</p>
          <p className="text-xs text-surface-500">{t("notes.statusInProgress")}</p>
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === "done" ? "" : "done")}
          className={`bg-white border rounded-xl p-2 sm:p-3 text-center transition ${filterStatus === "done" ? "border-green-500" : "border-surface-200 hover:border-surface-300"}`}
        >
          <p className="text-lg sm:text-2xl font-bold text-green-400">{stats.done}</p>
          <p className="text-xs text-surface-500">{t("notes.statusDone")}</p>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-surface-200 rounded-xl p-3 sm:p-4 space-y-3">
        {/* Row 1: Search + View Toggle + New Note (compact) */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative flex-1 min-w-[160px]">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder={t("notes.search")}
              className="w-full bg-surface-50 border border-surface-200 rounded-lg pl-10 pr-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none transition"
            />
          </div>
          <div className="flex rounded-lg overflow-hidden border border-surface-200">
            {(["flow", "grid", "list"] as const).map(mode => {
              const icons = { flow: <Workflow size={15} />, grid: <LayoutGrid size={15} />, list: <ListIcon size={15} /> };
              const titles = { flow: t("notes.viewFlow"), grid: t("notes.viewCards"), list: t("notes.viewList") };
              return (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`p-2 transition ${viewMode === mode ? "bg-brand-600 text-white" : "bg-white text-surface-500 hover:text-surface-900"}`}
                  title={titles[mode]}
                >
                  {icons[mode]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Module Filter Chips */}
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs font-medium text-surface-500 mr-1"><Layers size={12} className="inline mr-0.5" /> Module:</span>
          <button
            onClick={() => { setFilterModule(""); setFilterUnlinked(false); }}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
              !filterModule && !filterUnlinked ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"
            }`}
          >
            Alle
          </button>
          {modules.map(m => {
            const count = flowItems.filter(i => i.module_name === m.name).length;
            return (
              <button
                key={m.id}
                onClick={() => { setFilterModule(filterModule === m.id ? "" : m.id); setFilterUnlinked(false); }}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                  filterModule === m.id ? "ring-2 ring-offset-1" : "hover:brightness-110"
                }`}
                style={{ backgroundColor: m.color + "20", color: m.color, ...(filterModule === m.id ? { ringColor: m.color } : {}) }}
              >
                <CircleDot size={8} /> {m.name}{count > 0 ? ` (${count})` : ""}
              </button>
            );
          })}
          <button
            onClick={() => { setFilterUnlinked(!filterUnlinked); setFilterModule(""); }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
              filterUnlinked ? "bg-surface-700 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"
            }`}
          >
            <StickyNote size={8} /> Allgemein
          </button>
        </div>

        {/* Row 3: Source Type + Rubriken + Status filters */}
        <div className="flex gap-1.5 flex-wrap items-center">
          <span className="text-xs font-medium text-surface-500 mr-1"><Filter size={12} className="inline mr-0.5" /> Quelle:</span>
          {([
            { key: "", label: "Alle", icon: null },
            { key: "note", label: "Notizen", icon: FLOW_ICONS.note },
            { key: "module", label: "Modul", icon: FLOW_ICONS.module },
            { key: "timer", label: "Timer", icon: FLOW_ICONS.timer },
            { key: "exam", label: "Prüfung", icon: FLOW_ICONS.exam },
          ] as const).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setFilterSource(key as any)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                filterSource === key ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"
              }`}
            >
              {icon} {label}
            </button>
          ))}

          <div className="w-px h-4 bg-surface-200 mx-1" />

          <span className="text-xs font-medium text-surface-500 mr-1"><Tag size={12} className="inline mr-0.5" /> Rubrik:</span>
          <button
            onClick={() => setFilterRubrik("")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${
              !filterRubrik ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-600 hover:bg-surface-200"
            }`}
          >
            Alle
          </button>
          {rubriken.map(r => (
            <button
              key={r.id}
              onClick={() => setFilterRubrik(filterRubrik === r.id ? "" : r.id)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition ${
                filterRubrik === r.id ? "ring-2 ring-offset-1" : "hover:brightness-110"
              }`}
              style={{ backgroundColor: r.color + "20", color: r.color }}
            >
              <Tag size={8} /> {r.name}
            </button>
          ))}
          <button
            onClick={() => setShowRubrikCreate(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-surface-50 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition border border-dashed border-surface-300"
          >
            <FolderPlus size={10} /> Neue Rubrik
          </button>
        </div>

        {/* Active filters summary + reset */}
        {(filterModule || filterStatus || filterSource || filterRubrik || filterUnlinked || searchQ) && (
          <div className="flex items-center gap-2 pt-1 border-t border-surface-100">
            <span className="text-xs text-surface-400">Aktive Filter:</span>
            {searchQ && <span className="text-xs bg-surface-100 px-2 py-0.5 rounded-full text-surface-600">Suche: "{searchQ}"</span>}
            {filterModule && <span className="text-xs bg-brand-100 px-2 py-0.5 rounded-full text-brand-700">{modules.find(m => m.id === filterModule)?.name}</span>}
            {filterUnlinked && <span className="text-xs bg-surface-200 px-2 py-0.5 rounded-full text-surface-700">Allgemein</span>}
            {filterSource && <span className="text-xs bg-surface-100 px-2 py-0.5 rounded-full text-surface-600">{({ note: "Notizen", module: "Modul", timer: "Timer", exam: "Prüfung" } as any)[filterSource]}</span>}
            {filterStatus && <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: STATUS_CONFIG[filterStatus].color + "20", color: STATUS_CONFIG[filterStatus].color }}>{STATUS_CONFIG[filterStatus].label}</span>}
            {filterRubrik && <span className="text-xs bg-surface-100 px-2 py-0.5 rounded-full text-surface-600">{rubriken.find(r => r.id === filterRubrik)?.name}</span>}
            <button
              onClick={() => { setFilterModule(""); setFilterStatus(""); setSearchQ(""); setFilterSource(""); setFilterRubrik(""); setFilterUnlinked(false); }}
              className="text-xs text-red-500 hover:text-red-700 ml-auto"
            >
              Alle zurücksetzen
            </button>
          </div>
        )}
      </div>

      {/* Notes list */}
      {loading ? (
        <p className="text-surface-500 text-sm">Laden...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto mb-4 text-surface-300" />
          <p className="text-surface-500">{notes.length === 0 ? t("notes.noNotes") : t("notes.noNotesFound")}</p>
          <p className="text-sm mt-1 text-surface-400">
            {notes.length === 0 ? t("notes.createFirst") : t("notes.tryOtherSearch")}
          </p>
        </div>
      ) : viewMode === "flow" ? (
        <FlowView
          items={flowItems.filter(item => {
            if (searchQ) {
              const q = searchQ.toLowerCase();
              if (!item.title.toLowerCase().includes(q) && !item.content.toLowerCase().includes(q)) return false;
            }
            if (filterModule && item.module_name !== modules.find(m => m.id === filterModule)?.name) return false;
            if (filterUnlinked && item.module_name) return false;
            if (filterSource && item.type !== filterSource) return false;
            if (filterRubrik && item.type === "note" && item.original?.category_id !== filterRubrik) return false;
            if (filterRubrik && item.type !== "note") return false;
            return true;
          })}
          onOpenNote={(note) => setActiveNote(note)}
        />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(note => (
            <NoteCard key={note.id} note={note} modules={modules} onClick={() => setActiveNote(note)} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(note => (
            <NoteListRow key={note.id} note={note} modules={modules} onClick={() => setActiveNote(note)} />
          ))}
        </div>
      )}

      {showUpgrade && (
        <UpgradeModal feature="unlimitedNotes" onClose={() => setShowUpgrade(false)} />
      )}

      {showCreate && (
        <CreateNoteModal
          modules={modules}
          exams={exams}
          tasks={tasks}
          rubriken={rubriken}
          onClose={() => setShowCreate(false)}
          onCreated={(n) => { setActiveNote(n); setShowCreate(false); }}
        />
      )}

      {showRubrikCreate && (
        <RubrikCreateModal
          onClose={() => setShowRubrikCreate(false)}
          onCreated={() => { setShowRubrikCreate(false); fetchRubriken(); }}
        />
      )}
    </div>
  );
}

/* ── Flow View ──────────────────────────────────────────────────────── */
function FlowView({ items, onOpenNote }: { items: FlowItem[]; onOpenNote: (n: Note) => void }) {
  const { t } = useTranslation();
  const STATUS_CONFIG = getStatusConfig(t);
  // Group by date
  const grouped: Record<string, FlowItem[]> = {};
  items.forEach(item => {
    const dateKey = new Date(item.date).toLocaleDateString("de-CH", {
      weekday: "long", day: "numeric", month: "long", year: "numeric"
    });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(item);
  });

  if (items.length === 0) {
    return (
      <div className="text-center py-16">
        <Workflow size={48} className="mx-auto mb-4 text-surface-300" />
        <p className="text-surface-500">Keine Notizen im Flow</p>
        <p className="text-sm mt-1 text-surface-400">Erstelle Notizen in Modulen, Timer oder direkt hier</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex gap-2 sm:gap-3 flex-wrap mb-2 overflow-x-auto">
        {(["note", "module", "timer", "exam"] as const).map(type => {
          const count = items.filter(i => i.type === type).length;
          if (count === 0) return null;
          const labels: Record<string, string> = { note: "Notizen", module: "Modul-Notizen", timer: "Timer-Notizen", exam: "Prüfungs-Notizen" };
          return (
            <span key={type} className="flex items-center gap-1.5 text-xs font-medium" style={{ color: FLOW_TYPE_COLORS[type] }}>
              {FLOW_ICONS[type]} {labels[type]} ({count})
            </span>
          );
        })}
        <span className="text-xs text-surface-400 ml-auto">{items.length} Einträge total</span>
      </div>

      {/* Timeline */}
      {Object.entries(grouped).map(([dateLabel, dayItems]) => (
        <div key={dateLabel}>
          {/* Date header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-surface-100" />
            <span className="text-xs font-medium text-surface-500 px-2">{dateLabel}</span>
            <div className="h-px flex-1 bg-surface-100" />
          </div>

          {/* Items with timeline line */}
          <div className="relative pl-6 sm:pl-8">
            {/* Vertical line */}
            <div className="absolute left-2.5 sm:left-3 top-0 bottom-0 w-px bg-surface-100" />

            <div className="space-y-2 sm:space-y-3">
              {dayItems.map((item, idx) => {
                const typeColor = FLOW_TYPE_COLORS[item.type] ?? "#a78bfa";
                const isClickable = item.type === "note" && item.original;

                return (
                  <div
                    key={item.id}
                    className={`relative group ${isClickable ? "cursor-pointer" : ""}`}
                    onClick={() => { if (isClickable && item.original) onOpenNote(item.original); }}
                  >
                    {/* Timeline dot */}
                    <div
                      className="absolute -left-4.5 sm:-left-5 top-3 w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full border-2 border-surface-100"
                      style={{ backgroundColor: typeColor }}
                    />

                    {/* Card */}
                    <div
                      className={`bg-white border border-surface-200 rounded-lg p-2.5 sm:p-3.5 transition ${
                        isClickable ? "hover:border-surface-400 hover:bg-surface-200/50" : ""
                      }`}
                      style={{ borderLeftWidth: 3, borderLeftColor: item.module_color ?? typeColor }}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
                          <span style={{ color: typeColor }} className="flex-shrink-0">{FLOW_ICONS[item.type]}</span>
                          <h4 className={`text-xs sm:text-sm font-medium text-surface-900 line-clamp-1 ${isClickable ? "group-hover:text-brand-300" : ""}`}>
                            {item.pinned && <Pin size={10} className="inline mr-1 text-amber-400" />}
                            {item.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 flex-wrap sm:flex-nowrap justify-end">
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: typeColor + "20", color: typeColor }}
                          >
                            {item.source_label}
                          </span>
                          {item.status && (
                            <span
                              className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium"
                              style={{
                                backgroundColor: STATUS_CONFIG[item.status].color + "20",
                                color: STATUS_CONFIG[item.status].color
                              }}
                            >
                              {STATUS_CONFIG[item.status].icon} {STATUS_CONFIG[item.status].label}
                            </span>
                          )}
                        </div>
                      </div>

                      {item.content && (
                        <p className="text-xs text-surface-500 line-clamp-2 leading-relaxed mt-1.5">{item.content}</p>
                      )}

                      <div className="flex items-center gap-1 sm:gap-2 mt-2 flex-wrap">
                        {item.module_name && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: (item.module_color ?? "#666") + "20", color: item.module_color }}
                          >
                            {item.module_name}
                          </span>
                        )}
                        <span className="text-xs text-surface-300 ml-auto">
                          {new Date(item.date).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Note Card (Grid) ───────────────────────────────────────────────── */
function NoteCard({ note, modules, onClick }: { note: Note; modules: Module[]; onClick: () => void }) {
  const { t } = useTranslation();
  const STATUS_CONFIG = getStatusConfig(t);
  const mod = note.module ?? modules.find(m => m.id === note.module_id);
  const st = STATUS_CONFIG[note.status as NoteStatus] ?? STATUS_CONFIG.draft;
  const preview = note.content.replace(/<[^>]*>/g, "").slice(0, 120);

  return (
    <button
      onClick={onClick}
      className="bg-white border border-surface-200 rounded-xl p-4 text-left hover:border-surface-400 transition group"
      style={{ borderTopWidth: 3, borderTopColor: note.color }}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-surface-900 text-sm group-hover:text-brand-300 transition line-clamp-1 flex-1">
          {note.pinned && <Pin size={12} className="inline mr-1 text-amber-400" />}
          {note.title}
        </h3>
        <span
          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2"
          style={{ backgroundColor: st.color + "20", color: st.color }}
        >
          {st.icon} {st.label}
        </span>
      </div>

      {preview && (
        <p className="text-xs text-surface-500 line-clamp-3 mb-3 leading-relaxed">{preview}</p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {mod && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: mod.color + "20", color: mod.color }}
          >
            <BookOpen size={10} className="inline mr-1" />{mod.name}
          </span>
        )}
        <span className="text-xs text-surface-400 ml-auto">
          {new Date(note.updated_at).toLocaleDateString("de-CH")}
        </span>
      </div>
    </button>
  );
}

/* ── Note List Row ──────────────────────────────────────────────────── */
function NoteListRow({ note, modules, onClick }: { note: Note; modules: Module[]; onClick: () => void }) {
  const { t } = useTranslation();
  const STATUS_CONFIG = getStatusConfig(t);
  const mod = note.module ?? modules.find(m => m.id === note.module_id);
  const st = STATUS_CONFIG[note.status as NoteStatus] ?? STATUS_CONFIG.draft;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-white border border-surface-200 rounded-lg hover:border-surface-400 transition group text-left"
    >
      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: note.color }} />
      {note.pinned && <Pin size={14} className="text-amber-400 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-surface-900 group-hover:text-brand-300 transition line-clamp-1">{note.title}</h3>
        {mod && (
          <span className="text-xs" style={{ color: mod.color }}>{mod.name}</span>
        )}
      </div>
      <span
        className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0"
        style={{ backgroundColor: st.color + "20", color: st.color }}
      >
        {st.icon} {st.label}
      </span>
      <span className="text-xs text-surface-400 flex-shrink-0">
        {new Date(note.updated_at).toLocaleDateString("de-CH")}
      </span>
    </button>
  );
}

/* ── Create Note Modal ──────────────────────────────────────────────── */
function CreateNoteModal({
  modules, exams, tasks, rubriken, onClose, onCreated,
}: {
  modules: Module[];
  exams: CalendarEvent[];
  tasks: Task[];
  rubriken: { id: string; name: string; color: string }[];
  onClose: () => void;
  onCreated: (n: Note) => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [examId, setExamId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [color, setColor] = useState("#6d28d9");
  const [saving, setSaving] = useState(false);

  const filteredExams = moduleId
    ? exams.filter(e => e.title?.toLowerCase().includes(modules.find(m => m.id === moduleId)?.name?.toLowerCase().slice(0, 5) ?? "---"))
    : exams;
  const filteredTasks = moduleId ? tasks.filter(t => t.module_id === moduleId) : tasks;

  async function handleCreate() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from("notes").insert({
      user_id: user.id,
      title: title || "Neue Notiz",
      module_id: moduleId || null,
      exam_id: examId || null,
      task_id: taskId || null,
      category_id: categoryId || null,
      color,
      content: "",
      status: "draft",
    }).select("*, module:modules(id,name,color)").single();

    if (data && !error) onCreated(data as Note);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="bg-white border border-surface-300 rounded-2xl w-full max-w-md p-4 sm:p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4 sm:mb-5">
          <h2 className="text-base sm:text-lg font-bold text-surface-900">{t("notes.newNote")}</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-900 transition"><X size={20} /></button>
        </div>

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">Titel</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="z.B. Zusammenfassung Kapitel 3..."
          className="w-full bg-surface-100 border border-surface-300 rounded-lg px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-surface-900 placeholder:text-surface-400 mb-3 sm:mb-4 focus:border-brand-500 focus:outline-none transition"
          autoFocus
        />

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">Zuordnung (optional)</label>
        <select
          value={moduleId}
          onChange={e => { setModuleId(e.target.value); setExamId(""); setTaskId(""); }}
          className="w-full bg-surface-100 border border-surface-300 rounded-lg px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-surface-900 mb-2"
        >
          <option value="">Allgemein (kein Modul)</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {moduleId && (
          <div className="flex gap-1.5 sm:gap-2 mb-2 flex-wrap sm:flex-nowrap">
            <select
              value={examId}
              onChange={e => setExamId(e.target.value)}
              className="flex-1 bg-surface-100 border border-surface-300 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-surface-900"
            >
              <option value="">Keine Prüfung</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              className="flex-1 bg-surface-100 border border-surface-300 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm text-surface-900"
            >
              <option value="">Keine Aufgabe</option>
              {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5 mt-3">Rubrik (optional)</label>
        <select
          value={categoryId}
          onChange={e => setCategoryId(e.target.value)}
          className="w-full bg-surface-100 border border-surface-300 rounded-lg px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-surface-900 mb-3 sm:mb-4"
        >
          <option value="">Keine Rubrik</option>
          {rubriken.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">Farbe</label>
        <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-5 flex-wrap">
          {NOTE_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition ${color === c ? "border-white scale-110" : "border-surface-200 hover:border-surface-400"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition disabled:opacity-50"
        >
          {saving ? t("notes.creating_progress") : t("notes.newNote")}
        </button>
      </div>
    </div>
  );
}

/* ── Rich Text Toolbar Button ───────────────────────────────────────── */
function TBtn({ active, onClick, children, title }: {
  active?: boolean; onClick: () => void; children: React.ReactNode; title: string;
}) {
  return (
    <button
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`p-1 sm:p-1.5 rounded transition ${active ? "bg-brand-600 text-white" : "text-surface-500 hover:text-surface-900 hover:bg-surface-200"}`}
      title={title}
    >
      {children}
    </button>
  );
}

/* ── Note Editor ────────────────────────────────────────────────────── */
function NoteEditor({
  note, modules, exams, tasks, onBack,
}: {
  note: Note;
  modules: Module[];
  exams: CalendarEvent[];
  tasks: Task[];
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const STATUS_CONFIG = getStatusConfig(t);
  const supabase = createClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<NoteStatus>(note.status as NoteStatus);
  const [pinned, setPinned] = useState(note.pinned);
  const [moduleId, setModuleId] = useState(note.module_id ?? "");
  const [examId, setExamId] = useState(note.exam_id ?? "");
  const [taskId, setTaskId] = useState(note.task_id ?? "");
  const [categoryId, setCategoryId] = useState(note.category_id ?? "");
  const [checklist, setChecklist] = useState<NoteChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showChecklist, setShowChecklist] = useState(true);
  const [rubriken, setRubriken] = useState<{ id: string; name: string; color: string }[]>([]);
  const saveTimer = useRef<NodeJS.Timeout | null>(null);

  const mod = modules.find(m => m.id === moduleId);
  const filteredExams = moduleId
    ? exams.filter(e => e.title?.toLowerCase().includes(modules.find(m => m.id === moduleId)?.name?.toLowerCase().slice(0, 5) ?? "---"))
    : exams;
  const filteredTasks = moduleId ? tasks.filter(t => t.module_id === moduleId) : tasks;

  // Load content into editor
  useEffect(() => {
    if (editorRef.current && note.content) {
      editorRef.current.innerHTML = note.content;
    }
  }, [note.content]);

  // Load checklist and rubriken
  useEffect(() => {
    supabase
      .from("note_checklist_items")
      .select("*")
      .eq("note_id", note.id)
      .order("sort_order")
      .then(r => setChecklist(r.data ?? []));
    supabase
      .from("note_categories")
      .select("*")
      .order("sort_order")
      .then(r => setRubriken(r.data ?? []));
  }, [supabase, note.id]);

  // Auto-save with debounce
  function scheduleAutoSave() {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => saveNote(), 2000);
  }

  async function saveNote() {
    setSaving(true);
    const content = editorRef.current?.innerHTML ?? "";
    await supabase.from("notes").update({
      title,
      content,
      status,
      pinned,
      module_id: moduleId || null,
      exam_id: examId || null,
      task_id: taskId || null,
      category_id: categoryId || null,
      updated_at: new Date().toISOString(),
    }).eq("id", note.id);
    setSaving(false);
    setLastSaved(new Date());
  }

  async function deleteNote() {
    if (!confirm(t("notes.deleteConfirm"))) return;
    await supabase.from("note_checklist_items").delete().eq("note_id", note.id);
    await supabase.from("notes").delete().eq("id", note.id);
    onBack();
  }

  async function togglePin() {
    const newVal = !pinned;
    setPinned(newVal);
    await supabase.from("notes").update({ pinned: newVal }).eq("id", note.id);
  }

  // Checklist operations
  async function addCheckItem() {
    if (!newCheckItem.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("note_checklist_items").insert({
      user_id: user.id,
      note_id: note.id,
      content: newCheckItem.trim(),
      sort_order: checklist.length,
    });
    setNewCheckItem("");
    const { data } = await supabase.from("note_checklist_items").select("*").eq("note_id", note.id).order("sort_order");
    setChecklist(data ?? []);
  }

  async function toggleCheckItem(id: string, checked: boolean) {
    await supabase.from("note_checklist_items").update({ checked: !checked }).eq("id", id);
    setChecklist(prev => prev.map(i => i.id === id ? { ...i, checked: !checked } : i));
  }

  async function deleteCheckItem(id: string) {
    await supabase.from("note_checklist_items").delete().eq("id", id);
    setChecklist(prev => prev.filter(i => i.id !== id));
  }

  // Rich text commands
  function execCmd(cmd: string, value?: string) {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    scheduleAutoSave();
  }

  const checkDone = checklist.length > 0 ? checklist.filter(i => i.checked).length : 0;
  const checkTotal = checklist.length;
  const st = STATUS_CONFIG[status];

  return (
    <div className="p-3 sm:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 sm:justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={() => { saveNote(); onBack(); }} className="text-surface-500 hover:text-surface-900 transition p-1 flex-shrink-0">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 min-w-0">
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); scheduleAutoSave(); }}
              className="text-lg sm:text-xl font-bold text-surface-900 bg-transparent border-none focus:outline-none w-full"
              placeholder="Notiz-Titel..."
            />
            <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
              {mod && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0" style={{ backgroundColor: mod.color + "25", color: mod.color }}>
                  <BookOpen size={10} className="inline mr-1" />{mod.name}
                </span>
              )}
              <span
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer flex-shrink-0"
                style={{ backgroundColor: st.color + "20", color: st.color }}
                onClick={() => {
                  const order: NoteStatus[] = ["draft", "in_progress", "done"];
                  const next = order[(order.indexOf(status) + 1) % 3];
                  setStatus(next);
                  scheduleAutoSave();
                }}
                title={t("notes.clickToToggleStatus")}
              >
                {st.icon} {st.label}
              </span>
              {lastSaved && (
                <span className="text-xs text-surface-400 flex-shrink-0">
                  {saving ? t("notes.saving") : `Gespeichert ${lastSaved.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}`}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
          <button onClick={togglePin} className={`p-2 rounded-lg transition ${pinned ? "bg-amber-500/20 text-amber-400" : "bg-surface-100 text-surface-500 hover:text-surface-900"} border border-surface-200`} title={pinned ? t("notes.detach") : t("notes.pin")}>
            {pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
          <button onClick={saveNote} className="flex items-center gap-1.5 px-3 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm font-medium transition">
            <Save size={14} /> {t("notes.save")}
          </button>
          <button onClick={deleteNote} className="p-2 rounded-lg bg-surface-100 border border-surface-200 text-red-400 hover:text-red-300 hover:border-red-500/40 transition">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Linking selectors */}
      <div className="flex gap-1.5 sm:gap-2 mb-3 sm:mb-4 flex-wrap overflow-x-auto">
        <select
          value={moduleId}
          onChange={e => { setModuleId(e.target.value); setExamId(""); setTaskId(""); scheduleAutoSave(); }}
          className="bg-white border border-surface-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs text-surface-900 flex-shrink-0"
        >
          <option value="">Kein Modul</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {moduleId && (
          <>
            <select
              value={examId}
              onChange={e => { setExamId(e.target.value); scheduleAutoSave(); }}
              className="bg-white border border-surface-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs text-surface-900 flex-shrink-0"
            >
              <option value="">Keine Prüfung</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <select
              value={taskId}
              onChange={e => { setTaskId(e.target.value); scheduleAutoSave(); }}
              className="bg-white border border-surface-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs text-surface-900 flex-shrink-0"
            >
              <option value="">Keine Aufgabe</option>
              {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </>
        )}
        <select
          value={categoryId}
          onChange={e => { setCategoryId(e.target.value); scheduleAutoSave(); }}
          className="bg-white border border-surface-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs text-surface-900 flex-shrink-0"
        >
          <option value="">Keine Rubrik</option>
          {rubriken.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {/* Rich Text Toolbar */}
      <div className="flex items-center gap-0.5 p-1.5 sm:p-2 bg-white border border-surface-200 rounded-t-xl flex-wrap overflow-x-auto">
        <TBtn onClick={() => execCmd("bold")} title={t("notes.bold")}><Bold size={14} /></TBtn>
        <TBtn onClick={() => execCmd("italic")} title={t("notes.italic")}><Italic size={14} /></TBtn>
        <TBtn onClick={() => execCmd("underline")} title={t("notes.underline")}><Underline size={14} /></TBtn>
        <TBtn onClick={() => execCmd("strikeThrough")} title={t("notes.strikethrough")}><Strikethrough size={14} /></TBtn>
        <div className="w-px h-4 sm:h-5 bg-surface-200 mx-0.5 sm:mx-1" />
        <TBtn onClick={() => execCmd("formatBlock", "h1")} title={t("notes.heading1")}><Heading1 size={14} /></TBtn>
        <TBtn onClick={() => execCmd("formatBlock", "h2")} title={t("notes.heading2")}><Heading2 size={14} /></TBtn>
        <TBtn onClick={() => execCmd("formatBlock", "p")} title={t("notes.paragraph")}><AlignLeft size={14} /></TBtn>
        <div className="w-px h-4 sm:h-5 bg-surface-200 mx-0.5 sm:mx-1" />
        <TBtn onClick={() => execCmd("insertUnorderedList")} title={t("notes.bullet")}><List size={14} /></TBtn>
        <TBtn onClick={() => execCmd("insertOrderedList")} title={t("notes.numbering")}><ListOrdered size={14} /></TBtn>
        <div className="w-px h-4 sm:h-5 bg-surface-200 mx-0.5 sm:mx-1" />
        <TBtn onClick={() => {
          const url = prompt(t("notes.linkUrl"));
          if (url) execCmd("createLink", url);
        }} title={t("notes.insertLink")}><Link2 size={14} /></TBtn>
        <TBtn onClick={() => execCmd("justifyCenter")} title={t("notes.centered")}><AlignCenter size={14} /></TBtn>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={scheduleAutoSave}
        className="min-h-[300px] bg-white border-x border-b border-surface-200 rounded-b-xl p-3 sm:p-4 text-xs sm:text-sm text-surface-900 focus:outline-none prose prose-sm max-w-none [&_h1]:text-lg sm:[&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-surface-900 [&_h1]:mt-3 sm:[&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base sm:[&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-surface-200 [&_h2]:mt-2 sm:[&_h2]:mt-3 [&_h2]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-4 sm:[&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-4 sm:[&_ol]:pl-5 [&_a]:text-brand-400 [&_a]:underline [&_li]:text-surface-800 [&_p]:text-surface-800 [&_p]:leading-relaxed"
        data-placeholder={t("notes.startTyping")}
        suppressContentEditableWarning
      />

      {/* Checklist */}
      <div className="mt-3 sm:mt-4 bg-white border border-surface-200 rounded-xl">
        <button
          onClick={() => setShowChecklist(!showChecklist)}
          className="w-full flex items-center justify-between p-2.5 sm:p-3 text-left"
        >
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <CheckSquare size={16} className="text-brand-400 flex-shrink-0" />
            <span className="text-xs sm:text-sm font-semibold text-surface-800">Checkliste</span>
            {checkTotal > 0 && (
              <span className="text-xs text-surface-500">({checkDone}/{checkTotal})</span>
            )}
          </div>
          <ChevronDown size={14} className={`text-surface-500 transition ${showChecklist ? "rotate-180" : ""} flex-shrink-0`} />
        </button>

        {showChecklist && (
          <div className="px-2.5 sm:px-3 pb-2.5 sm:pb-3">
            {/* Progress bar */}
            {checkTotal > 0 && (
              <div className="mb-2.5 sm:mb-3">
                <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300 rounded-full"
                    style={{ width: `${(checkDone / checkTotal) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Items */}
            <div className="space-y-1 sm:space-y-1">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-1.5 sm:gap-2 group p-1 rounded hover:bg-surface-200/50 transition">
                  <button
                    onClick={() => toggleCheckItem(item.id, item.checked)}
                    className="flex-shrink-0"
                  >
                    {item.checked
                      ? <CheckSquare size={16} className="text-green-400" />
                      : <Square size={16} className="text-surface-400 hover:text-surface-700" />
                    }
                  </button>
                  <span className={`text-xs sm:text-sm flex-1 ${item.checked ? "text-surface-400 line-through" : "text-surface-800"}`}>
                    {item.content}
                  </span>
                  <button
                    onClick={() => deleteCheckItem(item.id)}
                    className="p-1 text-surface-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition flex-shrink-0"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add item */}
            <div className="flex gap-1.5 sm:gap-2 mt-2 flex-wrap sm:flex-nowrap">
              <input
                value={newCheckItem}
                onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addCheckItem(); }}
                placeholder={t("notes.newPoint")}
                className="flex-1 bg-surface-100 border border-surface-200 rounded-lg px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none transition min-w-[120px]"
              />
              <button
                onClick={addCheckItem}
                disabled={!newCheckItem.trim()}
                className="px-2.5 sm:px-3 py-1.5 bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-surface-900 rounded-lg text-xs sm:text-sm transition flex-shrink-0"
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Rubrik Create Modal ──────────────────────────────────────────── */
function RubrikCreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(NOTE_COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    await supabase.from("note_categories").insert({
      user_id: user.id,
      name: name.trim(),
      color,
    });
    setSaving(false);
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-4 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900 text-sm">Neue Rubrik erstellen</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleCreate} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">Name</label>
            <input
              className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-2 text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="z.B. Zusammenfassungen, Lernnotizen..."
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Farbe</label>
            <div className="flex gap-1.5 flex-wrap">
              {NOTE_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${color === c ? "border-surface-800 scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-surface-200 text-sm font-medium text-surface-600 hover:bg-surface-50 transition">Abbrechen</button>
            <button type="submit" disabled={saving || !name.trim()} className="flex-1 px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-500 transition disabled:opacity-50">
              {saving ? t("notes.creating_progress") : "Erstellen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
