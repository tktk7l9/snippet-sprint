// Pure scoring + rank. Score rewards speed and combo, but accuracy dominates
// (squared), so sloppy fast typing is punished.

export type Rank = "S" | "A" | "B" | "C" | "D";

export interface ScoreInput {
  readonly wpm: number;
  readonly accuracy: number; // 0..1
  readonly maxCombo: number;
  readonly length: number; // snippet character count
}

export interface ScoreResult {
  readonly score: number;
  readonly rank: Rank;
}

/** Rank thresholds, best first. A rank needs both its WPM and accuracy floors. */
const RANK_FLOORS: readonly { rank: Rank; wpm: number; accuracy: number }[] = [
  { rank: "S", wpm: 60, accuracy: 0.98 },
  { rank: "A", wpm: 45, accuracy: 0.95 },
  { rank: "B", wpm: 30, accuracy: 0.9 },
  { rank: "C", wpm: 18, accuracy: 0.8 },
];

export function rankFor(wpm: number, accuracy: number): Rank {
  for (const f of RANK_FLOORS) {
    if (accuracy >= f.accuracy && wpm >= f.wpm) return f.rank;
  }
  return "D";
}

export interface RankGoal {
  readonly rank: Rank;
  readonly wpm: number;
  readonly accuracy: number;
}

/**
 * The rank one step above the current result and the floors it needs, so the
 * results screen can say what to aim for instead of just a letter (SHIG 55, 89).
 * Null at the top rank.
 */
export function nextRankGoal(wpm: number, accuracy: number): RankGoal | null {
  const current = rankFor(wpm, accuracy);
  const i = RANK_FLOORS.findIndex((f) => f.rank === current);
  // D is not in the table (index -1), so its next goal is the last entry (C).
  const next = i === -1 ? RANK_FLOORS[RANK_FLOORS.length - 1] : RANK_FLOORS[i - 1];
  return next ? { rank: next.rank, wpm: next.wpm, accuracy: next.accuracy } : null;
}

export function computeScore(input: ScoreInput): ScoreResult {
  const base = Math.max(0, input.length) * 10;
  const speed = 1 + Math.max(0, input.wpm) / 60;
  const acc = Math.max(0, Math.min(1, input.accuracy)) ** 2;
  const combo = 1 + Math.max(0, input.maxCombo) / 100;
  const score = Math.round(base * speed * acc * combo);
  return { score, rank: rankFor(input.wpm, input.accuracy) };
}
