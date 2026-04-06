// ── Adaptive Rescheduler ─────────────────────────────────────────────────────
// Intelligently reschedules missed/partial blocks based on learned patterns.
// No side effects — returns reschedule proposals that the API/UI layer applies.
//
// Triggers:
//   - Block missed (15min grace passed, no session started)
//   - Block partial (session ended early)
//   - User request (manual "find me a better time")
//   - Day overflow (too many blocks for available time)
//   - Energy low (user reports low energy, wants to postpone)
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ScheduleBlock, TimerSession, SchedulePreferences, FreeSlot,
} from "./types";
import { DEFAULT_PREFERENCES, getBlockDurationMinutes, isLearningBlock } from "./types";
import { findFreeSlots } from "./engine";
import type { StudyPatterns } from "./pattern-analyzer";
import { scoreSlotForTask } from "./pattern-analyzer";

// ── Types ──────────────────────────────────────────────────────────────────────

export type RescheduleTrigger =
  | "missed"
  | "partial"
  | "conflict"
  | "energy_low"
  | "user_request"
  | "auto_optimize"
  | "day_overflow";

export type RescheduleResolution =
  | "rescheduled"
  | "shortened"
  | "merged"
  | "dropped"
  | "pending";

export interface RescheduleProposal {
  originalBlock: ScheduleBlock;
  trigger: RescheduleTrigger;
  resolution: RescheduleResolution;

  // Proposed new timing (null if dropped)
  newStart: string | null;
  newEnd: string | null;
  newDuration: number | null;    // minutes

  // Score & reasoning
  confidence: number;            // 0-100
  reason: string;                // i18n key
  reasonData: Record<string, any>;

  // If merged with another block
  mergeTargetBlockId: string | null;
}

export interface RescheduleResult {
  proposals: RescheduleProposal[];
  droppedBlocks: ScheduleBlock[];
  warnings: string[];
  totalRescheduledMinutes: number;
}

export interface RescheduleOptions {
  /** Look ahead N days for free slots (default: 3) */
  lookAheadDays?: number;
  /** Minimum slot duration to consider (default: from prefs) */
  minSlotMinutes?: number;
  /** Allow shortening blocks (default: true) */
  allowShorten?: boolean;
  /** Minimum percentage of original duration to keep when shortening (default: 0.5) */
  minShortenRatio?: number;
  /** Allow merging similar blocks (default: true) */
  allowMerge?: boolean;
  /** Allow dropping low-priority blocks (default: false for manual, true for auto) */
  allowDrop?: boolean;
  /** Maximum blocks to reschedule at once (default: 10) */
  maxProposals?: number;
}

const DEFAULT_OPTIONS: Required<RescheduleOptions> = {
  lookAheadDays: 3,
  minSlotMinutes: 0,
  allowShorten: true,
  minShortenRatio: 0.5,
  allowMerge: true,
  allowDrop: false,
  maxProposals: 10,
};


// ── Main Rescheduler ──────────────────────────────────────────────────────────

/**
 * Generate reschedule proposals for one or more blocks.
 * Pure function: returns proposals without applying them.
 */
export function generateRescheduleProposals(
  blocksToReschedule: ScheduleBlock[],
  trigger: RescheduleTrigger,
  allBlocks: ScheduleBlock[],
  allSessions: TimerSession[],
  preferences: SchedulePreferences,
  patterns: StudyPatterns | null,
  options?: RescheduleOptions,
): RescheduleResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  if (opts.minSlotMinutes === 0) {
    opts.minSlotMinutes = preferences.min_study_block_minutes;
  }

  const proposals: RescheduleProposal[] = [];
  const droppedBlocks: ScheduleBlock[] = [];
  const warnings: string[] = [];
  let totalRescheduledMinutes = 0;

  // Sort blocks by priority: critical > high > medium > low
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...blocksToReschedule].sort((a, b) =>
    (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
  );

  // Collect available slots across look-ahead days
  const today = new Date().toISOString().slice(0, 10);
  const availableSlots: Array<FreeSlot & { date: string; slotScore: number }> = [];

  for (let d = 0; d < opts.lookAheadDays; d++) {
    const date = addDays(today, d);
    const daySlots = findFreeSlots(allBlocks, allSessions, preferences, date, opts.minSlotMinutes);

    for (const slot of daySlots) {
      // Skip slots in the past
      if (new Date(slot.slot_start).getTime() < Date.now()) continue;

      const slotScore = patterns
        ? scoreSlotForTask(patterns, slot.slot_start, slot.duration_minutes)
        : 50;

      availableSlots.push({ ...slot, date, slotScore });
    }
  }

  // Sort slots by score (best first)
  availableSlots.sort((a, b) => b.slotScore - a.slotScore);

  // Process each block
  for (const block of sorted.slice(0, opts.maxProposals)) {
    const duration = getBlockDurationMinutes(block);
    const proposal = findBestReschedule(
      block, trigger, duration, availableSlots, allBlocks,
      preferences, patterns, opts, warnings,
    );

    if (proposal) {
      proposals.push(proposal);
      totalRescheduledMinutes += proposal.newDuration ?? 0;

      // Remove used slot capacity
      if (proposal.newStart && proposal.newEnd) {
        removeSlotCapacity(availableSlots, proposal.newStart, proposal.newEnd);
      }
    } else if (opts.allowDrop && block.priority !== "critical") {
      droppedBlocks.push(block);
      proposals.push({
        originalBlock: block,
        trigger,
        resolution: "dropped",
        newStart: null,
        newEnd: null,
        newDuration: null,
        confidence: 30,
        reason: "reschedule.reason.no_slots",
        reasonData: { days: opts.lookAheadDays },
        mergeTargetBlockId: null,
      });
    } else {
      warnings.push(`reschedule.warning.no_slot_for:${block.title}`);
    }
  }

  return { proposals, droppedBlocks, warnings, totalRescheduledMinutes };
}


// ── Find Best Reschedule for Single Block ─────────────────────────────────────

function findBestReschedule(
  block: ScheduleBlock,
  trigger: RescheduleTrigger,
  requiredMinutes: number,
  availableSlots: Array<FreeSlot & { date: string; slotScore: number }>,
  allBlocks: ScheduleBlock[],
  preferences: SchedulePreferences,
  patterns: StudyPatterns | null,
  opts: Required<RescheduleOptions>,
  warnings: string[],
): RescheduleProposal | null {

  // Strategy 1: Find a slot that fits the full duration
  for (const slot of availableSlots) {
    if (slot.duration_minutes >= requiredMinutes) {
      const moduleScore = patterns
        ? scoreSlotForTask(patterns, slot.slot_start, requiredMinutes, block.module_id)
        : 50;

      return {
        originalBlock: block,
        trigger,
        resolution: "rescheduled",
        newStart: slot.slot_start,
        newEnd: new Date(new Date(slot.slot_start).getTime() + requiredMinutes * 60000).toISOString(),
        newDuration: requiredMinutes,
        confidence: Math.min(90, moduleScore),
        reason: "reschedule.reason.moved_to_free_slot",
        reasonData: {
          date: slot.date,
          hour: new Date(slot.slot_start).getHours(),
          score: moduleScore,
        },
        mergeTargetBlockId: null,
      };
    }
  }

  // Strategy 2: Shorten the block to fit available slot
  if (opts.allowShorten) {
    const minDuration = Math.max(
      opts.minSlotMinutes,
      Math.ceil(requiredMinutes * opts.minShortenRatio)
    );

    for (const slot of availableSlots) {
      if (slot.duration_minutes >= minDuration) {
        const newDuration = Math.min(slot.duration_minutes, requiredMinutes);
        const moduleScore = patterns
          ? scoreSlotForTask(patterns, slot.slot_start, newDuration, block.module_id)
          : 45;

        return {
          originalBlock: block,
          trigger,
          resolution: "shortened",
          newStart: slot.slot_start,
          newEnd: new Date(new Date(slot.slot_start).getTime() + newDuration * 60000).toISOString(),
          newDuration,
          confidence: Math.min(75, moduleScore - 10),
          reason: "reschedule.reason.shortened_to_fit",
          reasonData: {
            originalDuration: requiredMinutes,
            newDuration,
            reduction: requiredMinutes - newDuration,
          },
          mergeTargetBlockId: null,
        };
      }
    }
  }

  // Strategy 3: Merge with an existing similar block
  if (opts.allowMerge && block.module_id) {
    const mergeTarget = allBlocks.find(b =>
      b.id !== block.id &&
      b.module_id === block.module_id &&
      b.layer === 2 &&
      b.status === "scheduled" &&
      new Date(b.start_time).getTime() > Date.now() &&
      getBlockDurationMinutes(b) + requiredMinutes <= preferences.max_study_block_minutes
    );

    if (mergeTarget) {
      const newDuration = getBlockDurationMinutes(mergeTarget) + requiredMinutes;
      return {
        originalBlock: block,
        trigger,
        resolution: "merged",
        newStart: mergeTarget.start_time,
        newEnd: new Date(new Date(mergeTarget.start_time).getTime() + newDuration * 60000).toISOString(),
        newDuration,
        confidence: 60,
        reason: "reschedule.reason.merged_with_similar",
        reasonData: {
          targetBlockId: mergeTarget.id,
          targetTitle: mergeTarget.title,
          combinedDuration: newDuration,
        },
        mergeTargetBlockId: mergeTarget.id,
      };
    }
  }

  return null;
}


// ── Detect Blocks Needing Reschedule ──────────────────────────────────────────

/**
 * Scan the schedule and identify blocks that need rescheduling.
 * Called periodically or after session completion.
 */
export function detectBlocksNeedingReschedule(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  preferences: SchedulePreferences,
  date: string,
): Array<{ block: ScheduleBlock; trigger: RescheduleTrigger }> {
  const results: Array<{ block: ScheduleBlock; trigger: RescheduleTrigger }> = [];
  const now = Date.now();
  const graceMs = 15 * 60000; // 15 min grace period

  const dayBlocks = blocks.filter(b =>
    b.layer === 2 &&
    b.start_time.slice(0, 10) === date &&
    b.status === "scheduled" &&
    isLearningBlock(b.block_type)
  );

  for (const block of dayBlocks) {
    const blockEnd = new Date(block.end_time).getTime();
    const blockStart = new Date(block.start_time).getTime();

    // Skip future blocks
    if (blockStart > now) continue;

    // Check if block was missed (end time + grace passed, no session)
    if (blockEnd + graceMs < now) {
      const hasSession = sessions.some(s =>
        s.schedule_block_id === block.id ||
        (s.module_id === block.module_id && block.module_id &&
         new Date(s.started_at).getTime() >= blockStart - 30 * 60000 &&
         new Date(s.started_at).getTime() <= blockEnd + 30 * 60000 &&
         s.status !== "abandoned")
      );

      if (!hasSession) {
        results.push({ block, trigger: "missed" });
        continue;
      }

      // Check if session was partial (< 50% of planned time)
      const matchingSessions = sessions.filter(s =>
        (s.schedule_block_id === block.id ||
         (s.module_id === block.module_id && block.module_id)) &&
        s.status === "completed"
      );
      const totalMinutes = matchingSessions.reduce((sum, s) => {
        const dur = s.effective_seconds ? s.effective_seconds / 60 : getSessionDuration(s);
        return sum + dur;
      }, 0);
      const planned = getBlockDurationMinutes(block);

      if (totalMinutes < planned * 0.5) {
        results.push({ block, trigger: "partial" });
      }
    }
  }

  // Check day overflow: total planned > max daily
  const totalPlanned = dayBlocks.reduce((sum, b) => sum + getBlockDurationMinutes(b), 0);
  if (totalPlanned > preferences.max_daily_study_minutes) {
    // Find lowest priority future blocks to reschedule
    const futureBlocks = dayBlocks
      .filter(b => new Date(b.start_time).getTime() > now)
      .sort((a, b) => {
        const pOrder = { critical: 0, high: 1, medium: 2, low: 3 };
        return (pOrder[b.priority] ?? 2) - (pOrder[a.priority] ?? 2); // Low priority first
      });

    let excess = totalPlanned - preferences.max_daily_study_minutes;
    for (const block of futureBlocks) {
      if (excess <= 0) break;
      results.push({ block, trigger: "day_overflow" });
      excess -= getBlockDurationMinutes(block);
    }
  }

  return results;
}


// ── Auto-Optimize Day ─────────────────────────────────────────────────────────

/**
 * Optimize remaining schedule for the day based on patterns.
 * Reorders future blocks to match user's energy curve and preferences.
 */
export function optimizeDaySchedule(
  blocks: ScheduleBlock[],
  sessions: TimerSession[],
  preferences: SchedulePreferences,
  patterns: StudyPatterns | null,
  date: string,
): RescheduleProposal[] {
  if (!patterns || patterns.dataQuality === "insufficient") return [];

  const now = Date.now();
  const futureBlocks = blocks.filter(b =>
    b.layer === 2 &&
    b.start_time.slice(0, 10) === date &&
    b.status === "scheduled" &&
    new Date(b.start_time).getTime() > now &&
    !b.is_locked
  );

  if (futureBlocks.length < 2) return []; // Nothing to optimize

  // Get free slots for the rest of the day
  const freeSlots = findFreeSlots(blocks, sessions, preferences, date, preferences.min_study_block_minutes)
    .filter(s => new Date(s.slot_start).getTime() > now);

  // Score each block-slot combination
  const proposals: RescheduleProposal[] = [];
  const usedSlots = new Set<string>();

  // Sort blocks by priority (high first)
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  const sortedBlocks = [...futureBlocks].sort((a, b) =>
    (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)
  );

  for (const block of sortedBlocks) {
    const duration = getBlockDurationMinutes(block);
    let bestSlot: typeof freeSlots[0] | null = null;
    let bestScore = -1;

    for (const slot of freeSlots) {
      if (usedSlots.has(slot.slot_start)) continue;
      if (slot.duration_minutes < duration) continue;

      const score = scoreSlotForTask(patterns, slot.slot_start, duration, block.module_id);
      if (score > bestScore) {
        bestScore = score;
        bestSlot = slot;
      }
    }

    if (bestSlot && bestScore > 50) {
      const currentScore = scoreSlotForTask(patterns, block.start_time, duration, block.module_id);

      // Only propose if improvement is significant (>10 points)
      if (bestScore > currentScore + 10) {
        proposals.push({
          originalBlock: block,
          trigger: "auto_optimize",
          resolution: "rescheduled",
          newStart: bestSlot.slot_start,
          newEnd: new Date(new Date(bestSlot.slot_start).getTime() + duration * 60000).toISOString(),
          newDuration: duration,
          confidence: Math.min(80, bestScore),
          reason: "reschedule.reason.optimized_timing",
          reasonData: {
            previousScore: currentScore,
            newScore: bestScore,
            improvement: bestScore - currentScore,
          },
          mergeTargetBlockId: null,
        });

        usedSlots.add(bestSlot.slot_start);
      }
    }
  }

  return proposals;
}


// ── Utility ───────────────────────────────────────────────────────────────────

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function getSessionDuration(session: TimerSession): number {
  if (session.ended_at) {
    return (new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 60000;
  }
  return 0;
}

function removeSlotCapacity(
  slots: Array<FreeSlot & { date: string; slotScore: number }>,
  usedStart: string,
  usedEnd: string,
): void {
  const uStart = new Date(usedStart).getTime();
  const uEnd = new Date(usedEnd).getTime();

  for (let i = slots.length - 1; i >= 0; i--) {
    const sStart = new Date(slots[i].slot_start).getTime();
    const sEnd = new Date(slots[i].slot_end).getTime();

    if (sStart >= uStart && sEnd <= uEnd) {
      // Fully consumed
      slots.splice(i, 1);
    } else if (sStart < uStart && sEnd > uEnd) {
      // Split: slot is larger than used portion
      const afterSlot = {
        ...slots[i],
        slot_start: usedEnd,
        slot_end: slots[i].slot_end,
        duration_minutes: Math.round((sEnd - uEnd) / 60000),
      };
      slots[i] = {
        ...slots[i],
        slot_end: usedStart,
        duration_minutes: Math.round((uStart - sStart) / 60000),
      };
      slots.splice(i + 1, 0, afterSlot);
    } else if (sStart >= uStart && sStart < uEnd) {
      // Trim start
      slots[i].slot_start = usedEnd;
      slots[i].duration_minutes = Math.round((sEnd - uEnd) / 60000);
    } else if (sEnd > uStart && sEnd <= uEnd) {
      // Trim end
      slots[i].slot_end = usedStart;
      slots[i].duration_minutes = Math.round((uStart - sStart) / 60000);
    }
  }

  // Remove tiny remnants
  for (let i = slots.length - 1; i >= 0; i--) {
    if (slots[i].duration_minutes < 10) slots.splice(i, 1);
  }
}
