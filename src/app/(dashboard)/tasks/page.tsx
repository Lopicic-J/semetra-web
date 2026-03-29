"use client";
import { useState } from "react";
import { useTasks } from "@/lib/hooks/useTasks";
import { useModules } from "@/lib/hooks/useModules";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { Plus, CheckSquare, X, Pencil, Trash2, Check } from "lucide-react";
import type { Task, TaskStatus, TaskPriority } from "@/types/database";

const STATUS_LABELS: Record<string, string> = { todo: "Offen", in_progress: "In Arbeit", done: "Erledigt" };
const PRIORITY_LABELS: Record<string, string> = { low: "Niedrig", medium: "Mittel", high: "Hoch" };

export default function TasksPage() {
  const { tasks, loading, refetch } = useTasks();
  const { modules } = useModules();
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const supabase = createClient();

  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);

  async function toggleDone(task: Task) {
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm("Aufgabe löschen?")) return;
    await supabase.from("tasks").delete().eq("id", id);
    refetch();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Aufgaben</h1>
          <p className="text-gray-500 text-sm mt-0.5">{tasks.filter(t => t.status !== "done").length} offen · {tasks.filter(t => t.status === "done").length} erledigt</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary gap-2">
          <Plus size={16} /> Neue Aufgabe
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-5 w-fit">
        {(["all", "todo", "in_progress", "done"] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            {s === "all" ? "Alle" : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Keine Aufgaben</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <TaskRow key={task.id} task={task} modules={modules}
              onToggle={toggleDone}
              onEdit={t => { setEditing(t); setShowForm(true); }}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showForm && (
        <TaskModal
          initial={editing}
          modules={modules}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); refetch(); }}
        />
      )}
    </div>
  );
}

function TaskRow({ task, modules, onToggle, onEdit, onDelete }: {
  task: Task & { modules?: { name: string; color: string } | null };
  modules: ReturnType<typeof useModules>["modules"];
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
}) {
  const isOverdue = task.status !== "done" && task.due_date && new Date(task.due_date) < new Date();

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors group ${task.status === "done" ? "bg-gray-50 border-gray-100" : "bg-white border-gray-100 hover:border-violet-200"}`}>
      <button onClick={() => onToggle(task)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${task.status === "done" ? "bg-green-500 border-green-500 text-white" : "border-gray-300 hover:border-violet-400"}`}>
        {task.status === "done" && <Check size={11} />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>{task.title}</p>
        <div className="flex flex-wrap gap-2 mt-0.5">
          {task.due_date && (
            <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}>
              📅 {formatDate(task.due_date)}
            </span>
          )}
          {(task as any).modules && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: (task as any).modules.color }} />
              {(task as any).modules.name}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={`badge text-[10px] ${task.priority === "high" ? "bg-red-100 text-red-600" : task.priority === "medium" ? "bg-yellow-100 text-yellow-700" : "badge-gray"}`}>
          {PRIORITY_LABELS[task.priority ?? "low"]}
        </span>
        <span className={`badge text-[10px] ${task.status === "done" ? "bg-green-100 text-green-700" : task.status === "in_progress" ? "bg-blue-100 text-blue-700" : "badge-gray"}`}>
          {STATUS_LABELS[task.status ?? "todo"]}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><Pencil size={13} /></button>
          <button onClick={() => onDelete(task.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

function TaskModal({ initial, modules, onClose, onSaved }: {
  initial: Task | null;
  modules: ReturnType<typeof useModules>["modules"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [form, setForm] = useState({
    title: initial?.title ?? "",
    description: initial?.description ?? "",
    due_date: initial?.due_date ? initial.due_date.split("T")[0] : "",
    priority: (initial?.priority ?? "medium") as TaskPriority,
    status: (initial?.status ?? "todo") as TaskStatus,
    module_id: initial?.module_id ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const payload = {
      title: form.title,
      description: form.description || null,
      due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
      priority: form.priority,
      status: form.status,
      module_id: form.module_id || null,
    };
    if (initial) {
      await supabase.from("tasks").update(payload).eq("id", initial.id);
    } else {
      await supabase.from("tasks").insert(payload);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{initial ? "Aufgabe bearbeiten" : "Neue Aufgabe"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Titel *</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder="Aufgabe beschreiben…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder="Details…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Fälligkeitsdatum</label>
              <input className="input" type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modul</label>
              <select className="input" value={form.module_id} onChange={e => set("module_id", e.target.value)}>
                <option value="">— kein —</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Priorität</label>
              <select className="input" value={form.priority} onChange={e => set("priority", e.target.value)}>
                <option value="low">Niedrig</option>
                <option value="medium">Mittel</option>
                <option value="high">Hoch</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className="input" value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="todo">Offen</option>
                <option value="in_progress">In Arbeit</option>
                <option value="done">Erledigt</option>
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
