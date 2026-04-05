"use client";

import { useMemo } from "react";

interface StudyItem {
  scheduled_date: string;
  completed: boolean;
}

interface WeeklyProgressProps {
  items: StudyItem[];
}

export function WeeklyProgress({ items }: WeeklyProgressProps) {
  // Calculate completed items per day for current week
  const weekData = useMemo(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday

    const days = [];
    const completedCounts: Record<string, number> = {};
    const maxCount = 10; // Max height reference

    // Initialize counters for 7 days
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      completedCounts[dateStr] = 0;
      days.push({
        date: dateStr,
        dayAbbr: d.toLocaleDateString("en-US", { weekday: "short" }).substring(0, 2),
        isToday: dateStr === today.toISOString().slice(0, 10),
      });
    }

    // Count completed items per day
    items.forEach(item => {
      if (item.completed && completedCounts.hasOwnProperty(item.scheduled_date)) {
        completedCounts[item.scheduled_date]++;
      }
    });

    // Find max to calculate scaling
    const maxCompleted = Math.max(...Object.values(completedCounts), 1);

    return {
      days: days.map(d => ({
        ...d,
        completed: completedCounts[d.date],
        height: (completedCounts[d.date] / maxCompleted) * 100,
      })),
    };
  }, [items]);

  return (
    <div className="flex items-end justify-between gap-2 h-32 px-2 py-4 bg-surface-50 rounded-xl">
      {weekData.days.map((day, idx) => (
        <div key={day.date} className="flex flex-col items-center flex-1 gap-2">
          {/* Bar */}
          <div className="flex-1 w-full flex items-end justify-center">
            <div
              className={`w-full rounded-t-lg transition-all duration-300 ${
                day.isToday
                  ? "bg-indigo-500"
                  : `bg-gradient-to-t from-brand-600 to-brand-400`
              }`}
              style={{ height: `${day.height}%`, minHeight: day.completed > 0 ? "12px" : "0px" }}
            />
          </div>

          {/* Count label on top */}
          {day.completed > 0 && (
            <span className="text-xs font-bold text-brand-700 h-5">
              {day.completed}
            </span>
          )}

          {/* Day abbreviation */}
          <span className={`text-xs font-medium uppercase ${
            day.isToday
              ? "text-indigo-600 font-bold"
              : "text-surface-500"
          }`}>
            {day.dayAbbr}
          </span>
        </div>
      ))}
    </div>
  );
}
