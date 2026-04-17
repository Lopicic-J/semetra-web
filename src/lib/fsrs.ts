/**
 * FSRS — Free Spaced Repetition Scheduler
 *
 * Implementation of the FSRS-4.5 algorithm for optimal review scheduling.
 * Based on the open-source FSRS algorithm by Jarrett Ye.
 *
 * Core concepts:
 * - Stability (S): Time (days) until recall probability drops to 90%
 * - Difficulty (D): Card difficulty on 0-10 scale
 * - Retrievability (R): Current recall probability based on elapsed time
 *
 * Rating scale: 1=Again, 2=Hard, 3=Good, 4=Easy
 */

// ─── Types ──────────────────────────────────────────────────────

export type Rating = 1 | 2 | 3 | 4;
export type CardState = "new" | "learning" | "review" | "relearning";

export interface FSRSCard {
  /** Days until recall probability drops to 90% */
  stability: number;
  /** Card difficulty (0-10) */
  difficulty: number;
  /** Days since last review */
  elapsedDays: number;
  /** Scheduled interval in days */
  scheduledDays: number;
  /** Number of reviews completed */
  reps: number;
  /** Number of lapses (rating=1 after review state) */
  lapses: number;
  /** Current card state */
  state: CardState;
  /** Last review date (ISO string) */
  lastReview: string | null;
}

export interface SchedulingResult {
  /** Updated card state */
  card: FSRSCard;
  /** Next review date (ISO string) */
  nextReview: string;
  /** Scheduled interval in days */
  interval: number;
}

// ─── FSRS Parameters (v4.5 defaults) ───────────────────────────

const PARAMS = {
  // Initial stability for each rating when card is new
  w: [
    0.4, 0.6, 2.4, 5.8,  // w[0-3]: initial stability for rating 1-4
    4.93, 0.94, 0.86, 0.01, // w[4-7]: difficulty params
    1.49, 0.14, 0.94,       // w[8-10]: stability after success
    2.18, 0.05, 0.34, 1.26, // w[11-14]: stability after failure
    0.29, 2.61,              // w[15-16]: additional modifiers
  ],
  requestRetention: 0.9,     // Target retention rate (90%)
  maximumInterval: 365,       // Max interval in days
};

// ─── Core Algorithm ─────────────────────────────────────────────

/**
 * Create a new card with default values.
 */
export function createNewCard(): FSRSCard {
  return {
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    reps: 0,
    lapses: 0,
    state: "new",
    lastReview: null,
  };
}

/**
 * Calculate retrievability (recall probability) for a card.
 * R = e^(-t/S * ln(requested_retention) / ln(0.9))
 * Simplified when requestRetention = 0.9: R = (1 + t/(9*S))^(-1)
 */
export function getRetrievability(card: FSRSCard, elapsedDays?: number): number {
  if (card.state === "new" || card.stability <= 0) return 0;
  const t = elapsedDays ?? card.elapsedDays;
  return Math.pow(1 + t / (9 * card.stability), -1);
}

/**
 * Schedule a review for a card with a given rating.
 * This is the main entry point for the FSRS algorithm.
 */
export function reviewCard(card: FSRSCard, rating: Rating, now?: Date): SchedulingResult {
  const reviewDate = now ?? new Date();
  const elapsed = card.lastReview
    ? Math.max(0, (reviewDate.getTime() - new Date(card.lastReview).getTime()) / 86400000)
    : 0;

  let newCard: FSRSCard;

  if (card.state === "new") {
    newCard = handleNewCard(card, rating);
  } else {
    newCard = handleReviewCard(card, rating, elapsed);
  }

  // Calculate interval from new stability
  const interval = calculateInterval(newCard.stability);
  newCard.scheduledDays = interval;
  newCard.elapsedDays = 0;
  newCard.reps = card.reps + 1;
  newCard.lastReview = reviewDate.toISOString();

  // Calculate next review date
  const nextReview = new Date(reviewDate);
  nextReview.setDate(nextReview.getDate() + interval);

  return {
    card: newCard,
    nextReview: nextReview.toISOString(),
    interval,
  };
}

// ─── Internal Functions ─────────────────────────────────────────

function handleNewCard(card: FSRSCard, rating: Rating): FSRSCard {
  const w = PARAMS.w;
  const initialStability = w[rating - 1]; // w[0-3]
  const initialDifficulty = clampDifficulty(
    w[4] - (rating - 3) * w[5]
  );

  return {
    ...card,
    stability: initialStability,
    difficulty: initialDifficulty,
    state: rating === 1 ? "learning" : "review",
    lapses: rating === 1 ? card.lapses + 1 : card.lapses,
  };
}

function handleReviewCard(card: FSRSCard, rating: Rating, elapsed: number): FSRSCard {
  const w = PARAMS.w;
  const retrievability = getRetrievability(card, elapsed);

  // Update difficulty
  const newDifficulty = clampDifficulty(
    card.difficulty - w[6] * (rating - 3)
  );

  let newStability: number;
  let newState: CardState;
  let lapses = card.lapses;

  if (rating === 1) {
    // Failed review → relearning
    newStability = computeStabilityAfterFailure(card.difficulty, card.stability, retrievability);
    newState = "relearning";
    lapses += 1;
  } else {
    // Successful review
    newStability = computeStabilityAfterSuccess(
      card.difficulty, card.stability, retrievability, rating
    );
    newState = "review";
  }

  return {
    ...card,
    stability: newStability,
    difficulty: newDifficulty,
    state: newState,
    lapses,
  };
}

/**
 * Stability after successful review.
 * S' = S * (1 + e^(w[8]) * (11-D) * S^(-w[9]) * (e^(w[10]*(1-R)) - 1) * hardPenalty * easyBonus)
 */
function computeStabilityAfterSuccess(
  D: number, S: number, R: number, rating: Rating
): number {
  const w = PARAMS.w;
  const hardPenalty = rating === 2 ? w[15] : 1;
  const easyBonus = rating === 4 ? w[16] : 1;

  const newS = S * (1 +
    Math.exp(w[8]) *
    (11 - D) *
    Math.pow(S, -w[9]) *
    (Math.exp(w[10] * (1 - R)) - 1) *
    hardPenalty *
    easyBonus
  );

  return Math.max(0.1, newS);
}

/**
 * Stability after failed review (lapse).
 * S' = w[11] * D^(-w[12]) * ((S+1)^w[13] - 1) * e^(w[14]*(1-R))
 */
function computeStabilityAfterFailure(
  D: number, S: number, R: number
): number {
  const w = PARAMS.w;
  const newS = w[11] *
    Math.pow(D, -w[12]) *
    (Math.pow(S + 1, w[13]) - 1) *
    Math.exp(w[14] * (1 - R));

  return Math.max(0.1, Math.min(newS, S)); // Never increase stability after failure
}

/**
 * Calculate review interval from stability.
 * I = S * 9 * (1/R - 1) where R = requestRetention
 * When R = 0.9: I = S * 9 * (1/0.9 - 1) = S * 9 * 0.111... = S
 * So interval ≈ stability in days (at 90% retention)
 */
function calculateInterval(stability: number): number {
  const interval = Math.round(
    stability * 9 * (1 / PARAMS.requestRetention - 1)
  );
  return Math.max(1, Math.min(PARAMS.maximumInterval, interval));
}

function clampDifficulty(d: number): number {
  return Math.max(1, Math.min(10, Math.round(d * 100) / 100));
}

// ─── Utility Functions ──────────────────────────────────────────

/**
 * Check if a card is due for review.
 */
export function isDue(card: FSRSCard, now?: Date): boolean {
  if (card.state === "new") return true;
  if (!card.lastReview) return true;
  const reviewDate = now ?? new Date();
  const lastReview = new Date(card.lastReview);
  const elapsed = (reviewDate.getTime() - lastReview.getTime()) / 86400000;
  return elapsed >= card.scheduledDays;
}

/**
 * Get scheduling info for all 4 possible ratings.
 * Useful for showing the user what each button will do.
 */
export function getSchedulingOptions(card: FSRSCard, now?: Date): Record<Rating, { interval: number; nextReview: string }> {
  const ratings: Rating[] = [1, 2, 3, 4];
  const result = {} as Record<Rating, { interval: number; nextReview: string }>;

  for (const rating of ratings) {
    const { interval, nextReview } = reviewCard(card, rating, now);
    result[rating] = { interval, nextReview };
  }

  return result;
}

/**
 * Convert legacy SRS data to FSRS card.
 * Used for migrating existing flashcards to the new algorithm.
 */
export function migrateFromLegacy(params: {
  nextReview: string | null;
  repetitions?: number;
  interval?: number;
}): FSRSCard {
  const card = createNewCard();

  if (!params.nextReview) return card;

  // Estimate stability from existing interval
  const interval = params.interval ?? 1;
  card.stability = Math.max(0.4, interval);
  card.difficulty = 5; // Default medium difficulty
  card.reps = params.repetitions ?? 0;
  card.state = card.reps > 0 ? "review" : "new";
  card.scheduledDays = interval;
  card.lastReview = new Date().toISOString();

  return card;
}
