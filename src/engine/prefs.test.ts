import { describe, expect, it } from "vitest";
import { DEFAULT_PREFS, loadMuted, loadPrefs, saveMuted, savePrefs } from "./prefs.js";
import type { RecordStore } from "./records.js";

const memory = (init: string | null = null): RecordStore & { value: string | null } => {
  const s = {
    value: init,
    getItem: () => s.value,
    setItem: (_k: string, v: string) => {
      s.value = v;
    },
  };
  return s;
};

describe("loadPrefs", () => {
  it("returns defaults when nothing is stored", () => {
    expect(loadPrefs(memory())).toEqual(DEFAULT_PREFS);
  });

  it("returns defaults for broken JSON or non-objects", () => {
    expect(loadPrefs(memory("{oops"))).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(memory("42"))).toEqual(DEFAULT_PREFS);
    expect(loadPrefs(memory("null"))).toEqual(DEFAULT_PREFS);
  });

  it("round-trips a saved config", () => {
    const store = memory();
    savePrefs(store, { languages: ["py", "go"], category: "async", difficulty: "hard" });
    expect(loadPrefs(store)).toEqual({ languages: ["py", "go"], category: "async", difficulty: "hard" });
  });

  it("drops unknown languages and falls back when none remain", () => {
    expect(loadPrefs(memory(JSON.stringify({ languages: ["py", "cobol"] }))).languages).toEqual(["py"]);
    expect(loadPrefs(memory(JSON.stringify({ languages: ["cobol"] }))).languages).toEqual(DEFAULT_PREFS.languages);
    expect(loadPrefs(memory(JSON.stringify({ languages: "py" }))).languages).toEqual(DEFAULT_PREFS.languages);
  });

  it("de-duplicates languages", () => {
    expect(loadPrefs(memory(JSON.stringify({ languages: ["py", "py"] }))).languages).toEqual(["py"]);
  });

  it("falls back per field for unknown category or difficulty", () => {
    const p = loadPrefs(memory(JSON.stringify({ languages: ["ts"], category: "drill", difficulty: "insane" })));
    expect(p.category).toBe("all");
    expect(p.difficulty).toBe("mixed");
  });

  it("returns a fresh defaults array each time", () => {
    const a = loadPrefs(memory());
    a.languages.push("py");
    expect(loadPrefs(memory()).languages).toEqual(["ts"]);
  });
});

describe("muted preference", () => {
  it("defaults to sound on", () => {
    expect(loadMuted(memory())).toBe(false);
  });

  it("round-trips the mute state (SHIG 42, 12)", () => {
    const store = memory();
    saveMuted(store, true);
    expect(loadMuted(store)).toBe(true);
    saveMuted(store, false);
    expect(loadMuted(store)).toBe(false);
  });

  it("ignores garbage", () => {
    expect(loadMuted(memory("maybe"))).toBe(false);
  });
});
