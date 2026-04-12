"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { useModules } from "@/lib/hooks/useModules";
import { useTasks } from "@/lib/hooks/useTasks";
import { Calendar, Clock, GraduationCap, CheckSquare, AlertTriangle, Filter, ChevronDown, ChevronUp, ExternalLink, FileText, Link2, FolderOpen } from "lucide-react";
import type { Task, CalendarEvent, Module, Document } from "@/types/database";

type TimelineItem = {
  id: string;
  type: "task" | "exam";
  title: string;
  date: Date;
  moduleName?: string;
  moduleColor?: string;
  priority?: string;
  status?: string;
  daysLeft: number;
  location?: string;
  description?: string;
  notes?: string;
  links?: { label: string; url: string }[];
  documents?: { title: string; url: string; kind: string }[];
};

export default function TimelinePage() {
  const { t } = useTranslation();

  const RANGES = [
    { label: t("timeline.filter7Days"), days: 7 },
    { label: t("timeline.filter30Days"), days: 30 },
    { label: t("timeline.filter90Days"), days: 90 },
    { label: t("timeline.filterAll"), days: 9999 },
  ];

  const { modules } = useModules();
  const { tasks } = useTasks();
  const [exams, setExams] = useState<CalendarEvent[]>([]);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [rangeDays, setRangeDays] = useState(30);
  const [showOverdue, setShowOverdue] = useState(true);
  const supabase = createClient();

  const fetchExams = useCallback(async () => {
    const { data } = await supabase
      .from("events")
      .select("*")
      .eq("event_type", "exam")
      .order("start_dt", { ascending: true });
    setExams(data ?? []);
  }, [supabase]);

  const fetchDocuments = useCallback(async () => {
    const { data } = await supabase
      .from("documents")
      .select("*");
    setDocuments(data ?? []);
  }, [supabase]);

  const toggleExpanded = (itemId: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedItems(newExpanded);
  };

  useEffect(() => {
    fetchExams();
    fetchDocuments();
  }, [fetchExams, fetchDocuments]);

  const items = useMemo(() => {
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + rangeDays);

    const result: TimelineItem[] = [];

    // Tasks with due dates
    tasks.forEach(t => {
      if (!t.due_date || t.status === "done") return;
      const d = new Date(t.due_date);
      const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > rangeDays && rangeDays < 9999) return;
      if (!showOverdue && daysLeft < 0) return;
      const mod = modules.find(m => m.id === t.module_id);

      // Get associated documents
      const taskDocs = documents.filter(doc => doc.task_id === t.id);

      result.push({
        id: t.id,
        type: "task",
        title: t.title,
        date: d,
        moduleName: mod?.name,
        moduleColor: mod?.color ?? "#6d28d9",
        priority: t.priority,
        status: t.status,
        daysLeft,
        description: t.description ?? undefined,
        documents: taskDocs.map(doc => ({ title: doc.title, url: doc.url, kind: doc.kind })),
      });
    });

    // Exams
    exams.forEach(e => {
      const d = new Date(e.start_dt);
      const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > rangeDays && rangeDays < 9999) return;
      if (!showOverdue && daysLeft < 0) return;

      // Get associated documents
      const examDocs = documents.filter(doc => doc.exam_id === e.id);

      result.push({
        id: e.id,
        type: "exam",
        title: e.title,
        date: d,
        moduleColor: e.color ?? "#dc2626",
        daysLeft,
        location: e.location ?? undefined,
        description: e.description ?? undefined,
        documents: examDocs.map(doc => ({ title: doc.title, url: doc.url, kind: doc.kind })),
      });
    });

    // Sort by date
    result.sort((a, b) => a.date.getTime() - b.date.getTime());
    return result;
  }, [tasks, exams, modules, documents, rangeDays, showOverdue]);

  // Group by relative date
  const grouped = useMemo(() => {
    const groups: Record<string, TimelineItem[]> = {};
    items.forEach(item => {
      let label: string;
      if (item.daysLeft < 0) label = t("timeline.groupOverdue");
      else if (item.daysLeft === 0) label = t("timeline.groupToday");
      else if (item.daysLeft === 1) label = t("timeline.groupTomorrow");
      else if (item.daysLeft <= 7) label = t("timeline.groupThisWeek");
      else if (item.daysLeft <= 30) label = t("timeline.groupThisMonth");
      else label = t("timeline.groupLater");

      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });
    return groups;
  }, [items, t]);

  const groupOrder = [
    t("timeline.groupOverdue"),
    t("timeline.groupToday"),
    t("timeline.groupTomorrow"),
    t("timeline.groupThisWeek"),
    t("timeline.groupThisMonth"),
    t("timeline.groupLater"),
  ];
  const overdueCount = items.filter(i => i.daysLeft < 0).length;

  return (
    <div className="p-3 sm:p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 dark:text-white flex items-center gap-2">
            <Calendar className="text-brand-600" size={26} />
            {t("nav.timeline")}
          </h1>
          <p className="text-surface-500 dark:text-surface-400 text-sm mt-0.5">
            {t("timeline.subtitle", { count: items.length, overdue: overdueCount > 0 ? t("timeline.overdue", { count: overdueCount }) : "" })}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 bg-surface-100 dark:bg-surface-800 rounded-xl p-1">
          {RANGES.map(r => (
            <button key={r.days} onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                rangeDays === r.days ? "bg-[rgb(var(--card-bg))] dark:bg-surface-700 text-surface-900 dark:text-white shadow-sm" : "text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-200"
              }`}>
              {r.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-surface-600 dark:text-surface-500 cursor-pointer">
          <input type="checkbox" checked={showOverdue} onChange={e => setShowOverdue(e.target.checked)}
            className="rounded border-surface-300 dark:border-surface-600 text-brand-600 dark:text-brand-500 focus:ring-brand-500" />
          {t("timeline.showOverdue")}
        </label>
      </div>

      {/* Timeline */}
      {items.length === 0 ? (
        <div className="text-center py-20 text-surface-400 dark:text-surface-500">
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">{t("timeline.noEntries")}</p>
          <p className="text-sm mt-1">{t("timeline.noEntriesHint")}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupOrder.map(label => {
            const group = grouped[label];
            if (!group || group.length === 0) return null;
            const isOverdue = label === "Überfällig";

            return (
              <div key={label}>
                <div className="flex items-center gap-2 mb-3">
                  {isOverdue && <AlertTriangle size={14} className="text-red-500" />}
                  <h2 className={`text-sm font-semibold uppercase tracking-wider ${
                    isOverdue ? "text-red-500" : label === t("timeline.groupToday") ? "text-brand-600" : "text-surface-400 dark:text-surface-500"
                  }`}>
                    {label}
                  </h2>
                  <span className="text-xs text-surface-400 dark:text-surface-500">({group.length})</span>
                </div>
                <div className="space-y-2 relative pl-6 border-l-2 border-surface-100 dark:border-surface-700">
                  {group.map(item => {
                    const isExpanded = expandedItems.has(item.id);

                    return (
                      <div key={item.id} className="relative">
                        {/* Timeline dot */}
                        <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 border-white ${
                          item.type === "exam" ? "bg-red-500" :
                          isOverdue ? "bg-red-400" :
                          item.daysLeft <= 3 ? "bg-amber-400" :
                          "bg-brand-400"
                        }`} />

                        {/* Main card */}
                        <div className={`rounded-xl border transition-colors ${
                          isOverdue
                            ? "border-red-200 dark:border-red-900 bg-red-50/50 dark:bg-red-950/20"
                            : "border-surface-100 dark:border-surface-700 hover:border-brand-200 dark:hover:border-brand-700 bg-[rgb(var(--card-bg))] dark:bg-surface-800"
                        }`}>
                          {/* Header - clickable */}
                          <button
                            onClick={() => toggleExpanded(item.id)}
                            className="w-full flex items-center gap-3 p-3 hover:bg-surface-50/50 dark:hover:bg-surface-700/50 transition-colors text-left"
                          >
                            {/* Icon */}
                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                              style={{ background: item.moduleColor + "20" }}>
                              {item.type === "exam"
                                ? <GraduationCap size={14} style={{ color: item.moduleColor }} />
                                : <CheckSquare size={14} style={{ color: item.moduleColor }} />
                              }
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-surface-800 dark:text-white">{item.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {item.moduleName && (
                                  <span className="text-[10px] text-surface-500 dark:text-surface-400">{item.moduleName}</span>
                                )}
                                {item.location && (
                                  <span className="text-[10px] text-surface-400 dark:text-surface-500">· {item.location}</span>
                                )}
                              </div>
                            </div>

                            {/* Priority + Date + Badge + Expand Icon */}
                            <div className="flex items-center gap-2 shrink-0">
                              {item.priority && item.type === "task" && (
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                  item.priority === "high" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
                                  item.priority === "medium" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                                  "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-500"
                                }`}>
                                  {item.priority === "high" ? t("timeline.priorityHigh") :
                                   item.priority === "medium" ? t("timeline.priorityMedium") :
                                   t("timeline.priorityLow")}
                                </span>
                              )}
                              <span className="text-xs text-surface-500 dark:text-surface-400 w-10 text-right">
                                {item.date.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}
                              </span>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                                item.type === "exam" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
                                item.priority === "high" ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300" :
                                item.priority === "medium" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300" :
                                "bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-500"
                              }`}>
                                {item.type === "exam" ? t("timeline.exam") :
                                  item.daysLeft < 0 ? t("timeline.daysOverdue", { days: Math.abs(item.daysLeft) }) :
                                  item.daysLeft === 0 ? t("timeline.groupToday") :
                                  t("timeline.daysLeft", { days: item.daysLeft })
                                }
                              </span>
                              {isExpanded ? (
                                <ChevronUp size={16} className="text-surface-400 dark:text-surface-500" />
                              ) : (
                                <ChevronDown size={16} className="text-surface-400 dark:text-surface-500" />
                              )}
                            </div>
                          </button>

                          {/* Expanded content */}
                          {isExpanded && (
                            <div className="border-t border-surface-100 dark:border-surface-700 px-3 py-3 space-y-3 bg-surface-50/30 dark:bg-surface-700/30">
                              {/* Description */}
                              {item.description && (
                                <div>
                                  <p className="text-sm text-surface-600 dark:text-surface-500">{item.description}</p>
                                </div>
                              )}

                              {/* Notes */}
                              {item.notes && (
                                <div>
                                  <p className="text-xs text-surface-500 dark:text-surface-400 italic">{item.notes}</p>
                                </div>
                              )}

                              {/* Documents */}
                              {item.documents && item.documents.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-surface-600 dark:text-surface-500 mb-2">{t("timeline.documents")}</p>
                                  <div className="flex flex-wrap gap-2">
                                    {item.documents.map((doc, idx) => (
                                      <a
                                        key={idx}
                                        href={doc.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                                      >
                                        {doc.kind === "file" || doc.kind === "pdf" ? (
                                          <FileText size={12} className="text-surface-600 dark:text-surface-500" />
                                        ) : (
                                          <Link2 size={12} className="text-surface-600 dark:text-surface-500" />
                                        )}
                                        <span className="text-xs text-surface-700 dark:text-surface-800 truncate max-w-[200px]">{doc.title}</span>
                                        <ExternalLink size={11} className="text-surface-500 dark:text-surface-400" />
                                      </a>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Status for tasks */}
                              {item.status && item.type === "task" && (
                                <div className="pt-1">
                                  <span className="text-[10px] text-surface-600 dark:text-surface-500">
                                    {t("timeline.status", { status:
                                      item.status === "todo" ? t("timeline.statusTodo") :
                                      item.status === "in_progress" ? t("timeline.statusInProgress") :
                                      t("timeline.statusDone")
                                    })}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
