// ── Decision Engine → Schedule Engine Bridge ────────────────────────────────
// Transforms Decision Engine outputs (priorities, actions, risk) into
// concrete Schedule Blocks that can be placed in the calendar.
//
// This is the key connector between "WHAT to study" and "WHEN to study".
// ─────────────────────────────────────────────────────────────────────────────

import type { ScheduleBlock, FreeSlot, SchedulePreferences, BlockType } from "./types";
import { DEFAULT_PREFERENCES, BLOCK_TYPE_META } from "./types";

// ── Decision Engine Types (imported shape) ──────────────────────────────────
// We define the interface we need from the Decision Engine to avoid
// circular dependencies. These match the types in src/lib/decision/types.ts.

interface DecisionAction {
  id: string;
  moduleId: string;
  moduleName: string;
  moduleColor: string;
  type: string;       // ActionType from decision engine
  urgency: string;    // ActionUrgency
  title: string;
  description: string;
  estimatedMinutes: number;
  reason: string;
  impact: string;
  relatedEntityId?: string;
  relatedEntityType?: string;
  metadata?: Record<string, unknown>;
}

interface DecisionModulePriority {
  moduleId: string;
  score: number;
  rank: number;
  reasons: string[];
  suggestedMinutesToday: number;
}

interface DecisionModuleRisk {
  moduleId: string;
  level: "low" | "medium" | "high" | "critical";
  factors: Array<{ type: string; severity: number }>;
}

interface DecisionDailyPlan {
  date: string;
  totalMinutes: number;
  actions: DecisionAction[];
  focusModule: { moduleId: string; moduleName: string; moduleColor: string } | null;
  alerts: Array<{ level: string; message: string; moduleId?: string }>;
}

// ── Bridge Configuration ────────────────────────────────────────────────────

interface BridgeConfig {
  /** Minimum break between auto-scheduled blocks (minutes) */
  minBreakBetweenBlocks: number;
  /** Maximum block duration (minutes) */
  maxBlockDuration: number;
  /** Prefer placing high-energy tasks in high-energy time slots */
  respectEnergyCurve: boolean;
  /** Padding around existing blocks (minutes) */
  blockPadding: number;
}

const DEFAULT_BRIDGE_CONFIG: BridgeConfig = {
  minBreakBetweenBlocks: 10,
  maxBlockDuration: 90,
  respectEnergyCurve: true,
  blockPadding: 5,
};

// ── Action Type to Block Type Mapping ───────────────────────────────────────

function actionTypeToBlockType(actionType: string): BlockType {
  switch (actionType) {
    case "study_topic":       return "study";
    case "review_flashcards": return "flashcards";
    case "complete_task":     return "study";
    case "prepare_exam":      return "exam_prep";
    case "start_studying":    return "study";
    case "increase_time":     return "deep_work";
    case "seek_help":         return "group_study";
    case "create_material":   return "study";
    case "review_weak_topics":return "review";
    case "submit_component":  return "study";
    default:                  return "study";
  }
}

// ── Energy Curve Scoring ────────────────────────────────────────────────────

type EnergyPeriod = "morning" | "afternoon" | "evening";

function getEnergyPeriod(hour: number): EnergyPeriod {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function getEnergyScore(period: EnergyPeriod, prefs: SchedulePreferences): number {
  switch (period) {
    case "morning":   return prefs.energy_morning;
    case "afternoon": return prefs.energy_afternoon;
    case "evening":   return prefs.energy_evening;
  }
}

/**
 * Determine if an action requires high cognitive load.
 * High-energy actions should be scheduled during high-energy periods.
 */
function actionRequiresHighEnergy(action: DecisionAction): boolean {
  const highEnergyTypes = ["study_topic", "prepare_exam", "create_material"];
  const highUrgency = action.urgency === "now" || action.urgency === "today";
  return highEnergyTypes.includes(action.type) || highUrgency;
}


// ── Main Bridge Function ────────────────────────────────────────────────────

export interface BridgeResult {
  /** Generated schedule blocks */
  blocks: Omit<ScheduleBlock, "id" | "user_id" | "created_at" | "updated_at">[];
  /** Actions that couldn't be scheduled (no free slots) */
  unscheduled: DecisionAction[];
  /** Total minutes scheduled */
  totalMinutesScheduled: number;
  /** Warnings */
  warnings: string[];
}

/**
 * Convert Decision Engine daily plan into concrete schedule blocks.
 *
 * Algorithm:
 * 1. Sort actions by urgency (now > today > this_week)
 * 2. Sort free slots by energy preference
 * 3. Place each action in the best available slot
 * 4. Insert breaks between blocks
 * 5. Return blocks + unscheduled actions
 */
export function bridgeDecisionToSchedule(
  dailyPlan: DecisionDailyPlan,
  priorities: DecisionModulePriority[],
  freeSlots: FreeSlot[],
  preferences: SchedulePreferences = DEFAULT_PREFERENCES,
  config: BridgeConfig = DEFAULT_BRIDGE_CONFIG,
  risks?: DecisionModuleRisk[],
): BridgeResult {
  const blocks: BridgeResult["blocks"] = [];
  const unscheduled: DecisionAction[] = [];
  const warnings: string[] = [];
  let totalMinutes = 0;

  // Budget tracking
  const dailyMax = preferences.max_daily_study_minutes;
  let remainingBudget = dailyMax;

  // Priority map for module weighting
  const priorityMap = new Map(priorities.map(p => [p.moduleId, p]));

  // Risk map for difficulty-aware scheduling
  const riskMap = new Map((risks ?? []).map(r => [r.moduleId, r]));
  const riskMultiplier: Record<string, number> = {
    critical: 1.5, high: 1.25, medium: 1.0, low: 0.85,
  };

  // Sort actions: "now" first, then "today", then by estimated time (larger first)
  const urgencyOrder: Record<string, number> = {
    now: 0, today: 1, this_week: 2, soon: 3, later: 4,
  };
  const sortedActions = [...dailyPlan.actions].sort((a, b) => {
    const urgDiff = (urgencyOrder[a.urgency] ?? 5) - (urgencyOrder[b.urgency] ?? 5);
    if (urgDiff !== 0) return urgDiff;
    return b.estimatedMinutes - a.estimatedMinutes;
  });

  // Build mutable slot list
  const availableSlots = freeSlots.map(s => ({
    start: new Date(s.slot_start).getTime(),
    end: new Date(s.slot_end).getTime(),
    remainingMinutes: s.duration_minutes,
  }));

  // Sort slots by energy preference if enabled
  if (config.respectEnergyCurve) {
    availableSlots.sort((a, b) => {
      const aHour = new Date(a.start).getHours();
      const bHour = new Date(b.start).getHours();
      const aEnergy = getEnergyScore(getEnergyPeriod(aHour), preferences);
      const bEnergy = getEnergyScore(getEnergyPeriod(bHour), preferences);
      // Higher energy slots first
      return bEnergy - aEnergy;
    });
  }

  for (const action of sortedActions) {
    if (remainingBudget <= 0) {
      unscheduled.push(action);
      continue;
    }

    // Risk-aware duration: high-risk modules get more time
    const moduleRisk = riskMap.get(action.moduleId);
    const riskMult = moduleRisk ? (riskMultiplier[moduleRisk.level] ?? 1.0) : 1.0;
    const adjustedEstimate = Math.round(action.estimatedMinutes * riskMult);

    const duration = Math.min(
      adjustedEstimate,
      config.maxBlockDuration,
      remainingBudget,
    );

    if (duration < preferences.min_study_block_minutes && action.urgency !== "now") {
      // Too short for a meaningful block (unless urgent)
      unscheduled.push(action);
      continue;
    }

    // Find best slot
    const needsHighEnergy = actionRequiresHighEnergy(action);
    let bestSlotIdx = -1;
    let bestScore = -1;

    for (let i = 0; i < availableSlots.length; i++) {
      const slot = availableSlots[i];
      if (slot.remainingMinutes < duration + config.blockPadding) continue;

      let score = 100; // Base score

      // Energy match
      if (config.respectEnergyCurve) {
        const hour = new Date(slot.start).getHours();
        const energy = getEnergyScore(getEnergyPeriod(hour), preferences);
        if (needsHighEnergy) {
          score += energy * 20; // Prefer high-energy slots for hard tasks
        } else {
          score += (6 - energy) * 10; // Save high-energy slots for hard tasks
        }
      }

      // Prefer earlier slots for urgent tasks
      if (action.urgency === "now" || action.urgency === "today") {
        score += (availableSlots.length - i) * 5;
      }

      // Risk-aware: critical/high-risk modules get priority for best slots
      if (moduleRisk) {
        const riskBonus: Record<string, number> = { critical: 40, high: 20, medium: 5, low: 0 };
        score += riskBonus[moduleRisk.level] ?? 0;
      }

      // Prefer slots that fit the duration well (reduce fragmentation)
      const waste = slot.remainingMinutes - duration;
      if (waste < preferences.min_study_block_minutes && waste > 0) {
        score -= 30; // Would leave an unusable fragment
      }

      if (score > bestScore) {
        bestScore = score;
        bestSlotIdx = i;
      }
    }

    if (bestSlotIdx === -1) {
      unscheduled.push(action);
      warnings.push(`Kein freies Zeitfenster für: ${action.title} (${duration} min)`);
      continue;
    }

    // Place block in slot
    const slot = availableSlots[bestSlotIdx];
    const blockStart = new Date(slot.start + config.blockPadding * 60000);
    const blockEnd = new Date(blockStart.getTime() + duration * 60000);

    const blockType = actionTypeToBlockType(action.type);
    const meta = BLOCK_TYPE_META[blockType];

    blocks.push({
      block_type: blockType,
      layer: 2,
      start_time: blockStart.toISOString(),
      end_time: blockEnd.toISOString(),
      recurrence: null,
      recurrence_end: null,
      module_id: action.moduleId,
      task_id: action.relatedEntityType === "task" ? (action.relatedEntityId || null) : null,
      topic_id: action.relatedEntityType === "topic" ? (action.relatedEntityId || null) : null,
      exam_id: action.relatedEntityType === "exam" ? (action.relatedEntityId || null) : null,
      study_plan_id: null,
      title: action.title,
      description: `${action.description}\n\nGrund: ${action.reason}`,
      color: action.moduleColor || meta.defaultColor,
      icon: meta.defaultIcon,
      priority: mapUrgencyToPriority(action.urgency),
      status: "scheduled",
      completion_percent: 0,
      original_block_id: null,
      reschedule_reason: null,
      estimated_minutes: duration,
      is_locked: false,
      source: "decision_engine",
    });

    // Update slot: consume time + add break
    const consumed = duration + config.minBreakBetweenBlocks + config.blockPadding;
    slot.start = blockEnd.getTime() + config.minBreakBetweenBlocks * 60000;
    slot.remainingMinutes -= consumed;
    remainingBudget -= duration;
    totalMinutes += duration;
  }

  // Add break blocks between consecutive study blocks
  const sortedBlocks = [...blocks].sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  );

  for (let i = 0; i < sortedBlocks.length - 1; i++) {
    const current = sortedBlocks[i];
    const next = sortedBlocks[i + 1];
    const gap = (new Date(next.start_time).getTime() - new Date(current.end_time).getTime()) / 60000;

    if (gap >= config.minBreakBetweenBlocks && gap <= config.minBreakBetweenBlocks + 5) {
      blocks.push({
        block_type: "break",
        layer: 2,
        start_time: current.end_time,
        end_time: next.start_time,
        recurrence: null,
        recurrence_end: null,
        module_id: null,
        task_id: null,
        topic_id: null,
        exam_id: null,
        study_plan_id: null,
        title: "Pause",
        description: null,
        color: BLOCK_TYPE_META.break.defaultColor,
        icon: BLOCK_TYPE_META.break.defaultIcon,
        priority: "low",
        status: "scheduled",
        completion_percent: 0,
        original_block_id: null,
        reschedule_reason: null,
        estimated_minutes: Math.round(gap),
        is_locked: false,
        source: "decision_engine",
      });
    }
  }

  return { blocks, unscheduled, totalMinutesScheduled: totalMinutes, warnings };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function mapUrgencyToPriority(urgency: string): "low" | "medium" | "high" | "critical" {
  switch (urgency) {
    case "now": return "critical";
    case "today": return "high";
    case "this_week": return "medium";
    default: return "low";
  }
}
