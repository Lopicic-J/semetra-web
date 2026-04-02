"use client";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import {
  Plus, Trash2, Pencil, X, ArrowLeft, Save, FileText,
  Pin, PinOff, Search, Filter, BookOpen, CheckSquare, Square,
  Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2,
  AlignLeft, AlignCenter, Link2, Strikethrough, GripVertical,
  ChevronDown, Clock, CheckCircle2, FileEdit, LayoutGrid, ListIcon,
  StickyNote, FolderOpen, CircleDot, Timer, GraduationCap,
  GitBranch, ArrowDown, Workflow
} from "lucide-react";
import type {
  Note, NoteStatus, NoteChecklistItem,
  CalendarEvent, Task, Module, TimeLog
} from "@/types/database";

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

const STATUS_CONFIG: Record<NoteStatus, { label: string; color: string; icon: React.ReactNode }> = {
  draft:       { label: "Entwurf",    color: "#a1a1aa", icon: <FileEdit size={12} /> },
  in_progress: { label: "In Arbeit",  color: "#f59e0b", icon: <Clock size={12} /> },
  done:        { label: "Fertig",     color: "#22c55e", icon: <CheckCircle2 size={12} /> },
};

const NOTE_COLORS = [
  "#6d28d9","#2563eb","#059669","#dc2626","#d97706",
  "#db2777","#0891b2","#7c3aed","#16a34a","#ea580c",
];

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function NotesPage() {
  const supabase = createClient();
  const { modules } = useModules();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeNote, setActiveNote] = useState<Note | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterStatus, setFilterStatus] = useState<NoteStatus | "">("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "flow">("grid");
  const [flowItems, setFlowItems] = useState<FlowItem[]>([]);

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from("notes")
      .select("*, module:modules(id,name,color)")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    setNotes((data ?? []) as Note[]);
    setLoading(false);
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
        source_label: "Notiz",
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
        title: en.label || "Prüfungs-Notiz",
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
    supabase.from("events").select("*").eq("event_type", "exam").then(r => setExams(r.data ?? []));
    supabase.from("tasks").select("*").then(r => setTasks(r.data ?? []));
  }, [supabase, fetchNotes, fetchFlowItems]);

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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="text-amber-400" /> Notizen
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Alle Notizen an einem Ort — geordnet nach Modul, Aufgabe & Prüfung</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Neue Notiz
        </button>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <button
          onClick={() => setViewMode("flow")}
          className={`bg-zinc-900 border rounded-xl p-3 text-center transition ${viewMode === "flow" ? "border-violet-500" : "border-zinc-700 hover:border-zinc-600"}`}
        >
          <p className="text-2xl font-bold text-white">{flowItems.length}</p>
          <p className="text-xs text-zinc-400">Alle Notizen</p>
          {(stats.fromModules + stats.fromTimer + stats.fromExams) > 0 && (
            <p className="text-xs text-zinc-500 mt-0.5">
              +{stats.fromModules + stats.fromTimer + stats.fromExams} aus anderen Quellen
            </p>
          )}
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === "draft" ? "" : "draft")}
          className={`bg-zinc-900 border rounded-xl p-3 text-center transition ${filterStatus === "draft" ? "border-zinc-400" : "border-zinc-700 hover:border-zinc-600"}`}
        >
          <p className="text-2xl font-bold text-zinc-400">{stats.draft}</p>
          <p className="text-xs text-zinc-400">Entwürfe</p>
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === "in_progress" ? "" : "in_progress")}
          className={`bg-zinc-900 border rounded-xl p-3 text-center transition ${filterStatus === "in_progress" ? "border-amber-500" : "border-zinc-700 hover:border-zinc-600"}`}
        >
          <p className="text-2xl font-bold text-amber-400">{stats.inProgress}</p>
          <p className="text-xs text-zinc-400">In Arbeit</p>
        </button>
        <button
          onClick={() => setFilterStatus(filterStatus === "done" ? "" : "done")}
          className={`bg-zinc-900 border rounded-xl p-3 text-center transition ${filterStatus === "done" ? "border-green-500" : "border-zinc-700 hover:border-zinc-600"}`}
        >
          <p className="text-2xl font-bold text-green-400">{stats.done}</p>
          <p className="text-xs text-zinc-400">Fertig</p>
        </button>
      </div>

      {/* Module distribution */}
      {stats.byModule.length > 0 && (
        <div className="mb-6 bg-zinc-900 border border-zinc-700 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <FolderOpen size={14} className="text-violet-400" /> Notizen nach Modul
          </h3>
          <div className="flex gap-2 flex-wrap">
            {stats.byModule.map(({ module: m, count }) => (
              <button
                key={m.id}
                onClick={() => setFilterModule(filterModule === m.id ? "" : m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  filterModule === m.id
                    ? "ring-2 ring-white/30"
                    : "hover:brightness-110"
                }`}
                style={{ backgroundColor: m.color + "25", color: m.color }}
              >
                <CircleDot size={10} /> {m.name} ({count})
              </button>
            ))}
            {stats.unlinked > 0 && (
              <button
                onClick={() => setFilterModule("")}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition"
              >
                <StickyNote size={10} /> Ohne Zuordnung ({stats.unlinked})
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search + filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Notizen durchsuchen..."
            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none transition"
          />
        </div>
        <select
          value={filterModule}
          onChange={e => setFilterModule(e.target.value)}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
        >
          <option value="">Alle Module</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-zinc-700">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-2 transition ${viewMode === "grid" ? "bg-violet-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
            title="Karten"
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 transition ${viewMode === "list" ? "bg-violet-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
            title="Liste"
          >
            <ListIcon size={16} />
          </button>
          <button
            onClick={() => setViewMode("flow")}
            className={`p-2 transition ${viewMode === "flow" ? "bg-violet-600 text-white" : "bg-zinc-900 text-zinc-400 hover:text-white"}`}
            title="Flow — alle Notizen chronologisch"
          >
            <Workflow size={16} />
          </button>
        </div>
        {(filterModule || filterStatus || searchQ) && (
          <button
            onClick={() => { setFilterModule(""); setFilterStatus(""); setSearchQ(""); }}
            className="px-3 py-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white text-xs transition"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {/* Notes list */}
      {loading ? (
        <p className="text-zinc-400 text-sm">Laden...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-400">{notes.length === 0 ? "Noch keine Notizen" : "Keine Notizen gefunden"}</p>
          <p className="text-sm mt-1 text-zinc-500">
            {notes.length === 0 ? "Erstelle deine erste Notiz zu einem Modul oder Thema!" : "Versuche einen anderen Suchbegriff oder Filter"}
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

      {showCreate && (
        <CreateNoteModal
          modules={modules}
          exams={exams}
          tasks={tasks}
          onClose={() => setShowCreate(false)}
          onCreated={(n) => { setActiveNote(n); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

/* ── Flow View ──────────────────────────────────────────────────────── */
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

function FlowView({ items, onOpenNote }: { items: FlowItem[]; onOpenNote: (n: Note) => void }) {
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
        <Workflow size={48} className="mx-auto mb-4 text-zinc-600" />
        <p className="text-zinc-400">Keine Notizen im Flow</p>
        <p className="text-sm mt-1 text-zinc-500">Erstelle Notizen in Modulen, Timer oder direkt hier</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex gap-3 flex-wrap mb-2">
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
        <span className="text-xs text-zinc-500 ml-auto">{items.length} Einträge total</span>
      </div>

      {/* Timeline */}
      {Object.entries(grouped).map(([dateLabel, dayItems]) => (
        <div key={dateLabel}>
          {/* Date header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-px flex-1 bg-zinc-800" />
            <span className="text-xs font-medium text-zinc-400 px-2">{dateLabel}</span>
            <div className="h-px flex-1 bg-zinc-800" />
          </div>

          {/* Items with timeline line */}
          <div className="relative pl-8">
            {/* Vertical line */}
            <div className="absolute left-3 top-0 bottom-0 w-px bg-zinc-800" />

            <div className="space-y-3">
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
                      className="absolute -left-5 top-3 w-3 h-3 rounded-full border-2 border-zinc-900"
                      style={{ backgroundColor: typeColor }}
                    />

                    {/* Card */}
                    <div
                      className={`bg-zinc-900 border border-zinc-700 rounded-lg p-3.5 transition ${
                        isClickable ? "hover:border-zinc-500 hover:bg-zinc-800/50" : ""
                      }`}
                      style={{ borderLeftWidth: 3, borderLeftColor: item.module_color ?? typeColor }}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span style={{ color: typeColor }}>{FLOW_ICONS[item.type]}</span>
                          <h4 className={`text-sm font-medium text-white line-clamp-1 ${isClickable ? "group-hover:text-violet-300" : ""}`}>
                            {item.pinned && <Pin size={10} className="inline mr-1 text-amber-400" />}
                            {item.title}
                          </h4>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
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
                        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed mt-1">{item.content}</p>
                      )}

                      <div className="flex items-center gap-2 mt-2">
                        {item.module_name && (
                          <span
                            className="text-xs px-1.5 py-0.5 rounded font-medium"
                            style={{ backgroundColor: (item.module_color ?? "#666") + "20", color: item.module_color }}
                          >
                            {item.module_name}
                          </span>
                        )}
                        <span className="text-xs text-zinc-600 ml-auto">
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
  const mod = note.module ?? modules.find(m => m.id === note.module_id);
  const st = STATUS_CONFIG[note.status as NoteStatus] ?? STATUS_CONFIG.draft;
  const preview = note.content.replace(/<[^>]*>/g, "").slice(0, 120);

  return (
    <button
      onClick={onClick}
      className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-left hover:border-zinc-500 transition group"
      style={{ borderTopWidth: 3, borderTopColor: note.color }}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="font-semibold text-white text-sm group-hover:text-violet-300 transition line-clamp-1 flex-1">
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
        <p className="text-xs text-zinc-400 line-clamp-3 mb-3 leading-relaxed">{preview}</p>
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
        <span className="text-xs text-zinc-500 ml-auto">
          {new Date(note.updated_at).toLocaleDateString("de-CH")}
        </span>
      </div>
    </button>
  );
}

/* ── Note List Row ──────────────────────────────────────────────────── */
function NoteListRow({ note, modules, onClick }: { note: Note; modules: Module[]; onClick: () => void }) {
  const mod = note.module ?? modules.find(m => m.id === note.module_id);
  const st = STATUS_CONFIG[note.status as NoteStatus] ?? STATUS_CONFIG.draft;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-700 rounded-lg hover:border-zinc-500 transition group text-left"
    >
      <div className="w-1 h-8 rounded-full flex-shrink-0" style={{ backgroundColor: note.color }} />
      {note.pinned && <Pin size={14} className="text-amber-400 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-medium text-white group-hover:text-violet-300 transition line-clamp-1">{note.title}</h3>
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
      <span className="text-xs text-zinc-500 flex-shrink-0">
        {new Date(note.updated_at).toLocaleDateString("de-CH")}
      </span>
    </button>
  );
}

/* ── Create Note Modal ──────────────────────────────────────────────── */
function CreateNoteModal({
  modules, exams, tasks, onClose, onCreated,
}: {
  modules: Module[];
  exams: CalendarEvent[];
  tasks: Task[];
  onClose: () => void;
  onCreated: (n: Note) => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [examId, setExamId] = useState("");
  const [taskId, setTaskId] = useState("");
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
      color,
      content: "",
      status: "draft",
    }).select("*, module:modules(id,name,color)").single();

    if (data && !error) onCreated(data as Note);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-600 rounded-2xl w-full max-w-md p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-white">Neue Notiz</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition"><X size={20} /></button>
        </div>

        <label className="block text-sm font-medium text-zinc-200 mb-1.5">Titel</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="z.B. Zusammenfassung Kapitel 3..."
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2.5 text-sm text-white placeholder:text-zinc-500 mb-4 focus:border-violet-500 focus:outline-none transition"
          autoFocus
        />

        <label className="block text-sm font-medium text-zinc-200 mb-1.5">Zuordnung (optional)</label>
        <select
          value={moduleId}
          onChange={e => { setModuleId(e.target.value); setExamId(""); setTaskId(""); }}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2.5 text-sm text-white mb-2"
        >
          <option value="">Allgemein (kein Modul)</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {moduleId && (
          <div className="flex gap-2 mb-2">
            <select
              value={examId}
              onChange={e => setExamId(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Keine Prüfung</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Keine Aufgabe</option>
              {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <label className="block text-sm font-medium text-zinc-200 mb-1.5 mt-3">Farbe</label>
        <div className="flex gap-2 mb-5 flex-wrap">
          {NOTE_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition ${color === c ? "border-white scale-110" : "border-zinc-700 hover:border-zinc-500"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white py-2.5 rounded-lg font-medium text-sm transition disabled:opacity-50"
        >
          {saving ? "Erstellen..." : "Notiz erstellen"}
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
      className={`p-1.5 rounded transition ${active ? "bg-violet-600 text-white" : "text-zinc-400 hover:text-white hover:bg-zinc-700"}`}
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
  const supabase = createClient();
  const editorRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState(note.title);
  const [status, setStatus] = useState<NoteStatus>(note.status as NoteStatus);
  const [pinned, setPinned] = useState(note.pinned);
  const [moduleId, setModuleId] = useState(note.module_id ?? "");
  const [examId, setExamId] = useState(note.exam_id ?? "");
  const [taskId, setTaskId] = useState(note.task_id ?? "");
  const [checklist, setChecklist] = useState<NoteChecklistItem[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showChecklist, setShowChecklist] = useState(true);
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

  // Load checklist
  useEffect(() => {
    supabase
      .from("note_checklist_items")
      .select("*")
      .eq("note_id", note.id)
      .order("sort_order")
      .then(r => setChecklist(r.data ?? []));
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
      updated_at: new Date().toISOString(),
    }).eq("id", note.id);
    setSaving(false);
    setLastSaved(new Date());
  }

  async function deleteNote() {
    if (!confirm("Notiz wirklich löschen?")) return;
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
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={() => { saveNote(); onBack(); }} className="text-zinc-400 hover:text-white transition p-1">
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1">
            <input
              value={title}
              onChange={e => { setTitle(e.target.value); scheduleAutoSave(); }}
              className="text-xl font-bold text-white bg-transparent border-none focus:outline-none w-full"
              placeholder="Notiz-Titel..."
            />
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {mod && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: mod.color + "25", color: mod.color }}>
                  <BookOpen size={10} className="inline mr-1" />{mod.name}
                </span>
              )}
              <span
                className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer"
                style={{ backgroundColor: st.color + "20", color: st.color }}
                onClick={() => {
                  const order: NoteStatus[] = ["draft", "in_progress", "done"];
                  const next = order[(order.indexOf(status) + 1) % 3];
                  setStatus(next);
                  scheduleAutoSave();
                }}
                title="Klicken zum Status wechseln"
              >
                {st.icon} {st.label}
              </span>
              {lastSaved && (
                <span className="text-xs text-zinc-500">
                  {saving ? "Speichern..." : `Gespeichert ${lastSaved.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}`}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={togglePin} className={`p-2 rounded-lg transition ${pinned ? "bg-amber-500/20 text-amber-400" : "bg-zinc-800 text-zinc-400 hover:text-white"} border border-zinc-700`} title={pinned ? "Loslösen" : "Anheften"}>
            {pinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
          <button onClick={saveNote} className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-sm font-medium transition">
            <Save size={14} /> Speichern
          </button>
          <button onClick={deleteNote} className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-red-400 hover:text-red-300 hover:border-red-500/40 transition">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Linking selectors */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <select
          value={moduleId}
          onChange={e => { setModuleId(e.target.value); setExamId(""); setTaskId(""); scheduleAutoSave(); }}
          className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white"
        >
          <option value="">Kein Modul</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {moduleId && (
          <>
            <select
              value={examId}
              onChange={e => { setExamId(e.target.value); scheduleAutoSave(); }}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="">Keine Prüfung</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <select
              value={taskId}
              onChange={e => { setTaskId(e.target.value); scheduleAutoSave(); }}
              className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white"
            >
              <option value="">Keine Aufgabe</option>
              {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </>
        )}
      </div>

      {/* Rich Text Toolbar */}
      <div className="flex items-center gap-0.5 p-2 bg-zinc-900 border border-zinc-700 rounded-t-xl flex-wrap">
        <TBtn onClick={() => execCmd("bold")} title="Fett"><Bold size={14} /></TBtn>
        <TBtn onClick={() => execCmd("italic")} title="Kursiv"><Italic size={14} /></TBtn>
        <TBtn onClick={() => execCmd("underline")} title="Unterstrichen"><Underline size={14} /></TBtn>
        <TBtn onClick={() => execCmd("strikeThrough")} title="Durchgestrichen"><Strikethrough size={14} /></TBtn>
        <div className="w-px h-5 bg-zinc-700 mx-1" />
        <TBtn onClick={() => execCmd("formatBlock", "h1")} title="Überschrift 1"><Heading1 size={14} /></TBtn>
        <TBtn onClick={() => execCmd("formatBlock", "h2")} title="Überschrift 2"><Heading2 size={14} /></TBtn>
        <TBtn onClick={() => execCmd("formatBlock", "p")} title="Absatz"><AlignLeft size={14} /></TBtn>
        <div className="w-px h-5 bg-zinc-700 mx-1" />
        <TBtn onClick={() => execCmd("insertUnorderedList")} title="Aufzählung"><List size={14} /></TBtn>
        <TBtn onClick={() => execCmd("insertOrderedList")} title="Nummerierung"><ListOrdered size={14} /></TBtn>
        <div className="w-px h-5 bg-zinc-700 mx-1" />
        <TBtn onClick={() => {
          const url = prompt("Link-URL:");
          if (url) execCmd("createLink", url);
        }} title="Link einfügen"><Link2 size={14} /></TBtn>
        <TBtn onClick={() => execCmd("justifyCenter")} title="Zentriert"><AlignCenter size={14} /></TBtn>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={scheduleAutoSave}
        className="min-h-[300px] bg-zinc-900 border-x border-b border-zinc-700 rounded-b-xl p-4 text-sm text-white focus:outline-none prose prose-invert prose-sm max-w-none [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-white [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_h2]:mt-3 [&_h2]:mb-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-violet-400 [&_a]:underline [&_li]:text-zinc-200 [&_p]:text-zinc-200 [&_p]:leading-relaxed"
        data-placeholder="Beginne hier zu schreiben..."
        suppressContentEditableWarning
      />

      {/* Checklist */}
      <div className="mt-4 bg-zinc-900 border border-zinc-700 rounded-xl">
        <button
          onClick={() => setShowChecklist(!showChecklist)}
          className="w-full flex items-center justify-between p-3 text-left"
        >
          <div className="flex items-center gap-2">
            <CheckSquare size={16} className="text-violet-400" />
            <span className="text-sm font-semibold text-zinc-200">Checkliste</span>
            {checkTotal > 0 && (
              <span className="text-xs text-zinc-400">({checkDone}/{checkTotal})</span>
            )}
          </div>
          <ChevronDown size={14} className={`text-zinc-400 transition ${showChecklist ? "rotate-180" : ""}`} />
        </button>

        {showChecklist && (
          <div className="px-3 pb-3">
            {/* Progress bar */}
            {checkTotal > 0 && (
              <div className="mb-3">
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500 transition-all duration-300 rounded-full"
                    style={{ width: `${(checkDone / checkTotal) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Items */}
            <div className="space-y-1">
              {checklist.map(item => (
                <div key={item.id} className="flex items-center gap-2 group p-1 rounded hover:bg-zinc-800/50 transition">
                  <button
                    onClick={() => toggleCheckItem(item.id, item.checked)}
                    className="flex-shrink-0"
                  >
                    {item.checked
                      ? <CheckSquare size={16} className="text-green-400" />
                      : <Square size={16} className="text-zinc-500 hover:text-zinc-300" />
                    }
                  </button>
                  <span className={`text-sm flex-1 ${item.checked ? "text-zinc-500 line-through" : "text-zinc-200"}`}>
                    {item.content}
                  </span>
                  <button
                    onClick={() => deleteCheckItem(item.id)}
                    className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            {/* Add item */}
            <div className="flex gap-2 mt-2">
              <input
                value={newCheckItem}
                onChange={e => setNewCheckItem(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") addCheckItem(); }}
                placeholder="Neuer Punkt..."
                className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none transition"
              />
              <button
                onClick={addCheckItem}
                disabled={!newCheckItem.trim()}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white rounded-lg text-sm transition"
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
