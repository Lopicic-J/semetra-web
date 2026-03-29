"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useModules } from "@/lib/hooks/useModules";
import { useTasks } from "@/lib/hooks/useTasks";
import { Calendar, Clock, GraduationCap, CheckSquare, AlertTriangle, Filter } from "lucide-react";
import type { Task, CalendarEvent, Module } from "@/types/database";

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
};

const RANGES = [
  { label: "7 Tage", days: 7 },
  { label: "30 Tage", days: 30 },
  { label: "90 Tage", days: 90 },
  { label: "Alle", days: 9999 },
];

export default function TimelinePage() {
  const { modules } = useModules();
  const { tasks } = useTasks();
  const [exams, setExams] = useState<CalendarEvent[]>([]);
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

  useEffect(() => { fetchExams(); }, [fetchExams]);

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
      });
    });

    // Exams
    exams.forEach(e => {
      const d = new Date(e.start_dt);
      const daysLeft = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      if (daysLeft > rangeDays && rangeDays < 9999) return;
      if (!showOverdue && daysLeft < 0) return;
      result.push({
        id: e.id,
        type: "exam",
        title: e.title,
        date: d,
        moduleColor: e.color ?? "#dc2626",
        daysLeft,
        location: e.location ?? undefined,
      });
    });

    // Sort by date
    result.sort((a, b) => a.date.getTime() - b.date.getTime());
    return result;
  }, [tasks, exams, modules, rangeDays, showOverdue]);

  // Group by relative date
  const grouped = useMemo(() => {
    const groups: Record<string, TimelineItem[]> = {};
    items.forEach(item => {
      let label: string;
      if (item.daysLeft < 0) label = "Überfällig";
      else if (item.daysLeft === 0) label = "Heute";
      else if (item.daysLeft === 1) label = "Morgen";
      else if (item.daysLeft <= 7) label = "Diese Woche";
      else if (item.daysLeft <= 30) label = "Diesen Monat";
      else label = "Später";

      if (!groups[label]) groups[label] = [];
      groups[label].push(item);
    });
    return groups;
  }, [items]);

  const groupOrder = ["Überfällig", "Heute", "Morgen", "Diese Woche", "Diesen Monat", "Später"];
  const overdueCount = items.filter(i => i.daysLeft < 0).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="text-violet-600" size={26} />
            Timeline
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {items.length} Einträge
            {overdueCount > 0 && <span className="text-red-500 font-medium ml-1">· {overdueCount} überfällig</span>}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {RANGES.map(r => (
            <button key={r.days} onClick={() => setRangeDays(r.days)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                rangeDays === r.days ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
              }`}>
              {r.label}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={showOverdue} onChange={e => setShowOverdue(e.target.checked)}
            className="rounded border-gray-300 text-violet-600 focus:ring-violet-500" />
          Überfällige zeigen
        </label>
      </div>

      {/* Timeline */}
      {items.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Calendar size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">Keine Einträge im gewählten Zeitraum</p>
          <p className="text-sm mt-1">Erstelle Aufgaben mit Fälligkeitsdaten oder trage Prüfungen ein.</p>
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
                    isOverdue ? "text-red-500" : label === "Heute" ? "text-violet-600" : "text-gray-400"
                  }`}>
                    {label}
                  </h2>
                  <span className="text-xs text-gray-400">({group.length})</span>
                </div>
                <div className="space-y-2 relative pl-6 border-l-2 border-gray-100">
                  {group.map(item => (
                    <div key={item.id} className="relative">
                      {/* Timeline dot */}
                      <div className={`absolute -left-[25px] w-3 h-3 rounded-full border-2 border-white ${
                        item.type === "exam" ? "bg-red-500" :
                        isOverdue ? "bg-red-400" :
                        item.daysLeft <= 3 ? "bg-amber-400" :
                        "bg-violet-400"
                      }`} />

                      <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                        isOverdue
                          ? "border-red-200 bg-red-50/50"
                          : "border-gray-100 hover:border-violet-200 bg-white"
                      }`}>
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
                          <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {item.moduleName && (
                              <span className="text-[10px] text-gray-500">{item.moduleName}</span>
                            )}
                            {item.location && (
                              <span className="text-[10px] text-gray-400">· {item.location}</span>
                            )}
                          </div>
                        </div>

                        {/* Date + badge */}
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-gray-500">
                            {item.date.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" })}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                            item.type === "exam" ? "bg-red-100 text-red-700" :
                            item.priority === "high" ? "bg-red-100 text-red-700" :
                            item.priority === "medium" ? "bg-amber-100 text-amber-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>
                            {item.type === "exam" ? "Prüfung" :
                              item.daysLeft < 0 ? `${Math.abs(item.daysLeft)}d überfällig` :
                              item.daysLeft === 0 ? "Heute" :
                              `${item.daysLeft}d`
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
