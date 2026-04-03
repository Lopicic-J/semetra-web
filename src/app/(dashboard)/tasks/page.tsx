"use client";
import { useState, useRef } from "react";
import { useTranslation } from "@/lib/i18n";
import { useTasks } from "@/lib/hooks/useTasks";
import { useModules } from "@/lib/hooks/useModules";
import { useTaskAttachments } from "@/lib/hooks/useTaskAttachments";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/utils";
import { Plus, CheckSquare, X, Pencil, Trash2, Check, Paperclip, Link2, Upload, ExternalLink, FileText } from "lucide-react";
import type { Task, TaskStatus, TaskPriority, TaskAttachment } from "@/types/database";

// Note: Status and priority labels are moved to i18n translations
// const STATUS_LABELS: Record<string, string> = { todo: "Offen", in_progress: "In Arbeit", done: "Erledigt" };
// const PRIORITY_LABELS: Record<string, string> = { low: "Niedrig", medium: "Mittel", high: "Hoch" };

const FILE_ICONS: Record<string, string> = {
  pdf: "📄", docx: "📝", doc: "📝", xlsx: "📊", xls: "📊", csv: "📊",
  pptx: "📽️", ppt: "📽️", png: "🖼️", jpg: "🖼️", jpeg: "🖼️", gif: "🖼️",
  zip: "📦", rar: "📦", txt: "📃", py: "🐍", js: "📜", ts: "📜",
  html: "🌐", mp4: "🎬", mp3: "🎵",
};

function fileIcon(kind: string, fileType?: string | null) {
  if (kind === "link") return "🔗";
  return FILE_ICONS[fileType?.toLowerCase() ?? ""] ?? "📎";
}

function humanSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TasksPage() {
  const { t } = useTranslation();
  const { tasks, loading, refetch } = useTasks();
  const { modules } = useModules();
  const [filter, setFilter] = useState<"all" | TaskStatus>("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const supabase = createClient();

  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);

  async function toggleDone(task: Task) {
    const newStatus: TaskStatus = task.status === "done" ? "todo" : "done";
    await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
    refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm(t("tasks.deleteConfirm"))) return;
    await supabase.from("tasks").delete().eq("id", id);
    refetch();
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t("tasks.title")}</h1>
          <p className="text-surface-500 text-sm mt-0.5">{t("tasks.subtitle", { open: tasks.filter(tk => tk.status !== "done").length, done: tasks.filter(tk => tk.status === "done").length })}</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary gap-2">
          <Plus size={16} /> {t("tasks.newTask")}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-surface-100 rounded-xl mb-5 w-fit">
        {(["all", "todo", "in_progress", "done"] as const).map(s => {
          const label = s === "all" ? t("tasks.filterAll") :
                       s === "todo" ? t("tasks.filterOpen") :
                       s === "in_progress" ? t("tasks.filterInProgress") :
                       t("tasks.filterDone");
          return (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === s ? "bg-white text-surface-900 shadow-sm" : "text-surface-500 hover:text-surface-700"}`}>
              {label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-surface-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-surface-400">
          <CheckSquare size={40} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("tasks.noTasks")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <div key={task.id}>
              <TaskRow task={task} modules={modules}
                onToggle={toggleDone}
                onEdit={t => { setEditing(t); setShowForm(true); }}
                onDelete={handleDelete}
                isExpanded={expandedTask === task.id}
                onToggleExpand={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
              />
              {expandedTask === task.id && (
                <TaskAttachmentsPanel taskId={task.id} />
              )}
            </div>
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

function TaskRow({ task, modules, onToggle, onEdit, onDelete, isExpanded, onToggleExpand }: {
  task: Task & { modules?: { name: string; color: string } | null };
  modules: ReturnType<typeof useModules>["modules"];
  onToggle: (t: Task) => void;
  onEdit: (t: Task) => void;
  onDelete: (id: string) => void;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const { t } = useTranslation();
  const isOverdue = task.status !== "done" && task.due_date && new Date(task.due_date) < new Date();

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors group ${task.status === "done" ? "bg-surface-50 border-surface-100" : "bg-white border-surface-100 hover:border-brand-200"} ${isExpanded ? "rounded-b-none border-b-0" : ""}`}>
      <button onClick={() => onToggle(task)}
        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${task.status === "done" ? "bg-green-500 border-green-500 text-white" : "border-surface-300 hover:border-brand-400"}`}>
        {task.status === "done" && <Check size={11} />}
      </button>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-surface-400" : "text-surface-800"}`}>{task.title}</p>
        <div className="flex flex-wrap gap-2 mt-0.5">
          {task.due_date && (
            <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-surface-400"}`}>
              📅 {formatDate(task.due_date)}
            </span>
          )}
          {(task as any).modules && (
            <span className="text-xs text-surface-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: (task as any).modules.color }} />
              {(task as any).modules.name}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button onClick={onToggleExpand}
          className={`p-1.5 rounded-lg transition-colors ${isExpanded ? "bg-brand-100 text-brand-600" : "text-surface-400 hover:bg-surface-100"}`}
          title={t("tasks.attachments")}>
          <Paperclip size={14} />
        </button>
        <span className={`badge text-[10px] ${task.priority === "high" ? "bg-red-100 text-red-600" : task.priority === "medium" ? "bg-yellow-100 text-yellow-700" : "badge-surface"}`}>
          {task.priority === "high" ? t("tasks.statusHigh") : task.priority === "medium" ? t("tasks.statusMedium") : t("tasks.statusLow")}
        </span>
        <span className={`badge text-[10px] ${task.status === "done" ? "bg-green-100 text-green-700" : task.status === "in_progress" ? "bg-blue-100 text-blue-700" : "badge-surface"}`}>
          {task.status === "done" ? t("tasks.statusDone") : task.status === "in_progress" ? t("tasks.statusInProgress") : t("tasks.statusOpen")}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(task)} className="p-1.5 rounded-lg hover:bg-surface-100 text-surface-400"><Pencil size={13} /></button>
          <button onClick={() => onDelete(task.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-surface-400 hover:text-red-500"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

/** Expandable panel showing attachments for a task */
function TaskAttachmentsPanel({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const { attachments, loading, addLink, uploadFile, remove, getDownloadUrl } = useTaskAttachments(taskId);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkLabel, setLinkLabel] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAddLink(e: React.FormEvent) {
    e.preventDefault();
    if (!linkUrl.trim()) return;
    const url = linkUrl.trim().startsWith("http") ? linkUrl.trim() : `https://${linkUrl.trim()}`;
    await addLink(linkLabel.trim() || url, url);
    setLinkUrl("");
    setLinkLabel("");
    setShowLinkForm(false);
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      await uploadFile(files[i]);
    }
    e.target.value = "";
  }

  return (
    <div className="bg-surface-50 border border-t-0 border-surface-100 rounded-b-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
          <Paperclip size={12} /> {t("tasks.attachments")}
        </h3>
        <div className="flex gap-2">
          <button onClick={() => setShowLinkForm(!showLinkForm)}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
            <Link2 size={12} /> {t("tasks.addLink")}
          </button>
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg bg-white border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-600 transition-colors">
            <Upload size={12} /> {t("tasks.addFile")}
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload}
            accept=".pdf,.docx,.doc,.xlsx,.xls,.csv,.pptx,.ppt,.png,.jpg,.jpeg,.gif,.svg,.zip,.rar,.txt,.py,.js,.ts,.html,.mp4,.mp3" />
        </div>
      </div>

      {/* Link form */}
      {showLinkForm && (
        <form onSubmit={handleAddLink} className="flex gap-2 mb-3">
          <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
            placeholder="https://..." className="input flex-1 text-sm" required />
          <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)}
            placeholder={t("tasks.addAttachment")} className="input w-40 text-sm" />
          <button type="submit" className="btn-primary text-xs px-3 py-1.5">{t("tasks.addAttachment")}</button>
          <button type="button" onClick={() => setShowLinkForm(false)}
            className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-400"><X size={14} /></button>
        </form>
      )}

      {/* Attachment list */}
      {loading ? (
        <div className="h-8 bg-surface-200 rounded animate-pulse" />
      ) : attachments.length === 0 ? (
        <p className="text-xs text-surface-400 text-center py-3">{t("tasks.noAttachments")}</p>
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-2.5 p-2 rounded-lg bg-white border border-surface-100 group/att hover:border-brand-200 transition-colors">
              <span className="text-sm shrink-0">{fileIcon(att.kind, att.file_type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-surface-800 truncate">{att.label || att.url}</p>
                {att.kind === "file" && att.file_size > 0 && (
                  <p className="text-[10px] text-surface-400">{att.file_type?.toUpperCase()} · {humanSize(att.file_size)}</p>
                )}
              </div>
              <a href={getDownloadUrl(att) ?? att.url} target="_blank" rel="noopener noreferrer"
                className="p-1 rounded hover:bg-surface-100 text-surface-400 hover:text-brand-600 transition-colors"
                title={t("tasks.openLink")}>
                <ExternalLink size={13} />
              </a>
              <button onClick={() => remove(att)}
                className="p-1 rounded hover:bg-red-50 text-surface-300 hover:text-red-500 opacity-0 group-hover/att:opacity-100 transition-all"
                title={t("tasks.removeAttachment")}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TaskModal({ initial, modules, onClose, onSaved }: {
  initial: Task | null;
  modules: ReturnType<typeof useModules>["modules"];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
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
      await supabase.from("tasks").insert({ ...payload, user_id: user.id });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">{initial ? t("tasks.modal.editTitle") : t("tasks.modal.title")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("tasks.modal.titleLabel")}</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder={t("tasks.modal.titlePlaceholder")} />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("tasks.modal.descriptionLabel")}</label>
            <textarea className="input resize-none" rows={2} value={form.description} onChange={e => set("description", e.target.value)} placeholder={t("tasks.modal.descriptionPlaceholder")} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("tasks.modal.dueDateLabel")}</label>
              <input className="input" type="date" value={form.due_date} onChange={e => set("due_date", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("tasks.modal.modulLabel")}</label>
              <select className="input" value={form.module_id} onChange={e => set("module_id", e.target.value)}>
                <option value="">{t("tasks.modal.moduleEmpty")}</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("tasks.modal.priorityLabel")}</label>
              <select className="input" value={form.priority} onChange={e => set("priority", e.target.value)}>
                <option value="low">{t("tasks.statusLow")}</option>
                <option value="medium">{t("tasks.statusMedium")}</option>
                <option value="high">{t("tasks.statusHigh")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("tasks.modal.statusLabel")}</label>
              <select className="input" value={form.status} onChange={e => set("status", e.target.value)}>
                <option value="todo">{t("tasks.statusOpen")}</option>
                <option value="in_progress">{t("tasks.statusInProgress")}</option>
                <option value="done">{t("tasks.statusDone")}</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t("tasks.modal.cancel")}</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? t("tasks.modal.saving") : t("tasks.modal.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
