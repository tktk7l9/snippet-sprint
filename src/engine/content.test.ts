import { describe, expect, it } from "vitest";
import { ALGORITHMS, CODE_SNIPPETS, DRILLS, SNIPPETS } from "./content/index.js";
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  LANGUAGE_LABELS,
  LANGUAGE_ORDER,
} from "./content/types.js";

describe("content", () => {
  it("combines code snippets, algorithms and drills", () => {
    expect(SNIPPETS).toHaveLength(CODE_SNIPPETS.length + ALGORITHMS.length + DRILLS.length);
    expect(SNIPPETS.length).toBeGreaterThan(0);
  });

  it("ships algorithm snippets tagged with the algo category", () => {
    expect(ALGORITHMS.length).toBeGreaterThan(0);
    for (const a of ALGORITHMS) expect(a.category).toBe("algo");
  });

  it("has unique ids", () => {
    const ids = SNIPPETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses normalized, non-empty code", () => {
    for (const s of SNIPPETS) {
      expect(s.code.length, s.id).toBeGreaterThan(0);
      expect(s.code.includes("\r"), s.id).toBe(false);
      expect(s.code.startsWith("\n"), s.id).toBe(false);
      expect(s.code.endsWith("\n"), s.id).toBe(false);
    }
  });

  it("gives every snippet a one-line description", () => {
    for (const s of SNIPPETS) {
      expect(s.description.length, s.id).toBeGreaterThan(0);
      expect(s.description.includes("\n"), s.id).toBe(false);
    }
  });

  it("tags every snippet with a known language, difficulty and category", () => {
    for (const s of SNIPPETS) {
      expect(LANGUAGE_ORDER, s.id).toContain(s.language);
      expect(LANGUAGE_LABELS[s.language], s.id).toBeTruthy();
      expect(DIFFICULTY_LABELS[s.difficulty], s.id).toBeTruthy();
      expect(CATEGORY_LABELS[s.category], s.id).toBeTruthy();
    }
  });

  it("keeps drills on a single line", () => {
    for (const d of DRILLS) {
      expect(d.code.includes("\n"), d.id).toBe(false);
      expect(d.language).toBe("drill");
    }
  });
});
