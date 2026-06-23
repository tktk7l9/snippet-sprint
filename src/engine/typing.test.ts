import { describe, expect, it } from "vitest";
import { TypingSession } from "./typing.js";

describe("TypingSession", () => {
  it("advances on correct input and flags mistakes", () => {
    const s = new TypingSession("ab");
    expect(s.index).toBe(0);
    expect(s.hasError).toBe(false);
    expect(s.isComplete()).toBe(false);
    expect(s.progress).toBe(0);

    const r1 = s.input("a");
    expect(r1).toEqual({ correct: true, completed: false, expected: "a", advanced: 1 });
    expect(s.index).toBe(1);
    expect(s.cells[0].status).toBe("correct");

    const wrong = s.input("x");
    expect(wrong).toEqual({ correct: false, completed: false, expected: "b", advanced: 0 });
    expect(s.hasError).toBe(true);
    expect(s.mistakes).toBe(1);
    expect(s.index).toBe(1);

    const r2 = s.input("b");
    expect(r2.correct).toBe(true);
    expect(r2.completed).toBe(true);
    expect(s.isComplete()).toBe(true);
    expect(s.progress).toBe(1);
    expect(s.keystrokes).toBe(3);
  });

  it("reports fractional progress mid-snippet", () => {
    const s = new TypingSession("abcd");
    s.input("a");
    expect(s.progress).toBe(0.25);
  });

  it("ignores input once complete", () => {
    const s = new TypingSession("a");
    s.input("a");
    const after = s.input("z");
    expect(after).toEqual({ correct: false, completed: true, expected: "", advanced: 0 });
  });

  it("auto-skips space indentation after a newline", () => {
    const s = new TypingSession("a\n  b");
    s.input("a");
    const nl = s.input("\n");
    expect(nl.correct).toBe(true);
    expect(nl.advanced).toBe(3); // newline + two skipped spaces
    expect(s.index).toBe(4);
    expect(s.cells[2].auto).toBe(true);
    expect(s.cells[2].status).toBe("correct");
    expect(s.input("b").completed).toBe(true);
  });

  it("auto-skips tab indentation after a newline", () => {
    const s = new TypingSession("a\n\tb");
    s.input("a");
    const nl = s.input("\n");
    expect(nl.advanced).toBe(2);
    expect(s.cells[2].char).toBe("\t");
    expect(s.cells[2].auto).toBe(true);
  });

  it("can complete by skipping trailing indentation", () => {
    const s = new TypingSession("a\n  ");
    s.input("a");
    const nl = s.input("\n");
    expect(nl.completed).toBe(true);
    expect(nl.advanced).toBe(3);
    expect(s.isComplete()).toBe(true);
  });

  it("backspaces a settled cell and clears the error flag", () => {
    const s = new TypingSession("ab");
    s.input("a");
    s.input("y"); // wrong -> errored
    expect(s.hasError).toBe(true);
    expect(s.backspace()).toBe(true);
    expect(s.index).toBe(0);
    expect(s.cells[0].status).toBe("pending");
    expect(s.cells[0].auto).toBe(false);
    expect(s.hasError).toBe(false);
  });

  it("returns false when backspacing at the start", () => {
    const s = new TypingSession("ab");
    s.input("x"); // wrong, still at index 0
    expect(s.backspace()).toBe(false);
    expect(s.hasError).toBe(false);
  });

  it("handles an empty target", () => {
    const s = new TypingSession("");
    expect(s.cells).toHaveLength(0);
    expect(s.isComplete()).toBe(true);
    expect(s.progress).toBe(1);
    expect(s.input("x").completed).toBe(true);
    expect(s.backspace()).toBe(false);
  });
});
