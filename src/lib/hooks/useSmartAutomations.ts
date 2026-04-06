"use client";
/**
 * useSmartAutomations — Reactive Notification System
 *
 * Evaluates the Decision Engine state and shows toast notifications
 * for important events. Uses deduplication to avoid showing the
 * same notification twice per session.
 *
 * WICHTIG: Dieser Hook erstellt KEINE eigene useModuleIntelligence-Instanz.
 * State und Modules werden von aussen übergeben, um doppelte
 * Supabase-Subscriptions zu vermeiden.
 */

import { useEffect, useRef } from "react";
import { evaluateAutomations, filterNewAutomations } from "@/lib/decision/automations";
import type { Automation } from "@/lib/decision/automations";
import type { CommandCenterState, ModuleIntelligence } from "@/lib/decision/types";
import toast from "react-hot-toast";

interface UseSmartAutomationsOptions {
  enabled?: boolean;
  state: CommandCenterState | null;
  modules: ModuleIntelligence[];
}

export function useSmartAutomations({
  enabled = true,
  state,
  modules,
}: UseSmartAutomationsOptions) {
  const shownKeysRef = useRef(new Set<string>());
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!enabled || !state || modules.length === 0) return;

    // On first load: only show critical automations, mark rest as seen
    if (!initializedRef.current) {
      initializedRef.current = true;
      const allAutomations = evaluateAutomations(state, modules);
      const critical = allAutomations.filter((a) => a.priority === "critical");

      for (const automation of critical) {
        showAutomationToast(automation);
        shownKeysRef.current.add(automation.dedupeKey);
      }

      // Mark non-critical as "seen"
      for (const a of allAutomations) {
        shownKeysRef.current.add(a.dedupeKey);
      }
      return;
    }

    // Subsequent changes: show max 3 new automations
    const allAutomations = evaluateAutomations(state, modules);
    const newAutomations = filterNewAutomations(allAutomations, shownKeysRef.current);

    for (const automation of newAutomations.slice(0, 3)) {
      showAutomationToast(automation);
      shownKeysRef.current.add(automation.dedupeKey);
    }
  }, [enabled, state, modules]);
}

function showAutomationToast(automation: Automation) {
  const duration =
    automation.priority === "critical" ? 8000 :
    automation.priority === "high" ? 6000 : 4000;

  const icon =
    automation.type === "exam_warning" ? "\u{1F4DD}" :
    automation.type === "grade_alert" ? "\u26A0\uFE0F" :
    automation.type === "study_nudge" ? "\u{1F4DA}" :
    automation.type === "streak_celebration" ? "\u{1F525}" :
    automation.type === "task_reminder" ? "\u{1F4CB}" :
    automation.type === "knowledge_review" ? "\u{1F9E0}" :
    automation.type === "milestone_reached" ? "\u{1F3AF}" :
    automation.type === "risk_escalation" ? "\u{1F6A8}" : "\u{1F4A1}";

  if (automation.priority === "critical") {
    toast.error(`${icon} ${automation.title}\n${automation.message}`, {
      duration,
      id: automation.id,
    });
  } else {
    toast(`${icon} ${automation.title}\n${automation.message}`, {
      duration,
      id: automation.id,
    });
  }
}
