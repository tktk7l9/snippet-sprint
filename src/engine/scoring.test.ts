import { describe, expect, it } from "vitest";
import { computeScore, rankByThresholds, rankFor } from "./scoring.js";

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

describe("rankByThresholds", () => {
  const tiers = { S: 1000, A: 600, B: 300, C: 100 };
  it("maps a value onto S..D by threshold", () => {
    expect(rankByThresholds(1200, tiers)).toBe("S");
    expect(rankByThresholds(700, tiers)).toBe("A");
    expect(rankByThresholds(400, tiers)).toBe("B");
    expect(rankByThresholds(150, tiers)).toBe("C");
    expect(rankByThresholds(50, tiers)).toBe("D");
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
