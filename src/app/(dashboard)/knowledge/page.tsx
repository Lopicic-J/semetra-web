"use client";
import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { Plus, X, Trash2, Pencil, Brain, ChevronDown, ChevronRight } from "lucide-react";
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

export default function KnowledgePage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [showForm, setShowForm] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [parentForNew, setParentForNew] = useState<string | null>(null);
  const [filterModule, setFilterModule] = useState<string>("all");
  const { modules } = useModules();
  const supabase = createClient();

  const fetchTopics = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("topics").select("*").order("created_at", { ascending: true });
    setTopics(data ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchTopics(); }, [fetchTopics]);

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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lernziele</h1>
          <p className="text-gray-500 text-sm mt-0.5">{topics.filter(t => t.status === "understood").length}/{topics.length} verstanden</p>
        </div>
        <button onClick={() => { setParentForNew(null); setEditingTopic(null); setShowForm(true); }} className="btn-primary gap-2">
          <Plus size={16} /> Thema
        </button>
      </div>

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
    </div>
  );
}

function TopicNode({ topic, children, allTopics, expanded, onToggleExpand, onToggleStatus, onEdit, onDelete, onAddChild, depth }: {
  topic: Topic;
  children: Topic[];
  allTopics: Topic[];
  expanded: Set<string>;
  onToggleExpand: (id: string) => void;
  onToggleStatus: (t: Topic) => void;
  onEdit: (t: Topic) => void;
  onDelete: (id: string) => void;
  onAddChild: (id: string) => void;
  depth: number;
}) {
  const isExpanded = expanded.has(topic.id);
  const hasChildren = children.length > 0;

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

        {topic.description && <span className="text-xs text-gray-400 truncate max-w-[200px] hidden sm:block">{topic.description}</span>}

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
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

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
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description || null,
      module_id: form.module_id || null,
      status: form.status,
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
