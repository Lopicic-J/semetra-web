"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useTranslation } from "@/lib/i18n";
import { useModules } from "@/lib/hooks/useModules";
import { useProfile } from "@/lib/hooks/useProfile";
import { FREE_LIMITS } from "@/lib/gates";
import { UpgradeModal } from "@/components/ui/ProGate";
import { Plus, X, Trash2, ChevronLeft, ChevronRight, Copy, GripHorizontal, RefreshCw, PanelRightOpen, PanelRightClose } from "lucide-react";
import type { StundenplanEntry } from "@/types/database";
import SmartSchedulePanel from "@/components/dashboard/SmartSchedulePanel";

const DAYS_SHORT = ["Mo","Di","Mi","Do","Fr","Sa","So"];
const HOURS = Array.from({ length: 14 }, (_, i) => i + 7); // 7:00 – 20:00
const SEMESTERS = ["Semester 1","Semester 2","Semester 3","Semester 4","Semester 5","Semester 6","Semester 7","Semester 8","Semester 9"];
const MAX_KW = 20;

/** Returns the Monday (Date) of a given ISO calendar week in a given year */
function getMondayOfIsoWeek(week: number, year: number): Date {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // 1=Mon..7=Sun
  const mondayWeek1 = new Date(jan4);
  mondayWeek1.setDate(jan4.getDate() - (dayOfWeek - 1));
  const monday = new Date(mondayWeek1);
  monday.setDate(mondayWeek1.getDate() + (week - 1) * 7);
  return monday;
}

/** Returns an array of 7 Dates (Mo–So) for a given KW + semester start year */
function getWeekDates(kw: number, year: number): Date[] {
  const monday = getMondayOfIsoWeek(kw, year);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

/** Format a date as "DD.MM." */
function formatDateShort(d: Date): string {
  return `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.`;
}

function formatWeeks(t: ReturnType<typeof useTranslation>["t"], count: number) {
  return t("stundenplan.modal.kwWarning", { count, from: "", to: "" }).replace(/\([^)]*\)/, "").trim();
}

export default function StundenplanPage() {
  const { t } = useTranslation();
  const DAYS = t("stundenplan.dayNames").split("|");
  const [entries, setEntries] = useState<StundenplanEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [currentKw, setCurrentKw] = useState(1);
  const [currentSemester, setCurrentSemester] = useState("Semester 1");
  const [deleteDialog, setDeleteDialog] = useState<{ entry: StundenplanEntry; siblings: StundenplanEntry[] } | null>(null);
  const [moveDialog, setMoveDialog] = useState<{ entry: StundenplanEntry; newDay: string; newStart: string; newEnd: string; siblings: StundenplanEntry[] } | null>(null);
  const [draggedEntry, setDraggedEntry] = useState<StundenplanEntry | null>(null);
  const [editEntry, setEditEntry] = useState<StundenplanEntry | null>(null);
  const [dragIndicator, setDragIndicator] = useState<{dayIdx: number; startMin: number; endMin: number; text: string} | null>(null);
  const [showSchedulePanel, setShowSchedulePanel] = useState(true);
  const [mobileDayIndex, setMobileDayIndex] = useState(() => {
    // Default to current weekday (0=Mo, 6=So)
    const d = new Date().getDay(); // 0=Sun
    return d === 0 ? 6 : d - 1;
  });
  const [mobileView, setMobileView] = useState<"day" | "week">("day");
  const [newEntry, setNewEntry] = useState({
    day: "Mo",
    time_start: "08:00",
    time_end: "09:00",
  });
  const { modules } = useModules();
  const { isPro } = useProfile();
  const supabase = createClient();

  // Compute calendar dates for current KW
  const currentYear = new Date().getFullYear();
  const weekDates = useMemo(() => getWeekDates(currentKw, currentYear), [currentKw, currentYear]);

  const fetchEntries = useCallback(async () => {
    const { data } = await supabase.from("stundenplan").select("*");
    setEntries(data ?? []);
  }, [supabase]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Filter entries by current KW + semester
  const currentEntries = entries.filter(e =>
    (e.kw === currentKw || e.kw === null || e.kw === undefined) &&
    (e.semester === currentSemester || !e.semester)
  );

  // Find which KWs have entries for current semester
  const kwsWithEntries = new Set(
    entries.filter(e => e.semester === currentSemester || !e.semester).map(e => e.kw ?? 1)
  );

  function findSiblings(entry: StundenplanEntry): StundenplanEntry[] {
    return entries.filter(e =>
      e.id !== entry.id &&
      e.title === entry.title &&
      e.day === entry.day &&
      e.time_start === entry.time_start &&
      e.time_end === entry.time_end &&
      e.semester === entry.semester
    );
  }

  function handleDeleteClick(entry: StundenplanEntry) {
    const siblings = findSiblings(entry);
    if (siblings.length > 0) {
      setDeleteDialog({ entry, siblings });
    } else {
      if (confirm(t("stundenplan.deleteConfirm") || "Delete this entry?")) {
        deleteEntry(entry.id);
      }
    }
  }

  async function handleDeleteChoice(mode: "this" | "all") {
    if (!deleteDialog) return;
    const { entry, siblings } = deleteDialog;

    if (mode === "this") {
      // Delete linked schedule_blocks first
      await supabase.from("schedule_blocks").delete().eq("stundenplan_id", entry.id).eq("layer", 1);
      await supabase.from("stundenplan").delete().eq("id", entry.id);
    } else {
      const idsToDelete = [entry.id, ...siblings.map(s => s.id)];
      await supabase.from("schedule_blocks").delete().in("stundenplan_id", idsToDelete).eq("layer", 1);
      await supabase.from("stundenplan").delete().in("id", idsToDelete);
    }

    setDeleteDialog(null);
    await fetchEntries();
  }

  async function deleteEntry(id: string) {
    await supabase.from("schedule_blocks").delete().eq("stundenplan_id", id).eq("layer", 1);
    await supabase.from("stundenplan").delete().eq("id", id);
    await fetchEntries();
  }

  function timeToMinutes(t: string) {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  }

  function minutesToTime(mins: number): string {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  function handleEntryDragStart(e: React.DragEvent, entry: StundenplanEntry) {
    setDraggedEntry(entry);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDayDropZoneDragOver(e: React.DragEvent, dayIndex: number) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    // Calculate drop position in minutes
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const dropY = e.clientY - rect.top;
    const gridStart = 7 * 60;
    const minutes = Math.round((dropY / 56) * 60) + gridStart;
    const rounded = Math.round(minutes / 15) * 15;
    const duration = draggedEntry ? (timeToMinutes(draggedEntry.time_end) - timeToMinutes(draggedEntry.time_start)) : 60;

    setDragIndicator({
      dayIdx: dayIndex,
      startMin: rounded,
      endMin: rounded + duration,
      text: `${minutesToTime(rounded)} – ${minutesToTime(rounded + duration)}`,
    });
  }

  function handleDayDropZoneDrop(e: React.DragEvent, dayIndex: number) {
    e.preventDefault();
    if (!draggedEntry) return;

    const gridContainer = e.currentTarget;
    const rect = gridContainer.getBoundingClientRect();
    const dropY = e.clientY - rect.top;

    const gridStart = 7 * 60;
    const newStartMinutes = Math.round((dropY / 56) * 60) + gridStart;
    const roundedStart = Math.round(newStartMinutes / 15) * 15;

    const duration = timeToMinutes(draggedEntry.time_end) - timeToMinutes(draggedEntry.time_start);
    const newEndMinutes = roundedStart + duration;

    const newDay = DAYS_SHORT[dayIndex];
    const newStart = minutesToTime(roundedStart);
    const newEnd = minutesToTime(newEndMinutes);

    const siblings = findSiblings(draggedEntry);
    if (siblings.length > 0) {
      setMoveDialog({
        entry: draggedEntry,
        newDay,
        newStart,
        newEnd,
        siblings,
      });
    } else {
      updateEntryPosition(draggedEntry.id, newDay, newStart, newEnd);
    }

    setDraggedEntry(null);
    setDragIndicator(null);
  }

  async function updateEntryPosition(id: string, newDay: string, newStart: string, newEnd: string) {
    await supabase
      .from("stundenplan")
      .update({ day: newDay, time_start: newStart, time_end: newEnd })
      .eq("id", id);
    await fetchEntries();
    // Sync: update corresponding schedule_block if it exists
    await syncStundenplanToSchedule(id, newDay, newStart, newEnd);
  }

  /** Sync a moved stundenplan entry → its schedule_block (Layer 1) */
  async function syncStundenplanToSchedule(
    stundenplanId: string, day: string, timeStart: string, timeEnd: string,
  ) {
    // Find schedule_block linked to this stundenplan entry
    const { data: blocks } = await supabase
      .from("schedule_blocks")
      .select("id, recurrence")
      .eq("stundenplan_id", stundenplanId)
      .eq("layer", 1);

    if (!blocks || blocks.length === 0) return;

    // Calculate new absolute timestamps for the current week
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);

    const dayOffsetMap: Record<string, number> = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5, So: 6 };
    const dayOffset = dayOffsetMap[day] ?? 0;

    const targetDate = new Date(monday);
    targetDate.setDate(monday.getDate() + dayOffset);

    const [sh, sm] = timeStart.split(":").map(Number);
    const [eh, em] = timeEnd.split(":").map(Number);

    const startTime = new Date(targetDate);
    startTime.setHours(sh, sm, 0, 0);
    const endTime = new Date(targetDate);
    endTime.setHours(eh, em, 0, 0);

    for (const block of blocks) {
      await supabase
        .from("schedule_blocks")
        .update({
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
        })
        .eq("id", block.id);
    }
  }

  async function handleMoveChoice(mode: "this" | "all") {
    if (!moveDialog) return;
    const { entry, newDay, newStart, newEnd, siblings } = moveDialog;

    if (mode === "this") {
      await updateEntryPosition(entry.id, newDay, newStart, newEnd);
    } else {
      const idsToUpdate = [entry.id, ...siblings.map(s => s.id)];
      await supabase
        .from("stundenplan")
        .update({ day: newDay, time_start: newStart, time_end: newEnd })
        .in("id", idsToUpdate);
      await fetchEntries();
      // Sync all moved entries to schedule_blocks
      for (const id of idsToUpdate) {
        await syncStundenplanToSchedule(id, newDay, newStart, newEnd);
      }
    }

    setMoveDialog(null);
  }

  async function copyToKw(targetKw: number) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const toCopy = currentEntries.map(e => ({
      user_id: user.id,
      title: e.title,
      day: e.day,
      time_start: e.time_start,
      time_end: e.time_end,
      room: e.room ?? null,
      module_id: e.module_id ?? null,
      color: e.color ?? null,
      kw: targetKw,
      semester: currentSemester,
    }));
    if (toCopy.length === 0) return;
    await supabase.from("stundenplan").insert(toCopy);
    fetchEntries();
    setCurrentKw(targetKw);
  }

  function getEntryStyle(entry: StundenplanEntry) {
    const start = timeToMinutes(entry.time_start);
    const end = timeToMinutes(entry.time_end);
    const gridStart = 7 * 60;
    const top = ((start - gridStart) / 60) * 56;
    const height = Math.max(((end - start) / 60) * 56, 28);
    return { top, height };
  }

  // Calculate overlap layout — entries on same day that overlap in time
  // are displayed side-by-side (like Google Calendar)
  function getOverlapLayout(entries: StundenplanEntry[]) {
    const layout = new Map<string, { col: number; totalCols: number }>();

    // Group entries by day
    const byDay = new Map<string, StundenplanEntry[]>();
    entries.forEach(e => {
      const list = byDay.get(e.day) ?? [];
      list.push(e);
      byDay.set(e.day, list);
    });

    byDay.forEach((dayEntries) => {
      // Sort by start time
      const sorted = [...dayEntries].sort((a, b) =>
        timeToMinutes(a.time_start) - timeToMinutes(b.time_start)
      );

      // Build overlap groups using a sweep-line approach
      const groups: StundenplanEntry[][] = [];
      let currentGroup: StundenplanEntry[] = [];
      let groupEnd = 0;

      sorted.forEach(entry => {
        const start = timeToMinutes(entry.time_start);
        const end = timeToMinutes(entry.time_end);
        if (currentGroup.length === 0 || start < groupEnd) {
          // Overlaps with current group
          currentGroup.push(entry);
          groupEnd = Math.max(groupEnd, end);
        } else {
          // No overlap — finalize current group and start new
          if (currentGroup.length > 0) groups.push(currentGroup);
          currentGroup = [entry];
          groupEnd = end;
        }
      });
      if (currentGroup.length > 0) groups.push(currentGroup);

      // Assign columns within each group
      groups.forEach(group => {
        const totalCols = group.length;
        group.forEach((entry, i) => {
          layout.set(entry.id, { col: i, totalCols });
        });
      });
    });

    return layout;
  }

  const overlapLayout = useMemo(() => getOverlapLayout(currentEntries), [currentEntries]);

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-56px)] md:h-[calc(100vh-64px)]">
      {/* ── LEFT: Stundenplan ──────────────────────────────────────── */}
      <div className={"flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 " + (showSchedulePanel ? "lg:max-w-[calc(100%-320px)]" : "")}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-surface-900 truncate">{t("nav.stundenplan")}</h1>
            <p className="text-surface-500 text-xs mt-0.5">{t("stundenplan.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={() => setShowSchedulePanel(!showSchedulePanel)}
              className="hidden lg:flex p-1.5 rounded-lg border border-surface-200 hover:bg-surface-50 dark:hover:bg-surface-800 text-surface-500"
              title={showSchedulePanel ? "Smart Schedule ausblenden" : "Smart Schedule einblenden"}>
              {showSchedulePanel ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
            </button>
            <button onClick={() => { setShowForm(true); }} className="btn-primary gap-2 text-sm">
              <Plus size={16} /> <span className="hidden sm:inline">{t("stundenplan.addEntry")}</span><span className="sm:hidden">Neu</span>
            </button>
          </div>
        </div>

      {/* Semester selector */}
      <div className="flex gap-1.5 sm:gap-2 mb-4 overflow-x-auto pb-1 -mx-3 px-3 sm:mx-0 sm:px-0 scrollbar-hide">
        {SEMESTERS.map(s => (
          <button
            key={s}
            onClick={() => { setCurrentSemester(s); setCurrentKw(1); }}
            className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-colors shrink-0 ${
              currentSemester === s
                ? "bg-brand-600 text-white"
                : "bg-surface-100 text-surface-600 text-surface-600 hover:bg-surface-200 hover:bg-surface-200"
            }`}
          >
            {s.replace("Semester ", "Sem. ")}
          </button>
        ))}
      </div>

      {/* KW navigation */}
      <div className="flex items-center gap-1 sm:gap-2 mb-4">
        <button
          onClick={() => setCurrentKw(Math.max(1, currentKw - 1))}
          disabled={currentKw <= 1}
          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30 shrink-0"
        >
          <ChevronLeft size={18} />
        </button>

        <div className="flex gap-1 overflow-x-auto pb-1 flex-1 scrollbar-hide">
          {Array.from({ length: MAX_KW }, (_, i) => i + 1).map(kw => {
            const kwMon = getMondayOfIsoWeek(kw, currentYear);
            return (
              <button
                key={kw}
                onClick={() => setCurrentKw(kw)}
                className={`px-2 sm:px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 transition-colors ${
                  currentKw === kw
                    ? "bg-brand-600 text-white"
                    : kwsWithEntries.has(kw)
                      ? "bg-brand-100 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300 hover:bg-brand-200"
                      : "bg-surface-50 text-surface-400 hover:bg-surface-100"
                }`}
                title={`KW${kw}: ${formatDateShort(kwMon)}`}
              >
                {kw}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setCurrentKw(Math.min(MAX_KW, currentKw + 1))}
          disabled={currentKw >= MAX_KW}
          className="p-1.5 rounded-lg hover:bg-surface-100 dark:hover:bg-surface-800 disabled:opacity-30 shrink-0"
        >
          <ChevronRight size={18} />
        </button>

        {/* Copy to next KW */}
        {currentEntries.length > 0 && (
          <button
            onClick={() => {
              const target = currentKw + 1;
              if (target <= MAX_KW && confirm(t("stundenplan.copyConfirm", { from: currentKw, to: target }))) {
                copyToKw(target);
              }
            }}
            className="btn-secondary gap-1 text-xs ml-1 shrink-0 hidden sm:flex"
            title={t("stundenplan.copyToNext")}
          >
            <Copy size={13} /> <span className="hidden md:inline">→ KW{Math.min(currentKw + 1, MAX_KW)}</span>
          </button>
        )}
      </div>

      {/* ── Mobile: View Toggle (Tag/Woche) ─────────────────── */}
      <div className="lg:hidden flex items-center gap-2 mb-3">
        <button
          onClick={() => setMobileView("day")}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
            mobileView === "day"
              ? "bg-brand-600 text-white shadow-sm"
              : "bg-surface-100 text-surface-500 text-surface-600"
          }`}
        >
          Tagesansicht
        </button>
        <button
          onClick={() => setMobileView("week")}
          className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all ${
            mobileView === "week"
              ? "bg-brand-600 text-white shadow-sm"
              : "bg-surface-100 text-surface-500 text-surface-600"
          }`}
        >
          Wochenansicht
        </button>
      </div>

      {/* ── Mobile: Day Selector Tabs (only in day view) ──── */}
      <div className={`lg:hidden flex gap-1 mb-3 overflow-x-auto scrollbar-hide -mx-3 px-3 ${mobileView === "week" ? "hidden" : ""}`}>
        {DAYS_SHORT.map((d, i) => {
          const dayEntries = currentEntries.filter(e => e.day === d);
          const isToday = (() => {
            const now = new Date();
            const wd = now.getDay();
            return (wd === 0 ? 6 : wd - 1) === i;
          })();
          return (
            <button
              key={d}
              onClick={() => setMobileDayIndex(i)}
              className={`flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 min-w-[48px] ${
                mobileDayIndex === i
                  ? "bg-brand-600 text-white shadow-md shadow-brand-600/20"
                  : isToday
                    ? "bg-brand-50 dark:bg-brand-950/30 text-brand-600 dark:text-brand-400 ring-1 ring-brand-200 dark:ring-brand-800"
                    : "bg-surface-100 text-surface-600 text-surface-600"
              }`}
            >
              <span className="font-semibold">{d}</span>
              <span className={`text-[9px] mt-0.5 ${mobileDayIndex === i ? "text-white/70" : "text-surface-400"}`}>
                {formatDateShort(weekDates[i])}
              </span>
              {dayEntries.length > 0 && mobileDayIndex !== i && (
                <div className="w-1 h-1 rounded-full bg-brand-500 mt-0.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Mobile: Single Day View ──────────────────────────── */}
      <div className={`lg:hidden card p-0 overflow-hidden ${mobileView === "week" ? "hidden" : ""}`}>
        <div className="relative" style={{ height: `${14 * 48}px` }}>
          {HOURS.map(h => (
            <div key={h} className="absolute w-full flex items-start" style={{ top: `${(h - 7) * 48}px`, height: "48px" }}>
 <div className="w-10 text-[10px] text-surface-400 text-right pr-1.5 pt-0.5 shrink-0">{h}:00</div>
 <div className="flex-1 border-t border-surface-100" />
            </div>
          ))}

          <div className="ml-10 relative" style={{ height: `${14 * 48}px` }}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('[data-entry]')) return;
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const dropY = e.clientY - rect.top;
              const gridStart = 7 * 60;
              const minutes = Math.round((dropY / 48) * 60) + gridStart;
              const rounded = Math.round(minutes / 15) * 15;
              setNewEntry({
                day: DAYS_SHORT[mobileDayIndex],
                time_start: minutesToTime(rounded),
                time_end: minutesToTime(rounded + 60),
              });
              setShowForm(true);
            }}
          >
            {currentEntries
              .filter(e => e.day === DAYS_SHORT[mobileDayIndex])
              .map(entry => {
                const start = timeToMinutes(entry.time_start);
                const end = timeToMinutes(entry.time_end);
                const gridStart = 7 * 60;
                const top = ((start - gridStart) / 60) * 48;
                const height = Math.max(((end - start) / 60) * 48, 28);
                const mod = modules.find(m => m.id === entry.module_id);
                const overlap = overlapLayout.get(entry.id) ?? { col: 0, totalCols: 1 };
                const colWidth = 1 / overlap.totalCols;
                return (
                  <div key={entry.id}
                    data-entry="true"
                    onClick={(e) => { setEditEntry(entry); e.stopPropagation(); }}
                    className="absolute px-0.5 group active:scale-[0.98] transition-transform"
                    style={{
                      left: `${overlap.col * colWidth * 100}%`,
                      width: `${colWidth * 100}%`,
                      top: `${top}px`,
                      height: `${height}px`,
                      padding: "1px",
                      zIndex: 1,
                    }}>
                    <div className="w-full h-full rounded-xl px-2.5 py-1.5 overflow-hidden text-white relative shadow-sm"
                      style={{ background: entry.color ?? mod?.color ?? "#6d28d9" }}>
                      <p className="text-[12px] font-semibold leading-tight truncate">{entry.title}</p>
                      {entry.room && <p className="text-[11px] opacity-80 truncate">{entry.room}</p>}
                      <p className="text-[11px] opacity-70">{entry.time_start} – {entry.time_end}</p>
                      <button onClick={(e) => { handleDeleteClick(entry); e.stopPropagation(); }}
                        className="absolute top-1 right-1 p-1 rounded-lg bg-black/20 hover:bg-black/40 active:bg-black/50">
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* ── Desktop: Full Week Grid ──────────────────────────── */}
      <div className={`${mobileView === "week" ? "block" : "hidden lg:block"} card p-0 overflow-hidden overflow-x-auto`}>
        <div className="min-w-[800px]">
          {/* Header */}
 <div className="grid border-b border-surface-100" style={{ gridTemplateColumns:"48px repeat(7, 1fr)" }}>
            <div className="py-2 text-center text-[10px] font-medium text-surface-400 leading-tight">
              <span className="font-semibold">KW{currentKw}</span>
              <br />
 <span className="text-[9px] text-surface-300">{formatDateShort(weekDates[0])} – {formatDateShort(weekDates[6])}</span>
            </div>
            {DAYS_SHORT.map((d, i) => (
 <div key={d} className="py-2 text-center border-l border-surface-100">
 <div className="text-sm font-semibold text-surface-600">{d}</div>
 <div className="text-[10px] text-surface-400">{formatDateShort(weekDates[i])}</div>
              </div>
            ))}
          </div>

          {/* Time grid */}
          <div className="relative">
            {HOURS.map(h => (
              <div key={h} className="absolute w-full flex items-start" style={{ top: `${(h - 7) * 56}px`, height: "56px" }}>
                <div className="w-12 text-[10px] text-surface-400 text-right pr-2 pt-0.5 shrink-0">{h}:00</div>
 <div className="flex-1 border-t border-surface-100" />
              </div>
            ))}

            <div className="ml-12 grid relative" style={{ gridTemplateColumns: "repeat(7, 1fr)", height: `${14 * 56}px` }}>
              {DAYS.map((_, i) => (
                <div key={i}
 className="border-l border-surface-100 transition-colors cursor-pointer hover:bg-brand-50/30 dark:hover:bg-brand-950/20"
                  onDragOver={(e) => handleDayDropZoneDragOver(e, i)}
                  onDrop={(e) => handleDayDropZoneDrop(e, i)}
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest('[draggable="true"]')) return;
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    const dropY = e.clientY - rect.top;
                    const gridStart = 7 * 60;
                    const minutes = Math.round((dropY / 56) * 60) + gridStart;
                    const rounded = Math.round(minutes / 15) * 15;
                    setNewEntry({
                      day: DAYS_SHORT[i],
                      time_start: minutesToTime(rounded),
                      time_end: minutesToTime(rounded + 60),
                    });
                    setShowForm(true);
                  }}
                />
              ))}

              {currentEntries.map(entry => {
                const dayIdx = DAYS_SHORT.indexOf(entry.day);
                if (dayIdx < 0) return null;
                const { top, height } = getEntryStyle(entry);
                const mod = modules.find(m => m.id === entry.module_id);
                const overlap = overlapLayout.get(entry.id) ?? { col: 0, totalCols: 1 };
                const dayWidth = 1 / 7;
                const colWidth = dayWidth / overlap.totalCols;
                return (
                  <div key={entry.id}
                    draggable
                    onDragStart={(e) => { handleEntryDragStart(e, entry); e.stopPropagation(); }}
                    onDoubleClick={(e) => { setEditEntry(entry); e.stopPropagation(); }}
                    className="absolute px-0.5 group cursor-grab active:cursor-grabbing"
                    style={{
                      left: `${(dayIdx * dayWidth + overlap.col * colWidth) * 100}%`,
                      width: `${colWidth * 100}%`,
                      top: `${top}px`,
                      height: `${height}px`,
                      padding: "1px",
                      opacity: draggedEntry?.id === entry.id ? 0.4 : 1,
                      zIndex: draggedEntry?.id === entry.id ? 5 : 1,
                    }}>
                    <div className="w-full h-full rounded-lg px-1.5 py-1 overflow-hidden text-white relative"
                      style={{ background: entry.color ?? mod?.color ?? "#6d28d9" }}>
                      <p className="text-[11px] font-semibold leading-tight truncate">{entry.title}</p>
                      {entry.room && <p className="text-[10px] opacity-80 truncate">{entry.room}</p>}
                      <p className="text-[10px] opacity-70">{entry.time_start} – {entry.time_end}</p>
                      <button onClick={(e) => { handleDeleteClick(entry); e.stopPropagation(); }}
                        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 rounded bg-black/20 hover:bg-black/40">
                        <X size={10} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Drag ghost preview */}
              {dragIndicator && draggedEntry && (
                <div
                  className="absolute pointer-events-none px-1"
                  style={{
                    left: `${(dragIndicator.dayIdx / 7) * 100}%`,
                    width: `${(1 / 7) * 100}%`,
                    top: `${((dragIndicator.startMin - 7 * 60) / 60) * 56}px`,
                    height: `${Math.max(((dragIndicator.endMin - dragIndicator.startMin) / 60) * 56, 28)}px`,
                    padding: "2px",
                    zIndex: 30,
                  }}
                >
                  <div className="w-full h-full rounded-lg border-2 border-dashed border-brand-400 bg-brand-100/50 dark:bg-brand-900/30 backdrop-blur-sm flex flex-col items-center justify-center">
                    <span className="text-[11px] font-bold text-brand-700 dark:text-brand-300">{dragIndicator.text}</span>
                    {draggedEntry.title && (
                      <span className="text-[10px] text-brand-500 truncate max-w-full px-1">{draggedEntry.title}</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {currentEntries.length === 0 && (
        <p className="text-center text-sm text-surface-400 mt-4">
          {t("stundenplan.noEntries", { week: currentKw, semester: currentSemester })}
        </p>
      )}

      {showForm && (
        <StundenplanModal
          modules={modules}
          currentKw={currentKw}
          currentSemester={currentSemester}
          prefilledEntry={newEntry}
          onClose={() => { setShowForm(false); setNewEntry({ day: "Mo", time_start: "08:00", time_end: "09:00" }); }}
          onSaved={() => { setShowForm(false); setNewEntry({ day: "Mo", time_start: "08:00", time_end: "09:00" }); fetchEntries(); }}
        />
      )}

      {editEntry && (
        <StundenplanEditModal
          modules={modules}
          entry={editEntry}
          onClose={() => setEditEntry(null)}
          onSaved={() => { setEditEntry(null); fetchEntries(); }}
        />
      )}

      {showUpgrade && (
        <UpgradeModal onClose={() => setShowUpgrade(false)} />
      )}

      {deleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-100 rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">{t("stundenplan.deleteDialogTitle")}</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-surface-600 text-surface-600 mb-6">
                {t("stundenplan.deleteDialogText", { count: deleteDialog.siblings.length + 1 })}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteDialog(null)}
                  className="btn-secondary flex-1"
                >
                  {t("stundenplan.modal.cancel")}
                </button>
                <button
                  onClick={() => handleDeleteChoice("this")}
                  className="btn-secondary flex-1"
                >
                  {t("stundenplan.deleteThisWeek")}
                </button>
                <button
                  onClick={() => handleDeleteChoice("all")}
                  className="btn-primary flex-1"
                >
                  {t("stundenplan.deleteAllWeeks")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Drag indicator is rendered inside the grid as a ghost preview */}

      {moveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-surface-100 rounded-2xl shadow-xl w-full max-w-sm">
            <div className="p-5 border-b border-surface-100">
              <h2 className="font-semibold text-surface-900">{t("stundenplan.moveDialogTitle")}</h2>
            </div>
            <div className="p-5">
              <p className="text-sm text-surface-600 text-surface-600 mb-6">
                {t("stundenplan.moveDialogText", { day: moveDialog.newDay, time: `${moveDialog.newStart} – ${moveDialog.newEnd}` })}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setMoveDialog(null)}
                  className="btn-secondary flex-1"
                >
                  {t("stundenplan.modal.cancel")}
                </button>
                <button
                  onClick={() => handleMoveChoice("this")}
                  className="btn-secondary flex-1"
                >
                  {t("stundenplan.moveThisWeek")}
                </button>
                <button
                  onClick={() => handleMoveChoice("all")}
                  className="btn-primary flex-1"
                >
                  {t("stundenplan.moveAllWeeks")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* ── RIGHT: Smart Schedule Panel ────────────────────────────── */}
      {showSchedulePanel && (
 <div className="hidden lg:flex w-[320px] shrink-0 border-l border-surface-100 bg-[rgb(var(--card-bg))] dark:bg-gray-900/50">
          <SmartSchedulePanel />
        </div>
      )}
    </div>
  );
}

function StundenplanModal({ modules, currentKw, currentSemester, prefilledEntry, onClose, onSaved }: {
  modules: ReturnType<typeof useModules>["modules"];
  currentKw: number;
  currentSemester: string;
  prefilledEntry?: { day: string; time_start: string; time_end: string };
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const COLORS = ["#6d28d9","#2563eb","#dc2626","#059669","#d97706","#db2777","#0891b2","#7c3aed"];

  const [form, setForm] = useState({
    title: "",
    day: prefilledEntry?.day ?? "Mo",
    time_start: prefilledEntry?.time_start ?? "08:00",
    time_end: prefilledEntry?.time_end ?? "10:00",
    room: "",
    module_id: "",
    color: COLORS[0],
    kw_from: currentKw.toString(),
    kw_to: currentKw.toString(),
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const kwFrom = parseInt(form.kw_from);
    const kwTo = parseInt(form.kw_to);
    const rows = [];

    for (let kw = kwFrom; kw <= kwTo; kw++) {
      rows.push({
        user_id: user.id,
        title: form.title,
        day: form.day,
        time_start: form.time_start,
        time_end: form.time_end,
        room: form.room || null,
        module_id: form.module_id || null,
        color: form.color,
        kw,
        semester: currentSemester,
      });
    }

    const { data: inserted } = await supabase.from("stundenplan").insert(rows).select("id, day, time_start, time_end, title, color, module_id");
    // Auto-create schedule_blocks for the new entries
    if (inserted && inserted.length > 0) {
      const today = new Date();
      const dow = today.getDay();
      const mondayOffset = dow === 0 ? -6 : 1 - dow;
      const mondayDate = new Date(today);
      mondayDate.setDate(today.getDate() + mondayOffset);
      mondayDate.setHours(0, 0, 0, 0);

      const dayMap: Record<string, number> = { Mo: 0, Di: 1, Mi: 2, Do: 3, Fr: 4, Sa: 5, So: 6 };

      const scheduleRows = inserted.map(entry => {
        const offset = dayMap[entry.day] ?? 0;
        const targetDate = new Date(mondayDate);
        targetDate.setDate(mondayDate.getDate() + offset);
        const [sh, sm] = entry.time_start.split(":").map(Number);
        const [eh, em] = entry.time_end.split(":").map(Number);
        const start = new Date(targetDate); start.setHours(sh, sm, 0, 0);
        const end = new Date(targetDate); end.setHours(eh, em, 0, 0);

        return {
          user_id: user.id,
          block_type: "lecture" as const,
          layer: 1,
          title: entry.title,
          color: entry.color,
          module_id: entry.module_id,
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          recurrence: "weekly" as const,
          source: "stundenplan_sync" as const,
          stundenplan_id: entry.id,
          status: "scheduled" as const,
          priority: "medium" as const,
        };
      });
      await supabase.from("schedule_blocks").insert(scheduleRows);
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface-100 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">{t("stundenplan.modal.title")}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 hover:bg-surface-200"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.nameLabel")} *</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder={t("stundenplan.modal.namePlaceholder")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.dayLabel")}</label>
              <select className="input" value={form.day} onChange={e => set("day", e.target.value)}>
                {DAYS_SHORT.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.fromLabel")}</label>
              <input className="input" type="time" value={form.time_start} onChange={e => set("time_start", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.toLabel")}</label>
              <input className="input" type="time" value={form.time_end} onChange={e => set("time_end", e.target.value)} />
            </div>
          </div>

          {/* KW range */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.fromKwLabel")}</label>
              <input className="input" type="number" min="1" max={MAX_KW} value={form.kw_from} onChange={e => set("kw_from", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.toKwLabel")}</label>
              <input className="input" type="number" min={form.kw_from} max={MAX_KW} value={form.kw_to} onChange={e => set("kw_to", e.target.value)} />
            </div>
          </div>
          {parseInt(form.kw_to) > parseInt(form.kw_from) && (
            <p className="text-xs text-brand-600 -mt-2">
              {t("stundenplan.modal.kwWarning", { count: parseInt(form.kw_to) - parseInt(form.kw_from) + 1, from: form.kw_from, to: form.kw_to })}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.roomLabel")}</label>
              <input className="input" value={form.room} onChange={e => set("room", e.target.value)} placeholder={t("stundenplan.modal.roomPlaceholder")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.moduleLabel")}</label>
              <select className="input" value={form.module_id} onChange={e => set("module_id", e.target.value)}>
                <option value="">—</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("stundenplan.modal.colorLabel")}</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => set("color", c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-surface-800 scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t("stundenplan.modal.cancel")}</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? t("stundenplan.modal.saving") : t("stundenplan.modal.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function StundenplanEditModal({ modules, entry, onClose, onSaved }: {
  modules: ReturnType<typeof useModules>["modules"];
  entry: StundenplanEntry;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation();
  const supabase = createClient();
  const COLORS = ["#6d28d9","#2563eb","#dc2626","#059669","#d97706","#db2777","#0891b2","#7c3aed"];

  const [form, setForm] = useState({
    title: entry.title,
    day: entry.day,
    time_start: entry.time_start,
    time_end: entry.time_end,
    room: entry.room ?? "",
    module_id: entry.module_id ?? "",
    color: entry.color ?? COLORS[0],
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await supabase
      .from("stundenplan")
      .update({
        title: form.title,
        day: form.day,
        time_start: form.time_start,
        time_end: form.time_end,
        room: form.room || null,
        module_id: form.module_id || null,
        color: form.color,
      })
      .eq("id", entry.id);

    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-surface-100 rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-surface-100">
          <h2 className="font-semibold text-surface-900">{t("stundenplan.modal.editTitle") || "Edit Entry"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-100 hover:bg-surface-200"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.nameLabel")} *</label>
            <input className="input" required value={form.title} onChange={e => set("title", e.target.value)} placeholder={t("stundenplan.modal.namePlaceholder")} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.dayLabel")}</label>
              <select className="input" value={form.day} onChange={e => set("day", e.target.value)}>
                {DAYS_SHORT.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.fromLabel")}</label>
              <input className="input" type="time" value={form.time_start} onChange={e => set("time_start", e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.toLabel")}</label>
              <input className="input" type="time" value={form.time_end} onChange={e => set("time_end", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.roomLabel")}</label>
              <input className="input" value={form.room} onChange={e => set("room", e.target.value)} placeholder={t("stundenplan.modal.roomPlaceholder")} />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1">{t("stundenplan.modal.moduleLabel")}</label>
              <select className="input" value={form.module_id} onChange={e => set("module_id", e.target.value)}>
                <option value="">—</option>
                {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t("stundenplan.modal.colorLabel")}</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map(c => (
                <button key={c} type="button" onClick={() => set("color", c)}
                  className={`w-7 h-7 rounded-full border-2 transition-transform ${form.color === c ? "border-surface-800 scale-110" : "border-transparent"}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">{t("stundenplan.modal.cancel")}</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
              {saving ? t("stundenplan.modal.saving") : t("stundenplan.modal.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
