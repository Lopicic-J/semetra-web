/**
 * Semetra Analytics Tracker
 *
 * Lightweight, privacy-friendly event tracking.
 * Supports two backends:
 *  1. Umami (if NEXT_PUBLIC_UMAMI_WEBSITE_ID is set)
 *  2. Supabase (always — stores in analytics_events table)
 *
 * Usage:
 *   import { track } from "@/lib/analytics/tracker";
 *   track("timer_started", { module_id: "abc", duration: 25 });
 */

// ── Types ────────────────────────────────────────────────────────────────────

export interface TrackEvent {
  name: string;
  data?: Record<string, string | number | boolean | null>;
}

type UmamiTracker = {
  track: (name: string, data?: Record<string, unknown>) => void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
  }
}

// ── Core tracker ─────────────────────────────────────────────────────────────

/**
 * Track a custom event.
 * Non-blocking — errors are swallowed to never affect UX.
 */
export function track(name: string, data?: Record<string, string | number | boolean | null>) {
  try {
    // 1. Umami (if loaded)
    if (typeof window !== "undefined" && window.umami) {
      window.umami.track(name, data ?? {});
    }

    // 2. Supabase analytics_events (non-blocking)
    if (typeof window !== "undefined") {
      storeEventInSupabase(name, data).catch(() => {
        // Silently fail — analytics should never break the app
      });
    }
  } catch {
    // Never throw from analytics
  }
}

// ── Predefined events ────────────────────────────────────────────────────────

export const events = {
  // Onboarding funnel
  onboardingStarted: () => track("onboarding_started"),
  onboardingStepCompleted: (step: number, stepName: string) =>
    track("onboarding_step_completed", { step, step_name: stepName }),
  onboardingCompleted: () => track("onboarding_completed"),
  onboardingSkipped: (atStep: number) =>
    track("onboarding_skipped", { at_step: atStep }),

  // Core features
  moduleCreated: (moduleId: string) =>
    track("module_created", { module_id: moduleId }),
  timerStarted: (moduleId: string | null, durationMin: number) =>
    track("timer_started", { module_id: moduleId ?? "none", duration_min: durationMin }),
  timerCompleted: (moduleId: string | null, actualMin: number) =>
    track("timer_completed", { module_id: moduleId ?? "none", actual_min: actualMin }),
  taskCreated: () => track("task_created"),
  taskCompleted: () => track("task_completed"),
  gradeEntered: (moduleId: string) =>
    track("grade_entered", { module_id: moduleId }),
  examPlanned: () => track("exam_planned"),

  // AI
  aiConversationStarted: () => track("ai_conversation_started"),
  aiMessageSent: () => track("ai_message_sent"),

  // Social
  groupCreated: () => track("group_created"),
  groupJoined: () => track("group_joined"),
  friendAdded: () => track("friend_added"),

  // Engagement
  weeklyReviewViewed: () => track("weekly_review_viewed"),
  dnaAnalysisRun: () => track("dna_analysis_run"),
  certificateGenerated: (moduleId: string) =>
    track("certificate_generated", { module_id: moduleId }),
  exportGenerated: (format: string) =>
    track("export_generated", { format }),

  // Navigation
  pageViewed: (path: string) =>
    track("page_viewed", { path }),

  // Upgrade
  upgradePageViewed: () => track("upgrade_page_viewed"),
  upgradeStarted: (plan: string) =>
    track("upgrade_started", { plan }),
} as const;

// ── Supabase storage (background) ───────────────────────────────────────────

async function storeEventInSupabase(
  name: string,
  data?: Record<string, string | number | boolean | null>
) {
  // Use fetch directly to avoid importing supabase client in analytics
  // (keeps bundle small and avoids circular deps)
  const res = await fetch("/api/analytics/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, data }),
    // Don't wait for response — fire and forget
    keepalive: true,
  });
  // We don't care about the response
  void res;
}
