import { describe, expect, it } from "vitest";
import { computeScore, nextRankGoal, rankFor } from "./scoring.js";

describe("rankFor", () => {
  it("maps speed + accuracy onto S..D", () => {
    expect(rankFor(70, 0.99)).toBe("S");
    expect(rankFor(50, 0.96)).toBe("A");
    expect(rankFor(35, 0.92)).toBe("B");
    expect(rankFor(20, 0.85)).toBe("C");
    expect(rankFor(10, 0.7)).toBe("D");
    // fast but sloppy drops below S
    expect(rankFor(90, 0.9)).toBe("B");
  });
});

describe("computeScore", () => {
  it("rewards speed and combo, scaled by accuracy squared", () => {
    const { score, rank } = computeScore({
      wpm: 60,
      accuracy: 1,
      maxCombo: 100,
      length: 50,
    });
    // base 500 * speed 2 * acc 1 * combo 2 = 2000
    expect(score).toBe(2000);
    expect(rank).toBe("S");
  });

  it("clamps out-of-range inputs", () => {
    const { score } = computeScore({
      wpm: -10,
      accuracy: 2,
      maxCombo: -5,
      length: -3,
    });
    // length clamps to 0 -> base 0 -> score 0
    expect(score).toBe(0);
  });

  it("penalizes low accuracy", () => {
    const clean = computeScore({ wpm: 40, accuracy: 1, maxCombo: 0, length: 20 });
    const sloppy = computeScore({ wpm: 40, accuracy: 0.5, maxCombo: 0, length: 20 });
    expect(sloppy.score).toBeLessThan(clean.score);
  });
});

describe("nextRankGoal", () => {
  it("names the next rank and the thresholds still to reach (SHIG 55, 89)", () => {
    expect(nextRankGoal(10, 0.7)).toEqual({ rank: "C", wpm: 18, accuracy: 0.8 });
    expect(nextRankGoal(20, 0.85)).toEqual({ rank: "B", wpm: 30, accuracy: 0.9 });
    expect(nextRankGoal(35, 0.92)).toEqual({ rank: "A", wpm: 45, accuracy: 0.95 });
    expect(nextRankGoal(50, 0.96)).toEqual({ rank: "S", wpm: 60, accuracy: 0.98 });
  });

  it("returns null at the top rank", () => {
    expect(nextRankGoal(70, 0.99)).toBeNull();
  });

  it("targets the rank right above the current one even when one metric already qualifies", () => {
    // 90 WPM but 90% accuracy is a B; the next goal is A, not S.
    expect(nextRankGoal(90, 0.9)).toEqual({ rank: "A", wpm: 45, accuracy: 0.95 });
  });
});
