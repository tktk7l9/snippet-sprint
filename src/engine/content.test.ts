import { beforeAll, describe, expect, it } from "vitest";
import html from "../../index.html?raw";
import readme from "../../README.md?raw";
import { isLoaded, loadAll, loadLanguage, loadLanguages, poolFor, warmAll } from "./content/index.js";
import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  LANGUAGE_LABELS,
  LANGUAGE_ORDER,
  type Language,
  type Snippet,
} from "./content/types.js";

let SNIPPETS: Snippet[] = [];
const byLanguage = new Map<Language, Snippet[]>();

beforeAll(async () => {
  SNIPPETS = await loadAll();
  for (const lang of LANGUAGE_ORDER) byLanguage.set(lang, await loadLanguage(lang));
});

describe("loader", () => {
  it("serves a language from its own module, cached after the first load", async () => {
    const first = await loadLanguage("ts");
    expect(first.length).toBeGreaterThan(0);
    expect(await loadLanguage("ts")).toBe(first);
    expect(isLoaded(["ts", "py"])).toBe(true);
  });

  it("combines the chosen languages in start-screen order, whatever order they were picked in", async () => {
    const pool = await loadLanguages(["py", "ts"]);
    expect(pool).toEqual([...byLanguage.get("ts")!, ...byLanguage.get("py")!]);
    expect(poolFor(["py", "ts"])).toEqual(pool);
    expect(poolFor([])).toEqual([]);
  });

  it("loadAll covers every language and warmAll is a no-op once everything is in", async () => {
    expect(SNIPPETS).toHaveLength([...byLanguage.values()].reduce((n, xs) => n + xs.length, 0));
    await warmAll();
    expect(isLoaded(LANGUAGE_ORDER)).toBe(true);
  });
});

describe("content", () => {
  it("files every snippet under the module of its own language", () => {
    for (const [lang, list] of byLanguage) {
      expect(list.length, lang).toBeGreaterThan(0);
      for (const s of list) expect(s.language, s.id).toBe(lang);
    }
  });

  it("has unique ids", () => {
    const ids = SNIPPETS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never ends with whitespace (the final keystroke must not be a Space or Enter)", () => {
    // The results screen focuses NEXT; a trailing Space would activate it on keyup.
    for (const s of SNIPPETS) expect(/\s$/.test(s.code), s.id).toBe(false);
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

  it("uses only printable ASCII and newlines so every character is on a plain keyboard", () => {
    for (const s of SNIPPETS) expect(/^[\x20-\x7e\n]*$/.test(s.code), s.id).toBe(true);
  });

  it("has no tabs, trailing spaces or blank lines (indentation is auto-skipped per line)", () => {
    for (const s of SNIPPETS) {
      expect(s.code.includes("\t"), s.id).toBe(false);
      expect(/[ ]+\n/.test(s.code), s.id).toBe(false);
      expect(s.code.includes("\n\n"), s.id).toBe(false);
    }
  });

  it("keeps every line short enough to fit the code panel without wrapping on desktop", () => {
    for (const s of SNIPPETS) {
      for (const line of s.code.split("\n")) expect(line.length, s.id).toBeLessThanOrEqual(80);
    }
  });

  it("keeps drills single-line and the only snippets in the drill category", () => {
    for (const s of SNIPPETS) {
      expect(s.category === "drill", s.id).toBe(s.language === "drill");
      if (s.language === "drill") expect(s.code.includes("\n"), s.id).toBe(false);
    }
  });

  it("offers every language as a start-screen pill, and nothing else", () => {
    const pills = [...html.matchAll(/class="pill(?: active)?" type="button" data-id="([a-z]+)"/g)].map((m) => m[1]);
    const langPills = pills.filter((id) => LANGUAGE_ORDER.includes(id as Language));
    expect([...langPills].sort()).toEqual([...LANGUAGE_ORDER].sort());
  });

  it("states the language count correctly in the help text and README", () => {
    const languages = LANGUAGE_ORDER.length - 1; // the drills are listed apart
    expect(html).toContain(`の${languages}言語と記号ドリル`);
    expect(html).toContain(`even below ${languages} language pills`);
    expect(readme).toContain(`**${LANGUAGE_ORDER.length} 言語・計 ${SNIPPETS.length} 問**`);
  });
});
