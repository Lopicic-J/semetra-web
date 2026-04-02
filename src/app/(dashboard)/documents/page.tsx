"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import {
  Plus, Trash2, Pencil, X, ExternalLink, FileText, Search,
  Link2, File, Image, Video, Pin, PinOff, BookOpen, FolderOpen,
  LayoutGrid, ListIcon, Workflow, GraduationCap, CheckSquare,
  CircleDot, Tag, Download, Globe, FileSpreadsheet, FileCode,
  Presentation, Archive
} from "lucide-react";
import type {
  Document as Doc, CalendarEvent, Task, Module,
  TaskAttachment, ExamAttachment
} from "@/types/database";

/* ── File type helpers ──────────────────────────────────────────────── */
function getKindFromUrl(url: string, fileType?: string | null): Doc["kind"] {
  const u = (url + (fileType ?? "")).toLowerCase();
  if (/\.(pdf)/.test(u)) return "pdf";
  if (/\.(png|jpg|jpeg|gif|webp|svg|bmp)/.test(u)) return "image";
  if (/\.(mp4|mov|avi|webm|mkv)/.test(u)) return "video";
  if (/\.(doc|docx|xls|xlsx|ppt|pptx|csv|txt|md)/.test(u)) return "file";
  return "link";
}

const KIND_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  link:  { label: "Link",     icon: <Globe size={14} />,         color: "#60a5fa" },
  file:  { label: "Datei",    icon: <File size={14} />,          color: "#a78bfa" },
  pdf:   { label: "PDF",      icon: <FileText size={14} />,      color: "#f87171" },
  image: { label: "Bild",     icon: <Image size={14} />,         color: "#34d399" },
  video: { label: "Video",    icon: <Video size={14} />,         color: "#fb923c" },
  other: { label: "Sonstiges",icon: <Archive size={14} />,       color: "#a1a1aa" },
};

/* ── Unified document item for aggregation ──────────────────────────── */
interface DocFlowItem {
  id: string;
  source: "document" | "task_attachment" | "exam_attachment" | "module_link";
  title: string;
  url: string;
  kind: string;
  date: string;
  module_name?: string;
  module_color?: string;
  context_label: string;
  pinned?: boolean;
  original?: Doc;
}

/* ── Main Page ──────────────────────────────────────────────────────── */
export default function DocumentsPage() {
  const supabase = createClient();
  const { modules } = useModules();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "flow">("grid");
  const [flowItems, setFlowItems] = useState<DocFlowItem[]>([]);

  const fetchDocs = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("*, module:modules(id,name,color)")
      .order("pinned", { ascending: false })
      .order("updated_at", { ascending: false });
    setDocs((data ?? []) as Doc[]);
    setLoading(false);
  }, [supabase]);

  // Aggregate all document sources
  const fetchFlow = useCallback(async () => {
    const items: DocFlowItem[] = [];

    // 1. Own documents
    const { data: ownDocs } = await supabase
      .from("documents")
      .select("*, module:modules(id,name,color)")
      .order("updated_at", { ascending: false });
    (ownDocs ?? []).forEach((d: any) => {
      items.push({
        id: "doc-" + d.id,
        source: "document",
        title: d.title,
        url: d.url,
        kind: d.kind,
        date: d.updated_at,
        module_name: d.module?.name,
        module_color: d.module?.color,
        context_label: "Dokument",
        pinned: d.pinned,
        original: d as Doc,
      });
    });

    // 2. Task attachments
    const { data: taskAtts } = await supabase
      .from("task_attachments")
      .select("*, task:tasks(id,title,module_id)")
      .order("created_at", { ascending: false });
    (taskAtts ?? []).forEach((a: any) => {
      const mod = a.task?.module_id ? modules.find(m => m.id === a.task.module_id) : null;
      items.push({
        id: "task-att-" + a.id,
        source: "task_attachment",
        title: a.label || "Aufgaben-Anhang",
        url: a.url,
        kind: getKindFromUrl(a.url, a.file_type),
        date: a.created_at,
        module_name: mod?.name,
        module_color: mod?.color,
        context_label: `Aufgabe: ${a.task?.title ?? "—"}`,
      });
    });

    // 3. Exam attachments (files & links, not notes)
    const { data: examAtts } = await supabase
      .from("exam_attachments")
      .select("*, exam:events!exam_attachments_exam_id_fkey(id,title)")
      .neq("kind", "note")
      .order("created_at", { ascending: false });
    (examAtts ?? []).forEach((a: any) => {
      items.push({
        id: "exam-att-" + a.id,
        source: "exam_attachment",
        title: a.label || "Prüfungs-Anhang",
        url: a.url,
        kind: getKindFromUrl(a.url, a.file_type),
        date: a.created_at,
        context_label: `Prüfung: ${a.exam?.title ?? "—"}`,
        module_color: "#fbbf24",
      });
    });

    // 4. Module links
    modules.forEach(m => {
      const links: { label: string; url: string }[] = [];
      if (m.link) links.push({ label: "Modul-Link", url: m.link });
      if (m.github_link) links.push({ label: "GitHub", url: m.github_link });
      if (m.sharepoint_link) links.push({ label: "SharePoint", url: m.sharepoint_link });
      if (m.notes_link) links.push({ label: "Notizen-Link", url: m.notes_link });
      if (m.literature_links) {
        m.literature_links.split(/[,;\n]/).filter(Boolean).forEach((l, i) => {
          links.push({ label: `Literatur ${i + 1}`, url: l.trim() });
        });
      }
      links.forEach((l, i) => {
        items.push({
          id: `mod-link-${m.id}-${i}`,
          source: "module_link",
          title: l.label,
          url: l.url,
          kind: "link",
          date: m.created_at,
          module_name: m.name,
          module_color: m.color,
          context_label: `Modul: ${m.name}`,
        });
      });
    });

    items.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    setFlowItems(items);
  }, [supabase, modules]);

  useEffect(() => {
    fetchDocs();
    fetchFlow();
    supabase.from("events").select("*").eq("event_type", "exam").then(r => setExams(r.data ?? []));
    supabase.from("tasks").select("*").then(r => setTasks(r.data ?? []));
  }, [supabase, fetchDocs, fetchFlow]);

  const filtered = useMemo(() => {
    let list = docs;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(d => d.title.toLowerCase().includes(q) || d.url.toLowerCase().includes(q));
    }
    if (filterModule) list = list.filter(d => d.module_id === filterModule);
    if (filterKind) list = list.filter(d => d.kind === filterKind);
    return list;
  }, [docs, searchQ, filterModule, filterKind]);

  const filteredFlow = useMemo(() => {
    let list = flowItems;
    if (searchQ) {
      const q = searchQ.toLowerCase();
      list = list.filter(i => i.title.toLowerCase().includes(q) || i.url.toLowerCase().includes(q));
    }
    if (filterModule) {
      const modName = modules.find(m => m.id === filterModule)?.name;
      list = list.filter(i => i.module_name === modName);
    }
    if (filterKind) list = list.filter(i => i.kind === filterKind);
    return list;
  }, [flowItems, searchQ, filterModule, filterKind, modules]);

  const stats = useMemo(() => ({
    total: flowItems.length,
    own: docs.length,
    fromTasks: flowItems.filter(i => i.source === "task_attachment").length,
    fromExams: flowItems.filter(i => i.source === "exam_attachment").length,
    fromModules: flowItems.filter(i => i.source === "module_link").length,
    byModule: modules.map(m => ({
      module: m,
      count: flowItems.filter(i => i.module_name === m.name).length,
    })).filter(x => x.count > 0).sort((a, b) => b.count - a.count),
    byKind: Object.keys(KIND_CONFIG).map(k => ({
      kind: k,
      count: flowItems.filter(i => i.kind === k).length,
    })).filter(x => x.count > 0),
  }), [docs, flowItems, modules]);

  async function deleteDoc(id: string) {
    if (!confirm("Dokument löschen?")) return;
    await supabase.from("documents").delete().eq("id", id);
    fetchDocs();
    fetchFlow();
  }

  async function togglePin(id: string, current: boolean) {
    await supabase.from("documents").update({ pinned: !current }).eq("id", id);
    fetchDocs();
    fetchFlow();
  }

  return (
    <div className="p-3 sm:p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4 sm:mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-surface-900 flex items-center gap-2">
            <FolderOpen className="text-blue-400" /> Dokumente & Links
          </h1>
          <p className="text-surface-500 text-xs sm:text-sm mt-1">Alle Dokumente und Links an einem Ort — zugeordnet zu Modulen, Aufgaben & Prüfungen</p>
        </div>
        <button
          onClick={() => { setEditDoc(null); setShowCreate(true); }}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition flex-shrink-0"
        >
          <Plus size={16} /> Hinzufügen
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <button
          onClick={() => setViewMode("flow")}
          className={`bg-white border rounded-xl p-2 sm:p-3 text-center transition ${viewMode === "flow" ? "border-brand-500" : "border-surface-200 hover:border-surface-300"}`}
        >
          <p className="text-lg sm:text-2xl font-bold text-surface-900">{stats.total}</p>
          <p className="text-xs text-surface-500">Alle Dokumente</p>
        </button>
        <div className="bg-white border border-surface-200 rounded-xl p-2 sm:p-3 text-center">
          <p className="text-lg sm:text-2xl font-bold text-brand-400">{stats.own}</p>
          <p className="text-xs text-surface-500">Eigene</p>
        </div>
        <div className="bg-white border border-surface-200 rounded-xl p-2 sm:p-3 text-center">
          <p className="text-lg sm:text-2xl font-bold text-blue-400">{stats.fromTasks + stats.fromExams}</p>
          <p className="text-xs text-surface-500">Aus Aufgaben & Prüfungen</p>
        </div>
        <div className="bg-white border border-surface-200 rounded-xl p-2 sm:p-3 text-center">
          <p className="text-lg sm:text-2xl font-bold text-cyan-400">{stats.fromModules}</p>
          <p className="text-xs text-surface-500">Modul-Links</p>
        </div>
      </div>

      {/* Module distribution */}
      {stats.byModule.length > 0 && (
        <div className="mb-4 sm:mb-6 bg-white border border-surface-200 rounded-xl p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-semibold text-surface-800 mb-2 sm:mb-3 flex items-center gap-2">
            <FolderOpen size={14} className="text-blue-400" /> Nach Modul
          </h3>
          <div className="flex gap-1 sm:gap-2 flex-wrap">
            {stats.byModule.map(({ module: m, count }) => (
              <button
                key={m.id}
                onClick={() => setFilterModule(filterModule === m.id ? "" : m.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  filterModule === m.id ? "ring-2 ring-white/30" : "hover:brightness-110"
                }`}
                style={{ backgroundColor: m.color + "25", color: m.color }}
              >
                <CircleDot size={10} /> {m.name} ({count})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kind filter chips */}
      {stats.byKind.length > 1 && (
        <div className="flex gap-1 sm:gap-1.5 mb-3 sm:mb-4 flex-wrap">
          <button
            onClick={() => setFilterKind("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${!filterKind ? "bg-brand-600 text-white" : "bg-surface-100 border border-surface-200 text-surface-700 hover:bg-surface-200"}`}
          >
            Alle Typen
          </button>
          {stats.byKind.map(({ kind, count }) => {
            const cfg = KIND_CONFIG[kind] ?? KIND_CONFIG.other;
            return (
              <button
                key={kind}
                onClick={() => setFilterKind(filterKind === kind ? "" : kind)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition ${
                  filterKind === kind ? "bg-brand-600 text-white" : "bg-surface-100 border border-surface-200 text-surface-700 hover:bg-surface-200"
                }`}
              >
                <span style={{ color: cfg.color }}>{cfg.icon}</span> {cfg.label} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Search + view toggle */}
      <div className="flex gap-1 sm:gap-2 mb-3 sm:mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[150px] sm:min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Dokumente durchsuchen..."
            className="w-full bg-white border border-surface-200 rounded-lg pl-10 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none transition"
          />
        </div>
        <select
          value={filterModule}
          onChange={e => setFilterModule(e.target.value)}
          className="bg-white border border-surface-200 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900"
        >
          <option value="">Module</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-surface-200">
          {(["grid", "list", "flow"] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`p-1 sm:p-2 transition ${viewMode === v ? "bg-brand-600 text-white" : "bg-white text-surface-500 hover:text-surface-900"}`}
              title={v === "flow" ? "Flow — alle Quellen" : v === "grid" ? "Karten" : "Liste"}
            >
              {v === "grid" ? <LayoutGrid size={14} /> : v === "list" ? <ListIcon size={14} /> : <Workflow size={14} />}
            </button>
          ))}
        </div>
        {(filterModule || filterKind || searchQ) && (
          <button
            onClick={() => { setFilterModule(""); setFilterKind(""); setSearchQ(""); }}
            className="px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg bg-surface-100 text-surface-500 hover:text-surface-900 text-xs transition flex-shrink-0"
          >
            Reset
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-surface-500 text-sm">Laden...</p>
      ) : viewMode === "flow" ? (
        <DocFlowView items={filteredFlow} onOpenDoc={(d) => { setEditDoc(d); setShowCreate(true); }} />
      ) : viewMode === "grid" ? (
        filtered.length === 0 ? (
          <EmptyState hasAny={docs.length > 0} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(doc => (
              <DocCard
                key={doc.id}
                doc={doc}
                modules={modules}
                onEdit={() => { setEditDoc(doc); setShowCreate(true); }}
                onDelete={() => deleteDoc(doc.id)}
                onTogglePin={() => togglePin(doc.id, doc.pinned)}
              />
            ))}
          </div>
        )
      ) : (
        filtered.length === 0 ? (
          <EmptyState hasAny={docs.length > 0} />
        ) : (
          <div className="space-y-2">
            {filtered.map(doc => (
              <DocListRow
                key={doc.id}
                doc={doc}
                modules={modules}
                onEdit={() => { setEditDoc(doc); setShowCreate(true); }}
                onDelete={() => deleteDoc(doc.id)}
              />
            ))}
          </div>
        )
      )}

      {showCreate && (
        <DocModal
          doc={editDoc}
          modules={modules}
          exams={exams}
          tasks={tasks}
          onClose={() => { setShowCreate(false); setEditDoc(null); }}
          onSaved={() => { setShowCreate(false); setEditDoc(null); fetchDocs(); fetchFlow(); }}
        />
      )}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────── */
function EmptyState({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="text-center py-16">
      <FolderOpen size={48} className="mx-auto mb-4 text-surface-300" />
      <p className="text-surface-500">{hasAny ? "Keine Dokumente gefunden" : "Noch keine Dokumente"}</p>
      <p className="text-sm mt-1 text-surface-400">
        {hasAny ? "Versuche einen anderen Filter" : "Füge Dokumente und Links zu deinen Modulen hinzu!"}
      </p>
    </div>
  );
}

/* ── Doc Card (Grid) ────────────────────────────────────────────────── */
function DocCard({ doc, modules, onEdit, onDelete, onTogglePin }: {
  doc: Doc; modules: Module[]; onEdit: () => void; onDelete: () => void; onTogglePin: () => void;
}) {
  const mod = doc.module ?? modules.find(m => m.id === doc.module_id);
  const cfg = KIND_CONFIG[doc.kind] ?? KIND_CONFIG.other;
  const domain = (() => { try { return new URL(doc.url).hostname.replace("www.", ""); } catch { return ""; } })();

  return (
    <div
      className="bg-white border border-surface-200 rounded-xl p-2 sm:p-4 hover:border-surface-300 transition group"
      style={{ borderTopWidth: 3, borderTopColor: cfg.color }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
          <span style={{ color: cfg.color }}>{cfg.icon}</span>
          <h3 className="font-semibold text-surface-900 text-xs sm:text-sm line-clamp-1 flex-1">
            {doc.pinned && <Pin size={10} className="inline mr-1 text-amber-400" />}
            {doc.title}
          </h3>
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded font-medium flex-shrink-0"
          style={{ backgroundColor: cfg.color + "20", color: cfg.color }}>
          {cfg.label}
        </span>
      </div>

      {domain && <p className="text-xs text-surface-400 mb-2 truncate text-[10px]">{domain}</p>}

      <div className="flex items-center gap-1 sm:gap-2 flex-wrap mb-2 sm:mb-3">
        {mod && (
          <span className="text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium"
            style={{ backgroundColor: mod.color + "20", color: mod.color }}>
            <BookOpen size={10} className="inline mr-0.5 sm:mr-1" />{mod.name}
          </span>
        )}
        {doc.tags?.length > 0 && doc.tags.map(t => (
          <span key={t} className="text-[10px] sm:text-xs px-1 sm:px-1.5 py-0.5 rounded bg-surface-100 text-surface-500">
            <Tag size={8} className="inline mr-0.5" />{t}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] sm:text-xs text-surface-400">{new Date(doc.updated_at).toLocaleDateString("de-CH")}</span>
        <div className="flex items-center gap-0 sm:gap-0.5 opacity-0 group-hover:opacity-100 transition">
          <a href={doc.url} target="_blank" rel="noopener" className="p-1 sm:p-1.5 text-surface-500 hover:text-blue-400 transition" title="Öffnen"><ExternalLink size={13} /></a>
          <button onClick={onTogglePin} className={`p-1 sm:p-1.5 transition ${doc.pinned ? "text-amber-400" : "text-surface-500 hover:text-amber-400"}`} title={doc.pinned ? "Loslösen" : "Anheften"}><Pin size={13} /></button>
          <button onClick={onEdit} className="p-1 sm:p-1.5 text-surface-500 hover:text-surface-900 transition" title="Bearbeiten"><Pencil size={13} /></button>
          <button onClick={onDelete} className="p-1 sm:p-1.5 text-surface-500 hover:text-red-400 transition" title="Löschen"><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

/* ── Doc List Row ───────────────────────────────────────────────────── */
function DocListRow({ doc, modules, onEdit, onDelete }: {
  doc: Doc; modules: Module[]; onEdit: () => void; onDelete: () => void;
}) {
  const mod = doc.module ?? modules.find(m => m.id === doc.module_id);
  const cfg = KIND_CONFIG[doc.kind] ?? KIND_CONFIG.other;

  return (
    <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-white border border-surface-200 rounded-lg hover:border-surface-300 transition group">
      <span style={{ color: cfg.color }}>{cfg.icon}</span>
      {doc.pinned && <Pin size={12} className="text-amber-400 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <h3 className="text-xs sm:text-sm font-medium text-surface-900 line-clamp-1">{doc.title}</h3>
        <p className="text-[10px] sm:text-xs text-surface-400 truncate">{doc.url}</p>
      </div>
      {mod && (
        <span className="text-xs px-1.5 sm:px-2 py-0.5 rounded-full font-medium flex-shrink-0" style={{ backgroundColor: mod.color + "20", color: mod.color }}>
          {mod.name}
        </span>
      )}
      <span className="text-xs px-1 sm:px-1.5 py-0.5 rounded font-medium flex-shrink-0" style={{ backgroundColor: cfg.color + "20", color: cfg.color }}>
        {cfg.label}
      </span>
      <div className="flex items-center gap-0 sm:gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
        <a href={doc.url} target="_blank" rel="noopener" className="p-1 sm:p-1.5 text-surface-500 hover:text-blue-400 transition"><ExternalLink size={13} /></a>
        <button onClick={onEdit} className="p-1 sm:p-1.5 text-surface-500 hover:text-surface-900 transition"><Pencil size={13} /></button>
        <button onClick={onDelete} className="p-1 sm:p-1.5 text-surface-500 hover:text-red-400 transition"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

/* ── Flow View ──────────────────────────────────────────────────────── */
const SOURCE_CONFIG: Record<string, { label: string; color: string }> = {
  document:        { label: "Dokument",        color: "#a78bfa" },
  task_attachment:  { label: "Aufgaben-Anhang", color: "#60a5fa" },
  exam_attachment:  { label: "Prüfungs-Anhang", color: "#fbbf24" },
  module_link:      { label: "Modul-Link",      color: "#22d3ee" },
};

function DocFlowView({ items, onOpenDoc }: { items: DocFlowItem[]; onOpenDoc: (d: Doc) => void }) {
  // Group by module
  const byModule: Record<string, DocFlowItem[]> = { "Ohne Zuordnung": [] };
  items.forEach(item => {
    const key = item.module_name || "Ohne Zuordnung";
    if (!byModule[key]) byModule[key] = [];
    byModule[key].push(item);
  });

  if (items.length === 0) {
    return <EmptyState hasAny={false} />;
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Legend */}
      <div className="flex gap-2 sm:gap-3 flex-wrap">
        {Object.entries(SOURCE_CONFIG).map(([key, cfg]) => {
          const count = items.filter(i => i.source === key).length;
          if (count === 0) return null;
          return (
            <span key={key} className="flex items-center gap-1 sm:gap-1.5 text-xs font-medium" style={{ color: cfg.color }}>
              <CircleDot size={8} /> {cfg.label} ({count})
            </span>
          );
        })}
        <span className="text-xs text-surface-400 ml-auto">{items.length} Einträge</span>
      </div>

      {/* Grouped by module */}
      {Object.entries(byModule).filter(([, items]) => items.length > 0).map(([modName, modItems]) => {
        const modColor = modItems[0]?.module_color ?? "#666";
        return (
          <div key={modName}>
            <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
              <div className="w-2 sm:w-3 h-2 sm:h-3 rounded-full flex-shrink-0" style={{ backgroundColor: modName === "Ohne Zuordnung" ? "#999" : modColor }} />
              <h3 className="text-xs sm:text-sm font-semibold text-surface-800">{modName}</h3>
              <span className="text-xs text-surface-400">({modItems.length})</span>
              <div className="h-px flex-1 bg-surface-200" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 sm:gap-2 ml-2 sm:ml-6">
              {modItems.map(item => {
                const cfg = KIND_CONFIG[item.kind] ?? KIND_CONFIG.other;
                const srcCfg = SOURCE_CONFIG[item.source] ?? SOURCE_CONFIG.document;
                const isOwn = item.source === "document" && item.original;

                return (
                  <div
                    key={item.id}
                    className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-white border border-surface-200 rounded-lg transition ${
                      isOwn ? "hover:border-surface-300 cursor-pointer" : ""
                    } group`}
                    onClick={() => { if (isOwn && item.original) onOpenDoc(item.original); }}
                  >
                    <span className="mt-0.5 flex-shrink-0" style={{ color: cfg.color }}>{cfg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <h4 className={`text-xs sm:text-sm font-medium text-surface-900 line-clamp-1 ${isOwn ? "group-hover:text-brand-600" : ""}`}>
                        {item.pinned && <Pin size={10} className="inline mr-1 text-amber-400" />}
                        {item.title}
                      </h4>
                      <p className="text-[10px] sm:text-xs text-surface-400 truncate mt-0.5">{item.context_label}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <span className="text-xs px-1 sm:px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: srcCfg.color + "20", color: srcCfg.color }}>
                        {srcCfg.label}
                      </span>
                      <a href={item.url} target="_blank" rel="noopener" className="p-1 text-surface-400 hover:text-blue-400 transition" onClick={e => e.stopPropagation()}>
                        <ExternalLink size={12} />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Add/Edit Document Modal ────────────────────────────────────────── */
function DocModal({
  doc, modules, exams, tasks, onClose, onSaved,
}: {
  doc: Doc | null;
  modules: Module[];
  exams: CalendarEvent[];
  tasks: Task[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const isEdit = !!doc;
  const [title, setTitle] = useState(doc?.title ?? "");
  const [url, setUrl] = useState(doc?.url ?? "");
  const [kind, setKind] = useState(doc?.kind ?? "link");
  const [moduleId, setModuleId] = useState(doc?.module_id ?? "");
  const [examId, setExamId] = useState(doc?.exam_id ?? "");
  const [taskId, setTaskId] = useState(doc?.task_id ?? "");
  const [tagsStr, setTagsStr] = useState((doc?.tags ?? []).join(", "));
  const [color, setColor] = useState(doc?.color ?? "#6d28d9");
  const [saving, setSaving] = useState(false);

  const filteredExams = moduleId
    ? exams.filter(e => e.title?.toLowerCase().includes(modules.find(m => m.id === moduleId)?.name?.toLowerCase().slice(0, 5) ?? "---"))
    : exams;
  const filteredTasks = moduleId ? tasks.filter(t => t.module_id === moduleId) : tasks;

  async function handleSave() {
    setSaving(true);
    const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      title: title || url || "Neues Dokument",
      url,
      kind: kind || getKindFromUrl(url),
      module_id: moduleId || null,
      exam_id: examId || null,
      task_id: taskId || null,
      tags,
      color,
      updated_at: new Date().toISOString(),
    };

    if (isEdit) {
      await supabase.from("documents").update(payload).eq("id", doc!.id);
    } else {
      await supabase.from("documents").insert(payload);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="bg-white border border-surface-200 rounded-2xl w-full max-w-md p-4 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center gap-2 mb-4 sm:mb-5">
          <h2 className="text-base sm:text-lg font-bold text-surface-900">{isEdit ? "Dokument bearbeiten" : "Dokument hinzufügen"}</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-900 transition flex-shrink-0"><X size={20} /></button>
        </div>

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">URL / Link</label>
        <input
          value={url}
          onChange={e => {
            setUrl(e.target.value);
            if (!title) {
              const detected = getKindFromUrl(e.target.value);
              setKind(detected);
            }
          }}
          placeholder="https://..."
          className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm text-surface-900 placeholder:text-surface-400 mb-3 focus:border-brand-500 focus:outline-none transition"
          autoFocus
        />

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">Titel</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="z.B. Skript Kapitel 5, Vorlesungsfolien..."
          className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm text-surface-900 placeholder:text-surface-400 mb-3 focus:border-brand-500 focus:outline-none transition"
        />

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">Typ</label>
        <div className="flex gap-1 sm:gap-1.5 mb-3 flex-wrap">
          {Object.entries(KIND_CONFIG).map(([k, cfg]) => (
            <button
              key={k}
              onClick={() => setKind(k as Doc["kind"])}
              className={`flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg text-xs font-medium transition ${
                kind === k ? "bg-brand-600 text-white" : "bg-surface-100 border border-surface-200 text-surface-500 hover:text-surface-900"
              }`}
            >
              <span style={{ color: kind === k ? "white" : cfg.color }}>{cfg.icon}</span> {cfg.label}
            </button>
          ))}
        </div>

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">Zuordnung</label>
        <select
          value={moduleId}
          onChange={e => { setModuleId(e.target.value); setExamId(""); setTaskId(""); }}
          className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900 mb-2"
        >
          <option value="">Kein Modul</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {moduleId && (
          <div className="flex gap-1 sm:gap-2 mb-2 flex-col sm:flex-row">
            <select
              value={examId}
              onChange={e => setExamId(e.target.value)}
              className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900"
            >
              <option value="">Keine Prüfung</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900"
            >
              <option value="">Keine Aufgabe</option>
              {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5 mt-2">Tags (kommagetrennt)</label>
        <input
          value={tagsStr}
          onChange={e => setTagsStr(e.target.value)}
          placeholder="z.B. Skript, Vorlesung, Übung"
          className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900 placeholder:text-surface-400 mb-3 sm:mb-4 focus:border-brand-500 focus:outline-none transition"
        />

        <button
          onClick={handleSave}
          disabled={saving || !url.trim()}
          className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition disabled:opacity-50"
        >
          {saving ? "Speichern..." : isEdit ? "Änderungen speichern" : "Hinzufügen"}
        </button>
      </div>
    </div>
  );
}
