import { describe, expect, it } from "vitest";
import { selectSnippet } from "./select.js";
import type { Snippet } from "./content/types.js";

const pool: Snippet[] = [
  { id: "a", language: "ts", category: "basics", difficulty: "easy", label: "", description: "", code:"x" },
  { id: "b", language: "ts", category: "functions", difficulty: "hard", label: "", description: "", code:"y" },
  { id: "c", language: "py", category: "basics", difficulty: "easy", label: "", description: "", code:"z" },
];

const first = () => 0;

describe("selectSnippet", () => {
  it("filters by language", () => {
    const s = selectSnippet({ languages: ["ts"], difficulty: "mixed", category: "all", rng: first }, pool);
    expect(s.id).toBe("a");
  });

  it("falls back to the full pool when no language matches", () => {
    const s = selectSnippet({ languages: ["go"], difficulty: "mixed", category: "all", rng: first }, pool);
    expect(s.id).toBe("a");
  });

  it("applies a difficulty filter when it yields results", () => {
    const s = selectSnippet({ languages: ["ts"], difficulty: "hard", category: "all", rng: first }, pool);
    expect(s.id).toBe("b");
  });

  it("keeps the pool when the difficulty filter is empty", () => {
    const s = selectSnippet({ languages: ["py"], difficulty: "hard", category: "all", rng: first }, pool);
    expect(s.id).toBe("c"); // py has no "hard", so difficulty is ignored
  });

  it("applies a category filter when it yields results", () => {
    const s = selectSnippet({ languages: ["ts"], difficulty: "mixed", category: "functions", rng: first }, pool);
    expect(s.id).toBe("b");
  });

  it("keeps the pool when the category filter is empty", () => {
    const s = selectSnippet({ languages: ["ts"], difficulty: "mixed", category: "async", rng: first }, pool);
    expect(s.id).toBe("a");
  });

  it("excludes the previous id when alternatives exist", () => {
    const s = selectSnippet({ languages: ["ts"], difficulty: "mixed", category: "all", excludeId: "a", rng: first }, pool);
    expect(s.id).toBe("b");
  });

  it("ignores excludeId when only one candidate remains", () => {
    const s = selectSnippet({ languages: ["py"], difficulty: "mixed", category: "all", excludeId: "c", rng: first }, pool);
    expect(s.id).toBe("c");
  });

  it("keeps candidates when excludeId would empty them", () => {
    const dup: Snippet[] = [
      { id: "same", language: "ts", category: "basics", difficulty: "easy", label: "", description: "", code:"1" },
      { id: "same", language: "ts", category: "basics", difficulty: "easy", label: "", description: "", code:"2" },
    ];
    const s = selectSnippet({ languages: ["ts"], difficulty: "mixed", category: "all", excludeId: "same", rng: first }, dup);
    expect(s.id).toBe("same");
  });

  it("guards against rng returning 1", () => {
    const s = selectSnippet({ languages: ["ts"], difficulty: "mixed", category: "all", rng: () => 1 }, pool);
    expect(s.id).toBe("a"); // index out of range -> fallback to first candidate
  });

  it("uses the bundled snippets and Math.random by default", () => {
    const s = selectSnippet({ languages: ["ts"], difficulty: "mixed", category: "all" });
    expect(s.language).toBe("ts");
  });
});
