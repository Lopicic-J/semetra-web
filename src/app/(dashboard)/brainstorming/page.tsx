"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { FREE_LIMITS, withinFreeLimit } from "@/lib/gates";
import { LimitNudge, LimitCounter, UpgradeModal } from "@/components/ui/ProGate";
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
import { useTranslation } from "@/lib/i18n";

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

function getTechniques(t: (key: string) => string): TechniqueDef[] {
  return [
    {
      key: "freeform",
      label: t("brainstorming.methodFreeform"),
      icon: <Lightbulb size={18} />,
      color: "#a78bfa",
      description: t("brainstorming.methodFreeformDesc"),
      prompts: [
        t("brainstorming.methodFreeformQ1"),
        t("brainstorming.methodFreeformQ2"),
        t("brainstorming.methodFreeformQ3"),
        t("brainstorming.methodFreeformQ4"),
        t("brainstorming.methodFreeformQ5"),
      ],
    },
    {
      key: "scamper",
      label: t("brainstorming.methodScamper"),
      icon: <Shuffle size={18} />,
      color: "#60a5fa",
      description: t("brainstorming.methodScamperDesc"),
      prompts: [
        t("brainstorming.methodScamperSubstitute"),
        t("brainstorming.methodScamperCombine"),
        t("brainstorming.methodScamperAdapt"),
        t("brainstorming.methodScamperModify"),
        t("brainstorming.methodScamperRepurpose"),
        t("brainstorming.methodScamperRemove"),
        t("brainstorming.methodScamperReverse"),
      ],
      categories: [
        t("brainstorming.methodScamperSubstitute").split(":")[0],
        t("brainstorming.methodScamperCombine").split(":")[0],
        t("brainstorming.methodScamperAdapt").split(":")[0],
        t("brainstorming.methodScamperModify").split(":")[0],
        t("brainstorming.methodScamperRepurpose").split(":")[0],
        t("brainstorming.methodScamperRemove").split(":")[0],
        t("brainstorming.methodScamperReverse").split(":")[0],
      ],
    },
    {
      key: "pro_contra",
      label: t("brainstorming.methodProCon"),
      icon: <Minus size={18} />,
      color: "#34d399",
      description: t("brainstorming.methodProConDesc"),
      prompts: [
        t("brainstorming.methodProConQ1"),
        t("brainstorming.methodProConQ2"),
        t("brainstorming.methodProConQ3"),
        t("brainstorming.methodProConQ4"),
      ],
      categories: [t("brainstorming.methodProConPro"), t("brainstorming.methodProConCon"), t("brainstorming.methodProConNeutral")],
    },
    {
      key: "starbursting",
      label: t("brainstorming.methodWhy"),
      icon: <Star size={18} />,
      color: "#fbbf24",
      description: t("brainstorming.methodWhyDesc"),
      prompts: [
        t("brainstorming.methodWhyWho"),
        t("brainstorming.methodWhyWhat"),
        t("brainstorming.methodWhyWhere"),
        t("brainstorming.methodWhyWhen"),
        t("brainstorming.methodWhyWhy"),
        t("brainstorming.methodWhyHow"),
      ],
      categories: ["Wer", "Was", "Wo", "Wann", "Warum", "Wie"],
    },
    {
      key: "brainwriting",
      label: t("brainstorming.methodChainReaction"),
      icon: <MessageSquare size={18} />,
      color: "#f472b6",
      description: t("brainstorming.methodChainReactionDesc"),
      prompts: [
        t("brainstorming.methodChainReactionQ1"),
        t("brainstorming.methodChainReactionQ2"),
        t("brainstorming.methodChainReactionQ3"),
        t("brainstorming.methodChainReactionQ4"),
      ],
    },
    {
      key: "reverse",
      label: t("brainstorming.methodReverse"),
      icon: <RefreshCw size={18} />,
      color: "#f87171",
      description: t("brainstorming.methodReverseDesc"),
      prompts: [
        t("brainstorming.methodReverseQ1"),
        t("brainstorming.methodReverseQ2"),
        t("brainstorming.methodReverseQ3"),
        t("brainstorming.methodReverseQ4"),
      ],
      categories: [t("brainstorming.methodReverseWorsen"), t("brainstorming.methodReverseOpposite")],
    },
    {
      key: "minddump",
      label: t("brainstorming.methodRapid"),
      icon: <Zap size={18} />,
      color: "#22d3ee",
      description: t("brainstorming.methodRapidDesc"),
      prompts: [
        t("brainstorming.methodRapidQ1"),
        t("brainstorming.methodRapidQ2"),
        t("brainstorming.methodRapidQ3"),
      ],
    },
  ];
}

const IDEA_COLORS = [
  "#a78bfa","#60a5fa","#34d399","#f87171","#fbbf24",
  "#f472b6","#22d3ee","#c084fc","#4ade80","#fb923c",
  "#818cf8","#2dd4bf","#facc15","#fb7185","#a78bfa",
];

/* ── KI-Assistent (lokale Prompt-basierte Vorschläge) ───────────────── */
function getAISuggestionTemplates(t: (key: string) => string): Record<string, (topic: string, existingIdeas: string[]) => string[]> {
  return {
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
}

function getAiSuggestions(t: (key: string) => string, technique: string, topic: string, ideas: BrainstormIdea[]): string[] {
  const templates = getAISuggestionTemplates(t);
  const fn = templates[technique] ?? templates.freeform;
  const ideaTexts = ideas.map(i => i.content);
  return fn(topic, ideaTexts);
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function BrainstormingPage() {
  const { t } = useTranslation();
  const supabase = createClient();
  const { modules } = useModules();
  const { isPro } = useProfile();
  const [sessions, setSessions] = useState<BrainstormSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSession, setActiveSession] = useState<BrainstormSession | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
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

  const TECHNIQUES = getTechniques(t);

  return (
    <div className="p-3 sm:p-6 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Lightbulb className="text-yellow-300" /> {t("brainstorming.title")}
          </h1>
          <p className="text-surface-500 text-xs sm:text-sm mt-1">{t("brainstorming.createSession")}</p>
        </div>
        <div className="flex items-center gap-3">
          <LimitCounter current={sessions.length} max={FREE_LIMITS.brainstormSessions} isPro={isPro} />
          <button
            onClick={() => {
              const check = withinFreeLimit("brainstormSessions", sessions.length, isPro);
              if (!check.allowed) { setShowUpgrade(true); return; }
              setPreselectedTech(null); setShowCreate(true);
            }}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-2.5 sm:px-4 py-1.5 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition"
          >
            <Plus size={16} /> {t("brainstorming.createSession")}
          </button>
        </div>
      </div>

      <LimitNudge current={sessions.length} max={FREE_LIMITS.brainstormSessions} isPro={isPro} label={t("brainstorming.title")} />

      {showUpgrade && (
        <UpgradeModal feature="unlimitedBrainstorm" onClose={() => setShowUpgrade(false)} />
      )}

      {/* Technique overview cards */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider mb-3">{t("nav.brainstorming")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {getTechniques(t).map(tech => (
            <button
              key={tech.key}
              onClick={() => { setPreselectedTech(tech.key); setShowCreate(true); }}
              className="bg-white border border-surface-200 rounded-lg p-3.5 text-left hover:border-surface-300 hover:bg-surface-50 transition group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ color: tech.color }}>{tech.icon}</span>
                <span className="text-sm font-medium text-surface-800">{tech.label}</span>
              </div>
              <p className="text-xs text-surface-500 line-clamp-2 leading-relaxed">{tech.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Session list */}
      <h2 className="text-sm font-semibold text-surface-700 uppercase tracking-wider mb-3">{t("brainstorming.title")}</h2>
      {loading ? (
        <p className="text-surface-500 text-sm">{t("brainstorming.noSessions")}</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb size={48} className="mx-auto mb-4 text-surface-300" />
          <p className="text-surface-500">{t("brainstorming.noSessions")}</p>
          <p className="text-sm mt-1 text-surface-400">{t("brainstorming.createSession")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {sessions.map(s => {
            const tech = getTechniques(t).find(tech => tech.key === s.technique);
            const mod = modules.find((m: any) => m.id === s.module_id);
            return (
              <button
                key={s.id}
                onClick={() => setActiveSession(s)}
                className="bg-white border border-surface-200 rounded-xl p-4 text-left hover:border-brand-500/60 hover:bg-surface-50 transition group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-surface-800 text-sm group-hover:text-brand-300 transition line-clamp-1">
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
                <p className="text-xs text-surface-400 mt-1">
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
  const { t } = useTranslation();
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

  const filteredTasks = moduleId ? tasks.filter((t: any) => t.module_id === moduleId) : tasks;

  const selectedTech = getTechniques(t).find(tech => tech.key === technique)!;

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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white border border-surface-200 rounded-2xl w-full max-w-lg p-3 sm:p-6 mx-4 max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-surface-900">{t("brainstorming.createSession")}</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-900 transition"><X size={20} /></button>
        </div>

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">{t("tasks.modal.titleLabel")}</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder={selectedTech.label}
          className="w-full bg-surface-50 border border-surface-200 rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-surface-900 placeholder:text-surface-400 mb-4 focus:border-brand-500 focus:outline-none transition"
        />

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-2">{t("brainstorming.title")}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {getTechniques(t).map(tech => (
            <button
              key={tech.key}
              onClick={() => setTechnique(tech.key)}
              className={`flex items-center gap-2 p-1.5 sm:p-2.5 rounded-lg border text-xs text-left transition ${
                technique === tech.key
                  ? "border-brand-500 bg-brand-500/15 text-surface-900"
                  : "border-surface-200 bg-surface-50 text-surface-700 hover:border-surface-300 hover:text-surface-900"
              }`}
            >
              <span style={{ color: tech.color }}>{tech.icon}</span>
              <div className="font-medium">{tech.label}</div>
            </button>
          ))}
        </div>

        <div className="text-xs text-surface-700 mb-4 p-3 bg-surface-50 border border-surface-200 rounded-lg flex items-start gap-2">
          <span className="mt-0.5" style={{ color: selectedTech.color }}>{selectedTech.icon}</span>
          <span>{selectedTech.description}</span>
        </div>

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">{t("tasks.modal.modulLabel")}</label>
        <select
          value={moduleId}
          onChange={e => { setModuleId(e.target.value); setExamId(""); setTaskId(""); }}
          className="w-full bg-surface-50 border border-surface-200 rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-surface-900 mb-2"
        >
          <option value="">Allgemein (kein Modul)</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {moduleId && (
          <div className="flex flex-col sm:flex-row gap-2 mb-2">
            <select
              value={examId}
              onChange={e => setExamId(e.target.value)}
              className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900"
            >
              <option value="">— keine Prüfung —</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900"
            >
              <option value="">— keine Aufgabe —</option>
              {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5 mt-3">{t("grades.modal.typeDefault")}</label>
        <div className="flex gap-2 mb-5 flex-wrap">
          {IDEA_COLORS.slice(0, 10).map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition ${color === c ? "border-surface-900 scale-110" : "border-surface-200 hover:border-surface-300"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition disabled:opacity-50"
        >
          {saving ? t("flashcards.creating") : t("brainstorming.start")}
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
  const { t } = useTranslation();
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

  const tech = getTechniques(t).find(tech => tech.key === session.technique)!;
  const mod = modules.find((m: any) => m.id === session.module_id);

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
    if (!confirm(t("brainstorming.deleteConfirm"))) return;
    await supabase.from("brainstorm_ideas").delete().eq("session_id", session.id);
    await supabase.from("brainstorm_sessions").delete().eq("id", session.id);
    onBack();
  }

  function nextPrompt() {
    setPromptIndex(i => (i + 1) % tech.prompts.length);
  }

  function generateAiSuggestions() {
    const topic = session.title || mod?.name || "dein Thema";
    const suggestions = getAiSuggestions(t, session.technique, topic, ideas);
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
          <button onClick={onBack} className="text-surface-500 hover:text-surface-900 transition p-1">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-surface-900 flex items-center gap-2">
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
              <span className="text-xs text-surface-500">{ideas.length} Ideen</span>
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
            className="p-2 rounded-lg bg-surface-100 border border-surface-200 text-surface-700 hover:text-surface-900 hover:border-surface-300 transition"
            title={viewMode === "board" ? t("brainstorming.viewList") : t("brainstorming.viewBoard")}
          >
            {viewMode === "board" ? <List size={16} /> : <LayoutGrid size={16} />}
          </button>
          <button
            onClick={deleteSession}
            className="p-2 rounded-lg bg-surface-100 border border-surface-200 text-red-400 hover:text-red-300 hover:border-red-500/40 transition"
            title={t("brainstorming.deleteSession")}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* KI-Assistent Panel */}
      {showAi && aiSuggestions.length > 0 && (
        <div className="mb-4 p-3 sm:p-4 rounded-xl border border-surface-200 bg-surface-50">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-xs sm:text-sm font-semibold text-brand-400 flex items-center gap-2">
              <Bot size={16} /> {t("brainstorming.newSuggestions")}
            </h3>
            <div className="flex gap-1">
              <button
                onClick={generateAiSuggestions}
                className="p-1.5 rounded text-surface-500 hover:text-surface-900 hover:bg-surface-200 transition"
                title={t("brainstorming.newSuggestions")}
              >
                <RefreshCw size={14} />
              </button>
              <button
                onClick={() => setShowAi(false)}
                className="p-1.5 rounded text-surface-500 hover:text-surface-900 hover:bg-surface-200 transition"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="space-y-2.5">
            {aiSuggestions.map((s, idx) => (
              <div key={idx} className="flex items-start gap-2.5 group">
                <Sparkles size={12} className="text-brand-400 mt-1.5 flex-shrink-0" />
                <p className="text-xs sm:text-sm text-surface-900 flex-1 leading-relaxed">{s}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                  <button
                    onClick={() => copyToInput(s, idx)}
                    className="p-1.5 text-surface-500 hover:text-surface-900 hover:bg-surface-200 rounded transition"
                    title={t("brainstorming.copyToInput")}
                  >
                    {copiedIdx === idx ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    onClick={() => addIdea(s)}
                    className="p-1.5 text-surface-500 hover:text-green-400 hover:bg-surface-200 rounded transition"
                    title={t("brainstorming.addAsIdea")}
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
        <div className="mb-4 p-3 sm:p-4 rounded-xl border border-surface-200 bg-surface-50 flex flex-col sm:flex-row items-start gap-2 sm:gap-3">
          <Sparkles size={16} className="flex-shrink-0 mt-0.5 sm:mt-0.5" style={{ color: tech.color }} />
          <div className="flex-1">
            <p className="text-xs sm:text-sm text-surface-900 font-medium leading-relaxed">{tech.prompts[promptIndex]}</p>
            {mod && (
              <p className="text-xs text-surface-500 mt-1">
                Kontext: {mod.name}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={nextPrompt}
              className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-200 transition"
              title={t("brainstorming.nextPrompt")}
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => setShowPrompt(false)}
              className="p-1.5 rounded-lg text-surface-500 hover:text-surface-900 hover:bg-surface-200 transition"
              title={t("brainstorming.hide")}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
      {!showPrompt && (
        <button
          onClick={() => setShowPrompt(true)}
          className="mb-4 text-xs text-surface-700 hover:text-surface-900 flex items-center gap-1 transition"
        >
          <Sparkles size={12} /> {t("brainstorming.methodRapid")}
        </button>
      )}

      {/* Mind Dump Timer */}
      {session.technique === "minddump" && (
        <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-surface-50 border border-surface-200 rounded-xl">
          <Zap size={16} className="text-cyan-400 sm:size-[18px]" />
          <span className="text-lg sm:text-2xl font-mono text-surface-900 font-bold tracking-wider">{fmtTimer(timerSec)}</span>
          {!timerActive ? (
            <button
              onClick={() => { setTimerActive(true); if (timerSec === 0) setTimerSec(300); }}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs sm:text-sm font-medium transition"
            >
              {timerSec === 300 ? t("brainstorming.start") : "Weiter"}
            </button>
          ) : (
            <button
              onClick={() => setTimerActive(false)}
              className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-surface-200 hover:bg-surface-300 text-surface-900 rounded-lg text-xs sm:text-sm font-medium transition"
            >
              Pause
            </button>
          )}
          <button
            onClick={() => { setTimerActive(false); setTimerSec(300); }}
            className="px-2.5 sm:px-3 py-1 sm:py-1.5 bg-surface-100 hover:bg-surface-200 text-surface-700 rounded-lg text-xs sm:text-sm transition"
          >
            Reset
          </button>
          <span className="text-xs text-surface-500 ml-auto">Schreibe so viele Ideen wie möglich!</span>
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
            placeholder={t("brainstorming.title")}
            className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none transition"
            autoFocus
          />
          {tech.categories && (
            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value)}
              className="bg-surface-50 border border-surface-200 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900 w-full sm:w-auto sm:min-w-[130px]"
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
          <Plus size={16} /> {t("tasks.modal.add")}
        </button>
      </div>

      {/* Category filter */}
      {tech.categories && tech.categories.length > 1 && (
        <div className="flex gap-1 sm:gap-1.5 mb-4 flex-wrap overflow-x-auto pb-2">
          <button
            onClick={() => setFilterCat("")}
            className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
              !filterCat ? "bg-brand-600 text-white" : "bg-surface-100 border border-surface-200 text-surface-700 hover:bg-surface-200 hover:text-surface-900"
            }`}
          >
            {t("grades.filterAll")}
          </button>
          {tech.categories.map(cat => {
            const count = (grouped[cat] ?? []).length;
            return (
              <button
                key={cat}
                onClick={() => setFilterCat(filterCat === cat ? "" : cat)}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-xs font-medium transition whitespace-nowrap ${
                  filterCat === cat ? "bg-brand-600 text-white" : "bg-surface-100 border border-surface-200 text-surface-700 hover:bg-surface-200 hover:text-surface-900"
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
        <p className="text-surface-500 text-sm">{t("brainstorming.noSessions")}</p>
      ) : ideas.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb size={48} className="mx-auto mb-4 text-surface-300" />
          <p className="text-surface-500">{t("brainstorming.noSessions")}</p>
          <p className="text-xs mt-1 text-surface-400">Nutze den Denkanstoß oder KI-Assistent als Inspiration</p>
        </div>
      ) : viewMode === "board" ? (
        tech.categories ? (
          <div className="grid gap-2 sm:gap-4" style={{ gridTemplateColumns: `repeat(${Math.min(allCats.length, 4)}, 1fr)` }}>
            {allCats.filter((c: any) => !filterCat || c === filterCat).map(cat => (
              <div key={cat} className="bg-white border border-surface-200 rounded-xl p-2 sm:p-3">
                <h3 className="text-xs sm:text-sm font-semibold text-surface-800 mb-3 flex items-center justify-between">
                  {cat}
                  <span className="text-xs text-surface-500 font-normal bg-surface-100 px-2 py-0.5 rounded-full">{(grouped[cat] ?? []).length}</span>
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
              className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-white border border-surface-200 rounded-lg group hover:border-surface-300 transition text-xs sm:text-sm"
            >
              <span className="text-xs text-surface-400 font-mono mt-1 w-6 text-right">{idx + 1}</span>
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
                      className="flex-1 bg-surface-50 border border-surface-300 rounded px-2 py-1 text-xs sm:text-sm text-surface-900 focus:border-brand-500 focus:outline-none"
                      autoFocus
                    />
                    <button onClick={() => updateIdea(idea.id, editContent)} className="text-green-400 hover:text-green-300"><Save size={14} /></button>
                    <button onClick={() => setEditingId(null)} className="text-surface-500 hover:text-surface-900"><X size={14} /></button>
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-surface-800">{idea.content}</p>
                )}
                {idea.category && (
                  <span className="text-xs text-surface-400 mt-0.5 inline-block">{idea.category}</span>
                )}
              </div>
              <div className="flex items-center gap-0.5 sm:gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                {idea.votes > 0 && <span className="text-xs text-yellow-400 mr-1 font-medium">{idea.votes}</span>}
                <button onClick={() => voteIdea(idea.id, 1)} className="p-1 text-surface-400 hover:text-yellow-400 transition"><ThumbsUp size={12} /></button>
                <button onClick={() => { setEditingId(idea.id); setEditContent(idea.content); }} className="p-1 text-surface-400 hover:text-surface-900 transition"><Pencil size={12} /></button>
                <button onClick={() => deleteIdea(idea.id)} className="p-1 text-surface-400 hover:text-red-400 transition"><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Summary stats */}
      {ideas.length > 0 && (
        <div className="mt-6 p-3 sm:p-4 bg-white border border-surface-200 rounded-xl">
          <h3 className="text-xs sm:text-sm font-semibold text-surface-800 mb-3 flex items-center gap-2">
            <Target size={14} className="text-brand-400" /> Zusammenfassung
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center">
            <div>
              <p className="text-lg sm:text-2xl font-bold text-surface-900">{ideas.length}</p>
              <p className="text-xs text-surface-500">Ideen</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-yellow-400">{ideas.filter(i => i.votes > 0).length}</p>
              <p className="text-xs text-surface-500">Bewertet</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-brand-400">
                {tech.categories ? new Set(ideas.map(i => i.category).filter(Boolean)).size : "\u2014"}
              </p>
              <p className="text-xs text-surface-500">Kategorien</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-cyan-400">
                {ideas.reduce((max, i) => Math.max(max, i.votes), 0)}
              </p>
              <p className="text-xs text-surface-500">Top Wertung</p>
            </div>
          </div>
          {ideas.filter(i => i.votes > 0).length > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-200">
              <p className="text-xs text-surface-500 mb-2 font-medium">Top Ideen:</p>
              {[...ideas].sort((a, b) => b.votes - a.votes).slice(0, 3).map((idea) => (
                <p key={idea.id} className="text-xs sm:text-sm text-surface-800 flex items-center gap-2 py-0.5">
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
      className="p-2 sm:p-3 rounded-lg border border-surface-200 bg-white hover:border-surface-300 group transition"
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
            className="w-full bg-surface-50 border border-surface-300 rounded px-2 py-1 sm:py-1.5 text-xs sm:text-sm text-surface-900 resize-none focus:border-brand-500 focus:outline-none"
            rows={3}
            autoFocus
          />
          <div className="flex gap-1.5 sm:gap-2 mt-1.5">
            <button onClick={onSaveEdit} className="text-xs text-green-400 hover:text-green-300 flex items-center gap-1 font-medium transition">
              <Save size={12} /> Speichern
            </button>
            <button onClick={onCancelEdit} className="text-xs text-surface-500 hover:text-surface-900 transition">Abbrechen</button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-xs sm:text-sm text-surface-800 mb-2 leading-relaxed">{idea.content}</p>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1">
              {idea.votes > 0 && (
                <span className="text-xs text-yellow-400 flex items-center gap-0.5 font-medium">
                  <ThumbsUp size={10} /> {idea.votes}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
              <button onClick={() => onVote(1)} className="p-1 text-surface-400 hover:text-yellow-400 transition" title="Bewerten"><ThumbsUp size={12} /></button>
              {idea.votes > 0 && (
                <button onClick={() => onVote(-1)} className="p-1 text-surface-400 hover:text-surface-700 transition" title="Abwerten"><Minus size={12} /></button>
              )}
              <button onClick={onStartEdit} className="p-1 text-surface-400 hover:text-surface-900 transition" title="Bearbeiten"><Pencil size={12} /></button>
              <button onClick={onDelete} className="p-1 text-surface-400 hover:text-red-400 transition" title="Löschen"><Trash2 size={12} /></button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
