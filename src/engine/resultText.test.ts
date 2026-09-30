import { describe, expect, it } from "vitest";
import { bestLine, goalLine } from "./resultText.js";
import type { BestRecord } from "./records.js";

const rec = (score: number): BestRecord => ({ wpm: 40, accuracy: 0.93, score, rank: "B" });

describe("goalLine", () => {
  it("names both floors when neither is met", () => {
    expect(goalLine(10, 0.7)).toBe("次のランク C まで: WPM 18 以上 · 正確率 80% 以上");
  });

  it("names only the accuracy floor when the run was already fast enough (SHIG 55)", () => {
    expect(goalLine(90, 0.9)).toBe("次のランク A まで: 正確率 95% 以上");
  });

  it("names only the WPM floor when the run was already accurate enough", () => {
    expect(goalLine(20, 0.99)).toBe("次のランク B まで: WPM 30 以上");
  });

  it("says so at the top rank", () => {
    expect(goalLine(70, 0.99)).toBe("最高ランクです");
  });
});

describe("bestLine", () => {
  it("calls a first clear a first clear", () => {
    expect(bestLine({ best: rec(100), improved: true, previous: null, score: 100 })).toBe("初クリア · ベストとして記録");
  });

  it("shows the beaten record on a new best (SHIG 28)", () => {
    expect(bestLine({ best: rec(200), improved: true, previous: rec(100), score: 200 })).toBe("前回ベスト 100pt → 200pt");
  });

  it("shows the standing best when the run did not beat it", () => {
    expect(bestLine({ best: rec(300), improved: false, previous: rec(300), score: 50 })).toBe("BEST · WPM 40 · 93% · 300pt");
  });

  it("is empty without any record", () => {
    expect(bestLine({ best: null, improved: false, previous: null, score: 0 })).toBe("");
  });
});
