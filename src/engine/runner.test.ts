import { describe, expect, it } from "vitest";
import { RunnerGame } from "./runner.js";

function lines(...arr: string[]): () => string {
  let i = 0;
  return () => arr[i++ % arr.length];
}

describe("RunnerGame", () => {
  it("accelerates on correct keys and advances to the next line", () => {
    const g = new RunnerGame({ nextLine: lines("ab", "cd") });
    expect(g.speed).toBe(8);

    const r1 = g.input("a");
    expect(r1).toEqual({ correct: true, expected: "a", lineComplete: false });
    expect(g.speed).toBeCloseTo(11.5);

    const r2 = g.input("b");
    expect(r2.lineComplete).toBe(true);
    expect(g.speed).toBeCloseTo(23); // +BOOST then +LINE_BONUS
    expect(g.session.target).toBe("cd");
  });

  it("brakes and fills the crash meter on mistakes, ending at full", () => {
    const g = new RunnerGame({ nextLine: lines("ab") });

    const wrong = g.input("z");
    expect(wrong.correct).toBe(false);
    expect(g.speed).toBeCloseTo(4.4); // max(4, 8 * 0.55)
    expect(g.crash).toBeCloseTo(0.14);
    expect(g.gameOver).toBe(false);

    for (let i = 0; i < 7; i++) g.input("z"); // push crash to 1
    expect(g.gameOver).toBe(true);

    // no more response after game over
    expect(g.input("a")).toEqual({ correct: false, expected: "", lineComplete: false });
  });

  it("accumulates distance and applies friction on tick", () => {
    const g = new RunnerGame({ nextLine: lines("ab") });
    g.tick(1);
    expect(g.distance).toBe(8);
    expect(g.speed).toBe(4); // max(4, 8 - 6)
    expect(g.crash).toBe(0);

    g.gameOver = true;
    g.tick(1);
    expect(g.distance).toBe(8); // frozen after game over
  });

  it("supports backspace on the current line", () => {
    const g = new RunnerGame({ nextLine: lines("ab") });
    g.input("a");
    g.backspace();
    expect(g.session.index).toBe(0);
  });
});
