import { describe, expect, it } from "vitest";
import { availableCategories, availableDifficulties } from "./availability.js";
import type { Snippet } from "./content/types.js";

const pool: Snippet[] = [
  { id: "a", language: "ts", category: "basics", difficulty: "easy", label: "", description: "", code: "x" },
  { id: "b", language: "ts", category: "async", difficulty: "hard", label: "", description: "", code: "y" },
  { id: "c", language: "sql", category: "basics", difficulty: "medium", label: "", description: "", code: "z" },
  { id: "d", language: "drill", category: "drill", difficulty: "easy", label: "", description: "", code: "{}" },
];

describe("availableCategories", () => {
  it("lists categories that have at least one snippet for the languages", () => {
    expect([...availableCategories(["sql"], pool)]).toEqual(["basics"]);
    expect([...availableCategories(["ts", "sql"], pool)].sort()).toEqual(["async", "basics"]);
  });

  it("is empty for drill-only selections (drills have their own category)", () => {
    expect(availableCategories(["drill"], pool).has("basics")).toBe(false);
    expect(availableCategories(["drill"], pool).has("drill")).toBe(true);
  });

  it("uses the bundled snippets by default", () => {
    expect(availableCategories(["ts"]).has("basics")).toBe(true);
  });
});

describe("availableDifficulties", () => {
  it("lists difficulties for the languages across all categories", () => {
    expect([...availableDifficulties(["ts"], "all", pool)].sort()).toEqual(["easy", "hard"]);
  });

  it("narrows by category", () => {
    expect([...availableDifficulties(["ts"], "async", pool)]).toEqual(["hard"]);
    expect([...availableDifficulties(["ts", "sql"], "basics", pool)].sort()).toEqual(["easy", "medium"]);
  });

  it("is empty when the category has no snippet for the languages", () => {
    expect(availableDifficulties(["sql"], "async", pool).size).toBe(0);
  });

  it("uses the bundled snippets by default", () => {
    expect(availableDifficulties(["ts"], "all").size).toBeGreaterThan(0);
  });
});
