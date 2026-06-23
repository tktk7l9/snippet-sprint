// Pure statistics: WPM, accuracy, combo and per-character mistake tracking.
// Time is injected (ms timestamps) so the tracker is fully deterministic in tests.

export interface StatsSnapshot {
  /** Net words per minute, where a "word" is 5 correct characters. */
  readonly wpm: number;
  /** Accuracy in 0..1. */
  readonly accuracy: number;
  readonly combo: number;
  readonly maxCombo: number;
  readonly elapsedMs: number;
  readonly keystrokes: number;
  readonly mistakes: number;
}

export interface MissEntry {
  readonly char: string;
  readonly count: number;
}

/** Net WPM from correct characters over elapsed time. */
export function computeWpm(correctChars: number, elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  const minutes = elapsedMs / 60000;
  return Math.round(correctChars / 5 / minutes);
}

/** Accuracy as correct / total keystrokes (1 when nothing typed yet). */
export function computeAccuracy(keystrokes: number, mistakes: number): number {
  if (keystrokes <= 0) return 1;
  return (keystrokes - mistakes) / keystrokes;
}

export class StatsTracker {
  private startedAt: number | null = null;
  private endedAt: number | null = null;
  combo = 0;
  maxCombo = 0;
  keystrokes = 0;
  mistakes = 0;
  readonly missByChar = new Map<string, number>();

  /** Record a keystroke. `expected` is the intended character (for misses). */
  record(correct: boolean, expected: string, now: number): void {
    if (this.startedAt === null) this.startedAt = now;
    this.keystrokes++;
    if (correct) {
      this.combo++;
      if (this.combo > this.maxCombo) this.maxCombo = this.combo;
    } else {
      this.combo = 0;
      this.mistakes++;
      this.missByChar.set(expected, (this.missByChar.get(expected) ?? 0) + 1);
    }
  }

  /** Freeze the clock at completion. */
  finish(now: number): void {
    if (this.startedAt === null) this.startedAt = now;
    this.endedAt = now;
  }

  /** Push the start time forward, e.g. to exclude a paused interval. */
  shiftStart(ms: number): void {
    if (this.startedAt !== null) this.startedAt += ms;
  }

  elapsedMs(now: number): number {
    if (this.startedAt === null) return 0;
    return (this.endedAt ?? now) - this.startedAt;
  }

  snapshot(now: number): StatsSnapshot {
    const elapsedMs = this.elapsedMs(now);
    return {
      wpm: computeWpm(this.keystrokes - this.mistakes, elapsedMs),
      accuracy: computeAccuracy(this.keystrokes, this.mistakes),
      combo: this.combo,
      maxCombo: this.maxCombo,
      elapsedMs,
      keystrokes: this.keystrokes,
      mistakes: this.mistakes,
    };
  }

  /** Most-missed characters, highest first. */
  topMisses(limit = 6): MissEntry[] {
    return [...this.missByChar.entries()]
      .map(([char, count]) => ({ char, count }))
      .sort((a, b) => b.count - a.count || a.char.localeCompare(b.char))
      .slice(0, limit);
  }
}
