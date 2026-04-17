"use client";

import { memo, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { formatDate } from "@/lib/utils";
import { AlertCircle, ChevronDown, Paperclip, Link2 } from "lucide-react";
import type { Task, Module } from "@/types/database";

interface Props {
  tasks: Task[];
  modules: Module[];
}

function DashboardTaskList({ tasks, modules }: Props) {
  const { t } = useTranslation();
  const supabase = createClient();
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [taskAttachments, setTaskAttachments] = useState<Record<string, any[]>>({});

  const openTasks = tasks.filter(tsk => tsk.status !== "done");
  const overdue = tasks.filter(tsk => tsk.status !== "done" && tsk.due_date && new Date(tsk.due_date) < new Date());

  const fetchTaskDetails = useCallback(async (taskId: string) => {
    const { data } = await supabase
      .from("task_attachments")
      .select("*")
      .eq("task_id", taskId)
      .order("created_at", { ascending: false });
    setTaskAttachments(prev => ({ ...prev, [taskId]: data ?? [] }));
  }, [supabase]);

  const toggleTaskExpand = (taskId: string) => {
    if (expandedTask === taskId) {
      setExpandedTask(null);
    } else {
      setExpandedTask(taskId);
      if (!taskAttachments[taskId]) fetchTaskDetails(taskId);
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-surface-900 dark:text-white flex items-center gap-2">
          <AlertCircle size={16} className="text-red-500" /> {t("dashboard.urgentTasks")}
        </h2>
        <Link href="/tasks" className="text-xs text-brand-600 hover:underline">{t("dashboard.showAll")}</Link>
      </div>
      {overdue.length === 0 && openTasks.length === 0 ? (
        <p className="text-sm text-surface-400 text-center py-4">{t("dashboard.allDone")}</p>
      ) : (
        <div className="space-y-2">
          {[...overdue, ...openTasks.filter(tsk => !overdue.includes(tsk))].slice(0, 6).map(task => {
            const isOverdue = task.due_date && new Date(task.due_date) < new Date();
            const isExpanded = expandedTask === task.id;
            const attachments = taskAttachments[task.id] ?? [];
            const mod = modules.find(m => m.id === task.module_id);

            return (
              <div key={task.id}>
                <button
                  onClick={() => toggleTaskExpand(task.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    isOverdue ? "bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800" :
                    task.priority === "high" ? "bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800" :
                    "bg-surface-50 hover:bg-surface-100 dark:hover:bg-surface-800 border border-transparent"
                  } ${isExpanded ? "rounded-b-none border-b-0" : ""}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    task.priority === "high" ? "bg-red-500" :
                    task.priority === "medium" ? "bg-yellow-500" : "bg-surface-300"
                  }`} />
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-semibold text-surface-900 dark:text-white truncate">{task.title}</p>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {task.due_date && formatDate(task.due_date)}
                      {mod ? ` · ${mod.name}` : ""}
                    </p>
                  </div>
                  {isOverdue && (
                    <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 shrink-0">
                      {t("dashboard.taskOverdue")}
                    </span>
                  )}
                  <ChevronDown size={14} className={`text-surface-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </button>
                {isExpanded && (
                  <div className={`border border-t-0 rounded-b-xl p-3 text-sm space-y-2 ${
                    isOverdue ? "bg-red-50/50 dark:bg-red-950/10 border-red-200 dark:border-red-800" :
                    task.priority === "high" ? "bg-orange-50/50 dark:bg-orange-950/10 border-orange-200 dark:border-orange-800" :
                    "bg-surface-50 border-surface-200"
                  }`}>
                    {task.description && (
                      <div>
                        <p className="text-xs font-medium text-surface-500 mb-1">{t("dashboard.description")}</p>
                        <p className="text-xs text-surface-700 whitespace-pre-line">{task.description}</p>
                      </div>
                    )}
                    {mod && (
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-surface-500">{t("dashboard.taskModule")}:</p>
                        <span className="flex items-center gap-1.5 text-xs text-surface-700">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ background: mod.color }} />
                          {mod.name}
                        </span>
                      </div>
                    )}
                    {attachments.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-surface-500 mb-1">{t("dashboard.attachments")}</p>
                        <div className="space-y-1">
                          {attachments.slice(0, 4).map((att: any) => (
                            <a key={att.id} href={att.url} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-2 text-xs text-surface-600 hover:text-brand-600 dark:hover:text-brand-400 transition-colors">
                              {att.kind === "link" ? <Link2 size={11} /> : <Paperclip size={11} />}
                              <span className="truncate">{att.label || att.url}</span>
                            </a>
                          ))}
                          {attachments.length > 4 && (
                            <p className="text-[10px] text-surface-400">+{attachments.length - 4} {t("dashboard.more")}</p>
                          )}
                        </div>
                      </div>
                    )}
                    {!task.description && !mod && attachments.length === 0 && (
                      <p className="text-xs text-surface-400">{t("dashboard.noDetails")}</p>
                    )}
                    <div className="pt-1">
                      <Link href="/tasks" className="text-xs text-brand-600 hover:underline font-medium">
                        {t("dashboard.taskOpenFull")} →
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default memo(DashboardTaskList);
