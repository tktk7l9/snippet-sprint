// Snippet selection. Filters are "soft": each filter narrows the pool but never
// empties it (it falls back to the wider set), so a play session is always served.

import { SNIPPETS } from "./content/index.js";
import type { Category, Difficulty, Language, Snippet } from "./content/types.js";

export interface SelectOptions {
  /** Languages to draw from. Empty falls back to all. */
  readonly languages: Language[];
  readonly difficulty: Difficulty | "mixed";
  readonly category: Category | "all";
  /** Avoid returning this id when alternatives exist. */
  readonly excludeId?: string;
  /** Injectable RNG for deterministic tests. Defaults to Math.random. */
  readonly rng?: () => number;
}

export function selectSnippet(
  opts: SelectOptions,
  pool: Snippet[] = SNIPPETS,
): Snippet {
  const rng = opts.rng ?? Math.random;

  let candidates = pool.filter((s) => opts.languages.includes(s.language));
  if (candidates.length === 0) candidates = pool.slice();

  if (opts.difficulty !== "mixed") {
    const byDiff = candidates.filter((s) => s.difficulty === opts.difficulty);
    if (byDiff.length > 0) candidates = byDiff;
  }

  if (opts.category !== "all") {
    const byCat = candidates.filter((s) => s.category === opts.category);
    if (byCat.length > 0) candidates = byCat;
  }

  if (opts.excludeId && candidates.length > 1) {
    const withoutLast = candidates.filter((s) => s.id !== opts.excludeId);
    if (withoutLast.length > 0) candidates = withoutLast;
  }

  const i = Math.floor(rng() * candidates.length);
  return candidates[i] ?? candidates[0];
}
