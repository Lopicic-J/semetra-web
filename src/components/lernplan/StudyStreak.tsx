"use client";

import { useMemo } from "react";
import { Flame } from "lucide-react";

interface StudyItem {
  scheduled_date: string;
  completed: boolean;
}

interface StudyStreakProps {
  items: StudyItem[];
}

export function StudyStreak({ items }: StudyStreakProps) {
  const streak = useMemo(() => {
    // Group items by date and check if any were completed that day
    const completedDates = new Set<string>();
    items.forEach(item => {
      if (item.completed) {
        completedDates.add(item.scheduled_date);
      }
    });

    // Calculate streak from today backwards
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let currentStreak = 0;
    let checkDate = new Date(today);

    while (true) {
      const dateStr = checkDate.toISOString().slice(0, 10);
      if (completedDates.has(dateStr)) {
        currentStreak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }

    return currentStreak;
  }, [items]);

  // Determine color based on streak length
  const getStreakColor = (count: number) => {
    if (count === 0) return { bg: "bg-surface-100", text: "text-surface-400" };
    if (count <= 2) return { bg: "bg-gray-100", text: "text-gray-600", flame: "text-gray-400" };
    if (count <= 6) return { bg: "bg-amber-50", text: "text-amber-700", flame: "text-amber-500" };
    if (count <= 13) return { bg: "bg-orange-50", text: "text-orange-700", flame: "text-orange-500" };
    return { bg: "bg-red-50", text: "text-red-700", flame: "text-red-500" };
  };

  const colors = getStreakColor(streak);
  const flameColor = colors.flame || colors.text;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg ${colors.bg}`}>
      <Flame size={16} className={flameColor} />
      <span className={`text-sm font-bold ${colors.text}`}>
        {streak} {streak === 1 ? "Tag" : "Tage"}
      </span>
    </div>
  );
}
