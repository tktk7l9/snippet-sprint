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

export function rankFor(wpm: number, accuracy: number): Rank {
  if (accuracy >= 0.98 && wpm >= 60) return "S";
  if (accuracy >= 0.95 && wpm >= 45) return "A";
  if (accuracy >= 0.9 && wpm >= 30) return "B";
  if (accuracy >= 0.8 && wpm >= 18) return "C";
  return "D";
}

export interface RankTiers {
  readonly S: number;
  readonly A: number;
  readonly B: number;
  readonly C: number;
}

/** Map a single score-like value onto S..D using per-mode thresholds. */
export function rankByThresholds(value: number, tiers: RankTiers): Rank {
  if (value >= tiers.S) return "S";
  if (value >= tiers.A) return "A";
  if (value >= tiers.B) return "B";
  if (value >= tiers.C) return "C";
  return "D";
}

export function computeScore(input: ScoreInput): ScoreResult {
  const base = Math.max(0, input.length) * 10;
  const speed = 1 + Math.max(0, input.wpm) / 60;
  const acc = Math.max(0, Math.min(1, input.accuracy)) ** 2;
  const combo = 1 + Math.max(0, input.maxCombo) / 100;
  const score = Math.round(base * speed * acc * combo);
  return { score, rank: rankFor(input.wpm, input.accuracy) };
}
