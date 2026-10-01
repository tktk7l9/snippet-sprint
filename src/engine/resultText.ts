// Result-screen copy derived from a finished run. Pure so the wording is tested.

import type { BestRecord } from "./records.js";
import { nextRankGoal } from "./scoring.js";

const pct = (ratio: number): number => Math.round(ratio * 100);

/**
 * Constructive next step instead of a bare letter (SHIG 55, 89). Only the
 * floors the run still misses are named, so a fast but sloppy run is told to
 * work on accuracy rather than shown a WPM it already beat.
 */
export function goalLine(wpm: number, accuracy: number): string {
  const goal = nextRankGoal(wpm, accuracy);
  if (!goal) return "最高ランクです";
  const needs: string[] = [];
  if (wpm < goal.wpm) needs.push(`WPM ${goal.wpm} 以上`);
  if (accuracy < goal.accuracy) needs.push(`正確率 ${pct(goal.accuracy)}% 以上`);
  return `次のランク ${goal.rank} まで: ${needs.join(" · ")}`;
}

export interface BestContext {
  readonly best: BestRecord | null;
  readonly improved: boolean;
  readonly previous: BestRecord | null;
  readonly score: number;
}

/** Best-record line: what this run was measured against, not a copy of its own numbers (SHIG 28). */
export function bestLine(data: BestContext): string {
  if (data.improved) {
    if (!data.previous) return "初クリア · ベストとして記録";
    return `前回ベスト ${data.previous.score}pt → ${data.score}pt`;
  }
  if (!data.best) return "";
  return `BEST · WPM ${data.best.wpm} · ${pct(data.best.accuracy)}% · ${data.best.score}pt`;
}
