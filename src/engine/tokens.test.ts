import { describe, expect, it } from "vitest";
import { TOKENS, tokenPool } from "./content/tokens.js";
import { DIFFICULTY_LABELS } from "./content/types.js";

describe("tokens", () => {
  it("defines non-empty tokens with known difficulties", () => {
    expect(TOKENS.length).toBeGreaterThan(0);
    for (const t of TOKENS) {
      expect(t.text.length).toBeGreaterThan(0);
      expect(DIFFICULTY_LABELS[t.difficulty]).toBeTruthy();
    }
  });

  it("filters by difficulty and returns all for mixed", () => {
    const easy = tokenPool("easy");
    expect(easy.length).toBeGreaterThan(0);
    expect(easy.every((text) => TOKENS.some((t) => t.text === text && t.difficulty === "easy"))).toBe(true);

    expect(tokenPool("mixed")).toHaveLength(TOKENS.length);
  });
});
