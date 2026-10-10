// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Snippet } from "../engine/content/types.js";
import { StatsTracker } from "../engine/stats.js";
import { isShown, mountApp } from "../test/dom.js";
import { byId } from "../ui/dom.js";
import { SprintMode } from "./sprint.js";
import type { ModeServices, PlayConfig } from "./types.js";

const snippetA: Snippet = {
  id: "a",
  language: "ts",
  category: "basics",
  difficulty: "easy",
  label: "A",
  description: "desc A",
  code: "ab\n  c",
};
const snippetB: Snippet = { ...snippetA, id: "b", language: "py", description: "desc B", code: "xy" };

const selectSnippet = vi.hoisted(() => vi.fn());
vi.mock("../engine/select.js", () => ({ selectSnippet }));
const loaded = vi.hoisted(() => vi.fn());
vi.mock("../engine/content/index.js", () => ({ poolFor: loaded }));

const config: PlayConfig = { languages: ["ts"], difficulty: "mixed", category: "all" };

function makeServices() {
  let stats = new StatsTracker();
  let clock = 1000;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  const services = {
    ctx: {} as ModeServices["ctx"],
    effects: { spark: vi.fn(), shockwave: vi.fn(), shakeImpulse: vi.fn() } as unknown as ModeServices["effects"],
    audio: { key: vi.fn(), error: vi.fn(), combo: vi.fn() } as unknown as ModeServices["audio"],
    record: vi.fn((correct: boolean, expected: string) => {
      stats.record(correct, expected, clock);
      return stats.combo;
    }),
    stats: vi.fn((now: number) => stats.snapshot(now)),
    finish: vi.fn(),
    toast: vi.fn(),
  } satisfies ModeServices;
  return {
    services,
    tick: (ms: number) => (clock += ms),
    reset: () => (stats = new StatsTracker()),
  };
}

describe("SprintMode", () => {
  let env: ReturnType<typeof makeServices>;
  let mode: SprintMode;

  beforeEach(() => {
    mountApp();
    selectSnippet.mockReset().mockReturnValue(snippetA);
    loaded.mockReset().mockReturnValue([snippetA, snippetB]);
    env = makeServices();
    mode = new SprintMode(env.services);
  });
  afterEach(() => vi.restoreAllMocks());

  it("begin draws from the loaded pool of the chosen languages and shows the snippet", () => {
    mode.begin(config);
    expect(loaded).toHaveBeenCalledWith(["ts"]);
    expect(selectSnippet).toHaveBeenCalledWith(
      {
        languages: ["ts"],
        difficulty: "mixed",
        category: "all",
        excludeId: undefined,
        replayId: undefined,
      },
      [snippetA, snippetB],
    );
    expect(isShown("sprint-view")).toBe(true);
    expect(byId("meta-lang").textContent).toBe("TS/JS");
    expect(byId("meta-cat").textContent).toBe("Basics · Easy");
    expect(byId("code-desc").textContent).toBe("desc A");
    expect(byId("code").textContent).toBe("ab↵\n  c");
    expect(byId("progress-fill").style.width).toBe("0%");
    expect(byId("stat-wpm").textContent).toBe("0");
    expect(byId("stat-acc").textContent).toBe("100%");
  });

  it("NEXT avoids the snippet just played, RETRY replays it", () => {
    mode.begin(config);
    selectSnippet.mockReturnValue(snippetB);
    mode.begin(config);
    expect(selectSnippet).toHaveBeenLastCalledWith(expect.objectContaining({ excludeId: "a", replayId: undefined }), [snippetA, snippetB]);
    expect(byId("meta-lang").textContent).toBe("Python");
    mode.begin(config, true);
    expect(selectSnippet).toHaveBeenLastCalledWith(expect.objectContaining({ excludeId: "b", replayId: "b" }), [snippetA, snippetB]);
  });

  it("a correct key advances, sparks, clicks and updates the HUD", () => {
    mode.begin(config);
    env.tick(1000);
    mode.inputChar("a");
    expect(env.services.record).toHaveBeenCalledWith(true, "a");
    expect(env.services.audio.key).toHaveBeenCalledTimes(1);
    expect(env.services.effects.spark).toHaveBeenCalledTimes(1);
    const spans = byId("code").querySelectorAll("span");
    expect(spans[0].className).toBe("ch correct");
    expect(spans[1].className).toBe("ch current");
    expect(byId("progress-fill").style.width).toBe("17%");
    expect(byId("stat-combo").textContent).toBe("1");
  });

  it("a wrong key shakes, buzzes, and marks the cursor without advancing", () => {
    mode.begin(config);
    mode.inputChar("z");
    expect(env.services.record).toHaveBeenCalledWith(false, "a");
    expect(env.services.audio.error).toHaveBeenCalledTimes(1);
    expect(env.services.effects.shakeImpulse).toHaveBeenCalledTimes(1);
    expect(byId("code").classList.contains("shake")).toBe(true);
    expect(byId("code").querySelectorAll("span")[0].className).toBe("ch current error");
    expect(byId("progress-fill").style.width).toBe("0%");
    expect(byId("stat-acc").textContent).toBe("0%");
    expect(env.services.finish).not.toHaveBeenCalled();
  });

  it("celebrates every tenth combo with a shockwave, chord and toast", () => {
    selectSnippet.mockReturnValue({ ...snippetA, code: "abcdefghijkl" });
    mode.begin(config);
    for (const ch of "abcdefghij") mode.inputChar(ch);
    expect(env.services.effects.shockwave).toHaveBeenCalledTimes(1);
    expect(env.services.audio.combo).toHaveBeenCalledWith(10);
    expect(env.services.toast).toHaveBeenCalledWith("COMBO ×10");
    mode.inputChar("k");
    expect(env.services.toast).toHaveBeenCalledTimes(1);
  });

  it("backspace steps the cursor back and refreshes the view", () => {
    mode.begin(config);
    mode.inputChar("a");
    mode.backspace();
    const spans = byId("code").querySelectorAll("span");
    expect(spans[0].className).toBe("ch current");
    expect(spans[1].className).toBe("ch pending");
  });

  it("backspace after a miss clears the error without undoing correct input", () => {
    mode.begin(config);
    mode.inputChar("a");
    mode.inputChar("z");
    const classes = () => [...byId("code").querySelectorAll("span")].slice(0, 2).map((s) => s.className);
    expect(classes()).toEqual(["ch correct", "ch current error"]);
    mode.backspace();
    expect(classes()).toEqual(["ch correct", "ch current"]);
  });

  it("finishes with a score once the last character lands and auto-skips indentation", () => {
    mode.begin(config);
    env.tick(500);
    mode.inputChar("a");
    mode.inputChar("b");
    env.tick(2500);
    mode.inputChar("\n");
    expect(byId("progress-fill").style.width).toBe("83%");
    mode.inputChar("c");
    expect(env.services.finish).toHaveBeenCalledTimes(1);
    const call = env.services.finish.mock.calls[0][0];
    expect(call.recordKey).toBe("sprint:a");
    // The finished snippet travels with the result so the results screen can name it.
    expect(call.snippet).toBe(snippetA);
    expect(["S", "A", "B", "C", "D"]).toContain(call.rank);
    expect(call.score).toBeGreaterThan(0);
    expect(byId("progress-fill").style.width).toBe("100%");
  });

  it("ignores input after completion and before begin", () => {
    mode.inputChar("a");
    mode.backspace();
    expect(env.services.record).not.toHaveBeenCalled();
    selectSnippet.mockReturnValue(snippetB);
    mode.begin(config);
    mode.inputChar("x");
    mode.inputChar("y");
    mode.inputChar("z");
    expect(env.services.record).toHaveBeenCalledTimes(2);
    expect(env.services.finish).toHaveBeenCalledTimes(1);
  });

  it("update refreshes the live clock while playing", () => {
    mode.begin(config);
    mode.inputChar("a");
    env.tick(4321);
    mode.update(0.016, performance.now());
    expect(byId("stat-time").textContent).toBe("4.3s");
  });

  it("reports stage signals from the session and stats", () => {
    expect(mode.signals()).toEqual({ progress: 0, combo: 0, accuracy: 1, active: false, language: undefined });
    mode.begin(config);
    mode.inputChar("a");
    expect(mode.signals()).toMatchObject({ combo: 1, accuracy: 1, active: true, language: "ts" });
    expect(mode.signals().progress).toBeCloseTo(1 / 6);
    selectSnippet.mockReturnValue(snippetB);
    mode.begin(config);
    mode.inputChar("x");
    mode.inputChar("y");
    expect(mode.signals().active).toBe(false);
  });

  it("end hides the HUD", () => {
    mode.begin(config);
    mode.end();
    expect(isShown("sprint-view")).toBe(false);
  });
});
