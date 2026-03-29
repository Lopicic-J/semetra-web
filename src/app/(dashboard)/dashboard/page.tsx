"use client";
import { useModules } from "@/lib/hooks/useModules";
import { useTasks } from "@/lib/hooks/useTasks";
import { useGrades } from "@/lib/hooks/useGrades";
import { useTimeLogs } from "@/lib/hooks/useTimeLogs";
import { formatDate, formatDuration, gradeAvg } from "@/lib/utils";
import { BookOpen, CheckSquare, Clock, TrendingUp, AlertCircle, Calendar } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { modules, loading: ml } = useModules();
  const { tasks } = useTasks();
  const { grades } = useGrades();
  const { logs } = useTimeLogs();

  const openTasks = tasks.filter(t => t.status !== "done");
  const overdue = tasks.filter(t => t.status !== "done" && t.due_date && new Date(t.due_date) < new Date());
  const todayLogs = logs.filter(l => new Date(l.started_at).toDateString() === new Date().toDateString());
  const todaySecs = todayLogs.reduce((s, l) => s + (l.duration_seconds ?? 0), 0);
  const avg = gradeAvg(grades);

  const statCards = [
    { label: "Module", value: modules.length, icon: BookOpen, color: "bg-violet-100 text-violet-600", href: "/modules" },
    { label: "Offene Aufgaben", value: openTasks.length, icon: CheckSquare, color: "bg-blue-100 text-blue-600", href: "/tasks" },
    { label: "Heute gelernt", value: formatDuration(todaySecs), icon: Clock, color: "bg-green-100 text-green-600", href: "/timer" },
    { label: "Notendurchschnitt", value: avg ? avg.toFixed(2) : "—", icon: TrendingUp, color: "bg-orange-100 text-orange-600", href: "/grades" },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-0.5">Willkommen zurück — Dein Studium auf einen Blick.</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map(c => (
          <Link key={c.label} href={c.href} className="card hover:shadow-md transition-shadow">
            <div className={`inline-flex p-2.5 rounded-xl mb-3 ${c.color}`}>
              <c.icon size={20} />
            </div>
            <p className="text-2xl font-bold text-gray-900">{c.value}</p>
            <p className="text-sm text-gray-500 mt-0.5">{c.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Overdue / urgent tasks */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" /> Dringende Aufgaben
            </h2>
            <Link href="/tasks" className="text-xs text-violet-600 hover:underline">Alle anzeigen</Link>
          </div>
          {overdue.length === 0 && openTasks.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-4">Alles erledigt! 🎉</p>
          )}
          <ul className="space-y-2">
            {[...overdue, ...openTasks.filter(t => !overdue.includes(t))].slice(0, 6).map(task => (
              <li key={task.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-gray-50">
                <span className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                  task.priority === "high" ? "bg-red-500" :
                  task.priority === "medium" ? "bg-yellow-500" : "bg-gray-300"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${task.status === "done" ? "line-through text-gray-400" : "text-gray-800"}`}>
                    {task.title}
                  </p>
                  {task.due_date && (
                    <p className={`text-xs mt-0.5 ${new Date(task.due_date) < new Date() ? "text-red-500 font-medium" : "text-gray-400"}`}>
                      Fällig: {formatDate(task.due_date)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Recent modules */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <BookOpen size={16} className="text-violet-500" /> Meine Module
            </h2>
            <Link href="/modules" className="text-xs text-violet-600 hover:underline">Verwalten</Link>
          </div>
          {ml ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-gray-100 rounded-lg animate-pulse" />)}
            </div>
          ) : modules.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">Noch keine Module angelegt.</p>
          ) : (
            <ul className="space-y-2">
              {modules.slice(0, 6).map(mod => (
                <li key={mod.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: mod.color ?? "#6d28d9" }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{mod.name}</p>
                    {mod.professor && <p className="text-xs text-gray-400 truncate">{mod.professor}</p>}
                  </div>
                  {mod.ects && <span className="badge badge-violet text-[10px]">{mod.ects} ECTS</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Study time this week */}
        <div className="card lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 flex items-center gap-2">
              <Calendar size={16} className="text-green-500" /> Lernzeit diese Woche
            </h2>
            <Link href="/timer" className="text-xs text-violet-600 hover:underline">Timer öffnen</Link>
          </div>
          <WeeklyChart logs={logs} />
        </div>
      </div>
    </div>
  );
}

function WeeklyChart({ logs }: { logs: ReturnType<typeof useTimeLogs>["logs"] }) {
  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  monday.setHours(0, 0, 0, 0);

  const weekData = days.map((label, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayStr = day.toDateString();
    const secs = logs
      .filter(l => new Date(l.started_at).toDateString() === dayStr)
      .reduce((s, l) => s + (l.duration_seconds ?? 0), 0);
    return { label, hours: secs / 3600, isToday: dayStr === now.toDateString() };
  });

  const maxH = Math.max(...weekData.map(d => d.hours), 1);

  return (
    <div className="flex items-end gap-3 h-28">
      {weekData.map(d => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex items-end justify-center" style={{ height: "80px" }}>
            <div
              className={`w-full rounded-t-lg transition-all ${d.isToday ? "bg-violet-500" : "bg-violet-200"}`}
              style={{ height: `${Math.max((d.hours / maxH) * 80, d.hours > 0 ? 4 : 0)}px` }}
            />
          </div>
          <span className={`text-[10px] font-medium ${d.isToday ? "text-violet-600" : "text-gray-400"}`}>{d.label}</span>
          {d.hours > 0 && <span className="text-[9px] text-gray-400">{d.hours.toFixed(1)}h</span>}
        </div>
      ))}
    </div>
  );
}
