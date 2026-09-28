// Remembers the last start-screen selection so a returning player does not
// have to pick the same languages again (SHIG 42, 12). Stored values are
// validated field by field; anything unknown falls back to the default.

import {
  CATEGORY_ORDER,
  DIFFICULTY_ORDER,
  LANGUAGE_ORDER,
  type Category,
  type Difficulty,
  type Language,
} from "./content/types.js";
import type { RecordStore } from "./records.js";

export interface Prefs {
  languages: Language[];
  category: Category | "all";
  difficulty: Difficulty | "mixed";
}

const KEY = "snippet-sprint:prefs:v1";

export const DEFAULT_PREFS: Readonly<Prefs> = Object.freeze({
  languages: ["ts"] as Language[],
  category: "all",
  difficulty: "mixed",
});

function defaults(): Prefs {
  return { ...DEFAULT_PREFS, languages: [...DEFAULT_PREFS.languages] };
}

export function loadPrefs(store: RecordStore): Prefs {
  const out = defaults();
  let parsed: unknown;
  try {
    parsed = JSON.parse(store.getItem(KEY) ?? "null");
  } catch {
    return out;
  }
  if (!parsed || typeof parsed !== "object") return out;
  const raw = parsed as Record<string, unknown>;

  if (Array.isArray(raw.languages)) {
    const langs = [
      ...new Set(raw.languages.filter((l): l is Language => LANGUAGE_ORDER.includes(l as Language))),
    ];
    if (langs.length > 0) out.languages = langs;
  }
  if (CATEGORY_ORDER.includes(raw.category as Category)) out.category = raw.category as Category;
  if (DIFFICULTY_ORDER.includes(raw.difficulty as Difficulty)) {
    out.difficulty = raw.difficulty as Difficulty;
  }
  return out;
}

export function savePrefs(store: RecordStore, prefs: Prefs): void {
  store.setItem(KEY, JSON.stringify(prefs));
}
