"use client";
import { useState, useEffect, useCallback, useRef, useMemo, KeyboardEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { FREE_LIMITS, withinFreeLimit } from "@/lib/gates";
import { LimitNudge, LimitCounter, UpgradeModal } from "@/components/ui/ProGate";
import {
  Plus, Trash2, X, ArrowLeft, Lightbulb,
  Sparkles, List, ChevronRight, ChevronDown,
  BookOpen, Shuffle, Minus, RefreshCw, Zap, MessageSquare, Star,
  Bot, Copy, Check, Search, Download, Undo2, Hash,
  ArrowUpRight, GripVertical, AlertCircle, FileText, Code,
  Keyboard,
} from "lucide-react";
import type {
  BrainstormSession, BrainstormIdea, BrainstormTechnique,
  CalendarEvent, Task, Module
} from "@/types/database";
import { useTranslation } from "@/lib/i18n";

/* ── Types ─────────────────────────────────────────────────────────── */
interface LocalIdea {
  id: string;
  content: string;
  indent_level: number;
  color: string;
  category: string;
  notes: string;
  priority: string;
  votes: number;
  sort_order: number;
  collapsed: boolean;
  done: boolean; // checkoff state
  isNew?: boolean; // not yet saved
}

/* ── Technique definitions ─────────────────────────────────────────── */
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
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "#f87171",
  medium: "#fbbf24",
  low: "#60a5fa",
  none: "transparent",
};

/* ── Helpers ──────────────────────────────────────────────────────── */
function extractTags(content: string): string[] {
  const matches = content.match(/#[\w\u00C0-\u024F]+/g);
  return matches ? matches.map(m => m.slice(1)) : [];
}

function getVisibleChildren(ideas: LocalIdea[], parentIdx: number): number[] {
  const parentLevel = ideas[parentIdx].indent_level;
  const children: number[] = [];
  for (let i = parentIdx + 1; i < ideas.length; i++) {
    if (ideas[i].indent_level <= parentLevel) break;
    children.push(i);
  }
  return children;
}

function hasChildren(ideas: LocalIdea[], idx: number): boolean {
  if (idx >= ideas.length - 1) return false;
  return ideas[idx + 1].indent_level > ideas[idx].indent_level;
}

function isVisible(ideas: LocalIdea[], idx: number): boolean {
  // Check all ancestors — if any are collapsed, this node is hidden
  for (let i = idx - 1; i >= 0; i--) {
    if (ideas[i].indent_level < ideas[idx].indent_level) {
      if (ideas[i].collapsed) return false;
      // Check further up
      if (ideas[i].indent_level === 0) return true;
    }
  }
  return true;
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
        exams={exams}
        tasks={tasks}
        isPro={isPro}
        onBack={() => { setActiveSession(null); fetchSessions(); }}
      />
    );
  }

  const TECHNIQUES = getTechniques(t);

  return (
    <div className="p-3 sm:p-5 max-w-5xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
            <Lightbulb className="text-yellow-300" /> {t("brainstorming.title")}
          </h1>
          <p className="text-surface-500 dark:text-surface-400 text-xs sm:text-sm mt-1">{t("brainstorming.createSession")}</p>
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
      {showUpgrade && <UpgradeModal feature="unlimitedBrainstorm" onClose={() => setShowUpgrade(false)} />}

      {/* Technique overview cards */}
      <div className="mb-8">
        <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider mb-3">{t("brainstorming.techniques")}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {TECHNIQUES.map(tech => (
            <button
              key={tech.key}
              onClick={() => { setPreselectedTech(tech.key); setShowCreate(true); }}
              className="bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg p-3 sm:p-3.5 text-left hover:border-surface-300 dark:hover:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition group"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span style={{ color: tech.color }}>{tech.icon}</span>
                <span className="text-sm font-medium text-surface-800 dark:text-surface-100">{tech.label}</span>
              </div>
              <p className="text-xs text-surface-500 dark:text-surface-400 line-clamp-2 leading-relaxed">{tech.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Session list */}
      <h2 className="text-sm font-semibold text-surface-700 dark:text-surface-300 uppercase tracking-wider mb-3">{t("brainstorming.yourSessions")}</h2>
      {loading ? (
        <p className="text-surface-500 dark:text-surface-400 text-sm">{t("brainstorming.noSessions")}</p>
      ) : sessions.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb size={48} className="mx-auto mb-4 text-surface-300 dark:text-surface-600" />
          <p className="text-surface-500 dark:text-surface-400">{t("brainstorming.noSessions")}</p>
          <p className="text-sm mt-1 text-surface-400 dark:text-surface-500">{t("brainstorming.createSession")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-4">
          {sessions.map(s => {
            const tech = TECHNIQUES.find(tech => tech.key === s.technique);
            const mod = modules.find((m: any) => m.id === s.module_id);
            return (
              <button
                key={s.id}
                onClick={() => setActiveSession(s)}
                className="bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl p-3 sm:p-4 text-left hover:border-brand-500/60 dark:hover:border-brand-600 hover:bg-surface-100 dark:hover:bg-surface-700 transition group"
              >
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-semibold text-surface-800 dark:text-surface-100 text-sm group-hover:text-brand-600 dark:group-hover:text-brand-400 transition line-clamp-1">
                    {s.title}
                  </h3>
                  <span className="w-3 h-3 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: s.color }} />
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
                <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
                  {new Date(s.updated_at).toLocaleDateString(undefined)}
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
  const [color, setColor] = useState("#a78bfa");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

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
      exam_id: null,
      task_id: null,
      color,
    }).select().single();
    if (data && !error) onCreated(data as BrainstormSession);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div
        className="bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-2xl w-full max-w-lg p-3 sm:p-6 mx-4 max-h-[85vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-bold text-surface-900 dark:text-surface-50">{t("brainstorming.createSession")}</h2>
          <button onClick={onClose} className="text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200 transition"><X size={20} /></button>
        </div>

        <label className="block text-xs sm:text-sm font-medium text-surface-800 dark:text-surface-200 mb-1.5">{t("brainstorming.sessionTitle")}</label>
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") handleCreate(); }}
          placeholder={selectedTech.label}
          className="w-full bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-surface-900 dark:text-surface-50 placeholder:text-surface-400 dark:placeholder:text-surface-500 mb-4 focus:border-brand-500 dark:focus:border-brand-600 focus:outline-none transition"
        />

        <label className="block text-xs sm:text-sm font-medium text-surface-800 dark:text-surface-200 mb-2">{t("brainstorming.techniques")}</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
          {getTechniques(t).map(tech => (
            <button
              key={tech.key}
              onClick={() => setTechnique(tech.key)}
              className={`flex items-center gap-2 p-1.5 sm:p-2.5 rounded-lg border text-xs text-left transition ${
                technique === tech.key
                  ? "border-brand-500 dark:border-brand-600 bg-brand-500/15 dark:bg-brand-950/30 text-surface-900 dark:text-surface-50"
                  : "border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 text-surface-700 dark:text-surface-300 hover:border-surface-300 dark:hover:border-surface-500"
              }`}
            >
              <span style={{ color: tech.color }}>{tech.icon}</span>
              <div className="font-medium">{tech.label}</div>
            </button>
          ))}
        </div>

        <label className="block text-xs sm:text-sm font-medium text-surface-800 dark:text-surface-200 mb-1.5">{t("brainstorming.moduleLink")}</label>
        <select
          value={moduleId}
          onChange={e => setModuleId(e.target.value)}
          className="w-full bg-surface-50 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 rounded-lg px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm text-surface-900 dark:text-surface-50 mb-4"
        >
          <option value="">{t("brainstorming.noModuleLink")}</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        <label className="block text-xs sm:text-sm font-medium text-surface-800 dark:text-surface-200 mb-1.5">{t("mindmaps.color")}</label>
        <div className="flex gap-2 mb-5 flex-wrap">
          {IDEA_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-7 h-7 rounded-full border-2 transition ${color === c ? "border-surface-900 dark:border-surface-100 scale-110" : "border-surface-200 dark:border-surface-600 hover:border-surface-300 dark:hover:border-surface-500"}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <button
          onClick={handleCreate}
          disabled={saving}
          className="w-full bg-brand-600 hover:bg-brand-500 dark:bg-brand-600 dark:hover:bg-brand-500 text-white py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition disabled:opacity-50"
        >
          {saving ? t("brainstorming.creating") : t("brainstorming.startSession")}
        </button>
      </div>
    </div>
  );
}

/* ── Brainstorm Editor (Complete Rewrite) ──────────────────────────── */
function BrainstormEditor({
  session, modules, exams, tasks, isPro, onBack,
}: {
  session: BrainstormSession;
  modules: Module[];
  exams: CalendarEvent[];
  tasks: Task[];
  isPro: boolean;
  onBack: () => void;
}) {
  const { t, locale } = useTranslation();
  const supabase = createClient();

  // Core state
  const [ideas, setIdeas] = useState<LocalIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusIdx, setFocusIdx] = useState(-1);
  const [editIdx, setEditIdx] = useState(-1);
  const [editText, setEditText] = useState("");

  // UI state
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState("");
  const [aiChatHistory, setAiChatHistory] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [aiUserInput, setAiUserInput] = useState("");
  const aiChatEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  // Undo
  const [undoStack, setUndoStack] = useState<LocalIdea[][]>([]);
  const [redoStack, setRedoStack] = useState<LocalIdea[][]>([]);

  // Refs
  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const newInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);

  const tech = getTechniques(t).find(tech => tech.key === session.technique)!;
  const mod = modules.find((m: any) => m.id === session.module_id);

  /* ── Load ideas ─────────────────────────────────────────────────── */
  const fetchIdeas = useCallback(async () => {
    const { data } = await supabase
      .from("brainstorm_ideas")
      .select("*")
      .eq("session_id", session.id)
      .order("sort_order", { ascending: true });

    const loaded: LocalIdea[] = (data ?? []).map((d: any) => ({
      id: d.id,
      content: d.content,
      indent_level: d.indent_level ?? 0,
      color: d.color,
      category: d.category ?? "",
      notes: d.notes ?? "",
      priority: d.priority ?? "none",
      votes: d.votes ?? 0,
      sort_order: d.sort_order ?? 0,
      collapsed: false,
      done: d.done ?? false,
    }));
    setIdeas(loaded);
    setLoading(false);
  }, [supabase, session.id]);

  useEffect(() => { fetchIdeas(); }, [fetchIdeas]);

  /* ── Autosave (debounced) ───────────────────────────────────────── */
  const saveIdeas = useCallback(async (newIdeas: LocalIdea[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Upsert all ideas
      for (let i = 0; i < newIdeas.length; i++) {
        const idea = newIdeas[i];
        if (idea.isNew) {
          await supabase.from("brainstorm_ideas").insert({
            id: idea.id,
            user_id: user.id,
            session_id: session.id,
            content: idea.content,
            indent_level: idea.indent_level,
            color: idea.color,
            category: idea.category,
            notes: idea.notes,
            priority: idea.priority,
            votes: idea.votes,
            sort_order: i,
            done: idea.done,
          });
        } else {
          await supabase.from("brainstorm_ideas").update({
            content: idea.content,
            indent_level: idea.indent_level,
            color: idea.color,
            category: idea.category,
            notes: idea.notes,
            priority: idea.priority,
            votes: idea.votes,
            sort_order: i,
            done: idea.done,
          }).eq("id", idea.id);
        }
      }

      // Delete removed ideas
      const currentIds = newIdeas.map(i => i.id);
      const { data: dbIdeas } = await supabase
        .from("brainstorm_ideas")
        .select("id")
        .eq("session_id", session.id);
      if (dbIdeas) {
        for (const dbIdea of dbIdeas) {
          if (!currentIds.includes(dbIdea.id)) {
            await supabase.from("brainstorm_ideas").delete().eq("id", dbIdea.id);
          }
        }
      }

      await supabase.from("brainstorm_sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", session.id);
    }, 800);
  }, [supabase, session.id]);

  /* ── Undo ───────────────────────────────────────────────────────── */
  function pushUndo() {
    setUndoStack(prev => [...prev.slice(-19), ideas.map(i => ({ ...i }))]);
    setRedoStack([]);
  }

  function undo() {
    if (undoStack.length === 0) return;
    setRedoStack(prev => [...prev.slice(-19), ideas.map(i => ({ ...i }))]);
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(s => s.slice(0, -1));
    setIdeas(prev);
    saveIdeas(prev);
  }

  function redo() {
    if (redoStack.length === 0) return;
    setUndoStack(prev => [...prev.slice(-19), ideas.map(i => ({ ...i }))]);
    const next = redoStack[redoStack.length - 1];
    setRedoStack(s => s.slice(0, -1));
    setIdeas(next);
    saveIdeas(next);
  }

  /* ── Idea operations ────────────────────────────────────────────── */
  function updateIdeas(newIdeas: LocalIdea[]) {
    pushUndo();
    setIdeas(newIdeas);
    saveIdeas(newIdeas);
  }

  function addIdea(afterIdx: number, indent: number, content = "") {
    pushUndo();
    const newIdea: LocalIdea = {
      id: crypto.randomUUID(),
      content,
      indent_level: indent,
      color: IDEA_COLORS[(ideas.length) % IDEA_COLORS.length],
      category: "",
      notes: "",
      priority: "none",
      votes: 0,
      sort_order: afterIdx + 1,
      collapsed: false,
      done: false,
      isNew: true,
    };
    const updated = [...ideas];
    updated.splice(afterIdx + 1, 0, newIdea);
    // Reorder
    updated.forEach((idea, i) => { idea.sort_order = i; });
    setIdeas(updated);
    saveIdeas(updated);
    // Focus the new row
    setTimeout(() => {
      setEditIdx(afterIdx + 1);
      setEditText("");
      const inp = inputRefs.current.get(afterIdx + 1);
      inp?.focus();
    }, 50);
  }

  function addIdeaAtEnd(content: string) {
    if (!content.trim()) return;
    pushUndo();
    const newIdea: LocalIdea = {
      id: crypto.randomUUID(),
      content: content.trim(),
      indent_level: 0,
      color: IDEA_COLORS[ideas.length % IDEA_COLORS.length],
      category: "",
      notes: "",
      priority: "none",
      votes: 0,
      sort_order: ideas.length,
      collapsed: false,
      done: false,
      isNew: true,
    };
    const updated = [...ideas, newIdea];
    setIdeas(updated);
    saveIdeas(updated);
  }

  function deleteIdea(idx: number) {
    if (idx < 0 || idx >= ideas.length) return;
    pushUndo();
    // Delete this idea and all its children
    const level = ideas[idx].indent_level;
    let endIdx = idx + 1;
    while (endIdx < ideas.length && ideas[endIdx].indent_level > level) {
      endIdx++;
    }
    const updated = [...ideas];
    updated.splice(idx, endIdx - idx);
    updated.forEach((idea, i) => { idea.sort_order = i; });
    setIdeas(updated);
    saveIdeas(updated);
  }

  function indentIdea(idx: number) {
    if (idx <= 0) return; // Can't indent first item
    const maxIndent = ideas[idx - 1].indent_level + 1;
    if (ideas[idx].indent_level >= maxIndent) return;
    pushUndo();
    const updated = [...ideas];
    updated[idx] = { ...updated[idx], indent_level: updated[idx].indent_level + 1 };
    setIdeas(updated);
    saveIdeas(updated);
  }

  function outdentIdea(idx: number) {
    if (ideas[idx].indent_level <= 0) return;
    pushUndo();
    const updated = [...ideas];
    updated[idx] = { ...updated[idx], indent_level: updated[idx].indent_level - 1 };
    setIdeas(updated);
    saveIdeas(updated);
  }

  function toggleCollapse(idx: number) {
    const updated = [...ideas];
    updated[idx] = { ...updated[idx], collapsed: !updated[idx].collapsed };
    setIdeas(updated);
  }

  function toggleDone(idx: number) {
    pushUndo();
    const updated = [...ideas];
    updated[idx] = { ...updated[idx], done: !updated[idx].done };
    setIdeas(updated);
    saveIdeas(updated);
  }

  function cyclePriority(idx: number) {
    const order = ["none", "low", "medium", "high"];
    const curr = order.indexOf(ideas[idx].priority);
    const next = order[(curr + 1) % order.length];
    pushUndo();
    const updated = [...ideas];
    updated[idx] = { ...updated[idx], priority: next };
    setIdeas(updated);
    saveIdeas(updated);
  }

  function updateIdeaContent(idx: number, content: string) {
    const updated = [...ideas];
    updated[idx] = { ...updated[idx], content };
    setIdeas(updated);
    saveIdeas(updated);
  }

  function moveIdea(idx: number, direction: "up" | "down") {
    if (direction === "up" && idx <= 0) return;
    if (direction === "down" && idx >= ideas.length - 1) return;
    pushUndo();
    const updated = [...ideas];
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];
    updated.forEach((idea, i) => { idea.sort_order = i; });
    setIdeas(updated);
    saveIdeas(updated);
    setFocusIdx(swapIdx);
  }

  /* ── Keyboard handler for outliner rows ─────────────────────────── */
  function handleRowKey(e: KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // Save current edit
      if (editIdx === idx) {
        updateIdeaContent(idx, editText);
      }
      // Add sibling after current
      addIdea(idx, ideas[idx].indent_level);
    } else if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      indentIdea(idx);
    } else if (e.key === "Tab" && e.shiftKey) {
      e.preventDefault();
      outdentIdea(idx);
    } else if (e.key === "Backspace" && editText === "") {
      e.preventDefault();
      if (ideas.length > 0) {
        deleteIdea(idx);
        if (idx > 0) {
          setTimeout(() => {
            setEditIdx(idx - 1);
            setEditText(ideas[idx - 1]?.content ?? "");
            inputRefs.current.get(idx - 1)?.focus();
          }, 50);
        }
      }
    } else if (e.key === "ArrowUp" && (e.altKey || e.metaKey)) {
      e.preventDefault();
      moveIdea(idx, "up");
    } else if (e.key === "ArrowDown" && (e.altKey || e.metaKey)) {
      e.preventDefault();
      moveIdea(idx, "down");
    } else if (e.key === "ArrowUp" && !e.altKey) {
      e.preventDefault();
      // Navigate to previous visible row
      for (let i = idx - 1; i >= 0; i--) {
        if (isVisible(ideas, i)) {
          setEditIdx(i);
          setEditText(ideas[i].content);
          setTimeout(() => inputRefs.current.get(i)?.focus(), 30);
          break;
        }
      }
    } else if (e.key === "ArrowDown" && !e.altKey) {
      e.preventDefault();
      for (let i = idx + 1; i < ideas.length; i++) {
        if (isVisible(ideas, i)) {
          setEditIdx(i);
          setEditText(ideas[i].content);
          setTimeout(() => inputRefs.current.get(i)?.focus(), 30);
          break;
        }
      }
    } else if (e.key === "Escape") {
      setEditIdx(-1);
      setEditText("");
    } else if (e.key === "p" && e.ctrlKey) {
      e.preventDefault();
      cyclePriority(idx);
    } else if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      undo();
    } else if (e.key === "y" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      redo();
    } else if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      setShowSearch(true);
    }
  }

  /* ── Global keyboard shortcuts ──────────────────────────────────── */
  useEffect(() => {
    function handleGlobal(e: globalThis.KeyboardEvent) {
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && editIdx === -1) {
        e.preventDefault();
        undo();
      }
      if (e.key === "y" && (e.ctrlKey || e.metaKey) && editIdx === -1) {
        e.preventDefault();
        redo();
      }
      if (e.key === "f" && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        setShowSearch(s => !s);
      }
      if (e.key === "?" && e.shiftKey && editIdx === -1) {
        setShowShortcuts(s => !s);
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setShowShortcuts(false);
        setShowExport(false);
        setShowAi(false);
      }
    }
    window.addEventListener("keydown", handleGlobal);
    return () => window.removeEventListener("keydown", handleGlobal);
  }, [editIdx, undoStack]);

  /* ── Search ─────────────────────────────────────────────────────── */
  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const q = searchQuery.toLowerCase();
    return new Set(ideas.filter(i => i.content.toLowerCase().includes(q)).map(i => i.id));
  }, [searchQuery, ideas]);

  /* ── Export functions ────────────────────────────────────────────── */
  function exportMarkdown(): string {
    let md = `# ${session.title}\n\n`;
    for (const idea of ideas) {
      const prefix = "  ".repeat(idea.indent_level) + "- ";
      const tags = extractTags(idea.content);
      const priority = idea.priority !== "none" ? ` [${idea.priority}]` : "";
      md += `${prefix}${idea.content}${priority}\n`;
      if (idea.notes) {
        md += `${"  ".repeat(idea.indent_level + 1)}> ${idea.notes}\n`;
      }
    }
    return md;
  }

  function exportJSON(): string {
    return JSON.stringify({
      session: { title: session.title, technique: session.technique },
      ideas: ideas.map(i => ({
        content: i.content,
        indent_level: i.indent_level,
        priority: i.priority,
        notes: i.notes,
        tags: extractTags(i.content),
      })),
    }, null, 2);
  }

  async function copyToClipboard(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadFile(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── KI streaming helper ─────────────────────────────────────────── */
  async function streamAiResponse(messages: { role: "user" | "assistant"; content: string }[], onChunk: (text: string) => void): Promise<string> {
    const { data: { session: authSession } } = await supabase.auth.getSession();
    const token = authSession?.access_token;
    if (!token) throw new Error("Auth");

    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        messages,
        mode: "chat",
        context: { moduleName: mod?.name, topicTitle: session.title, language: locale },
      }),
    });

    if (!res.ok) throw new Error("API");

    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let result = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.text) {
                result += parsed.text;
                onChunk(result);
              }
            } catch {}
          }
        }
      }
    }
    return result;
  }

  /* ── Locale → language name for AI prompts ───────────────────────── */
  const LANG_NAMES: Record<string, string> = {
    de: "German", en: "English", fr: "French", it: "Italian", es: "Spanish", nl: "Dutch",
  };
  const aiLang = LANG_NAMES[locale] || "German";
  const langInstruction = `IMPORTANT: You MUST respond entirely in ${aiLang}. All text, headings, and explanations must be in ${aiLang}.\n\n`;

  /* ── KI expand idea (Quick-Actions) ──────────────────────────────── */
  async function aiExpandIdeas(mode: "expand" | "structure" | "summarize" | "gaps" | "cleanup") {
    setAiLoading(true);
    setAiResult("");
    try {
      const ideaTexts = ideas.map(i => `${"  ".repeat(i.indent_level)}- ${i.content}`).join("\n");
      const techName = tech.label;
      const techDesc = tech.description;
      const techContext = `${langInstruction}Brainstorming method: ${techName}\nDescription: ${techDesc}\n\n`;
      const prompts: Record<string, string> = {
        expand: session.technique === "scamper"
          ? `${techContext}Expand this SCAMPER analysis. For each of the 7 categories (Substitute, Combine, Adapt, Modify, Put to other use, Eliminate, Reverse), provide 1-2 new ideas:\n\n${ideaTexts}\n\nRespond with concrete, actionable ideas per category.`
          : session.technique === "pro_contra"
          ? `${techContext}Expand this pro/contra analysis. Add 2-3 new arguments per side and assess their weight:\n\n${ideaTexts}\n\nStructure clearly by Pro, Contra, and Neutral.`
          : session.technique === "starbursting"
          ? `${techContext}Expand this W-questions analysis. For each question dimension (Who, What, Where, When, Why, How), generate 2 deeper sub-questions:\n\n${ideaTexts}\n\nStructure by question category.`
          : session.technique === "reverse"
          ? `${techContext}Expand this reverse brainstorming analysis. Generate 3-4 new "How could we make it worse?" ideas and derive constructive solutions:\n\n${ideaTexts}\n\nStructure: Problem → Reversal → Solution.`
          : session.technique === "brainwriting"
          ? `${techContext}Build on these chain-reaction ideas. Take the last idea and develop it in 3 different directions (Variant A, B, C):\n\n${ideaTexts}\n\nShow the flow of thought.`
          : session.technique === "minddump"
          ? `${techContext}Analyze this rapid braindump and identify clusters/themes. Group the ideas and add 3-5 new quick ideas per cluster:\n\n${ideaTexts}\n\nKeep it brief.`
          : `${techContext}Expand these brainstorming ideas with new perspectives and sub-points:\n\n${ideaTexts}\n\nReturn 5-8 new ideas as a list.`,
        structure: `${techContext}Analyze these brainstorming ideas and suggest a better structure/grouping:\n\n${ideaTexts}\n\nReturn a structured outline.`,
        summarize: `${techContext}Summarize these brainstorming ideas in 3-5 key takeaways:\n\n${ideaTexts}`,
        gaps: session.technique === "scamper"
          ? `${techContext}Which SCAMPER categories have not been sufficiently explored?\n\n${ideaTexts}\n\nList missing aspects per category.`
          : session.technique === "pro_contra"
          ? `${techContext}Which arguments are missing in this pro/contra analysis? Are there blind spots?\n\n${ideaTexts}\n\nList missing perspectives.`
          : session.technique === "starbursting"
          ? `${techContext}Which W-questions have not been asked yet? Which dimensions are missing?\n\n${ideaTexts}\n\nList unasked questions.`
          : `${techContext}Analyze these brainstorming ideas and identify gaps — what is still missing?\n\n${ideaTexts}\n\nReturn missing aspects as a list.`,
        cleanup: `${techContext}Analyze these brainstorming ideas for duplicates, very similar entries, and redundancies:\n\n${ideaTexts}\n\nList specifically:\n1. Which ideas are identical or nearly identical? (state numbers)\n2. Which ideas could be merged?\n3. Suggest a cleaned-up version without duplicates.\n\nBe precise and name the affected entries.`,
      };

      const userMsg: { role: "user" | "assistant"; content: string } = { role: "user", content: prompts[mode] };
      setAiChatHistory(prev => [...prev, userMsg]);

      const result = await streamAiResponse([...aiChatHistory, userMsg], (text) => setAiResult(text));

      setAiChatHistory(prev => [...prev, { role: "assistant", content: result }]);
      setTimeout(() => aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setAiResult(t("brainstorming.aiError"));
    }
    setAiLoading(false);
  }

  /* ── KI follow-up question ──────────────────────────────────────── */
  async function aiFollowUp() {
    if (!aiUserInput.trim() || aiLoading) return;
    setAiLoading(true);
    setAiResult("");
    try {
      const ideaTexts = ideas.map(i => `${"  ".repeat(i.indent_level)}- ${i.content}`).join("\n");
      const contextMsg = `${langInstruction}Context — current brainstorming ideas:\n${ideaTexts}\n\nUser's question: ${aiUserInput}`;
      const userMsg: { role: "user" | "assistant"; content: string } = { role: "user", content: contextMsg };
      const newHistory = [...aiChatHistory, userMsg];
      setAiChatHistory(newHistory);
      setAiUserInput("");

      const result = await streamAiResponse(newHistory, (text) => setAiResult(text));

      setAiChatHistory(prev => [...prev, { role: "assistant", content: result }]);
      setTimeout(() => aiChatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    } catch {
      setAiResult(t("brainstorming.aiError"));
    }
    setAiLoading(false);
  }

  /* ── Apply AI ideas into brainstorming list ──────────────────────── */
  function applyAiIdeas(text: string) {
    // Extract bullet points / numbered items from AI response
    const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
    const extracted: { content: string; indent: number }[] = [];

    for (const line of lines) {
      // Match lines starting with -, *, •, or numbered (1., 2., etc.)
      const bulletMatch = line.match(/^(?:[-*•]|\d+[.)]\s*)\s*(.+)/);
      if (bulletMatch) {
        // Detect indentation level based on leading whitespace in original text
        const origLine = text.split("\n").find(l => l.trim() === line) || line;
        const leadingSpaces = origLine.search(/\S/);
        const indent = leadingSpaces >= 4 ? 1 : 0;
        const content = bulletMatch[1].replace(/^\*\*(.+?)\*\*:?\s*/, "$1: ").trim();
        if (content.length > 2) {
          extracted.push({ content, indent });
        }
      }
    }

    if (extracted.length === 0) return;

    pushUndo();
    const newIdeas: LocalIdea[] = extracted.map((item, i) => ({
      id: crypto.randomUUID(),
      content: item.content,
      indent_level: item.indent,
      color: IDEA_COLORS[(ideas.length + i) % IDEA_COLORS.length],
      category: "",
      notes: "",
      priority: "none",
      votes: 0,
      sort_order: ideas.length + i,
      collapsed: false,
      done: false,
      isNew: true,
    }));

    const updated = [...ideas, ...newIdeas];
    updated.forEach((idea, i) => { idea.sort_order = i; });
    setIdeas(updated);
    saveIdeas(updated);
  }

  /* ── Delete session ─────────────────────────────────────────────── */
  async function handleDeleteSession() {
    if (!confirm(t("brainstorming.deleteConfirm"))) return;
    await supabase.from("brainstorm_ideas").delete().eq("session_id", session.id);
    await supabase.from("brainstorm_sessions").delete().eq("id", session.id);
    onBack();
  }

  /* ── Convert to task ────────────────────────────────────────────── */
  async function convertToTask(idea: LocalIdea) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("tasks").insert({
      user_id: user.id,
      title: idea.content.replace(/#[\w\u00C0-\u024F]+/g, "").trim(),
      module_id: session.module_id || null,
      status: "todo",
      priority: idea.priority === "high" ? "high" : idea.priority === "medium" ? "medium" : "low",
    });
    // Visual feedback — brief flash
    alert(t("brainstorming.taskCreated"));
  }

  /* ── Visible ideas (respecting collapsed state) ─────────────────── */
  const visibleIdeas = useMemo(() => {
    const result: { idea: LocalIdea; idx: number }[] = [];
    for (let i = 0; i < ideas.length; i++) {
      if (isVisible(ideas, i)) {
        result.push({ idea: ideas[i], idx: i });
      }
    }
    return result;
  }, [ideas]);

  if (loading) {
    return (
      <div className="p-3 sm:p-5 text-center">
        <p className="text-surface-500 dark:text-surface-400">{t("brainstorming.loading")}</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="p-3 sm:p-5 max-w-5xl mx-auto">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-2 sm:gap-3">
          <button onClick={onBack} className="text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200 transition p-1">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-surface-900 dark:text-surface-50 flex items-center gap-2">
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
              <span className="text-xs text-surface-500 dark:text-surface-400">{ideas.length} {t("brainstorming.ideas")}</span>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setShowSearch(s => !s)} className="p-2 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-100 hover:border-surface-300 dark:hover:border-surface-600 transition" title="Ctrl+F">
            <Search size={16} />
          </button>
          <button onClick={undo} disabled={undoStack.length === 0} className="p-2 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-100 hover:border-surface-300 dark:hover:border-surface-600 transition disabled:opacity-30" title="Ctrl+Z">
            <Undo2 size={16} />
          </button>
          <button onClick={redo} disabled={redoStack.length === 0} className="p-2 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-100 hover:border-surface-300 dark:hover:border-surface-600 transition disabled:opacity-30" title="Ctrl+Y">
            <Undo2 size={16} className="transform scale-x-[-1]" />
          </button>
          <button onClick={() => setShowAi(s => !s)} className="flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-brand-600 dark:bg-brand-600 border border-brand-500 dark:border-brand-600 text-white hover:bg-brand-500 dark:hover:bg-brand-500 text-xs font-medium transition">
            <Bot size={16} /> KI
          </button>
          <button onClick={() => setShowExport(s => !s)} className="p-2 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-100 hover:border-surface-300 dark:hover:border-surface-600 transition">
            <Download size={16} />
          </button>
          <button onClick={() => setShowShortcuts(s => !s)} className="p-2 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-surface-700 dark:text-surface-300 hover:text-surface-900 dark:hover:text-surface-100 hover:border-surface-300 dark:hover:border-surface-600 transition" title="?">
            <Keyboard size={16} />
          </button>
          <button onClick={handleDeleteSession} className="p-2 rounded-lg bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-red-400 dark:text-red-500 hover:text-red-300 dark:hover:text-red-400 hover:border-red-500/40 transition">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* ── Search bar ─────────────────────────────────────────────── */}
      {showSearch && (
        <div className="mb-4 flex items-center gap-2 p-2 bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-lg">
          <Search size={14} className="text-surface-500 dark:text-surface-400" />
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={t("brainstorming.searchPlaceholder")}
            className="flex-1 bg-transparent text-sm text-surface-900 dark:text-surface-50 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none"
            autoFocus
          />
          {searchQuery && (
            <span className="text-xs text-surface-500 dark:text-surface-400">{searchMatches.size} {t("mindmaps.found")}</span>
          )}
          <button onClick={() => { setShowSearch(false); setSearchQuery(""); }} className="text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200"><X size={14} /></button>
        </div>
      )}

      {/* ── KI Panel (Modern Chat) ─────────────────────────────────── */}
      {showAi && (
        <div className="mb-4 rounded-2xl border border-brand-200/60 dark:border-brand-900/40 bg-gradient-to-b from-brand-50/40 dark:from-brand-950/20 to-white dark:to-surface-800 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-brand-100/60 dark:border-brand-900/30 bg-white/60 dark:bg-surface-800/60 backdrop-blur-sm">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-brand-600 dark:bg-brand-600 flex items-center justify-center">
                <Bot size={14} className="text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-surface-900 dark:text-surface-50">{t("brainstorming.aiAssistant")}</h3>
                <p className="text-[10px] text-surface-500 dark:text-surface-400 leading-tight">{t("brainstorming.aiSubtitle")}</p>
              </div>
            </div>
            <button onClick={() => setShowAi(false)} className="w-7 h-7 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-700 flex items-center justify-center text-surface-400 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition">
              <X size={14} />
            </button>
          </div>

          {/* Quick Actions */}
          <div className="px-3 sm:px-4 py-2.5 border-b border-surface-100 dark:border-surface-700 flex gap-1.5 overflow-x-auto scrollbar-none">
            <button onClick={() => aiExpandIdeas("expand")} disabled={aiLoading || ideas.length === 0}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-600 dark:bg-brand-600 text-white text-xs font-medium hover:bg-brand-500 dark:hover:bg-brand-500 disabled:opacity-40 transition shadow-sm">
              <Sparkles size={11} /> {t("brainstorming.aiExpand")}
            </button>
            <button onClick={() => aiExpandIdeas("structure")} disabled={aiLoading || ideas.length === 0}
              className="shrink-0 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 text-xs font-medium hover:bg-surface-200 dark:hover:bg-surface-600 disabled:opacity-40 transition">
              {t("brainstorming.aiStructure")}
            </button>
            <button onClick={() => aiExpandIdeas("summarize")} disabled={aiLoading || ideas.length === 0}
              className="shrink-0 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 text-xs font-medium hover:bg-surface-200 dark:hover:bg-surface-600 disabled:opacity-40 transition">
              {t("brainstorming.aiSummarize")}
            </button>
            <button onClick={() => aiExpandIdeas("gaps")} disabled={aiLoading || ideas.length === 0}
              className="shrink-0 px-3 py-1.5 rounded-full bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 text-xs font-medium hover:bg-surface-200 dark:hover:bg-surface-600 disabled:opacity-40 transition">
              {t("brainstorming.aiGaps")}
            </button>
            <button onClick={() => aiExpandIdeas("cleanup")} disabled={aiLoading || ideas.length === 0}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-medium hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-40 transition border border-red-200/60 dark:border-red-900/40">
              <Trash2 size={11} /> {t("brainstorming.aiCleanup")}
            </button>
          </div>

          {/* Chat History */}
          <div className="max-h-80 overflow-y-auto px-3 sm:px-4 py-3 space-y-3 scrollbar-thin">
            {aiChatHistory.length === 0 && !aiResult && !aiLoading && (
              <div className="py-8 text-center">
                <div className="w-10 h-10 mx-auto mb-3 rounded-xl bg-brand-100 dark:bg-brand-950/30 flex items-center justify-center">
                  <Sparkles size={18} className="text-brand-500 dark:text-brand-400" />
                </div>
                <p className="text-sm text-surface-500 dark:text-surface-400">{t("brainstorming.aiEmpty")}</p>
                <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">{t("brainstorming.aiEmptyHint")}</p>
              </div>
            )}

            {aiChatHistory.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-brand-600 dark:bg-brand-600 text-white rounded-br-md"
                    : "bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 text-surface-800 dark:text-surface-100 rounded-bl-md shadow-sm"
                }`}>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Bot size={11} className="text-brand-500 dark:text-brand-400" />
                      <span className="text-[10px] font-medium text-brand-500 dark:text-brand-400">Semetra KI</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-xs sm:text-sm">{msg.content}</div>
                  {msg.role === "assistant" && (
                    <div className="flex items-center gap-3 mt-1.5">
                      <button
                        onClick={() => applyAiIdeas(msg.content)}
                        className="text-[10px] text-brand-500 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 transition font-medium"
                      >
                        <Plus size={10} /> {t("brainstorming.aiApply")}
                      </button>
                      <button
                        onClick={() => copyToClipboard(msg.content)}
                        className="text-[10px] text-surface-400 dark:text-surface-500 hover:text-surface-600 dark:hover:text-surface-300 flex items-center gap-1 transition"
                      >
                        {copied ? <Check size={10} /> : <Copy size={10} />} {copied ? t("brainstorming.copied") : t("brainstorming.copyResult")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Streaming result (not yet in history) */}
            {aiLoading && aiResult && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl rounded-bl-md px-3.5 py-2.5 bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 text-surface-800 dark:text-surface-100 shadow-sm">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Bot size={11} className="text-brand-500 dark:text-brand-400" />
                    <span className="text-[10px] font-medium text-brand-500 dark:text-brand-400">Semetra KI</span>
                  </div>
                  <div className="whitespace-pre-wrap text-xs sm:text-sm">{aiResult}</div>
                </div>
              </div>
            )}

            {aiLoading && !aiResult && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-md px-4 py-3 bg-surface-100 dark:bg-surface-700 border border-surface-200 dark:border-surface-600 shadow-sm">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 dark:bg-brand-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 dark:bg-brand-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-400 dark:bg-brand-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-xs text-surface-500 dark:text-surface-400">{t("brainstorming.aiThinking")}</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={aiChatEndRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 border-t border-surface-100 dark:border-surface-700 bg-white/60 dark:bg-surface-800/60 backdrop-blur-sm">
            <div className="flex items-center gap-2">
              <input
                value={aiUserInput}
                onChange={e => setAiUserInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); aiFollowUp(); } }}
                placeholder={t("brainstorming.aiInputPlaceholder")}
                disabled={aiLoading}
                className="flex-1 px-3.5 py-2 rounded-xl bg-surface-50 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-sm text-surface-900 dark:text-surface-100 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 disabled:opacity-50 transition"
              />
              <button
                onClick={aiFollowUp}
                disabled={aiLoading || !aiUserInput.trim()}
                className="w-9 h-9 rounded-xl bg-brand-600 text-white flex items-center justify-center hover:bg-brand-500 disabled:opacity-40 disabled:hover:bg-brand-600 transition shadow-sm"
              >
                <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Export Panel ───────────────────────────────────────────── */}
      {showExport && (
        <div className="mb-4 p-3 sm:p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-surface-800 dark:text-surface-100 flex items-center gap-2">
              <Download size={16} /> {t("brainstorming.export")}
            </h3>
            <button onClick={() => setShowExport(false)} className="text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200"><X size={14} /></button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => { downloadFile(exportMarkdown(), `${session.title}.md`, "text/markdown"); }}
              className="px-3 py-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-800 dark:text-surface-100 text-xs font-medium hover:bg-surface-300 dark:hover:bg-surface-600 transition flex items-center gap-1.5">
              <FileText size={14} /> Markdown
            </button>
            <button onClick={() => { downloadFile(exportJSON(), `${session.title}.json`, "application/json"); }}
              className="px-3 py-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-800 dark:text-surface-100 text-xs font-medium hover:bg-surface-300 dark:hover:bg-surface-600 transition flex items-center gap-1.5">
              <Code size={14} /> JSON
            </button>
            <button onClick={() => copyToClipboard(exportMarkdown())}
              className="px-3 py-1.5 rounded-lg bg-surface-200 dark:bg-surface-700 text-surface-800 dark:text-surface-100 text-xs font-medium hover:bg-surface-300 dark:hover:bg-surface-600 transition flex items-center gap-1.5">
              {copied ? <Check size={14} /> : <Copy size={14} />} {t("brainstorming.copyClipboard")}
            </button>
          </div>
        </div>
      )}

      {/* ── Shortcuts Modal ────────────────────────────────────────── */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-4" onClick={() => setShowShortcuts(false)}>
          <div className="bg-surface-100 dark:bg-surface-800 rounded-2xl p-4 sm:p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-surface-900 dark:text-surface-50">{t("brainstorming.shortcuts")}</h2>
              <button onClick={() => setShowShortcuts(false)} className="text-surface-500 dark:text-surface-400 hover:text-surface-900 dark:hover:text-surface-200"><X size={20} /></button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["Enter", t("brainstorming.shortcutEnter")],
                ["Tab", t("brainstorming.shortcutTab")],
                ["Shift + Tab", t("brainstorming.shortcutShiftTab")],
                ["Backspace", t("brainstorming.shortcutBackspace")],
                ["\u2191 / \u2193", t("brainstorming.shortcutNavigate")],
                ["Alt + \u2191/\u2193", t("brainstorming.shortcutMove")],
                ["Ctrl + P", t("brainstorming.shortcutPriority")],
                ["Ctrl + Z", t("brainstorming.shortcutUndo")],
                ["Ctrl + Y", t("brainstorming.shortcutRedo") || "Redo"],
                ["Ctrl + F", t("brainstorming.shortcutSearch")],
                ["Escape", t("brainstorming.shortcutEscape")],
              ].map(([key, desc]) => (
                <div key={key} className="flex justify-between items-center py-1.5 border-b border-surface-100 dark:border-surface-700">
                  <kbd className="px-2 py-0.5 bg-surface-100 dark:bg-surface-700 rounded text-xs font-mono text-surface-700 dark:text-surface-300">{key}</kbd>
                  <span className="text-surface-600 dark:text-surface-300 text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Inspiration prompt ─────────────────────────────────────── */}
      {ideas.length === 0 && (
        <div className="mb-6 p-3 sm:p-4 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 flex items-start gap-3">
          <Sparkles size={16} className="flex-shrink-0 mt-0.5" style={{ color: tech.color }} />
          <div>
            <div className="space-y-1">
              {tech.prompts.slice(0, 4).map((p, pi) => (
                <p key={pi} className={`text-sm leading-relaxed ${pi === 0 ? "text-surface-900 dark:text-surface-50 font-medium" : "text-surface-600 dark:text-surface-300"}`}>{pi > 0 ? "• " : ""}{p}</p>
              ))}
            </div>
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-1.5">{t("brainstorming.startTyping")}</p>
          </div>
        </div>
      )}

      {/* ── Outliner ───────────────────────────────────────────────── */}
      <div className="space-y-0.5 mb-4">
        {visibleIdeas.map(({ idea, idx }) => {
          const tags = extractTags(idea.content);
          const childCount = getVisibleChildren(ideas, idx).length;
          const hasKids = hasChildren(ideas, idx);
          const isEditing = editIdx === idx;
          const isSearchMatch = searchQuery && searchMatches.has(idea.id);
          const isSearchDim = searchQuery && !searchMatches.has(idea.id);

          return (
            <div
              key={idea.id}
              className={`group flex items-start gap-1 py-1 px-1 rounded-lg transition-all ${
                isEditing ? "bg-brand-500/5 dark:bg-brand-950/20 border border-brand-500/20 dark:border-brand-900/40" : "hover:bg-surface-50 dark:hover:bg-surface-700/50 border border-transparent"
              } ${isSearchDim ? "opacity-30" : ""} ${isSearchMatch ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-900/40" : ""}`}
              style={{ paddingLeft: `${idea.indent_level * 24 + 4}px` }}
            >
              {/* Collapse toggle */}
              <button
                onClick={() => toggleCollapse(idx)}
                className={`w-5 h-5 flex items-center justify-center text-surface-400 dark:text-surface-500 hover:text-surface-700 dark:hover:text-surface-300 transition flex-shrink-0 mt-0.5 ${
                  hasKids ? "visible" : "invisible"
                }`}
              >
                {idea.collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
              </button>

              {/* Done checkbox */}
              <button
                onClick={() => toggleDone(idx)}
                className="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all"
                style={{
                  borderColor: idea.done ? "#22c55e" : "#cbd5e1",
                  backgroundColor: idea.done ? "#22c55e" : "transparent",
                }}
                title={t("brainstorming.markDone")}
              >
                {idea.done && <Check size={10} className="text-white" />}
              </button>

              {/* Priority dot */}
              {idea.priority !== "none" && (
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-2"
                  style={{ backgroundColor: PRIORITY_COLORS[idea.priority] }}
                  title={idea.priority}
                />
              )}

              {/* Content */}
              <div className="flex-1 min-w-0">
                {isEditing ? (
                  <input
                    ref={el => { if (el) inputRefs.current.set(idx, el); }}
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    onBlur={() => {
                      if (editText !== idea.content) updateIdeaContent(idx, editText);
                      setEditIdx(-1);
                    }}
                    onKeyDown={e => handleRowKey(e, idx)}
                    className="w-full bg-transparent text-sm text-surface-900 dark:text-surface-50 focus:outline-none py-0.5"
                    autoFocus
                  />
                ) : (
                  <div
                    className={`text-sm py-0.5 cursor-text min-h-[24px] ${
                      idea.done ? "line-through text-surface-400 dark:text-surface-500 opacity-60" : "text-surface-800 dark:text-surface-100"
                    }`}
                    onClick={() => { setEditIdx(idx); setEditText(idea.content); }}
                  >
                    {idea.content ? (
                      <span>
                        {idea.content.split(/(#[\w\u00C0-\u024F]+)/g).map((part, pi) =>
                          part.startsWith("#") ? (
                            <span key={pi} className="text-brand-400 dark:text-brand-400 font-medium">{part}</span>
                          ) : (
                            <span key={pi}>{part}</span>
                          )
                        )}
                      </span>
                    ) : (
                      <span className="text-surface-300 dark:text-surface-600 italic">{t("brainstorming.emptyIdea")}</span>
                    )}
                    {idea.collapsed && childCount > 0 && (
                      <span className="ml-2 text-xs text-surface-400 dark:text-surface-500 bg-surface-100 dark:bg-surface-700 px-1.5 py-0.5 rounded-full">
                        +{childCount}
                      </span>
                    )}
                  </div>
                )}

                {/* Notes preview */}
                {idea.notes && !isEditing && (
                  <p className="text-xs text-surface-400 dark:text-surface-500 mt-0.5 line-clamp-1">{idea.notes}</p>
                )}
              </div>

              {/* Actions (on hover) */}
              <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                <button onClick={() => cyclePriority(idx)} className="p-1 text-surface-400 hover:text-yellow-500 transition" title={t("brainstorming.priority")}>
                  <AlertCircle size={12} />
                </button>
                <button onClick={() => convertToTask(idea)} className="p-1 text-surface-400 hover:text-green-500 transition" title={t("brainstorming.convertToTask")}>
                  <ArrowUpRight size={12} />
                </button>
                <button onClick={() => deleteIdea(idx)} className="p-1 text-surface-400 hover:text-red-400 transition" title={t("brainstorming.deleteIdea")}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── New idea input (always visible at bottom) ──────────────── */}
      <div className="flex items-center gap-2 py-2 px-3 sm:px-3 border border-dashed border-surface-200 dark:border-surface-700 rounded-lg hover:border-surface-300 dark:hover:border-surface-600 transition">
        <Plus size={14} className="text-surface-400 dark:text-surface-500" />
        <input
          ref={newInputRef}
          placeholder={t("brainstorming.newIdeaPlaceholder")}
          className="flex-1 bg-transparent text-sm text-surface-900 dark:text-surface-50 placeholder:text-surface-400 dark:placeholder:text-surface-500 focus:outline-none"
          onKeyDown={e => {
            if (e.key === "Enter" && (e.target as HTMLInputElement).value.trim()) {
              addIdeaAtEnd((e.target as HTMLInputElement).value);
              (e.target as HTMLInputElement).value = "";
            }
          }}
        />
      </div>

      {/* ── Summary stats ──────────────────────────────────────────── */}
      {ideas.length > 0 && (
        <div className="mt-6 p-3 sm:p-4 bg-surface-100 dark:bg-surface-800 border border-surface-200 dark:border-surface-700 rounded-xl">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 text-center">
            <div>
              <p className="text-lg sm:text-2xl font-bold text-surface-900 dark:text-surface-50">{ideas.length}</p>
              <p className="text-xs text-surface-500 dark:text-surface-400">{t("brainstorming.ideas")}</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-brand-400 dark:text-brand-400">
                {new Set(ideas.flatMap(i => extractTags(i.content))).size}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Tags</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-yellow-400 dark:text-yellow-500">
                {ideas.filter(i => i.priority !== "none").length}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">{t("brainstorming.prioritized")}</p>
            </div>
            <div>
              <p className="text-lg sm:text-2xl font-bold text-cyan-400 dark:text-cyan-400">
                {Math.max(...ideas.map(i => i.indent_level), 0) + 1}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">{t("brainstorming.depthLevels")}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
