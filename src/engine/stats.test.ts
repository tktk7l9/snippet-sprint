import { describe, expect, it } from "vitest";
import { StatsTracker, computeAccuracy, computeWpm } from "./stats.js";

describe("computeWpm", () => {
  it("returns 0 for non-positive time", () => {
    expect(computeWpm(0, 0)).toBe(0);
    expect(computeWpm(100, -5)).toBe(0);
  });

  it("computes net words per minute (5 chars = 1 word)", () => {
    expect(computeWpm(25, 60000)).toBe(5);
    expect(computeWpm(50, 30000)).toBe(20);
  });
});

describe("computeAccuracy", () => {
  it("is 1 when nothing was typed", () => {
    expect(computeAccuracy(0, 0)).toBe(1);
  });

  it("is correct / total keystrokes", () => {
    expect(computeAccuracy(10, 2)).toBeCloseTo(0.8);
  });
});

describe("StatsTracker", () => {
  it("tracks combos, mistakes and elapsed time", () => {
    const t = new StatsTracker();
    expect(t.elapsedMs(1000)).toBe(0); // not started yet

    t.record(true, "a", 1000);
    t.record(true, "b", 1100);
    expect(t.combo).toBe(2);
    expect(t.maxCombo).toBe(2);

    t.record(false, "c", 1200);
    t.record(false, "c", 1300); // existing miss key increments
    expect(t.combo).toBe(0);
    expect(t.mistakes).toBe(2);
    expect(t.missByChar.get("c")).toBe(2);

    t.record(true, "d", 1400); // combo grows but stays under maxCombo
    expect(t.combo).toBe(1);
    expect(t.maxCombo).toBe(2);

    expect(t.elapsedMs(2000)).toBe(1000); // now - startedAt (not finished)

    const snap = t.snapshot(2000);
    expect(snap.keystrokes).toBe(5);
    expect(snap.mistakes).toBe(2);
    expect(snap.accuracy).toBeCloseTo(0.6);
    expect(snap.combo).toBe(1);
    expect(snap.maxCombo).toBe(2);
    expect(snap.elapsedMs).toBe(1000);
    expect(snap.wpm).toBe(computeWpm(3, 1000));
  });

  it("freezes elapsed time at finish", () => {
    const t = new StatsTracker();
    t.record(true, "a", 1000);
    t.finish(1500);
    expect(t.elapsedMs(9999)).toBe(500);
  });

  it("shiftStart excludes paused intervals (and no-ops before start)", () => {
    const idle = new StatsTracker();
    idle.shiftStart(100); // not started yet -> no effect
    expect(idle.elapsedMs(50)).toBe(0);

    const t = new StatsTracker();
    t.record(true, "a", 1000);
    t.shiftStart(500); // pretend 500ms were paused
    expect(t.elapsedMs(2000)).toBe(500);
  });

  it("starts the clock if finished before any keystroke", () => {
    const t = new StatsTracker();
    t.finish(500);
    expect(t.elapsedMs(700)).toBe(0);
  });

  it("ranks misses by count then alphabetically, honoring the limit", () => {
    const t = new StatsTracker();
    t.record(false, "b", 1);
    t.record(false, "a", 2);
    t.record(false, "a", 3);
    t.record(false, "z", 4);
    expect(t.topMisses()).toEqual([
      { char: "a", count: 2 },
      { char: "b", count: 1 },
      { char: "z", count: 1 },
    ]);
    expect(t.topMisses(1)).toEqual([{ char: "a", count: 2 }]);
  });
});
