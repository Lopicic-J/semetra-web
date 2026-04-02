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
  StickyNote, FolderOpen, CircleDot
} from "lucide-react";
import type {
  Note, NoteStatus, NoteChecklistItem,
  CalendarEvent, Task, Module
} from "@/types/database";

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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const fetchNotes = useCallback(async () => {
    const { data } = await supabase
      .from("notes")
      .select("*, module:modules(id,name,color)")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    setNotes((data ?? []) as Note[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchNotes();
    supabase.from("events").select("*").eq("event_type", "exam").then(r => setExams(r.data ?? []));
    supabase.from("tasks").select("*").then(r => setTasks(r.data ?? []));
  }, [supabase, fetchNotes]);

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
  }), [notes, modules]);

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
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-white">{stats.total}</p>
          <p className="text-xs text-zinc-400">Notizen gesamt</p>
        </div>
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
        <button
          onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}
          className="p-2 rounded-lg bg-zinc-900 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 transition"
        >
          {viewMode === "grid" ? <ListIcon size={16} /> : <LayoutGrid size={16} />}
        </button>
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
