"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import {
  Plus, Trash2, Pencil, X, ArrowLeft, Save, Lightbulb,
  ThumbsUp, Sparkles, GripVertical, LayoutGrid, List,
  GraduationCap, Target, BookOpen, Shuffle, ArrowRight,
  HelpCircle, Minus, RefreshCw, Zap, MessageSquare, Star,
  ChevronDown, ChevronRight, Filter
} from "lucide-react";
import type {
  BrainstormSession, BrainstormIdea, BrainstormTechnique,
  CalendarEvent, Task, Module
} from "@/types/database";

/* ── Technique definitions ──────────────────────────────────────────── */
interface TechniqueDef {
  key: BrainstormTechnique;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
  prompts: string[];
  categories?: string[];
}

const TECHNIQUES: TechniqueDef[] = [
  {
    key: "freeform",
    label: "Freies Brainstorming",
    icon: <Lightbulb size={18} />,
    color: "#6d28d9",
    description: "Sammle frei alle Ideen die dir einfallen — ohne Grenzen oder Struktur.",
    prompts: [
      "Was fällt dir spontan zu diesem Thema ein?",
      "Welche Aspekte wurden noch nicht betrachtet?",
      "Wenn es keine Einschränkungen gäbe, was würdest du tun?",
      "Welche ungewöhnlichen Verbindungen siehst du?",
      "Was wäre das Gegenteil deiner bisherigen Ideen?",
    ],
  },
  {
    key: "scamper",
    label: "SCAMPER",
    icon: <Shuffle size={18} />,
    color: "#2563eb",
    description: "Systematische Kreativtechnik: Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse.",
    prompts: [
      "Substitute: Was könntest du ersetzen oder austauschen?",
      "Combine: Welche Ideen/Konzepte lassen sich kombinieren?",
      "Adapt: Was aus einem anderen Kontext lässt sich anpassen?",
      "Modify: Was kannst du vergrössern, verkleinern oder verändern?",
      "Put to other use: Wie kann es anders verwendet werden?",
      "Eliminate: Was kann entfernt oder vereinfacht werden?",
      "Reverse: Was passiert wenn du die Reihenfolge umkehrst?",
    ],
    categories: ["Substitute", "Combine", "Adapt", "Modify", "Put to other use", "Eliminate", "Reverse"],
  },
  {
    key: "pro_contra",
    label: "Pro & Contra",
    icon: <Minus size={18} />,
    color: "#059669",
    description: "Analysiere Vor- und Nachteile systematisch für bessere Entscheidungen.",
    prompts: [
      "Was spricht eindeutig dafür?",
      "Welche Risiken oder Nachteile gibt es?",
      "Welche versteckten Vorteile könnten existieren?",
      "Was sind die langfristigen Konsequenzen?",
    ],
    categories: ["Pro", "Contra", "Neutral"],
  },
  {
    key: "starbursting",
    label: "Starbursting (5W1H)",
    icon: <Star size={18} />,
    color: "#d97706",
    description: "Erforsche dein Thema mit den 6 Grundfragen: Wer, Was, Wo, Wann, Warum, Wie.",
    prompts: [
      "WER ist betroffen oder beteiligt?",
      "WAS genau ist das Problem/Thema?",
      "WO findet es statt oder tritt es auf?",
      "WANN ist es relevant oder tritt es ein?",
      "WARUM ist es wichtig?",
      "WIE kann es gelöst/umgesetzt werden?",
    ],
    categories: ["Wer", "Was", "Wo", "Wann", "Warum", "Wie"],
  },
  {
    key: "brainwriting",
    label: "Brainwriting",
    icon: <MessageSquare size={18} />,
    color: "#db2777",
    description: "Schreibe Ideen auf und baue darauf weiter — jede Idee kann neue Ideen inspirieren.",
    prompts: [
      "Schreibe 3 Ideen auf — schnell, ohne zu urteilen.",
      "Schau dir eine bestehende Idee an: Wie kannst du sie erweitern?",
      "Welche Variation oder Kombination fällt dir ein?",
      "Was fehlt noch? Welche Lücke siehst du?",
    ],
  },
  {
    key: "reverse",
    label: "Reverse Brainstorming",
    icon: <RefreshCw size={18} />,
    color: "#dc2626",
    description: "Denke umgekehrt: Was würde das Problem verschlimmern? Dann kehre die Ideen um.",
    prompts: [
      "Wie könntest du das Problem absichtlich verschlimmern?",
      "Was wäre die schlimmste mögliche Lösung?",
      "Welche Fehler könnten garantiert zum Scheitern führen?",
      "Jetzt umkehren: Was ist das Gegenteil jeder schlechten Idee?",
    ],
    categories: ["Probleme verschlimmern", "Umgekehrte Lösung"],
  },
  {
    key: "minddump",
    label: "Mind Dump",
    icon: <Zap size={18} />,
    color: "#0891b2",
    description: "Timer-basiert: Schreibe 5 Minuten lang alles auf was dir einfällt. Quantität vor Qualität!",
    prompts: [
      "Schreibe alles auf — ohne Filter, ohne Pause!",
      "Noch nicht fertig? Was liegt dir noch auf dem Herzen?",
      "Welche Gedanken schwirren noch im Kopf herum?",
    ],
  },
];

const IDEA_COLORS = [
  "#6d28d9","#2563eb","#059669","#dc2626","#d97706",
  "#db2777","#0891b2","#7c3aed","#16a34a","#ea580c",
  "#6366f1","#0d9488","#f59e0b","#ef4444","#8b5cf6",
];

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function BrainstormingPage() {
  const supabase = createClient();
  const { modules } = useModules();
  const [sessions, setSessions] = useState<BrainstormSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<BrainstormSession | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);

  const fetchSessions = useCallback(async () => {
    const { data } = await supabase
      .from("brainstorm_sessions")
      .select("*")
      .order("updated_at", { ascending: false });
    setSessions(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchSessions();
    supabase.from("events").select("*").eq("event_type", "exam").then(r => setExams(r.data ?? []));
    supabase.from("tasks").select("*").neq("status", "done").then(r => setTasks(r.data ?? []));
  }, [supabase, fetchSessions]);

  if (activeSession) {
    return (
      <BrainstormEditor
        session={activeSession}
        modules={modules}
        onBack={() => { setActiveSession(null); fetchSessions(); }}
      />
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Lightbulb className="text-yellow-400" /> Brainstorming
          </h1>
          <p className="text-zinc-400 text-sm mt-1">Ideen sammeln, Kreativität entfalten, Probleme lösen</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
        >
          <Plus size={16} /> Neue Session
        </button>
      </div>

      {/* Technique overview cards */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Techniken</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {TECHNIQUES.map(t => (
            <button
              key={t.key}
              onClick={() => setShowCreate(true)}
              className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-left hover:border-zinc-600 transition group"
            >
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: t.color }}>{t.icon}</span>
                <span className="text-sm font-medium text-white">{t.label}</span>
              </div>
              <p className="text-xs text-zinc-500 line-clamp-2">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Session list */}
      <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-3">Meine Sessions</h2>
      {loading ? (
        <p className="text-zinc-500 text-sm">Laden...</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Lightbulb size={48} className="mx-auto mb-4 opacity-30" />
          <p>Noch keine Brainstorming-Sessions</p>
          <p className="text-sm mt-1">Starte eine neue Session um Ideen zu sammeln!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map(s => {
            const tech = TECHNIQUES.find(t => t.key === s.technique);
            const mod = modules.find(m => m.id === s.module_id);
            return (
              <button
                key={s.id}
                onClick={() => setActiveSession(s)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-left hover:border-violet-500/50 transition group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-white text-sm group-hover:text-violet-300 transition line-clamp-1">
                    {s.title}
                  </h3>
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: s.color }}
                  />
                </div>
                {tech && (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mb-2"
                    style={{ backgroundColor: tech.color + "22", color: tech.color }}
                  >
                    {tech.icon} {tech.label}
                  </span>
                )}
                {mod && (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ml-1 mb-2"
                    style={{ backgroundColor: mod.color + "22", color: mod.color }}
                  >
                    <BookOpen size={10} /> {mod.name}
                  </span>
                )}
                <p className="text-xs text-zinc-500 mt-1">
                  {new Date(s.updated_at).toLocaleDateString("de-CH")}
                </p>
              </button>
            );
          })}
        </div>
      )}

      {showCreate && (
        <CreateSessionModal
          modules={modules}
          exams={exams}
          tasks={tasks}
          onClose={() => setShowCreate(false)}
          onCreated={(s) => { setActiveSession(s); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

/* ── Create Session Modal ───────────────────────────────────────────── */
function CreateSessionModal({
  modules, exams, tasks, onClose, onCreated,
}: {
  modules: Module[];
  exams: CalendarEvent[];
  tasks: Task[];
  onClose: () => void;
  onCreated: (s: BrainstormSession) => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [technique, setTechnique] = useState<BrainstormTechnique>("freeform");
  const [moduleId, setModuleId] = useState("");
  const [examId, setExamId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [color, setColor] = useState("#6d28d9");
  const [saving, setSaving] = useState(false);

  const filteredExams = moduleId ? exams.filter(e => e.title?.toLowerCase().includes(
    modules.find(m => m.id === moduleId)?.name?.toLowerCase().slice(0, 5) ?? "---"
  )) : exams;

  const filteredTasks = moduleId ? tasks.filter(t => t.module_id === moduleId) : tasks;

  const selectedTech = TECHNIQUES.find(t => t.key === technique)!;

  async function handleCreate() {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase.from("brainstorm_sessions").insert({
      user_id: user.id,
      title: title || selectedTech.label,
      technique,
      module_id: moduleId || null,
      exam_id: examId || null,
      task_id: taskId || null,
      color,
    }).select().single();

    if (data && !error) onCreated(data as BrainstormSession);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg p-6 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white">Neue Brainstorming-Session</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white"><X size={20} /></button>
        </div>

        <label className="block text-sm font-medium text-zinc-300 mb-1">Titel</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={selectedTech.label}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mb-4"
        />

        <label className="block text-sm font-medium text-zinc-300 mb-2">Technik wählen</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {TECHNIQUES.map(t => (
            <button
              key={t.key}
              onClick={() => setTechnique(t.key)}
              className={`flex items-center gap-2 p-2 rounded-lg border text-xs text-left transition ${
                technique === t.key
                  ? "border-violet-500 bg-violet-500/10 text-white"
                  : "border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600"
              }`}
            >
              <span style={{ color: t.color }}>{t.icon}</span>
              <div>
                <div className="font-medium">{t.label}</div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-xs text-zinc-500 mb-4 p-2 bg-zinc-800 rounded-lg">
          <span style={{ color: selectedTech.color }}>{selectedTech.icon}</span>{" "}
          {selectedTech.description}
        </p>

        <label className="block text-sm font-medium text-zinc-300 mb-1">Verknüpfung (optional)</label>
        <select
          value={moduleId}
          onChange={e => { setModuleId(e.target.value); setExamId(""); setTaskId(""); }}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white mb-2"
        >
          <option value="">Allgemein (kein Modul)</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {moduleId && (
          <div className="flex gap-2 mb-2">
            <select
              value={examId}
              onChange={e => setExamId(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Keine Prüfung</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white"
            >
              <option value="">Keine Aufgabe</option>
              {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <label className="block text-sm font-medium text-zinc-300 mb-1 mt-3">Farbe</label>
        <div className="flex gap-1.5 mb-5 flex-wrap">
          {IDEA_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-6 h-6 rounded-full border-2 transition ${color === c ? "border-white scale-110" : "border-transparent"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white py-2 rounded-lg font-medium text-sm transition disabled:opacity-50"
        >
          {saving ? "Erstellen..." : "Session starten"}
        </button>
      </div>
    </div>
  );
}

/* ── Brainstorm Editor ──────────────────────────────────────────────── */
function BrainstormEditor({
  session, modules, onBack,
}: {
  session: BrainstormSession;
  modules: Module[];
  onBack: () => void;
}) {
  const supabase = createClient();
  const [ideas, setIdeas] = useState<BrainstormIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [viewMode, setViewMode] = useState<"board" | "list">("board");
  const [promptIndex, setPromptIndex] = useState(0);
  const [showPrompt, setShowPrompt] = useState(true);
  const [filterCat, setFilterCat] = useState("");
  const [timerActive, setTimerActive] = useState(false);
  const [timerSec, setTimerSec] = useState(300); // 5 min for minddump
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const tech = TECHNIQUES.find(t => t.key === session.technique)!;
  const mod = modules.find(m => m.id === session.module_id);

  const fetchIdeas = useCallback(async () => {
    const { data } = await supabase
      .from("brainstorm_ideas")
      .select("*")
      .eq("session_id", session.id)
      .order("sort_order", { ascending: true });
    setIdeas(data ?? []);
    setLoading(false);
  }, [supabase, session.id]);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  // Timer for Mind Dump technique
  useEffect(() => {
    if (timerActive && timerSec > 0) {
      timerRef.current = setTimeout(() => setTimerSec(s => s - 1), 1000);
    } else if (timerSec === 0) {
      setTimerActive(false);
    }
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [timerActive, timerSec]);

  async function addIdea() {
    if (!newContent.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const category = newCategory || (tech.categories?.[0] ?? "");
    const sortOrder = ideas.length;
    const color = IDEA_COLORS[sortOrder % IDEA_COLORS.length];

    await supabase.from("brainstorm_ideas").insert({
      user_id: user.id,
      session_id: session.id,
      content: newContent.trim(),
      category,
      color,
      sort_order: sortOrder,
    });

    // Update session timestamp
    await supabase.from("brainstorm_sessions").update({ updated_at: new Date().toISOString() }).eq("id", session.id);

    setNewContent("");
    fetchIdeas();
    inputRef.current?.focus();
  }

  async function deleteIdea(id: string) {
    await supabase.from("brainstorm_ideas").delete().eq("id", id);
    fetchIdeas();
  }

  async function updateIdea(id: string, content: string) {
    await supabase.from("brainstorm_ideas").update({ content }).eq("id", id);
    setEditingId(null);
    fetchIdeas();
  }

  async function voteIdea(id: string, delta: number) {
    const idea = ideas.find(i => i.id === id);
    if (!idea) return;
    await supabase.from("brainstorm_ideas").update({ votes: Math.max(0, idea.votes + delta) }).eq("id", id);
    fetchIdeas();
  }

  async function updateCategory(id: string, cat: string) {
    await supabase.from("brainstorm_ideas").update({ category: cat }).eq("id", id);
    fetchIdeas();
  }

  async function deleteSession() {
    if (!confirm("Session wirklich löschen? Alle Ideen gehen verloren.")) return;
    await supabase.from("brainstorm_ideas").delete().eq("session_id", session.id);
    await supabase.from("brainstorm_sessions").delete().eq("id", session.id);
    onBack();
  }

  function nextPrompt() {
    setPromptIndex(i => (i + 1) % tech.prompts.length);
  }

  function getRandomPrompt(): string {
    const filtered = tech.prompts.filter((_, i) => i !== promptIndex);
    const idx = Math.floor(Math.random() * filtered.length);
    return filtered[idx] ?? tech.prompts[0];
  }

  // Group ideas by category
  const categories = tech.categories ?? Array.from(new Set(ideas.map(i => i.category).filter(Boolean)));
  const allCats = categories.length > 0 ? categories : ["Ideen"];
  const grouped: Record<string, BrainstormIdea[]> = {};
  allCats.forEach(c => { grouped[c] = []; });
  ideas.forEach(idea => {
    const cat = idea.category || allCats[0];
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(idea);
  });

  const filteredIdeas = filterCat ? ideas.filter(i => (i.category || allCats[0]) === filterCat) : ideas;

  const fmtTimer = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-zinc-400 hover:text-white transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span style={{ color: tech.color }}>{tech.icon}</span>
              {session.title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: tech.color + "22", color: tech.color }}>
                {tech.label}
              </span>
              {mod && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: mod.color + "22", color: mod.color }}>
                  <BookOpen size={10} className="inline mr-1" />{mod.name}
                </span>
              )}
              <span className="text-xs text-zinc-500">{ideas.length} Ideen</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode(viewMode === "board" ? "list" : "board")}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:text-white transition"
            title={viewMode === "board" ? "Listenansicht" : "Board-Ansicht"}
          >
            {viewMode === "board" ? <List size={16} /> : <LayoutGrid size={16} />}
          </button>
          <button
            onClick={deleteSession}
            className="p-2 rounded-lg bg-zinc-800 text-red-400 hover:text-red-300 transition"
            title="Session löschen"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Inspiration / Prompt Card */}
      {showPrompt && (
        <div
          className="mb-4 p-4 rounded-xl border flex items-start gap-3"
          style={{ backgroundColor: tech.color + "0a", borderColor: tech.color + "33" }}
        >
          <Sparkles size={20} className="flex-shrink-0 mt-0.5" style={{ color: tech.color }} />
          <div className="flex-1">
            <p className="text-sm text-zinc-200 font-medium">{tech.prompts[promptIndex]}</p>
            {mod && (
              <p className="text-xs text-zinc-500 mt-1">
                Kontext: {mod.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={nextPrompt}
              className="p-1.5 rounded-lg hover:bg-white/10 transition"
              style={{ color: tech.color }}
              title="Nächster Denkanstoß"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="p-1.5 rounded-lg text-zinc-500 hover:bg-white/10 transition"
              title="Ausblenden"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      {!showPrompt && (
        <button
          onClick={() => setShowPrompt(true)}
          className="mb-4 text-xs text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition"
        >
          <Sparkles size={12} /> Denkanstoß anzeigen
        </button>
      )}

      {/* Mind Dump Timer */}
      {session.technique === "minddump" && (
        <div className="mb-4 flex items-center gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
          <Zap size={18} className="text-cyan-400" />
          <span className="text-2xl font-mono text-white font-bold">{fmtTimer(timerSec)}</span>
          {!timerActive ? (
            <button
              onClick={() => { setTimerActive(true); if (timerSec === 0) setTimerSec(300); }}
              className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-sm font-medium transition"
            >
              {timerSec === 300 ? "Start" : "Weiter"}
            </button>
          ) : (
            <button
              onClick={() => setTimerActive(false)}
              className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition"
            >
              Pause
            </button>
          )}
          <button
            onClick={() => { setTimerActive(false); setTimerSec(300); }}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg text-sm transition"
          >
            Reset
          </button>
          <span className="text-xs text-zinc-500 ml-auto">Schreibe so viele Ideen wie möglich!</span>
        </div>
      )}

      {/* Input bar */}
      <div className="mb-6 flex gap-2">
        <div className="flex-1 flex gap-2">
          <input
            ref={inputRef}
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addIdea(); } }}
            placeholder="Neue Idee eingeben..."
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:border-violet-500 focus:outline-none transition"
            autoFocus
          />
          {tech.categories && (
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white min-w-[120px]"
            >
              {tech.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        <button
          onClick={addIdea}
          disabled={!newContent.trim()}
          className="bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-white px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-1"
        >
          <Plus size={16} /> Hinzufügen
        </button>
      </div>

      {/* Category filter */}
      {tech.categories && tech.categories.length > 1 && (
        <div className="flex gap-1.5 mb-4 flex-wrap">
          <button
            onClick={() => setFilterCat("")}
            className={`px-3 py-1 rounded-full text-xs font-medium transition ${
              !filterCat ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
            }`}
          >
            Alle
          </button>
          {tech.categories.map(cat => {
            const count = (grouped[cat] ?? []).length;
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(filterCat === cat ? "" : cat)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition ${
                  filterCat === cat ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Ideas display */}
      {loading ? (
        <p className="text-zinc-500 text-sm">Laden...</p>
      ) : ideas.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <Lightbulb size={48} className="mx-auto mb-4 opacity-20" />
          <p>Noch keine Ideen — leg los!</p>
          <p className="text-xs mt-1">Nutze den Denkanstoß oben als Inspiration</p>
        </div>
      ) : viewMode === "board" ? (
        /* Board view: grouped by category */
        tech.categories ? (
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(allCats.length, 4)}, 1fr)` }}>
            {allCats.filter(c => !filterCat || c === filterCat).map(cat => (
              <div key={cat} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3">
                <h3 className="text-sm font-semibold text-zinc-300 mb-3 flex items-center justify-between">
                  {cat}
                  <span className="text-xs text-zinc-500 font-normal">{(grouped[cat] ?? []).length}</span>
                </h3>
                <div className="space-y-2">
                  {(grouped[cat] ?? []).map(idea => (
                    <IdeaCard
                      key={idea.id}
                      idea={idea}
                      editing={editingId === idea.id}
                      editContent={editContent}
                      onStartEdit={() => { setEditingId(idea.id); setEditContent(idea.content); }}
                      onSaveEdit={() => updateIdea(idea.id, editContent)}
                      onCancelEdit={() => setEditingId(null)}
                      onEditChange={setEditContent}
                      onDelete={() => deleteIdea(idea.id)}
                      onVote={(d) => voteIdea(idea.id, d)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Board view: no categories — grid of cards */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredIdeas.map(idea => (
              <IdeaCard
                key={idea.id}
                idea={idea}
                editing={editingId === idea.id}
                editContent={editContent}
                onStartEdit={() => { setEditingId(idea.id); setEditContent(idea.content); }}
                onSaveEdit={() => updateIdea(idea.id, editContent)}
                onCancelEdit={() => setEditingId(null)}
                onEditChange={setEditContent}
                onDelete={() => deleteIdea(idea.id)}
                onVote={(d) => voteIdea(idea.id, d)}
              />
            ))}
          </div>
        )
      ) : (
        /* List view */
        <div className="space-y-2">
          {filteredIdeas.map((idea, idx) => (
            <div
              key={idea.id}
              className="flex items-start gap-3 p-3 bg-zinc-900 border border-zinc-800 rounded-lg group hover:border-zinc-700 transition"
            >
              <span className="text-xs text-zinc-600 font-mono mt-1 w-6 text-right">{idx + 1}</span>
              <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{ backgroundColor: idea.color }} />
              <div className="flex-1 min-w-0">
                {editingId === idea.id ? (
                  <div className="flex gap-2">
                    <input
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") updateIdea(idea.id, editContent);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-white"
                      autoFocus
                    />
                    <button onClick={() => updateIdea(idea.id, editContent)} className="text-green-400 hover:text-green-300"><Save size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-white"><X size={14} /></button>
                  </div>
                ) : (
                  <p className="text-sm text-zinc-200">{idea.content}</p>
                )}
                {idea.category && (
                  <span className="text-xs text-zinc-500 mt-0.5 inline-block">{idea.category}</span>
                )}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                {idea.votes > 0 && <span className="text-xs text-yellow-400 mr-1">{idea.votes}</span>}
                <button onClick={() => voteIdea(idea.id, 1)} className="p-1 text-zinc-500 hover:text-yellow-400"><ThumbsUp size={12} /></button>
                <button onClick={() => { setEditingId(idea.id); setEditContent(idea.content); }} className="p-1 text-zinc-500 hover:text-white"><Pencil size={12} /></button>
                <button onClick={() => deleteIdea(idea.id)} className="p-1 text-zinc-500 hover:text-red-400"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {ideas.length > 0 && (
        <div className="mt-6 p-4 bg-zinc-900 border border-zinc-800 rounded-xl">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
            <Target size={14} /> Zusammenfassung
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-white">{ideas.length}</p>
              <p className="text-xs text-zinc-500">Ideen gesamt</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-yellow-400">{ideas.filter(i => i.votes > 0).length}</p>
              <p className="text-xs text-zinc-500">Bewertet</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-violet-400">
                {tech.categories ? new Set(ideas.map(i => i.category).filter(Boolean)).size : "—"}
              </p>
              <p className="text-xs text-zinc-500">Kategorien genutzt</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-cyan-400">
                {ideas.reduce((max, i) => Math.max(max, i.votes), 0)}
              </p>
              <p className="text-xs text-zinc-500">Max. Stimmen</p>
            </div>
          </div>
          {ideas.filter(i => i.votes > 0).length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-800">
              <p className="text-xs text-zinc-400 mb-1">Top Ideen:</p>
              {[...ideas].sort((a, b) => b.votes - a.votes).slice(0, 3).map((idea, idx) => (
                <p key={idea.id} className="text-sm text-zinc-300 flex items-center gap-2">
                  <span className="text-yellow-400 text-xs">{idea.votes}x</span>
                  <span className="line-clamp-1">{idea.content}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Idea Card Component ────────────────────────────────────────────── */
function IdeaCard({
  idea, editing, editContent, onStartEdit, onSaveEdit, onCancelEdit, onEditChange, onDelete, onVote,
}: {
  idea: BrainstormIdea;
  editing: boolean;
  editContent: string;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onEditChange: (v: string) => void;
  onDelete: () => void;
  onVote: (delta: number) => void;
}) {
  return (
    <div
      className="p-3 rounded-lg border border-zinc-800 bg-zinc-900 hover:border-zinc-700 group transition"
      style={{ borderLeftWidth: 3, borderLeftColor: idea.color }}
    >
      {editing ? (
        <div>
          <textarea
            value={editContent}
            onChange={e => onEditChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && e.ctrlKey) onSaveEdit();
              if (e.key === "Escape") onCancelEdit();
            }}
            className="w-full bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-white resize-none"
            rows={3}
            autoFocus
          />
          <div className="flex gap-1 mt-1">
            <button onClick={onSaveEdit} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1">
              <Save size={12} /> Speichern
            </button>
            <button onClick={onCancelEdit} className="text-xs text-zinc-400 hover:text-white ml-2">Abbrechen</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-zinc-200 mb-2">{idea.content}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              {idea.votes > 0 && (
                <span className="text-xs text-yellow-400 flex items-center gap-0.5">
                  <ThumbsUp size={10} /> {idea.votes}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
              <button onClick={() => onVote(1)} className="p-1 text-zinc-500 hover:text-yellow-400" title="Vote"><ThumbsUp size={12} /></button>
              {idea.votes > 0 && (
                <button onClick={() => onVote(-1)} className="p-1 text-zinc-500 hover:text-zinc-300" title="Unvote"><Minus size={12} /></button>
              )}
              <button onClick={onStartEdit} className="p-1 text-zinc-500 hover:text-white" title="Bearbeiten"><Pencil size={12} /></button>
              <button onClick={onDelete} className="p-1 text-zinc-500 hover:text-red-400" title="Löschen"><Trash2 size={12} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
