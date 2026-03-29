"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { Plus, X, Trash2, Pencil, Brain, ChevronDown, ChevronRight, RotateCcw, Zap, Check } from "lucide-react";
import type { Topic } from "@/types/database";

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-200 text-gray-600",
  in_progress: "bg-blue-100 text-blue-700",
  understood: "bg-green-100 text-green-700",
  needs_review: "bg-yellow-100 text-yellow-700",
};
const STATUS_LABELS: Record<string, string> = {
  not_started: "Nicht begonnen",
  in_progress: "In Bearbeitung",
  understood: "Verstanden",
  needs_review: "Wiederholen",
};

const KNOWLEDGE_LEVELS = [
  { level: 0, label: "Unbekannt", color: "bg-gray-300" },
  { level: 1, label: "Gesehen", color: "bg-red-400" },
  { level: 2, label: "Grundlagen", color: "bg-orange-400" },
  { level: 3, label: "Verstanden", color: "bg-yellow-400" },
  { level: 4, label: "Beherrscht", color: "bg-green-500" },
];

// SM-2 Algorithm
function sm2(quality: number, easiness: number, interval: number, repetitions: number) {
  let newEasiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  if (newEasiness < 1.3) newEasiness = 1.3;

  let newInterval: number;
  let newReps: number;

  if (quality < 3) {
    newReps = 0;
    newInterval = 1;
  } else {
    newReps = repetitions + 1;
    if (newReps === 1) newInterval = 1;
    else if (newReps === 2) newInterval = 6;
    else newInterval = Math.round(interval * newEasiness);
  }

  const nextReview = new Date();
  nextReview.setDate(nextReview.getDate() + newInterval);

  return { easiness: newEasiness, interval: newInterval, repetitions: newReps, nextReview };
}

export default function KnowledgePage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [parentForNew, setParentForNew] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState<string>("all");
  const [showReview, setShowReview] = useState(false);
  const { modules } = useModules();
  const supabase = createClient();

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("topics").select("*").order("created_at", { ascending: true });
    setTopics(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

  // Due topics for SR
  const dueTopics = topics.filter(t => {
    if (!t.sr_next_review) return t.knowledge_level < 4;
    return new Date(t.sr_next_review) <= new Date();
  });

  async function handleDelete(id: string) {
    if (!confirm("Thema löschen?")) return;
    await supabase.from("topics").delete().eq("id", id);
    fetchTopics();
  }

  async function toggleStatus(topic: Topic) {
    const cycle = ["not_started", "in_progress", "understood", "needs_review"];
    const idx = cycle.indexOf(topic.status ?? "not_started");
    const next = cycle[(idx + 1) % cycle.length];
    await supabase.from("topics").update({ status: next }).eq("id", topic.id);
    fetchTopics();
  }

  async function setKnowledgeLevel(topic: Topic, level: number) {
    await supabase.from("topics").update({
      knowledge_level: level,
      last_reviewed: new Date().toISOString(),
    }).eq("id", topic.id);
    fetchTopics();
  }

  const rootTopics = topics.filter(t => !t.parent_id && (filterModule === "all" || t.module_id === filterModule));

  function getChildren(parentId: string) {
    return topics.filter(t => t.parent_id === parentId);
  }

  function toggle(id: string) {
    setExpanded(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  // Knowledge level distribution
  const levelDist = KNOWLEDGE_LEVELS.map(kl => ({
    ...kl,
    count: topics.filter(t => (t.knowledge_level ?? 0) === kl.level).length,
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lernziele & Wissen</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {topics.filter(t => t.status === "understood").length}/{topics.length} verstanden
            {dueTopics.length > 0 && (
              <span className="text-amber-600 font-medium ml-2">· {dueTopics.length} Review{dueTopics.length !== 1 ? "s" : ""} fällig</span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          {dueTopics.length > 0 && (
            <button onClick={() => setShowReview(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition-colors">
              <RotateCcw size={16} /> Review starten ({dueTopics.length})
            </button>
          )}
          <button onClick={() => { setParentForNew(null); setEditingTopic(null); setShowForm(true); }} className="btn-primary gap-2">
            <Plus size={16} /> Thema
          </button>
        </div>
      </div>

      {/* Knowledge level bar */}
      {topics.length > 0 && (
        <div className="card mb-5">
          <div className="flex justify-between text-sm mb-3">
            <span className="font-medium text-gray-700">Wissensstand</span>
            <span className="text-gray-500">{Math.round((topics.filter(t => (t.knowledge_level ?? 0) >= 3).length / topics.length) * 100)}% gut oder besser</span>
          </div>
          {/* Stacked bar */}
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden flex">
            {levelDist.map(ld => (
              ld.count > 0 && (
                <div key={ld.level} className={`h-full ${ld.color} transition-all`}
                  style={{ width: `${(ld.count / topics.length) * 100}%` }}
                  title={`${ld.label}: ${ld.count}`}
                />
              )
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500 flex-wrap">
            {levelDist.map(ld => (
              <span key={ld.level} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${ld.color}`} />
                {ld.count} {ld.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-5 flex-wrap">
        <button onClick={() => setFilterModule("all")} className={`badge cursor-pointer ${filterModule === "all" ? "bg-violet-600 text-white" : "badge-gray hover:bg-gray-200"}`}>
          Alle Module
        </button>
        {modules.map(m => (
          <button key={m.id} onClick={() => setFilterModule(m.id)}
            className={`badge cursor-pointer ${filterModule === m.id ? "text-white" : "badge-gray hover:bg-gray-200"}`}
            style={filterModule === m.id ? { background: m.color ?? "#6d28d9" } : {}}>
            {m.name}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      {topics.length > 0 && (
        <div className="card mb-5">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Gesamtfortschritt</span>
            <span className="text-gray-500">{Math.round((topics.filter(t => t.status === "understood").length / topics.length) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all"
              style={{ width: `${(topics.filter(t => t.status === "understood").length / topics.length) * 100}%` }} />
          </div>
          <div className="flex gap-4 mt-3 text-xs text-gray-500">
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <span key={k} className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${k === "not_started" ? "bg-gray-400" : k === "in_progress" ? "bg-blue-500" : k === "understood" ? "bg-green-500" : "bg-yellow-500"}`} />
                {topics.filter(t => t.status === k).length} {v}
              </span>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
      ) : rootTopics.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Brain size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Noch keine Lernziele</p>
          <p className="text-sm mt-1">Füge Themen und Unterthemen hinzu um deinen Lernfortschritt zu tracken.</p>
        </div>
      ) : (
        <div className="space-y-1">
          {rootTopics.map(topic => (
            <TopicNode
              key={topic.id}
              topic={topic}
              children={getChildren(topic.id)}
              allTopics={topics}
              expanded={expanded}
              onToggleExpand={toggle}
              onToggleStatus={toggleStatus}
              onEdit={t => { setEditingTopic(t); setShowForm(true); }}
              onDelete={handleDelete}
              onAddChild={id => { setParentForNew(id); setEditingTopic(null); setShowForm(true); }}
              onSetLevel={setKnowledgeLevel}
              depth={0}
            />
          ))}
        </div>
      )}

      {showForm && (
        <TopicModal
          initial={editingTopic}
          parentId={parentForNew}
          modules={modules}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); fetchTopics(); }}
        />
      )}

      {showReview && (
        <SRReviewModal
          topics={dueTopics}
          onClose={() => { setShowReview(false); fetchTopics(); }}
        />
      )}
    </div>
  );
}

function TopicNode({ topic, children, allTopics, expanded, onToggleExpand, onToggleStatus, onEdit, onDelete, onAddChild, onSetLevel, depth }: {
  topic: Topic;
  children: Topic[];
  allTopics: Topic[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleStatus: (t: Topic) => void;
  onEdit: (t: Topic) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string) => void;
  onSetLevel: (t: Topic, level: number) => void;
  depth: number;
}) {
  const isExpanded = expanded.has(topic.id);
  const hasChildren = children.length > 0;
  const kl = topic.knowledge_level ?? 0;

  return (
    <div>
      <div className={`flex items-center gap-2 p-2.5 rounded-xl hover:bg-gray-50 group ${depth > 0 ? "ml-6" : ""}`}>
        <button onClick={() => hasChildren && onToggleExpand(topic.id)} className="w-5 h-5 flex items-center justify-center shrink-0 text-gray-400">
          {hasChildren ? (isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="w-2 h-2 rounded-full bg-gray-200" />}
        </button>

        <button onClick={() => onToggleStatus(topic)}
          className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 cursor-pointer ${STATUS_COLORS[topic.status ?? "not_started"]}`}>
          {STATUS_LABELS[topic.status ?? "not_started"]}
        </button>

        <span className="flex-1 text-sm text-gray-800 font-medium">{topic.title}</span>

        {/* Knowledge level indicator */}
        <div className="flex gap-0.5 shrink-0">
          {KNOWLEDGE_LEVELS.map(l => (
            <button key={l.level} onClick={() => onSetLevel(topic, l.level)}
              className={`w-3 h-3 rounded-sm transition-all ${kl >= l.level ? l.color : "bg-gray-200"} hover:scale-125`}
              title={l.label}
            />
          ))}
        </div>

        {topic.description && <span className="text-xs text-gray-400 truncate max-w-[150px] hidden sm:block">{topic.description}</span>}

        {/* SR info */}
        {topic.sr_next_review && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            new Date(topic.sr_next_review) <= new Date() ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
          }`}>
            {new Date(topic.sr_next_review) <= new Date() ? "Fällig" : new Date(topic.sr_next_review).toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}
          </span>
        )}

        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onAddChild(topic.id)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-violet-500" title="Unterthema">
            <Plus size={13} />
          </button>
          <button onClick={() => onEdit(topic)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <Pencil size={13} />
          </button>
          <button onClick={() => onDelete(topic.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500">
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {isExpanded && children.map(child => (
        <TopicNode
          key={child.id}
          topic={child}
          children={allTopics.filter(t => t.parent_id === child.id)}
          allTopics={allTopics}
          expanded={expanded}
          onToggleExpand={onToggleExpand}
          onToggleStatus={onToggleStatus}
          onEdit={onEdit}
          onDelete={onDelete}
          onAddChild={onAddChild}
          onSetLevel={onSetLevel}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

/* ── SR Review Modal ──────────────────────────────────────────────────────── */
function SRReviewModal({ topics, onClose }: { topics: Topic[]; onClose: () => void }) {
  const supabase = createClient();
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [done, setDone] = useState(false);
  const [stats, setStats] = useState({ good: 0, again: 0 });

  const current = topics[idx];

  async function rate(quality: number) {
    if (!current) return;
    const result = sm2(
      quality,
      current.sr_easiness ?? 2.5,
      current.sr_interval ?? 1,
      current.sr_repetitions ?? 0
    );

    await supabase.from("topics").update({
      sr_easiness: result.easiness,
      sr_interval: result.interval,
      sr_repetitions: result.repetitions,
      sr_next_review: result.nextReview.toISOString(),
      last_reviewed: new Date().toISOString(),
      knowledge_level: Math.min(4, Math.max(current.knowledge_level ?? 0, quality >= 3 ? (current.knowledge_level ?? 0) + 1 : Math.max(0, (current.knowledge_level ?? 0) - 1))),
    }).eq("id", current.id);

    setStats(s => quality >= 3 ? { ...s, good: s.good + 1 } : { ...s, again: s.again + 1 });

    if (idx + 1 >= topics.length) {
      setDone(true);
    } else {
      setIdx(i => i + 1);
      setShowAnswer(false);
    }
  }

  if (done) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md text-center p-8">
          <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-green-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Review abgeschlossen!</h2>
          <p className="text-gray-500 mb-4">
            {stats.good + stats.again} Themen wiederholt
          </p>
          <div className="flex justify-center gap-6 mb-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-600">{stats.good}</p>
              <p className="text-xs text-gray-500">Gewusst</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-500">{stats.again}</p>
              <p className="text-xs text-gray-500">Wiederholen</p>
            </div>
          </div>
          <button onClick={onClose} className="btn-primary w-full justify-center">Fertig</button>
        </div>
      </div>
    );
  }

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Brain size={18} className="text-violet-600" />
            <span className="font-semibold text-gray-900">Spaced Repetition Review</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">{idx + 1} / {topics.length}</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
          </div>
        </div>

        {/* Progress */}
        <div className="h-1 bg-gray-100">
          <div className="h-full bg-violet-500 transition-all" style={{ width: `${((idx) / topics.length) * 100}%` }} />
        </div>

        {/* Card */}
        <div className="p-8 text-center min-h-[200px] flex flex-col items-center justify-center">
          <h3 className="text-xl font-bold text-gray-900 mb-2">{current.title}</h3>
          {current.description && !showAnswer && (
            <p className="text-gray-400 text-sm">Kannst du dieses Thema erklären?</p>
          )}
          {showAnswer && current.description && (
            <p className="text-gray-600 mt-3 text-sm bg-gray-50 rounded-xl p-4">{current.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="p-5 border-t border-gray-100">
          {!showAnswer ? (
            <button onClick={() => setShowAnswer(true)}
              className="w-full py-3 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors">
              Antwort zeigen
            </button>
          ) : (
            <div>
              <p className="text-xs text-gray-500 text-center mb-3">Wie gut wusstest du es?</p>
              <div className="grid grid-cols-4 gap-2">
                <button onClick={() => rate(1)} className="py-2.5 rounded-xl bg-red-100 hover:bg-red-200 text-red-700 text-sm font-medium transition-colors">
                  Nochmal
                </button>
                <button onClick={() => rate(3)} className="py-2.5 rounded-xl bg-orange-100 hover:bg-orange-200 text-orange-700 text-sm font-medium transition-colors">
                  Schwer
                </button>
                <button onClick={() => rate(4)} className="py-2.5 rounded-xl bg-green-100 hover:bg-green-200 text-green-700 text-sm font-medium transition-colors">
                  Gut
                </button>
                <button onClick={() => rate(5)} className="py-2.5 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-700 text-sm font-medium transition-colors">
                  Leicht
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Topic Create/Edit Modal ──────────────────────────────────────────────── */
function TopicModal({ initial, parentId, modules, onClose, onSaved }: {
  initial: Topic | null;
  parentId: string | null;
  modules: ReturnType<typeof useModules>["modules"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    module_id: initial?.module_id ?? "",
    status: initial?.status ?? "not_started",
    knowledge_level: initial?.knowledge_level ?? 0,
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string | number) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description || null,
      module_id: form.module_id || null,
      status: form.status,
      knowledge_level: form.knowledge_level,
      parent_id: initial?.parent_id ?? parentId ?? null,
    };
    if (initial) {
      await supabase.from("topics").update(payload).eq("id", initial.id);
    } else {
      await supabase.from("topics").insert(payload);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{initial ? "Thema bearbeiten" : parentId ? "Unterthema hinzufügen" : "Neues Thema"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder="Thema…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Details…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modul</label>
              <select className="input" value={form.module_id} onChange={e => set("module_id", e.target.value)}>
                <option value="">—</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="input" value={form.status} onChange={e => set("status", e.target.value)}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Wissensstand</label>
            <div className="flex gap-2">
              {KNOWLEDGE_LEVELS.map(kl => (
                <button key={kl.level} type="button"
                  onClick={() => set("knowledge_level", kl.level)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    form.knowledge_level >= kl.level ? `${kl.color} text-white` : "bg-gray-100 text-gray-500"
                  }`}>
                  {kl.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Abbrechen</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? "Speichern…" : "Speichern"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
