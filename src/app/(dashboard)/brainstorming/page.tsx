"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import {
  Plus, Trash2, Pencil, X, ArrowLeft, Save, Lightbulb,
  ThumbsUp, Sparkles, LayoutGrid, List,
  Target, BookOpen, Shuffle,
  Minus, RefreshCw, Zap, MessageSquare, Star,
  Bot, Send, Loader2, Copy, Check
} from "lucide-react";
import type {
  BrainstormSession, BrainstormIdea, BrainstormTechnique,
  CalendarEvent, Task, Module
} from "@/types/database";

/* ── Technique definitions (vollständig Deutsch) ────────────────────── */
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
    color: "#a78bfa",
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
    label: "SCAMPER-Methode",
    icon: <Shuffle size={18} />,
    color: "#60a5fa",
    description: "Systematische Kreativtechnik: Ersetzen, Kombinieren, Anpassen, Verändern, Zweckentfremden, Entfernen, Umkehren.",
    prompts: [
      "Ersetzen: Was könntest du durch etwas anderes austauschen?",
      "Kombinieren: Welche Ideen oder Konzepte lassen sich zusammenführen?",
      "Anpassen: Was aus einem anderen Kontext lässt sich hier anwenden?",
      "Verändern: Was kannst du vergrössern, verkleinern oder umgestalten?",
      "Zweckentfremden: Wie könnte es für einen anderen Zweck genutzt werden?",
      "Entfernen: Was kann weggelassen oder vereinfacht werden?",
      "Umkehren: Was passiert wenn du die Reihenfolge oder Perspektive umdrehst?",
    ],
    categories: ["Ersetzen", "Kombinieren", "Anpassen", "Verändern", "Zweckentfremden", "Entfernen", "Umkehren"],
  },
  {
    key: "pro_contra",
    label: "Pro & Contra",
    icon: <Minus size={18} />,
    color: "#34d399",
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
    label: "Sternfragen (5W1H)",
    icon: <Star size={18} />,
    color: "#fbbf24",
    description: "Erforsche dein Thema mit den 6 Grundfragen: Wer, Was, Wo, Wann, Warum, Wie.",
    prompts: [
      "WER ist betroffen oder beteiligt?",
      "WAS genau ist das Problem oder Thema?",
      "WO findet es statt oder tritt es auf?",
      "WANN ist es relevant oder tritt es ein?",
      "WARUM ist es wichtig?",
      "WIE kann es gelöst oder umgesetzt werden?",
    ],
    categories: ["Wer", "Was", "Wo", "Wann", "Warum", "Wie"],
  },
  {
    key: "brainwriting",
    label: "Ideenkettenreaktion",
    icon: <MessageSquare size={18} />,
    color: "#f472b6",
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
    label: "Umkehr-Brainstorming",
    icon: <RefreshCw size={18} />,
    color: "#f87171",
    description: "Denke umgekehrt: Was würde das Problem verschlimmern? Dann kehre die Ideen um.",
    prompts: [
      "Wie könntest du das Problem absichtlich verschlimmern?",
      "Was wäre die schlimmste mögliche Lösung?",
      "Welche Fehler könnten garantiert zum Scheitern führen?",
      "Jetzt umkehren: Was ist das Gegenteil jeder schlechten Idee?",
    ],
    categories: ["Problem verschlimmern", "Umgekehrte Lösung"],
  },
  {
    key: "minddump",
    label: "Gedankenflut",
    icon: <Zap size={18} />,
    color: "#22d3ee",
    description: "Timer-basiert: Schreibe 5 Minuten lang alles auf was dir einfällt. Quantität vor Qualität!",
    prompts: [
      "Schreibe alles auf — ohne Filter, ohne Pause!",
      "Noch nicht fertig? Was liegt dir noch auf dem Herzen?",
      "Welche Gedanken schwirren noch im Kopf herum?",
    ],
  },
];

const IDEA_COLORS = [
  "#a78bfa","#60a5fa","#34d399","#f87171","#fbbf24",
  "#f472b6","#22d3ee","#c084fc","#4ade80","#fb923c",
  "#818cf8","#2dd4bf","#facc15","#fb7185","#a78bfa",
];

/* ── KI-Assistent (lokale Prompt-basierte Vorschläge) ───────────────── */
const AI_SUGGESTION_TEMPLATES: Record<string, (topic: string, existingIdeas: string[]) => string[]> = {
  freeform: (topic, ideas) => [
    `Hast du schon an die technische Seite von "${topic}" gedacht?`,
    `Was würde jemand aus einer komplett anderen Fachrichtung zu "${topic}" sagen?`,
    `Stelle dir vor "${topic}" existiert in 10 Jahren — wie sieht es aus?`,
    ideas.length > 2 ? `Kannst du Idee "${ideas[0]}" mit "${ideas[1]}" kombinieren?` : `Welche Emotion verbindest du mit "${topic}"?`,
    `Was ist das Minimum Viable Product für "${topic}"?`,
  ],
  scamper: (topic, ideas) => [
    `Ersetzen: Was wäre, wenn du "${topic}" mit einer komplett anderen Methode umsetzt?`,
    `Kombinieren: Wie liesse sich "${topic}" mit einem aktuellen Trend verbinden?`,
    `Anpassen: Welche Lösung aus der Natur könnte auf "${topic}" angewendet werden?`,
    `Verändern: Was wenn "${topic}" 10x grösser oder 10x kleiner wäre?`,
    `Entfernen: Was passiert wenn du den wichtigsten Teil von "${topic}" weglässt?`,
  ],
  pro_contra: (topic, ideas) => [
    `Welchen finanziellen Einfluss hat "${topic}"?`,
    `Wie wirkt sich "${topic}" auf deine Zeitplanung aus?`,
    `Was sagen Kritiker zu "${topic}" — und haben sie recht?`,
    `Gibt es einen Mittelweg der die Nachteile minimiert?`,
  ],
  starbursting: (topic, ideas) => [
    `Wer profitiert am meisten wenn "${topic}" umgesetzt wird?`,
    `Was ist das grösste ungelöste Problem bei "${topic}"?`,
    `Wie misst man den Erfolg von "${topic}"?`,
    `Warum wurde "${topic}" bisher noch nicht anders gelöst?`,
  ],
  brainwriting: (topic, ideas) => {
    if (ideas.length === 0) return [`Beginne mit 3 schnellen Ideen zu "${topic}" — ohne Nachdenken!`];
    return [
      `Wie könnte "${ideas[ideas.length - 1]}" noch besser werden?`,
      `Was ist das Gegenteil von "${ideas[0]}"?`,
      `Welche zwei bestehenden Ideen ergeben zusammen etwas Neues?`,
    ];
  },
  reverse: (topic, ideas) => [
    `Was wäre der sicherste Weg "${topic}" zum Scheitern zu bringen?`,
    `Welcher Fehler wäre so offensichtlich, dass ihn niemand machen würde?`,
    `Jetzt dreh es um: Was ist die perfekte Lösung die sich daraus ergibt?`,
  ],
  minddump: (topic, ideas) => [
    `Schnell — was kommt dir als erstes in den Sinn?`,
    `Noch mehr! Denk nicht nach, schreib einfach!`,
    `Was hast du vergessen? Es wartet noch eine Idee!`,
  ],
};

function getAiSuggestions(technique: string, topic: string, ideas: BrainstormIdea[]): string[] {
  const fn = AI_SUGGESTION_TEMPLATES[technique] ?? AI_SUGGESTION_TEMPLATES.freeform;
  const ideaTexts = ideas.map(i => i.content);
  return fn(topic, ideaTexts);
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function BrainstormingPage() {
  const supabase = createClient();
  const { modules } = useModules();
  const [sessions, setSessions] = useState<BrainstormSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<BrainstormSession | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [preselectedTech, setPreselectedTech] = useState<BrainstormTechnique | null>(null);
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
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Lightbulb className="text-yellow-300" /> Brainstorming
          </h1>
          <p className="text-zinc-400 text-xs sm:text-sm mt-1">Ideen sammeln, Kreativität entfalten, Probleme lösen</p>
        </div>
        <button
          onClick={() => { setPreselectedTech(null); setShowCreate(true); }}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition"
        >
          <Plus size={16} /> Neue Session
        </button>
      </div>

      {/* Technique overview cards */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">Techniken</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {TECHNIQUES.map(t => (
            <button
              key={t.key}
              onClick={() => { setPreselectedTech(t.key); setShowCreate(true); }}
              className="bg-zinc-900 border border-zinc-700 rounded-lg p-3.5 text-left hover:border-zinc-500 hover:bg-zinc-800/80 transition group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ color: t.color }}>{t.icon}</span>
                <span className="text-sm font-medium text-zinc-100">{t.label}</span>
              </div>
              <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{t.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Session list */}
      <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">Meine Sessions</h2>
      {loading ? (
        <p className="text-zinc-400 text-sm">Laden...</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb size={48} className="mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-400">Noch keine Brainstorming-Sessions</p>
          <p className="text-sm mt-1 text-zinc-500">Starte eine neue Session um Ideen zu sammeln!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {sessions.map(s => {
            const tech = TECHNIQUES.find(t => t.key === s.technique);
            const mod = modules.find(m => m.id === s.module_id);
            return (
              <button
                key={s.id}
                onClick={() => setActiveSession(s)}
                className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 text-left hover:border-brand-500/60 hover:bg-zinc-800/60 transition group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-zinc-100 text-sm group-hover:text-brand-300 transition line-clamp-1">
                    {s.title}
                  </h3>
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
                    style={{ backgroundColor: s.color }}
                  />
                </div>
                {tech && (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mb-2 font-medium"
                    style={{ backgroundColor: tech.color + "22", color: tech.color }}
                  >
                    {tech.icon} {tech.label}
                  </span>
                )}
                {mod && (
                  <span
                    className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ml-1 mb-2 font-medium"
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
          initialTechnique={preselectedTech}
          onClose={() => setShowCreate(false)}
          onCreated={(s) => { setActiveSession(s); setShowCreate(false); }}
        />
      )}
    </div>
  );
}

/* ── Create Session Modal ───────────────────────────────────────────── */
function CreateSessionModal({
  modules, exams, tasks, initialTechnique, onClose, onCreated,
}: {
  modules: Module[];
  exams: CalendarEvent[];
  tasks: Task[];
  initialTechnique: BrainstormTechnique | null;
  onClose: () => void;
  onCreated: (s: BrainstormSession) => void;
}) {
  const supabase = createClient();
  const [title, setTitle] = useState("");
  const [technique, setTechnique] = useState<BrainstormTechnique>(initialTechnique ?? "freeform");
  const [moduleId, setModuleId] = useState("");
  const [examId, setExamId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [color, setColor] = useState("#a78bfa");
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
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-600 rounded-2xl w-full max-w-lg p-3 sm:p-6 mx-4 max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-white">Neue Brainstorming-Session</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white transition"><X size={20} /></button>
        </div>

        <label className="block text-xs sm:text-sm font-medium text-zinc-200 mb-1.5">Titel</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={selectedTech.label}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-500 mb-4 focus:border-brand-500 focus:outline-none transition"
        />

        <label className="block text-xs sm:text-sm font-medium text-zinc-200 mb-2">Technik wählen</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {TECHNIQUES.map(t => (
            <button
              key={t.key}
              onClick={() => setTechnique(t.key)}
              className={`flex items-center gap-2 p-1.5 sm:p-2.5 rounded-lg border text-xs text-left transition ${
                technique === t.key
                  ? "border-brand-500 bg-brand-500/15 text-white"
                  : "border-zinc-600 bg-zinc-800/80 text-zinc-300 hover:border-zinc-500 hover:text-white"
              }`}
            >
              <span style={{ color: t.color }}>{t.icon}</span>
              <div className="font-medium">{t.label}</div>
            </button>
          ))}
        </div>

        <div className="text-xs text-zinc-300 mb-4 p-3 bg-zinc-800/80 border border-zinc-700 rounded-lg flex items-start gap-2">
          <span className="mt-0.5" style={{ color: selectedTech.color }}>{selectedTech.icon}</span>
          <span>{selectedTech.description}</span>
        </div>

        <label className="block text-xs sm:text-sm font-medium text-zinc-200 mb-1.5">Verknüpfung (optional)</label>
        <select
          value={moduleId}
          onChange={e => { setModuleId(e.target.value); setExamId(""); setTaskId(""); }}
          className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-white mb-2"
        >
          <option value="">Allgemein (kein Modul)</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {moduleId && (
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <select
              value={examId}
              onChange={e => setExamId(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white"
            >
              <option value="">Keine Prüfung</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white"
            >
              <option value="">Keine Aufgabe</option>
              {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <label className="block text-xs sm:text-sm font-medium text-zinc-200 mb-1.5 mt-3">Farbe</label>
        <div className="flex gap-2 mb-5 flex-wrap">
          {IDEA_COLORS.slice(0, 10).map(c => (
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
          className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition disabled:opacity-50"
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
  const [timerSec, setTimerSec] = useState(300);
  const [showAi, setShowAi] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
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

  async function addIdea(content?: string) {
    const text = content ?? newContent;
    if (!text.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const category = newCategory || (tech.categories?.[0] ?? "");
    const sortOrder = ideas.length;
    const color = IDEA_COLORS[sortOrder % IDEA_COLORS.length];

    await supabase.from("brainstorm_ideas").insert({
      user_id: user.id,
      session_id: session.id,
      content: text.trim(),
      category,
      color,
      sort_order: sortOrder,
    });

    await supabase.from("brainstorm_sessions").update({ updated_at: new Date().toISOString() }).eq("id", session.id);

    if (!content) setNewContent("");
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

  async function deleteSession() {
    if (!confirm("Session wirklich löschen? Alle Ideen gehen verloren.")) return;
    await supabase.from("brainstorm_ideas").delete().eq("session_id", session.id);
    await supabase.from("brainstorm_sessions").delete().eq("id", session.id);
    onBack();
  }

  function nextPrompt() {
    setPromptIndex(i => (i + 1) % tech.prompts.length);
  }

  function generateAiSuggestions() {
    const topic = session.title || mod?.name || "dein Thema";
    const suggestions = getAiSuggestions(session.technique, topic, ideas);
    setAiSuggestions(suggestions);
    setShowAi(true);
  }

  function copyToInput(text: string, idx: number) {
    setNewContent(text);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
    inputRef.current?.focus();
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
    <div className="p-3 sm:p-6 max-w-6xl mx-auto space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-0 sm:mb-4 mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onBack} className="text-zinc-400 hover:text-white transition p-1">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span style={{ color: tech.color }}>{tech.icon}</span>
              {session.title}
            </h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: tech.color + "30", color: tech.color }}>
                {tech.label}
              </span>
              {mod && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: mod.color + "30", color: mod.color }}>
                  <BookOpen size={10} className="inline mr-1" />{mod.name}
                </span>
              )}
              <span className="text-xs text-zinc-400">{ideas.length} Ideen</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap sm:flex-nowrap">
          <button
            onClick={generateAiSuggestions}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-brand-600 border border-brand-500 text-white hover:bg-brand-500 text-xs sm:text-sm font-medium transition"
            title="KI-Vorschläge generieren"
          >
            <Bot size={16} /> KI-Assistent
          </button>
          <button
            onClick={() => setViewMode(viewMode === "board" ? "list" : "board")}
            className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 transition"
            title={viewMode === "board" ? "Listenansicht" : "Board-Ansicht"}
          >
            {viewMode === "board" ? <List size={16} /> : <LayoutGrid size={16} />}
          </button>
          <button
            onClick={deleteSession}
            className="p-2 rounded-lg bg-zinc-800 border border-zinc-700 text-red-400 hover:text-red-300 hover:border-red-500/40 transition"
            title="Session löschen"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* KI-Assistent Panel */}
      {showAi && aiSuggestions.length > 0 && (
        <div className="mb-4 p-3 sm:p-4 rounded-xl border border-zinc-600 bg-zinc-900">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-xs sm:text-sm font-semibold text-brand-400 flex items-center gap-2">
              <Bot size={16} /> KI-Denkanstösse
            </h3>
            <div className="flex gap-1">
              <button
                onClick={generateAiSuggestions}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
                title="Neue Vorschläge"
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => setShowAi(false)}
                className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-2.5">
            {aiSuggestions.map((s, idx) => (
              <div key={idx} className="flex items-start gap-2.5 group">
                <Sparkles size={12} className="text-brand-400 mt-1.5 flex-shrink-0" />
                <p className="text-xs sm:text-sm text-white flex-1 leading-relaxed">{s}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                  <button
                    onClick={() => copyToInput(s, idx)}
                    className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition"
                    title="In Eingabefeld kopieren"
                  >
                    {copiedIdx === idx ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => addIdea(s)}
                    className="p-1.5 text-zinc-400 hover:text-green-400 hover:bg-zinc-700 rounded transition"
                    title="Direkt als Idee hinzufügen"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inspiration / Prompt Card */}
      {showPrompt && (
        <div className="mb-4 p-3 sm:p-4 rounded-xl border border-zinc-600 bg-zinc-900 flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
          <Sparkles size={16} className="flex-shrink-0 mt-0.5 sm:mt-0.5" style={{ color: tech.color }} />
          <div className="flex-1">
            <p className="text-xs sm:text-sm text-white font-medium leading-relaxed">{tech.prompts[promptIndex]}</p>
            {mod && (
              <p className="text-xs text-zinc-400 mt-1">
                Kontext: {mod.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={nextPrompt}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
              title="Nächster Denkanstoß"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-700 transition"
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
          className="mb-4 text-xs text-zinc-300 hover:text-white flex items-center gap-1 transition"
        >
          <Sparkles size={12} /> Denkanstoß anzeigen
        </button>
      )}

      {/* Mind Dump Timer */}
      {session.technique === "minddump" && (
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-zinc-900 border border-zinc-600 rounded-xl">
          <Zap size={16} className="text-cyan-400 sm:size-[18px]" />
          <span className="text-lg sm:text-2xl font-mono text-white font-bold tracking-wider">{fmtTimer(timerSec)}</span>
          {!timerActive ? (
            <button
              onClick={() => { setTimerActive(true); if (timerSec === 0) setTimerSec(300); }}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs sm:text-sm font-medium transition"
            >
              {timerSec === 300 ? "Start" : "Weiter"}
            </button>
          ) : (
            <button
              onClick={() => setTimerActive(false)}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-xs sm:text-sm font-medium transition"
            >
              Pause
            </button>
          )}
          <button
            onClick={() => { setTimerActive(false); setTimerSec(300); }}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg text-xs sm:text-sm transition"
          >
            Reset
          </button>
          <span className="text-xs text-zinc-400 ml-auto">Schreibe so viele Ideen wie möglich!</span>
        </div>
      )}

      {/* Input bar */}
      <div className="mb-6 flex flex-col sm:flex-row gap-2">
        <div className="flex-1 flex gap-2">
          <input
            ref={inputRef}
            value={newContent}
            onChange={e => setNewContent(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addIdea(); } }}
            placeholder="Neue Idee eingeben... (Enter zum Hinzufügen)"
            className="flex-1 bg-zinc-800 border border-zinc-600 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-white placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none transition"
            autoFocus
          />
          {tech.categories && (
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="bg-zinc-800 border border-zinc-600 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-white w-full sm:w-auto sm:min-w-[130px]"
            >
              {tech.categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
        </div>
        <button
          onClick={() => addIdea()}
          disabled={!newContent.trim()}
          className="bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium transition flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-start"
        >
          <Plus size={16} /> Hinzufügen
        </button>
      </div>

      {/* Category filter */}
      {tech.categories && tech.categories.length > 1 && (
        <div className="flex gap-1 sm:gap-1.5 mb-4 flex-wrap overflow-x-auto pb-2">
          <button
            onClick={() => setFilterCat("")}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
              !filterCat ? "bg-brand-600 text-white" : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
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
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                  filterCat === cat ? "bg-brand-600 text-white" : "bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white"
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
        <p className="text-zinc-400 text-sm">Laden...</p>
      ) : ideas.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb size={48} className="mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-400">Noch keine Ideen — leg los!</p>
          <p className="text-xs mt-1 text-zinc-500">Nutze den Denkanstoß oder KI-Assistent als Inspiration</p>
        </div>
      ) : viewMode === "board" ? (
        tech.categories ? (
          <div className="grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(allCats.length, 4)}, 1fr)` }}>
            {allCats.filter(c => !filterCat || c === filterCat).map(cat => (
              <div key={cat} className="bg-zinc-900 border border-zinc-700 rounded-xl p-2 sm:p-3">
                <h3 className="text-xs sm:text-sm font-semibold text-zinc-200 mb-3 flex items-center justify-between">
                  {cat}
                  <span className="text-xs text-zinc-500 font-normal bg-zinc-800 px-2 py-0.5 rounded-full">{(grouped[cat] ?? []).length}</span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
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
        <div className="space-y-1.5 sm:space-y-2">
          {filteredIdeas.map((idea, idx) => (
            <div
              key={idea.id}
              className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-zinc-900 border border-zinc-700 rounded-lg group hover:border-zinc-600 transition text-xs sm:text-sm"
            >
              <span className="text-xs text-zinc-500 font-mono mt-1 w-6 text-right">{idx + 1}</span>
              <div className="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: idea.color }} />
              <div className="flex-1 min-w-0">
                {editingId === idea.id ? (
                  <div className="flex gap-1 sm:gap-2 w-full">
                    <input
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === "Enter") updateIdea(idea.id, editContent);
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 bg-zinc-800 border border-zinc-500 rounded px-2 py-1 text-xs sm:text-sm text-white focus:border-brand-500 focus:outline-none"
                      autoFocus
                    />
                    <button onClick={() => updateIdea(idea.id, editContent)} className="text-green-400 hover:text-green-300"><Save size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-white"><X size={14} /></button>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-zinc-100">{idea.content}</p>
                )}
                {idea.category && (
                  <span className="text-xs text-zinc-500 mt-0.5 inline-block">{idea.category}</span>
                )}
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                {idea.votes > 0 && <span className="text-xs text-yellow-400 mr-1 font-medium">{idea.votes}</span>}
                <button onClick={() => voteIdea(idea.id, 1)} className="p-1 text-zinc-500 hover:text-yellow-400 transition"><ThumbsUp size={12} /></button>
                <button onClick={() => { setEditingId(idea.id); setEditContent(idea.content); }} className="p-1 text-zinc-500 hover:text-white transition"><Pencil size={12} /></button>
                <button onClick={() => deleteIdea(idea.id)} className="p-1 text-zinc-500 hover:text-red-400 transition"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {ideas.length > 0 && (
        <div className="mt-6 p-3 sm:p-4 bg-zinc-900 border border-zinc-700 rounded-xl">
          <h3 className="text-xs sm:text-sm font-semibold text-zinc-200 mb-3 flex items-center gap-2">
            <Target size={14} className="text-brand-400" /> Zusammenfassung
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center">
            <div>
              <p className="text-lg sm:text-2xl font-bold text-white">{ideas.length}</p>
              <p className="text-xs text-zinc-400">Ideen</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-yellow-400">{ideas.filter(i => i.votes > 0).length}</p>
              <p className="text-xs text-zinc-400">Bewertet</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-brand-400">
                {tech.categories ? new Set(ideas.map(i => i.category).filter(Boolean)).size : "\u2014"}
              </p>
              <p className="text-xs text-zinc-400">Kategorien</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-cyan-400">
                {ideas.reduce((max, i) => Math.max(max, i.votes), 0)}
              </p>
              <p className="text-xs text-zinc-400">Top Wertung</p>
            </div>
          </div>
          {ideas.filter(i => i.votes > 0).length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-700">
              <p className="text-xs text-zinc-400 mb-2 font-medium">Top Ideen:</p>
              {[...ideas].sort((a, b) => b.votes - a.votes).slice(0, 3).map((idea) => (
                <p key={idea.id} className="text-xs sm:text-sm text-zinc-200 flex items-center gap-2 py-0.5">
                  <span className="text-yellow-400 text-xs font-medium min-w-[20px]">{idea.votes}x</span>
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
      className="p-2 sm:p-3 rounded-lg border border-zinc-700 bg-zinc-800 hover:border-zinc-500 group transition"
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
            className="w-full bg-zinc-800 border border-zinc-500 rounded px-2 py-1 sm:py-1.5 text-xs sm:text-sm text-white resize-none focus:border-brand-500 focus:outline-none"
            rows={3}
            autoFocus
          />
          <div className="flex gap-1.5 sm:gap-2 mt-1.5">
            <button onClick={onSaveEdit} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 font-medium transition">
              <Save size={12} /> Speichern
            </button>
            <button onClick={onCancelEdit} className="text-xs text-zinc-400 hover:text-white transition">Abbrechen</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs sm:text-sm text-zinc-100 mb-2 leading-relaxed">{idea.content}</p>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1">
              {idea.votes > 0 && (
                <span className="text-xs text-yellow-400 flex items-center gap-0.5 font-medium">
                  <ThumbsUp size={10} /> {idea.votes}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
              <button onClick={() => onVote(1)} className="p-1 text-zinc-500 hover:text-yellow-400 transition" title="Bewerten"><ThumbsUp size={12} /></button>
              {idea.votes > 0 && (
                <button onClick={() => onVote(-1)} className="p-1 text-zinc-500 hover:text-zinc-300 transition" title="Abwerten"><Minus size={12} /></button>
              )}
              <button onClick={onStartEdit} className="p-1 text-zinc-500 hover:text-white transition" title="Bearbeiten"><Pencil size={12} /></button>
              <button onClick={onDelete} className="p-1 text-zinc-500 hover:text-red-400 transition" title="Löschen"><Trash2 size={12} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
