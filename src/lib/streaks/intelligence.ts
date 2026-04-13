/**
 * Streak Intelligence — Advanced streak analysis and predictions
 *
 * Extends basic streak counting with:
 *   - Milestone detection (7, 14, 21, 30, 50, 100 days)
 *   - Streak health scoring
 *   - Break risk prediction
 *   - Historical streak analysis
 *   - Auto-celebration triggers
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface StreakMilestone {
  days: number;
  label: string;
  emoji: string;
  reached: boolean;
  reachedAt?: string;
}

export interface StreakHealth {
  score: number; // 0-100
  trend: "strengthening" | "stable" | "weakening";
  avgMinutesPerDay: number;
  consistencyRatio: number; // What % of days in streak had study
  longestGapHours: number;
  riskOfBreak: "low" | "medium" | "high";
  riskReason?: string;
}

export interface StreakIntelligence {
  currentStreak: number;
  longestStreak: number;
  totalStreaks: number; // Separate streak periods
  health: StreakHealth;
  milestones: StreakMilestone[];
  nextMilestone: StreakMilestone | null;
  recentActivity: DayActivity[];
  celebrationTrigger: CelebrationTrigger | null;
}

export interface DayActivity {
  date: string;
  minutes: number;
  sessions: number;
  active: boolean; // Met 15-min threshold
}

export interface CelebrationTrigger {
  type: "milestone" | "personal_best" | "comeback" | "consistency_week";
  title: string;
  message: string;
  emoji: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STREAK_THRESHOLD_SECONDS = 15 * 60; // 15 minutes

const MILESTONES: { days: number; label: string; emoji: string }[] = [
  { days: 3,   label: "3-Tage-Start",    emoji: "🌱" },
  { days: 7,   label: "1 Woche",         emoji: "🔥" },
  { days: 14,  label: "2 Wochen",        emoji: "⚡" },
  { days: 21,  label: "Gewohnheit!",     emoji: "💪" },
  { days: 30,  label: "1 Monat",         emoji: "🏆" },
  { days: 50,  label: "50 Tage",         emoji: "🌟" },
  { days: 100, label: "100 Tage",        emoji: "👑" },
  { days: 365, label: "1 Jahr",          emoji: "🎓" },
];

// ── Core Analysis ────────────────────────────────────────────────────────────

interface SessionInput {
  started_at: string;
  duration_seconds: number;
}

/**
 * Analyze streak behavior from raw session data.
 *
 * @param sessions All completed sessions (sorted by started_at ascending)
 * @param lookbackDays Number of days to analyze (default 90)
 */
export function analyzeStreaks(
  sessions: SessionInput[],
  lookbackDays = 90
): StreakIntelligence {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(startDate.getDate() - lookbackDays);

  // Build day-by-day activity map
  const dayMap = new Map<string, { minutes: number; sessions: number }>();

  for (const session of sessions) {
    const date = session.started_at.slice(0, 10);
    const sessionDate = new Date(date);
    if (sessionDate < startDate) continue;

    const existing = dayMap.get(date) ?? { minutes: 0, sessions: 0 };
    existing.minutes += session.duration_seconds / 60;
    existing.sessions += 1;
    dayMap.set(date, existing);
  }

  // Build recent activity (last 14 days)
  const recentActivity: DayActivity[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    const activity = dayMap.get(dateStr);
    recentActivity.push({
      date: dateStr,
      minutes: Math.round(activity?.minutes ?? 0),
      sessions: activity?.sessions ?? 0,
      active: (activity?.minutes ?? 0) * 60 >= STREAK_THRESHOLD_SECONDS,
    });
  }

  // Calculate streaks
  const { current, longest, totalStreaks, allStreakLengths } = calculateAllStreaks(dayMap, now);

  // Milestones
  const milestones: StreakMilestone[] = MILESTONES.map((m) => ({
    ...m,
    reached: current >= m.days,
    reachedAt: current >= m.days ? getStreakDate(now, current, m.days) : undefined,
  }));

  const nextMilestone = milestones.find((m) => !m.reached) ?? null;

  // Health scoring
  const health = computeStreakHealth(recentActivity, current, dayMap);

  // Celebration trigger
  const celebrationTrigger = detectCelebration(current, longest, allStreakLengths, recentActivity);

  return {
    currentStreak: current,
    longestStreak: longest,
    totalStreaks,
    health,
    milestones,
    nextMilestone,
    recentActivity,
    celebrationTrigger,
  };
}

// ── Streak Calculation ───────────────────────────────────────────────────────

function calculateAllStreaks(
  dayMap: Map<string, { minutes: number; sessions: number }>,
  now: Date
): { current: number; longest: number; totalStreaks: number; allStreakLengths: number[] } {
  // Get all dates in order
  const allDates: string[] = [];
  const check = new Date(now);
  check.setDate(check.getDate() - 365); // Look back up to 1 year

  while (check <= now) {
    allDates.push(check.toISOString().slice(0, 10));
    check.setDate(check.getDate() + 1);
  }

  // Find all streak periods
  const streakLengths: number[] = [];
  let currentRun = 0;

  for (const date of allDates) {
    const activity = dayMap.get(date);
    const isActive = (activity?.minutes ?? 0) * 60 >= STREAK_THRESHOLD_SECONDS;

    if (isActive) {
      currentRun++;
    } else {
      if (currentRun > 0) streakLengths.push(currentRun);
      currentRun = 0;
    }
  }
  if (currentRun > 0) streakLengths.push(currentRun);

  // Current streak (from today or yesterday backward)
  const todayStr = now.toISOString().slice(0, 10);
  const todayActivity = dayMap.get(todayStr);
  const todayActive = (todayActivity?.minutes ?? 0) * 60 >= STREAK_THRESHOLD_SECONDS;

  let currentStreak = 0;
  const startFrom = new Date(now);
  if (!todayActive) {
    startFrom.setDate(startFrom.getDate() - 1);
  }

  while (true) {
    const dateStr = startFrom.toISOString().slice(0, 10);
    const activity = dayMap.get(dateStr);
    if ((activity?.minutes ?? 0) * 60 >= STREAK_THRESHOLD_SECONDS) {
      currentStreak++;
      startFrom.setDate(startFrom.getDate() - 1);
    } else {
      break;
    }
  }

  return {
    current: currentStreak,
    longest: Math.max(0, ...streakLengths),
    totalStreaks: streakLengths.filter((s) => s >= 3).length, // Only count 3+ day streaks
    allStreakLengths: streakLengths,
  };
}

// ── Health Scoring ───────────────────────────────────────────────────────────

function computeStreakHealth(
  recentActivity: DayActivity[],
  currentStreak: number,
  dayMap: Map<string, { minutes: number; sessions: number }>
): StreakHealth {
  const activeDays = recentActivity.filter((d) => d.active);
  const consistencyRatio = activeDays.length / recentActivity.length;
  const avgMinutes = activeDays.length > 0
    ? activeDays.reduce((s, d) => s + d.minutes, 0) / activeDays.length
    : 0;

  // Find longest gap in recent history
  let maxGapHours = 0;
  let lastActive: Date | null = null;
  for (const day of recentActivity) {
    if (day.active) {
      if (lastActive) {
        const gap = (new Date(day.date).getTime() - lastActive.getTime()) / 3600000;
        maxGapHours = Math.max(maxGapHours, gap);
      }
      lastActive = new Date(day.date);
    }
  }

  // Trend: compare first 7 days vs last 7 days
  const firstHalf = recentActivity.slice(0, 7);
  const secondHalf = recentActivity.slice(7);
  const firstActive = firstHalf.filter((d) => d.active).length;
  const secondActive = secondHalf.filter((d) => d.active).length;
  const trend: StreakHealth["trend"] =
    secondActive > firstActive + 1 ? "strengthening"
    : secondActive < firstActive - 1 ? "weakening"
    : "stable";

  // Score
  const consistencyPts = consistencyRatio * 40;
  const streakPts = Math.min(30, currentStreak * 1.5);
  const minutesPts = Math.min(20, avgMinutes * 0.4);
  const trendPts = trend === "strengthening" ? 10 : trend === "weakening" ? -5 : 5;
  const score = Math.max(0, Math.min(100, Math.round(consistencyPts + streakPts + minutesPts + trendPts)));

  // Risk assessment
  let riskOfBreak: StreakHealth["riskOfBreak"] = "low";
  let riskReason: string | undefined;

  const todayDone = recentActivity[recentActivity.length - 1]?.active ?? false;
  const now = new Date();

  if (!todayDone && now.getHours() >= 20) {
    riskOfBreak = "high";
    riskReason = "Heute noch nicht gelernt und es ist schon Abend";
  } else if (trend === "weakening") {
    riskOfBreak = "medium";
    riskReason = "Lernaktivität nimmt ab";
  } else if (avgMinutes < 20) {
    riskOfBreak = "medium";
    riskReason = "Sessions sind sehr kurz";
  }

  return {
    score,
    trend,
    avgMinutesPerDay: Math.round(avgMinutes),
    consistencyRatio: Math.round(consistencyRatio * 100) / 100,
    longestGapHours: Math.round(maxGapHours),
    riskOfBreak,
    riskReason,
  };
}

// ── Celebration Detection ────────────────────────────────────────────────────

function detectCelebration(
  current: number,
  longest: number,
  allStreakLengths: number[],
  recentActivity: DayActivity[]
): CelebrationTrigger | null {
  // New personal best
  if (current > 0 && current === longest && current > 1 && longest > 3) {
    return {
      type: "personal_best",
      title: "Neuer Rekord!",
      message: `${current} Tage — dein längster Streak aller Zeiten!`,
      emoji: "🎉",
    };
  }

  // Milestone reached today
  const milestone = MILESTONES.find((m) => m.days === current);
  if (milestone) {
    return {
      type: "milestone",
      title: milestone.label,
      message: `Du hast ${current} Tage am Stück gelernt!`,
      emoji: milestone.emoji,
    };
  }

  // Comeback (started new streak after 3+ day break, now at 3 days)
  if (current === 3) {
    const prevStreak = allStreakLengths.length >= 2 ? allStreakLengths[allStreakLengths.length - 2] : 0;
    if (prevStreak > 0) {
      return {
        type: "comeback",
        title: "Comeback!",
        message: "3 Tage am Stück — du bist wieder drin!",
        emoji: "💪",
      };
    }
  }

  // Full consistency week (7/7 active days in last 7)
  const lastWeek = recentActivity.slice(-7);
  if (lastWeek.length === 7 && lastWeek.every((d) => d.active)) {
    return {
      type: "consistency_week",
      title: "Perfekte Woche!",
      message: "7 von 7 Tagen gelernt — herausragende Konstanz!",
      emoji: "⭐",
    };
  }

  return null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStreakDate(now: Date, currentStreak: number, milestoneDays: number): string {
  const daysAgo = currentStreak - milestoneDays;
  const d = new Date(now);
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}
