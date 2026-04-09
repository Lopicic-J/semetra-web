"use client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { FREE_LIMITS, withinFreeLimit } from "@/lib/gates";
import { LimitNudge, LimitCounter, UpgradeModal } from "@/components/ui/ProGate";
import {
  Plus, Trash2, Pencil, X, ExternalLink, FileText, Search,
  Link2, File, Image, Video, Pin, PinOff, BookOpen, FolderOpen,
  LayoutGrid, ListIcon, Workflow, GraduationCap, CheckSquare,
  CircleDot, Tag, Download, Globe, FileSpreadsheet, FileCode,
  Presentation, Archive, Upload, Loader2, Scissors, Combine,
  GripVertical, ChevronUp, ChevronDown, ArrowDownToLine, Minus
} from "lucide-react";
import type {
  Document as Doc, CalendarEvent, Task, Module,
  TaskAttachment, ExamAttachment
} from "@/types/database";
import { useTranslation } from "@/lib/i18n";

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
  const { t } = useTranslation();
  const supabase = createClient();
  const { modules } = useModules();
  const { isPro } = useProfile();
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editDoc, setEditDoc] = useState<Doc | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [filterModule, setFilterModule] = useState("");
  const [filterKind, setFilterKind] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list" | "flow">("flow");
  const [showPdfTools, setShowPdfTools] = useState(false);
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
    if (!confirm(t("documents.deleteConfirm"))) return;
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
            <FolderOpen className="text-blue-400" /> {t("documents.title")}
          </h1>
          <p className="text-surface-500 text-xs sm:text-sm mt-1">{t("navigator.documentsDesc")}</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <LimitCounter current={docs.length} max={FREE_LIMITS.documents} isPro={isPro} />
          <button
            onClick={() => setShowPdfTools(true)}
            className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition flex-shrink-0"
          >
            <FileText size={16} /> {t("documents.pdfTools")}
          </button>
          <button
            onClick={() => {
              const check = withinFreeLimit("documents", docs.length, isPro);
              if (!check.allowed) { setShowUpgrade(true); return; }
              setEditDoc(null); setShowCreate(true);
            }}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-lg text-xs sm:text-sm font-medium transition flex-shrink-0"
          >
            <Plus size={16} /> {t("documents.modal.add")}
          </button>
        </div>
      </div>

      <LimitNudge current={docs.length} max={FREE_LIMITS.documents} isPro={isPro} label={t("documents.title")} />

      {showUpgrade && (
        <UpgradeModal feature="unlimitedDocs" onClose={() => setShowUpgrade(false)} />
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-4 sm:mb-6">
        <button
          onClick={() => setViewMode("flow")}
          className={`bg-surface-100 border rounded-xl p-2 sm:p-3 text-center transition ${viewMode === "flow" ? "border-brand-500" : "border-surface-200 hover:border-surface-300"}`}
        >
          <p className="text-lg sm:text-2xl font-bold text-surface-900">{stats.total}</p>
          <p className="text-xs text-surface-500">{t("documents.totalDocs") || "Gesamt"}</p>
        </button>
        <div className="bg-surface-100 border border-surface-200 rounded-xl p-2 sm:p-3 text-center">
          <p className="text-lg sm:text-2xl font-bold text-brand-400">{stats.own}</p>
          <p className="text-xs text-surface-500">{t("documents.typeDocument")}</p>
        </div>
        <div className="bg-surface-100 border border-surface-200 rounded-xl p-2 sm:p-3 text-center">
          <p className="text-lg sm:text-2xl font-bold text-blue-400">{stats.fromTasks + stats.fromExams}</p>
          <p className="text-xs text-surface-500">{t("documents.typeTaskAttachment")}</p>
        </div>
        <div className="bg-surface-100 border border-surface-200 rounded-xl p-2 sm:p-3 text-center">
          <p className="text-lg sm:text-2xl font-bold text-cyan-400">{stats.fromModules}</p>
          <p className="text-xs text-surface-500">{t("documents.typeModuleLink")}</p>
        </div>
      </div>

      {/* Module distribution */}
      {stats.byModule.length > 0 && (
        <div className="mb-4 sm:mb-6 bg-surface-100 border border-surface-200 rounded-xl p-3 sm:p-4">
          <h3 className="text-xs sm:text-sm font-semibold text-surface-800 mb-2 sm:mb-3 flex items-center gap-2">
            <FolderOpen size={14} className="text-blue-400" /> {t("nav.modules")}
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
            {t("grades.filterAll")}
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
            placeholder={t("documents.search")}
            className="w-full bg-surface-100 border border-surface-200 rounded-lg pl-10 pr-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900 placeholder:text-surface-400 focus:border-brand-500 focus:outline-none transition"
          />
        </div>
        <select
          value={filterModule}
          onChange={e => setFilterModule(e.target.value)}
          className="bg-surface-100 border border-surface-200 rounded-lg px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900"
        >
          <option value="">{t("nav.modules")}</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-surface-200">
          {(["flow", "grid", "list"] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`p-1 sm:p-2 transition ${viewMode === v ? "bg-brand-600 text-white" : "bg-surface-100 text-surface-500 hover:text-surface-900"}`}
              title={v === "flow" ? t("documents.viewFlow") : v === "grid" ? t("documents.viewCards") : t("documents.viewList")}
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
            {t("grades.filterAll")}
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <p className="text-surface-500 text-sm">{t("documents.typeDocument")}</p>
      ) : viewMode === "flow" ? (
        <DocFlowView items={filteredFlow} onOpenDoc={(d) => { setEditDoc(d); setShowCreate(true); }} />
      ) : viewMode === "grid" ? (
        filtered.length === 0 ? (
          <EmptyState hasAny={docs.length > 0} flowCount={flowItems.length} onSwitchToFlow={() => setViewMode("flow")} />
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
          <EmptyState hasAny={docs.length > 0} flowCount={flowItems.length} onSwitchToFlow={() => setViewMode("flow")} />
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

      {showPdfTools && <PdfToolsModal onClose={() => setShowPdfTools(false)} />}
    </div>
  );
}

/* ── Empty state ────────────────────────────────────────────────────── */
function EmptyState({ hasAny, flowCount, onSwitchToFlow }: { hasAny: boolean; flowCount?: number; onSwitchToFlow?: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="text-center py-16">
      <FolderOpen size={48} className="mx-auto mb-4 text-surface-300" />
      <p className="text-surface-500">{hasAny ? t("documents.noDocuments") : t("documents.noDocumentsOwn")}</p>
      <p className="text-sm mt-1 text-surface-400">
        {hasAny ? t("documents.tryOtherFilter") : t("documents.addDocuments")}
      </p>
      {!hasAny && flowCount && flowCount > 0 && onSwitchToFlow && (
        <button onClick={onSwitchToFlow} className="mt-4 px-4 py-2 rounded-lg bg-brand-50 text-brand-600 text-sm font-medium hover:bg-brand-100 transition">
          <Workflow size={14} className="inline mr-1.5" />
          {flowCount} Dokumente aus Modulen, Aufgaben & Prüfungen anzeigen
        </button>
      )}
    </div>
  );
}

/* ── Doc Card (Grid) ────────────────────────────────────────────────── */
function DocCard({ doc, modules, onEdit, onDelete, onTogglePin }: {
  doc: Doc; modules: Module[]; onEdit: () => void; onDelete: () => void; onTogglePin: () => void;
}) {
  const { t } = useTranslation();
  const mod = doc.module ?? modules.find(m => m.id === doc.module_id);
  const cfg = KIND_CONFIG[doc.kind] ?? KIND_CONFIG.other;
  const domain = (() => { try { return new URL(doc.url).hostname.replace("www.", ""); } catch { return ""; } })();

  return (
    <div
      className="bg-surface-100 border border-surface-200 rounded-xl p-2 sm:p-4 hover:border-surface-300 transition group"
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
          <a href={doc.url} target="_blank" rel="noopener" className="p-1 sm:p-1.5 text-surface-500 hover:text-blue-400 transition" title={t("documents.open")}><ExternalLink size={13} /></a>
          <button onClick={onTogglePin} className={`p-1 sm:p-1.5 transition ${doc.pinned ? "text-amber-400" : "text-surface-500 hover:text-amber-400"}`} title={doc.pinned ? t("documents.detach") : t("documents.pin")}><Pin size={13} /></button>
          <button onClick={onEdit} className="p-1 sm:p-1.5 text-surface-500 hover:text-surface-900 transition" title={t("documents.edit")}><Pencil size={13} /></button>
          <button onClick={onDelete} className="p-1 sm:p-1.5 text-surface-500 hover:text-red-400 transition" title={t("documents.delete")}><Trash2 size={13} /></button>
        </div>
      </div>
    </div>
  );
}

/* ── Doc List Row ───────────────────────────────────────────────────── */
function DocListRow({ doc, modules, onEdit, onDelete }: {
  doc: Doc; modules: Module[]; onEdit: () => void; onDelete: () => void;
}) {
  const { t } = useTranslation();
  const mod = doc.module ?? modules.find(m => m.id === doc.module_id);
  const cfg = KIND_CONFIG[doc.kind] ?? KIND_CONFIG.other;

  return (
    <div className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-surface-100 border border-surface-200 rounded-lg hover:border-surface-300 transition group">
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
        <a href={doc.url} target="_blank" rel="noopener" className="p-1 sm:p-1.5 text-surface-500 hover:text-blue-400 transition" title={t("documents.open")}><ExternalLink size={13} /></a>
        <button onClick={onEdit} className="p-1 sm:p-1.5 text-surface-500 hover:text-surface-900 transition" title={t("documents.edit")}><Pencil size={13} /></button>
        <button onClick={onDelete} className="p-1 sm:p-1.5 text-surface-500 hover:text-red-400 transition" title={t("documents.delete")}><Trash2 size={13} /></button>
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
  const { t } = useTranslation();
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
        <span className="text-xs text-surface-400 ml-auto">{t("documents.entriesCount", { count: items.length })}</span>
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
                    className={`flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-surface-100 border border-surface-200 rounded-lg transition ${
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
                      <a href={item.url} target="_blank" rel="noopener" className="p-1 text-surface-400 hover:text-blue-400 transition" onClick={e => e.stopPropagation()} title={t("documents.open")}>
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

/* ── PDF Tools Modal ───────────────────────────────────────────────── */

interface PageThumb {
  pageIndex: number;       // original page index in its source PDF
  fileIndex: number;       // which PDF file it came from
  fileName: string;
  dataUrl: string;         // canvas thumbnail as data URL
  width: number;
  height: number;
}

async function renderPdfThumbnails(
  file: File,
  fileIndex: number,
  scale: number = 0.3
): Promise<PageThumb[]> {
  const buf = await file.arrayBuffer();
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(buf, { ignoreEncryption: true });
  const thumbs: PageThumb[] = [];
  const pageCount = pdf.getPageCount();

  // Use pdf.js-like canvas rendering isn't available without pdfjs.
  // Instead, create a simple placeholder with page number + file name.
  for (let i = 0; i < pageCount; i++) {
    const page = pdf.getPage(i);
    const { width, height } = page.getSize();
    const w = Math.round(width * scale);
    const h = Math.round(height * scale);

    // Create a simple canvas thumbnail
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    // Light background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    // Border
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
    // Page number centered
    ctx.fillStyle = "#64748b";
    ctx.font = `bold ${Math.max(12, Math.round(h * 0.15))}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(`${i + 1}`, w / 2, h / 2);
    // File name at bottom
    ctx.font = `${Math.max(8, Math.round(h * 0.07))}px system-ui`;
    ctx.fillStyle = "#94a3b8";
    const label = file.name.length > 15 ? file.name.slice(0, 12) + "…" : file.name;
    ctx.fillText(label, w / 2, h - Math.max(8, Math.round(h * 0.08)));

    thumbs.push({
      pageIndex: i,
      fileIndex,
      fileName: file.name,
      dataUrl: canvas.toDataURL("image/png"),
      width: w,
      height: h,
    });
  }
  return thumbs;
}

/* ── PDF Tools Modal ─────────────────────────────────────────────────── */
function PdfToolsModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"merge" | "split">("merge");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-surface-100 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-200">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-surface-900">{t("documents.pdfTools")}</h2>
            <div className="flex bg-surface-100 rounded-lg p-0.5">
              <button onClick={() => setActiveTab("merge")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  activeTab === "merge" ? "bg-surface-100 shadow text-brand-700" : "text-surface-500 hover:text-surface-700"
                }`}>
                <Combine size={13} className="inline mr-1.5 -mt-0.5" />
                {t("documents.pdfMerge")}
              </button>
              <button onClick={() => setActiveTab("split")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  activeTab === "split" ? "bg-surface-100 shadow text-brand-700" : "text-surface-500 hover:text-surface-700"
                }`}>
                <Scissors size={13} className="inline mr-1.5 -mt-0.5" />
                {t("documents.pdfSplit")}
              </button>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-surface-100 text-surface-400 hover:text-surface-600 transition">
            <X size={18} />
          </button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-6">
          {activeTab === "merge" ? <PdfMergePanel /> : <PdfSplitPanel />}
        </div>
      </div>
    </div>
  );
}

/* ── PDF Merge Panel (page-level thumbnails) ────────────────────────── */
function PdfMergePanel() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  async function addFiles(fileList: FileList) {
    setLoading(true);
    try {
      const newPages: PageThumb[] = [];
      const newFiles: File[] = [];
      for (const file of Array.from(fileList)) {
        if (file.type !== "application/pdf") continue;
        const fileIdx = sourceFiles.length + newFiles.length;
        newFiles.push(file);
        const thumbs = await renderPdfThumbnails(file, fileIdx);
        newPages.push(...thumbs);
      }
      setSourceFiles(prev => [...prev, ...newFiles]);
      setPages(prev => [...prev, ...newPages]);
    } finally {
      setLoading(false);
    }
  }

  function removePage(idx: number) {
    setPages(prev => prev.filter((_, i) => i !== idx));
  }

  function handleDragStart(idx: number) { setDragIdx(idx); }
  function handleDragOver(e: React.DragEvent, idx: number) { e.preventDefault(); setDragOverIdx(idx); }
  function handleDrop(idx: number) {
    if (dragIdx !== null && dragIdx !== idx) {
      setPages(prev => {
        const arr = [...prev];
        const [item] = arr.splice(dragIdx, 1);
        arr.splice(idx, 0, item);
        return arr;
      });
    }
    setDragIdx(null);
    setDragOverIdx(null);
  }

  async function mergePdfs() {
    if (pages.length < 1) return;
    setProcessing(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const merged = await PDFDocument.create();
      // Cache loaded source PDFs
      const pdfCache: Record<number, any> = {};
      for (const pg of pages) {
        if (!pdfCache[pg.fileIndex]) {
          const buf = await sourceFiles[pg.fileIndex].arrayBuffer();
          pdfCache[pg.fileIndex] = await PDFDocument.load(buf, { ignoreEncryption: true });
        }
        const [copiedPage] = await merged.copyPages(pdfCache[pg.fileIndex], [pg.pageIndex]);
        merged.addPage(copiedPage);
      }
      const bytes = await merged.save();
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "zusammengefuegt.pdf";
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF merge error:", err);
      alert(t("documents.pdfError"));
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <p className="text-xs text-surface-500">{t("documents.pdfMergeDesc")}</p>
        <p className="text-[11px] text-surface-400 mt-0.5">{t("documents.pdfDragHint")}</p>
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf" multiple className="hidden"
        onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
      <button onClick={() => fileInputRef.current?.click()}
        className="w-full mb-4 px-4 py-5 rounded-xl border-2 border-dashed border-surface-300 text-surface-500 text-sm hover:border-brand-400 hover:text-brand-600 transition flex flex-col items-center gap-1.5">
        <Upload size={18} />
        {t("documents.pdfAddFiles")}
      </button>

      {loading && (
        <div className="flex items-center justify-center py-6 text-surface-400 text-sm gap-2">
          <Loader2 size={16} className="animate-spin" /> Seiten werden geladen...
        </div>
      )}

      {/* Page thumbnail grid */}
      {pages.length > 0 && (
        <div className="flex-1 overflow-y-auto mb-4">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
            {pages.map((pg, i) => (
              <div key={`${pg.fileIndex}-${pg.pageIndex}-${i}`}
                draggable
                onDragStart={() => handleDragStart(i)}
                onDragOver={e => handleDragOver(e, i)}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                onDrop={() => handleDrop(i)}
                className={`relative group rounded-lg border-2 transition cursor-grab active:cursor-grabbing overflow-hidden ${
                  dragOverIdx === i ? "border-brand-400 ring-2 ring-brand-200" : dragIdx === i ? "opacity-40 border-surface-300" : "border-surface-200 hover:border-surface-300"
                }`}
              >
                {/* Order badge */}
                <div className="absolute top-1 left-1 bg-brand-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center z-10">
                  {i + 1}
                </div>
                {/* Remove button */}
                <button onClick={() => removePage(i)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10">
                  <X size={10} />
                </button>
                {/* Thumbnail */}
                <img src={pg.dataUrl} alt={`Page ${pg.pageIndex + 1}`}
                  className="w-full h-auto bg-[rgb(var(--card-bg))]" draggable={false} />
                {/* File label */}
                <div className="px-1.5 py-1 bg-surface-50 border-t border-surface-200">
                  <p className="text-[9px] text-surface-500 truncate">{pg.fileName}</p>
                  <p className="text-[10px] font-medium text-surface-700">S. {pg.pageIndex + 1}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer with merge button */}
      {pages.length > 0 && (
        <div className="flex items-center justify-between pt-3 border-t border-surface-200">
          <span className="text-xs text-surface-500">
            {pages.length} {t("documents.pdfPages")} · {new Set(pages.map(p => p.fileIndex)).size} PDFs
          </span>
          <button onClick={mergePdfs} disabled={pages.length < 1 || processing}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
            {processing ? <Loader2 size={14} className="animate-spin" /> : <ArrowDownToLine size={14} />}
            {processing ? t("documents.pdfProcessing") : t("documents.pdfMergeAction")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── PDF Split Panel (page-level group assignment) ──────────────────── */
const GROUP_COLORS = ["#6366f1", "#f43f5e", "#10b981", "#f59e0b", "#06b6d4", "#8b5cf6", "#ec4899", "#14b8a6"];

function PdfSplitPanel() {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [numOutputs, setNumOutputs] = useState(2);
  // group assignment per page index (0-based group)
  const [assignments, setAssignments] = useState<number[]>([]);

  async function loadFile(f: File) {
    if (f.type !== "application/pdf") return;
    setLoading(true);
    try {
      const thumbs = await renderPdfThumbnails(f, 0);
      setFile(f);
      setPages(thumbs);
      // Default: assign pages evenly across 2 groups
      const assign = thumbs.map((_, i) => Math.min(Math.floor(i / Math.ceil(thumbs.length / 2)), 1));
      setAssignments(assign);
      setNumOutputs(2);
    } finally {
      setLoading(false);
    }
  }

  function cycleGroup(pageIdx: number) {
    setAssignments(prev => {
      const arr = [...prev];
      arr[pageIdx] = (arr[pageIdx] + 1) % numOutputs;
      return arr;
    });
  }

  function setGroup(pageIdx: number, group: number) {
    setAssignments(prev => {
      const arr = [...prev];
      arr[pageIdx] = group;
      return arr;
    });
  }

  function changeNumOutputs(delta: number) {
    const next = Math.max(2, Math.min(8, numOutputs + delta));
    setNumOutputs(next);
    // Clamp any assignments that exceed new max
    setAssignments(prev => prev.map(g => Math.min(g, next - 1)));
  }

  async function splitPdf() {
    if (!file || pages.length === 0) return;
    setProcessing(true);
    try {
      const { PDFDocument } = await import("pdf-lib");
      const buf = await file.arrayBuffer();
      const src = await PDFDocument.load(buf, { ignoreEncryption: true });
      const baseName = file.name.replace(/\.pdf$/i, "");

      for (let g = 0; g < numOutputs; g++) {
        const pageIndices = assignments
          .map((group, idx) => group === g ? idx : -1)
          .filter(idx => idx >= 0);
        if (pageIndices.length === 0) continue;

        const newDoc = await PDFDocument.create();
        const copiedPages = await newDoc.copyPages(src, pageIndices);
        copiedPages.forEach((p: any) => newDoc.addPage(p));
        const bytes = await newDoc.save();
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${baseName}_${t("documents.pdfPart")}_${g + 1}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
        await new Promise(r => setTimeout(r, 150));
      }
    } catch (err) {
      console.error("PDF split error:", err);
      alert(t("documents.pdfError"));
    } finally {
      setProcessing(false);
    }
  }

  // Group legend with page counts
  const groupCounts = Array.from({ length: numOutputs }, (_, g) =>
    assignments.filter(a => a === g).length
  );

  return (
    <div className="flex flex-col h-full">
      <div className="mb-3">
        <p className="text-xs text-surface-500">{t("documents.pdfSplitDesc")}</p>
        <p className="text-[11px] text-surface-400 mt-0.5">{t("documents.pdfClickToAssign")}</p>
      </div>

      <input ref={fileInputRef} type="file" accept=".pdf" className="hidden"
        onChange={e => { if (e.target.files?.[0]) loadFile(e.target.files[0]); e.target.value = ""; }} />

      {!file ? (
        <button onClick={() => fileInputRef.current?.click()}
          className="w-full px-4 py-5 rounded-xl border-2 border-dashed border-surface-300 text-surface-500 text-sm hover:border-brand-400 hover:text-brand-600 transition flex flex-col items-center gap-1.5">
          <Upload size={18} />
          {t("documents.pdfSelectFile")}
        </button>
      ) : (
        <>
          {loading && (
            <div className="flex items-center justify-center py-6 text-surface-400 text-sm gap-2">
              <Loader2 size={16} className="animate-spin" /> Seiten werden geladen...
            </div>
          )}

          {/* Controls: number of output PDFs + file info */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-surface-700">{t("documents.pdfNumOutputs")}:</span>
              <div className="flex items-center gap-1">
                <button onClick={() => changeNumOutputs(-1)} disabled={numOutputs <= 2}
                  className="w-6 h-6 rounded-md bg-surface-100 hover:bg-surface-200 text-surface-600 flex items-center justify-center disabled:opacity-30 transition">
                  <Minus size={12} />
                </button>
                <span className="text-sm font-bold text-surface-800 w-6 text-center">{numOutputs}</span>
                <button onClick={() => changeNumOutputs(1)} disabled={numOutputs >= 8}
                  className="w-6 h-6 rounded-md bg-surface-100 hover:bg-surface-200 text-surface-600 flex items-center justify-center disabled:opacity-30 transition">
                  <Plus size={12} />
                </button>
              </div>
            </div>
            <button onClick={() => { setFile(null); setPages([]); setAssignments([]); }}
              className="text-xs text-surface-400 hover:text-red-500 transition">
              {t("documents.pdfSelectFile")}
            </button>
          </div>

          {/* Group legend */}
          <div className="flex flex-wrap gap-2 mb-3 px-1">
            {Array.from({ length: numOutputs }, (_, g) => (
              <div key={g} className="flex items-center gap-1.5 text-xs">
                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: GROUP_COLORS[g] }} />
                <span className="text-surface-600">PDF {g + 1}</span>
                <span className="text-surface-400">({groupCounts[g]})</span>
              </div>
            ))}
          </div>

          {/* Page thumbnail grid */}
          {pages.length > 0 && (
            <div className="flex-1 overflow-y-auto mb-4">
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
                {pages.map((pg, i) => (
                  <div key={`split-${pg.pageIndex}-${i}`}
                    onClick={() => cycleGroup(i)}
                    className="relative group rounded-lg border-2 transition cursor-pointer overflow-hidden hover:shadow-md"
                    style={{ borderColor: GROUP_COLORS[assignments[i] ?? 0] }}
                  >
                    {/* Group badge */}
                    <div className="absolute top-1 left-1 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center z-10"
                      style={{ backgroundColor: GROUP_COLORS[assignments[i] ?? 0] }}>
                      {(assignments[i] ?? 0) + 1}
                    </div>
                    {/* Mini group selector on hover */}
                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition z-10">
                      {Array.from({ length: numOutputs }, (_, g) => (
                        <button key={g}
                          onClick={e => { e.stopPropagation(); setGroup(i, g); }}
                          className="w-4 h-4 rounded-full border border-white/50 transition hover:scale-110"
                          style={{ backgroundColor: GROUP_COLORS[g], opacity: assignments[i] === g ? 1 : 0.5 }}
                        />
                      ))}
                    </div>
                    {/* Thumbnail */}
                    <img src={pg.dataUrl} alt={`Page ${pg.pageIndex + 1}`}
                      className="w-full h-auto bg-[rgb(var(--card-bg))]" draggable={false} />
                    {/* Page label */}
                    <div className="px-1.5 py-1 border-t" style={{ borderColor: GROUP_COLORS[assignments[i] ?? 0], backgroundColor: `${GROUP_COLORS[assignments[i] ?? 0]}10` }}>
                      <p className="text-[10px] font-medium text-surface-700">{t("documents.pdfPage")} {pg.pageIndex + 1}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer with split button */}
          {pages.length > 0 && (
            <div className="flex items-center justify-between pt-3 border-t border-surface-200">
              <span className="text-xs text-surface-500">
                {pages.length} {t("documents.pdfPages")} → {numOutputs} PDFs
              </span>
              <button onClick={splitPdf} disabled={processing}
                className="flex items-center gap-2 bg-brand-600 hover:bg-brand-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                {processing ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
                {processing ? t("documents.pdfProcessing") : t("documents.pdfSplitAction")}
              </button>
            </div>
          )}
        </>
      )}
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
  const { t } = useTranslation();
  const supabase = createClient();
  const isEdit = !!doc;
  const [mode, setMode] = useState<"link" | "upload">(doc ? "link" : "link");
  const [title, setTitle] = useState(doc?.title ?? "");
  const [url, setUrl] = useState(doc?.url ?? "");
  const [kind, setKind] = useState(doc?.kind ?? "link");
  const [moduleId, setModuleId] = useState(doc?.module_id ?? "");
  const [examId, setExamId] = useState(doc?.exam_id ?? "");
  const [taskId, setTaskId] = useState(doc?.task_id ?? "");
  const [tagsStr, setTagsStr] = useState((doc?.tags ?? []).join(", "));
  const [color, setColor] = useState(doc?.color ?? "#6d28d9");
  const [saving, setSaving] = useState(false);
  const [uploadFile, setUploadFile] = useState<globalThis.File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredExams = moduleId
    ? exams.filter(e => e.title?.toLowerCase().includes(modules.find(m => m.id === moduleId)?.name?.toLowerCase().slice(0, 5) ?? "---"))
    : exams;
  const filteredTasks = moduleId ? tasks.filter(t => t.module_id === moduleId) : tasks;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadError("");
    if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    const detected = getKindFromUrl(file.name);
    setKind(detected);
  }

  async function uploadToStorage(userId: string): Promise<string | null> {
    if (!uploadFile) return null;
    setUploading(true);
    const ext = uploadFile.name.split(".").pop() ?? "bin";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("documents").upload(path, uploadFile, {
      cacheControl: "3600",
      upsert: false,
    });
    if (error) {
      setUploadError(error.message);
      setUploading(false);
      return null;
    }
    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
    setUploading(false);
    return urlData.publicUrl;
  }

  async function handleSave() {
    setSaving(true);
    const tags = tagsStr.split(",").map(t => t.trim()).filter(Boolean);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    let finalUrl = url;
    if (mode === "upload" && uploadFile && !isEdit) {
      const uploaded = await uploadToStorage(user.id);
      if (!uploaded) { setSaving(false); return; }
      finalUrl = uploaded;
    }

    const payload = {
      user_id: user.id,
      title: title || finalUrl || "Neues Dokument",
      url: finalUrl,
      kind: kind || getKindFromUrl(finalUrl),
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

  const canSave = mode === "link" ? url.trim().length > 0 : !!uploadFile;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3 sm:p-4" onClick={onClose}>
      <div className="bg-surface-100 border border-surface-200 rounded-2xl w-full max-w-md p-4 sm:p-6 shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center gap-2 mb-4 sm:mb-5">
          <h2 className="text-base sm:text-lg font-bold text-surface-900">{isEdit ? t("documents.edit") : t("documents.modal.title")}</h2>
          <button onClick={onClose} className="text-surface-500 hover:text-surface-900 transition flex-shrink-0"><X size={20} /></button>
        </div>

        {/* Mode toggle: Link vs Upload */}
        {!isEdit && (
          <div className="flex rounded-lg bg-surface-100 p-0.5 mb-4">
            <button
              onClick={() => setMode("link")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs sm:text-sm font-medium transition ${
                mode === "link" ? "bg-surface-100 text-surface-900 shadow-sm" : "text-surface-500 hover:text-surface-700"
              }`}
            >
              <Globe size={14} /> {t("documents.typeLink")}
            </button>
            <button
              onClick={() => setMode("upload")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-xs sm:text-sm font-medium transition ${
                mode === "upload" ? "bg-surface-100 text-surface-900 shadow-sm" : "text-surface-500 hover:text-surface-700"
              }`}
            >
              <Upload size={14} /> {t("documents.typeFile")}
            </button>
          </div>
        )}

        {/* Link mode */}
        {(mode === "link" || isEdit) && (
          <>
            <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">{t("documents.typeLink")}</label>
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
          </>
        )}

        {/* Upload mode */}
        {mode === "upload" && !isEdit && (
          <>
            <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.md,.png,.jpg,.jpeg,.gif,.webp,.svg,.mp4,.mov,.zip,.rar" />
            {!uploadFile ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-surface-300 hover:border-brand-400 rounded-xl p-3 sm:p-6 mb-3 flex flex-col items-center gap-2 transition-colors group"
              >
                <Upload size={28} className="text-surface-300 group-hover:text-brand-500 transition-colors" />
                <span className="text-sm font-medium text-surface-500 group-hover:text-surface-700">{t("documents.typeFile")}</span>
                <span className="text-[10px] text-surface-400">PDF, Word, Excel, {t("documents.typeImage")}, {t("documents.typeVideo")}, etc.</span>
              </button>
            ) : (
              <div className="flex items-center gap-3 bg-surface-50 border border-surface-200 rounded-xl p-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-brand-50 flex items-center justify-center shrink-0">
                  <File size={18} className="text-brand-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-surface-800 truncate">{uploadFile.name}</p>
                  <p className="text-xs text-surface-400">{(uploadFile.size / 1024).toFixed(0)} KB</p>
                </div>
                <button onClick={() => { setUploadFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                  className="p-1 rounded hover:bg-surface-200 text-surface-400 hover:text-surface-600 shrink-0">
                  <X size={14} />
                </button>
              </div>
            )}
            {uploadError && (
              <p className="text-xs text-red-500 mb-2">{uploadError}</p>
            )}
          </>
        )}

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">{t("documents.modal.titleLabel")}</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="z.B. Skript Kapitel 5, Vorlesungsfolien..."
          className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 sm:py-2.5 text-xs sm:text-sm text-surface-900 placeholder:text-surface-400 mb-3 focus:border-brand-500 focus:outline-none transition"
        />

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">{t("grades.modal.typeLabel")}</label>
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

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5">{t("documents.modal.modulLabel")}</label>
        <select
          value={moduleId}
          onChange={e => { setModuleId(e.target.value); setExamId(""); setTaskId(""); }}
          className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900 mb-2"
        >
          <option value="">— {t("documents.modal.moduleEmpty")} —</option>
          {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>

        {moduleId && (
          <div className="flex gap-1 sm:gap-2 mb-2 flex-col sm:flex-row">
            <select
              value={examId}
              onChange={e => setExamId(e.target.value)}
              className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900"
            >
              <option value="">— keine Prüfung —</option>
              {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
            </select>
            <select
              value={taskId}
              onChange={e => setTaskId(e.target.value)}
              className="flex-1 bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900"
            >
              <option value="">— keine Aufgabe —</option>
              {filteredTasks.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
          </div>
        )}

        <label className="block text-xs sm:text-sm font-medium text-surface-800 mb-1.5 mt-2">{t("nav.modules")}</label>
        <input
          value={tagsStr}
          onChange={e => setTagsStr(e.target.value)}
          placeholder="z.B. Skript, Vorlesung, Übung"
          className="w-full bg-surface-50 border border-surface-200 rounded-lg px-3 py-1.5 sm:py-2 text-xs sm:text-sm text-surface-900 placeholder:text-surface-400 mb-3 sm:mb-4 focus:border-brand-500 focus:outline-none transition"
        />

        <button
          onClick={handleSave}
          disabled={saving || uploading || !canSave}
          className="w-full bg-brand-600 hover:bg-brand-500 text-white py-2 sm:py-2.5 rounded-lg font-medium text-xs sm:text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {(saving || uploading) && <Loader2 size={14} className="animate-spin" />}
          {uploading ? t("documents.modal.uploading") : saving ? t("documents.modal.save") : isEdit ? t("documents.modal.save") : t("documents.modal.add")}
        </button>
      </div>
    </div>
  );
}
