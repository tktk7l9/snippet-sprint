// Which start-screen filters can actually be satisfied for the chosen
// languages. The picker disables the rest so users see up front what exists
// instead of being silently served a different category (SHIG 13, 32).
// `pool` is the loaded snippets of those languages (content/index.ts).

import type { Category, Difficulty, Language, Snippet } from "./content/types.js";

export function availableCategories(
  languages: readonly Language[],
  pool: readonly Snippet[],
): Set<Category> {
  const out = new Set<Category>();
  for (const s of pool) if (languages.includes(s.language)) out.add(s.category);
  return out;
}

export function availableDifficulties(
  languages: readonly Language[],
  category: Category | "all",
  pool: readonly Snippet[],
): Set<Difficulty> {
  const out = new Set<Difficulty>();
  for (const s of pool) {
    if (!languages.includes(s.language)) continue;
    if (category !== "all" && s.category !== category) continue;
    out.add(s.difficulty);
  }
  return out;
}
