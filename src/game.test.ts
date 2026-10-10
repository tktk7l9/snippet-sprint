// @vitest-environment jsdom
//
// Runtime state machine of the game (menu / playing / paused / results) driven
// through the real DOM, keyboard and Screens. The Three.js layer is replaced by
// spies: WebGL cannot run in jsdom, so only its call surface is asserted.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import type { Snippet } from "./engine/content/types.js";
import { isShown, mountApp, pressKey, stubMatchMedia, trackGlobalListeners } from "./test/dom.js";
import { byId } from "./ui/dom.js";
import { Screens } from "./ui/screens.js";
import type { StageSignals } from "./render/stage.js";

const snippet: Snippet = {
  id: "fixture",
  language: "go",
  category: "flow",
  difficulty: "easy",
  label: "fixture",
  description: "fixture snippet",
  code: "ab",
};

const mocks = vi.hoisted(() => ({
  selectSnippet: vi.fn(),
  ctx: {
    scene: { add: vi.fn() },
    resize: vi.fn(),
    render: vi.fn(),
  },
  stageUpdate: vi.fn(),
  effects: { group: {}, update: vi.fn(), spark: vi.fn(), shockwave: vi.fn(), shakeImpulse: vi.fn() },
}));

vi.mock("./engine/select.js", () => ({ selectSnippet: mocks.selectSnippet }));
vi.mock("./render/renderer.js", () => ({ createRenderContext: vi.fn(() => mocks.ctx) }));
vi.mock("./render/stage.js", () => ({
  Stage: class {
    update = mocks.stageUpdate;
  },
}));
vi.mock("./render/effects.js", () => ({
  EffectsLayer: class {
    group = mocks.effects.group;
    update = mocks.effects.update;
    spark = mocks.effects.spark;
    shockwave = mocks.effects.shockwave;
    shakeImpulse = mocks.effects.shakeImpulse;
  },
}));

const CONFIG = { languages: ["go" as const], difficulty: "mixed" as const, category: "all" as const };

class SilentAudioContext {
  state = "running";
  currentTime = 0;
  destination = {};
  resume = vi.fn(() => Promise.resolve());
  createOscillator() {
    return {
      type: "sine",
      frequency: { setValueAtTime: vi.fn() },
      connect: vi.fn(() => ({ connect: vi.fn() })),
      start: vi.fn(),
      stop: vi.fn(),
    };
  }
  createGain() {
    return {
      gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
      connect: vi.fn(() => ({ connect: vi.fn() })),
    };
  }
}

interface Harness {
  screens: Screens;
  game: import("./game.js").GameController;
  handlers: { onStart: ReturnType<typeof vi.fn>; onRetry: ReturnType<typeof vi.fn>; onNext: ReturnType<typeof vi.fn>; onMenu: ReturnType<typeof vi.fn>; onReload: ReturnType<typeof vi.fn> };
  /** Run one animation frame at the current clock. */
  frame(): void;
  tick(ms: number): void;
}

let clock = 0;
let frameCb: FrameRequestCallback | null = null;

async function boot(opts: { touch?: boolean } = {}): Promise<Harness> {
  mountApp();
  stubMatchMedia(opts.touch ? ["(pointer: coarse)"] : []);
  const handlers = { onStart: vi.fn(), onRetry: vi.fn(), onNext: vi.fn(), onMenu: vi.fn(), onReload: vi.fn() };
  const screens = new Screens(handlers);
  screens.showStart();
  const { createGame } = await import("./game.js");
  const game = createGame(screens);
  handlers.onStart.mockImplementation((cfg) => game.start(cfg));
  handlers.onRetry.mockImplementation(() => game.retry());
  handlers.onNext.mockImplementation(() => game.next());
  handlers.onMenu.mockImplementation(() => game.menu());
  return {
    screens,
    game,
    handlers,
    frame: () => frameCb?.(clock),
    tick: (ms) => {
      clock += ms;
    },
  };
}

function typeAll(text: string): void {
  for (const ch of text) pressKey(ch === "\n" ? "Enter" : ch);
}

function lastStageSignals(): StageSignals {
  const calls = mocks.stageUpdate.mock.calls;
  return calls[calls.length - 1][1] as StageSignals;
}

describe("createGame", () => {
  const user = userEvent.setup();
  let untrack: () => void = () => {};

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    clock = 0;
    frameCb = null;
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    vi.stubGlobal("AudioContext", SilentAudioContext);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((cb: FrameRequestCallback) => {
        frameCb = cb;
        return 1;
      }),
    );
    untrack = trackGlobalListeners();
    mocks.selectSnippet.mockReset().mockReturnValue(snippet);
    for (const fn of [mocks.ctx.resize, mocks.ctx.render, mocks.ctx.scene.add, mocks.stageUpdate, mocks.effects.update]) {
      fn.mockClear();
    }
  });

  afterEach(() => {
    untrack();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("wires the effects layer into the scene and starts the render loop", async () => {
    const h = await boot();
    expect(mocks.ctx.scene.add).toHaveBeenCalledWith(mocks.effects.group);
    expect(screen.getByRole("button", { name: "効果音", pressed: true })).toBeTruthy();
    h.tick(16);
    h.frame();
    expect(mocks.ctx.render).toHaveBeenCalledTimes(1);
    expect(lastStageSignals()).toEqual({ progress: 0, combo: 0, accuracy: 1, active: false });
  });

  it("START hides the menu, shows the HUD, and typing advances the snippet", async () => {
    const h = await boot();
    await user.click(screen.getByRole("button", { name: "START" }));
    expect(isShown("start-screen")).toBe(false);
    expect(isShown("play-hud")).toBe(true);
    expect(isShown("sprint-view")).toBe(true);
    expect(byId("meta-lang").textContent).toBe("Go");
    pressKey("a");
    expect(byId("progress-fill").style.width).toBe("50%");
    h.tick(16);
    h.frame();
    expect(lastStageSignals()).toMatchObject({ progress: 0.5, combo: 1, active: true, language: "go" });
  });

  it("typing on the menu does nothing", async () => {
    await boot();
    pressKey("a");
    expect(byId("progress-fill").style.width).toBe("");
    expect(isShown("start-screen")).toBe(true);
  });

  it("completing the snippet shows results and records a best", async () => {
    const h = await boot();
    h.game.start(CONFIG);
    pressKey("a");
    h.tick(3000);
    pressKey("b");
    expect(isShown("results")).toBe(true);
    expect(isShown("play-hud")).toBe(false);
    expect(byId("result-wpm").textContent).toBe("8");
    expect(byId("result-acc").textContent).toBe("100%");
    expect(within(byId("mistakes")).getByRole("heading", { level: 2 }).textContent).toBe("ノーミス · ベスト更新 🎉");
    // The results say what was typed, what to aim for next, and that this is a first clear.
    expect(byId("result-meta").textContent).toBe("Go · Flow · Easy · fixture");
    expect(byId("result-goal").textContent).toBe("次のランク C まで: WPM 18 以上");
    expect(byId("result-best").textContent).toBe("初クリア · ベストとして記録");
    const bests = JSON.parse(localStorage.getItem("snippet-sprint:bests:v1") ?? "{}");
    expect(bests["sprint:fixture"]).toMatchObject({ wpm: 8, accuracy: 1 });
    // An Enter that leaks from typing does not skip the results.
    pressKey("Enter");
    expect(isShown("results")).toBe(true);
  });

  it("names the previous best when a replay beats it, and the standing best when it does not", async () => {
    const h = await boot();
    h.game.start(CONFIG);
    pressKey("a");
    h.tick(3000);
    pressKey("b");
    const first = Number(byId("result-score").textContent);
    h.tick(1000);
    h.game.retry();
    pressKey("a");
    h.tick(1000);
    pressKey("b");
    const second = Number(byId("result-score").textContent);
    expect(second).toBeGreaterThan(first);
    expect(byId("result-best").textContent).toBe(`前回ベスト ${first}pt → ${second}pt`);
    h.tick(1000);
    h.game.retry();
    pressKey("a");
    h.tick(5000);
    pressKey("b");
    expect(byId("result-best").textContent).toContain(`BEST · WPM`);
    expect(byId("result-best").textContent).toContain(`${second}pt`);
  });

  it("Backspace after a miss only cancels the miss and keeps the correct input", async () => {
    const h = await boot();
    h.game.start(CONFIG);
    pressKey("a");
    pressKey("x");
    const spans = () => [...byId("code").querySelectorAll("span")].map((s) => s.className);
    expect(spans()).toEqual(["ch correct", "ch current error"]);
    pressKey("Backspace");
    expect(spans()).toEqual(["ch correct", "ch current"]);
    expect(byId("progress-fill").style.width).toBe("50%");
    // With no outstanding miss it steps back one character as before.
    pressKey("Backspace");
    expect(spans()).toEqual(["ch current", "ch pending"]);
  });

  it("lists the characters that were mistyped", async () => {
    const h = await boot();
    h.game.start(CONFIG);
    pressKey("x");
    pressKey("x");
    typeAll("ab");
    expect(byId("result-acc").textContent).toBe("50%");
    const rows = [...byId("mistakes").querySelectorAll(".miss-row")];
    expect(rows.map((r) => r.textContent)).toEqual(["a×2"]);
  });

  it("RETRY replays the same snippet and NEXT draws another", async () => {
    const h = await boot();
    h.game.start(CONFIG);
    typeAll("ab");
    const results = within(byId("results"));
    h.tick(1000);
    await user.click(results.getByRole("button", { name: "RETRY" }));
    expect(mocks.selectSnippet).toHaveBeenLastCalledWith(expect.objectContaining({ replayId: "fixture" }), expect.any(Array));
    expect(isShown("play-hud")).toBe(true);
    typeAll("ab");
    h.tick(1000);
    await user.click(results.getByRole("button", { name: "NEXT" }));
    expect(mocks.selectSnippet).toHaveBeenLastCalledWith(
      expect.objectContaining({ excludeId: "fixture", replayId: undefined }),
      expect.any(Array),
    );
    expect(isShown("results")).toBe(false);
  });

  it("MENU on the results returns to the start screen", async () => {
    const h = await boot();
    h.game.start(CONFIG);
    typeAll("ab");
    h.tick(1000);
    await user.click(within(byId("results")).getByRole("button", { name: "MENU" }));
    expect(isShown("start-screen")).toBe(true);
    expect(isShown("play-hud")).toBe(false);
    h.frame();
    expect(lastStageSignals().active).toBe(false);
  });

  it("Escape pauses, freezes the clock, blocks typing, and resumes", async () => {
    const h = await boot();
    h.game.start(CONFIG);
    pressKey("a");
    pressKey("Escape");
    expect(isShown("pause-overlay")).toBe(true);
    expect(document.activeElement).toBe(byId("pause-resume"));
    pressKey("b");
    expect(isShown("results")).toBe(false);
    expect(byId("progress-fill").style.width).toBe("50%");
    h.tick(60000);
    pressKey("Escape");
    expect(isShown("pause-overlay")).toBe(false);
    h.tick(1000);
    h.frame();
    // 1s of play, 60s paused: the HUD clock only counts the played second.
    expect(byId("stat-time").textContent).toBe("1.0s");
  });

  it("on-screen PAUSE / RESUME / RETRY buttons mirror the keyboard", async () => {
    const h = await boot();
    h.game.start(CONFIG);
    pressKey("a");
    await user.click(screen.getByRole("button", { name: "ポーズ" }));
    expect(isShown("pause-overlay")).toBe(true);
    await user.click(screen.getByRole("button", { name: "RESUME" }));
    expect(isShown("pause-overlay")).toBe(false);
    pressKey("Escape");
    await user.click(within(byId("pause-overlay")).getByRole("button", { name: "RETRY" }));
    expect(isShown("pause-overlay")).toBe(false);
    expect(mocks.selectSnippet).toHaveBeenLastCalledWith(expect.objectContaining({ replayId: "fixture" }), expect.any(Array));
    expect(byId("progress-fill").style.width).toBe("0%");
  });

  it("Tab restarts the same snippet mid-run", async () => {
    const h = await boot();
    h.game.start(CONFIG);
    pressKey("a");
    pressKey("Tab");
    expect(byId("progress-fill").style.width).toBe("0%");
    expect(byId("stat-combo").textContent).toBe("0");
    expect(mocks.selectSnippet).toHaveBeenLastCalledWith(expect.objectContaining({ replayId: "fixture" }), expect.any(Array));
  });

  it("losing focus or hiding the tab auto-pauses, but only while playing", async () => {
    const h = await boot();
    window.dispatchEvent(new Event("blur"));
    expect(isShown("pause-overlay")).toBe(false);
    h.game.start(CONFIG);
    window.dispatchEvent(new Event("blur"));
    expect(isShown("pause-overlay")).toBe(true);
    pressKey("Escape");
    vi.spyOn(document, "hidden", "get").mockReturnValue(true);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(isShown("pause-overlay")).toBe(true);
  });

  it("HELP suspends the run and CLOSE resumes it; on the menu it just opens", async () => {
    const h = await boot();
    // Before a run, help is reachable from the start screen itself.
    await user.click(within(byId("start-screen")).getByRole("button", { name: "遊び方" }));
    expect(isShown("help-overlay")).toBe(true);
    expect(isShown("start-screen")).toBe(true);
    await user.click(screen.getByRole("button", { name: "CLOSE" }));
    expect(isShown("help-overlay")).toBe(false);
    expect(document.activeElement).toBe(byId("start-btn"));
    // Escape closes it on the menu without starting or pausing anything.
    await user.click(within(byId("start-screen")).getByRole("button", { name: "遊び方" }));
    pressKey("Escape");
    expect(isShown("help-overlay")).toBe(false);
    expect(isShown("pause-overlay")).toBe(false);
    expect(isShown("start-screen")).toBe(true);

    h.game.start(CONFIG);
    pressKey("a");
    await user.click(within(byId("play-hud")).getByRole("button", { name: "遊び方" }));
    expect(isShown("help-overlay")).toBe(true);
    pressKey("b");
    expect(byId("progress-fill").style.width).toBe("50%");
    // Reading the help freezes the WPM clock just like PAUSE does.
    h.tick(60000);
    await user.click(screen.getByRole("button", { name: "CLOSE" }));
    expect(isShown("help-overlay")).toBe(false);
    h.tick(1000);
    h.frame();
    expect(byId("stat-time").textContent).toBe("1.0s");
    pressKey("b");
    expect(isShown("results")).toBe(true);
  });

  it("the sound pill toggles mute in place", async () => {
    await boot();
    const pill = screen.getByRole("button", { name: "効果音" });
    await user.click(pill);
    expect(pill.getAttribute("aria-pressed")).toBe("false");
    expect(pill.textContent).toContain("MUTED");
    await user.click(pill);
    expect(pill.getAttribute("aria-pressed")).toBe("true");
  });

  it("remembers the mute choice for the next launch", async () => {
    await boot();
    await user.click(screen.getByRole("button", { name: "効果音" }));
    expect(localStorage.getItem("snippet-sprint:muted:v1")).toBe("1");
    untrack();
    untrack = trackGlobalListeners();
    vi.resetModules();
    await boot();
    const pill = screen.getByRole("button", { name: "効果音" });
    expect(pill.getAttribute("aria-pressed")).toBe("false");
    expect(pill.textContent).toContain("MUTED");
    await user.click(pill);
    expect(localStorage.getItem("snippet-sprint:muted:v1")).toBe("0");
  });

  it("RETRY and NEXT are no-ops before any run has started", async () => {
    const h = await boot();
    h.game.retry();
    h.game.next();
    expect(mocks.selectSnippet).not.toHaveBeenCalled();
    expect(isShown("start-screen")).toBe(true);
  });

  it("a visibility change that keeps the tab visible does not pause", async () => {
    const h = await boot();
    h.game.start(CONFIG);
    vi.spyOn(document, "hidden", "get").mockReturnValue(false);
    document.dispatchEvent(new Event("visibilitychange"));
    expect(isShown("pause-overlay")).toBe(false);
  });

  it("leaves the app frame alone on non-touch devices even with a visual viewport", async () => {
    const vv = Object.assign(new EventTarget(), { height: 300, offsetTop: 0, scale: 1 });
    vi.stubGlobal("visualViewport", vv);
    await boot();
    vv.dispatchEvent(new Event("resize"));
    expect(byId("app").style.height).toBe("");
  });

  it("forwards window resize to the renderer", async () => {
    await boot();
    window.dispatchEvent(new Event("resize"));
    expect(mocks.ctx.resize).toHaveBeenCalledTimes(1);
  });

  it("clamps the frame delta so a long tab switch does not jump the scene", async () => {
    const h = await boot();
    h.tick(5000);
    h.frame();
    expect(mocks.stageUpdate).toHaveBeenLastCalledWith(0.05, expect.anything());
    expect(mocks.effects.update).toHaveBeenLastCalledWith(0.05, mocks.ctx);
  });

  describe("touch devices", () => {
    it("focuses the hidden input on start and after taps outside buttons", async () => {
      const h = await boot({ touch: true });
      const sink = byId<HTMLInputElement>("key-sink");
      h.game.start(CONFIG);
      expect(document.activeElement).toBe(sink);
      byId("start-btn").focus();
      byId("code").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      expect(document.activeElement).toBe(sink);
      byId("pause-fab").focus();
      byId("pause-fab").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      expect(document.activeElement).toBe(byId("pause-fab"));
      // Back on the menu, taps leave focus alone so the keyboard stays down.
      h.game.menu();
      byId("start-btn").focus();
      byId("app").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
      expect(document.activeElement).toBe(byId("start-btn"));
    });

    it("reads soft-keyboard input through beforeinput", async () => {
      const h = await boot({ touch: true });
      h.game.start(CONFIG);
      const sink = byId<HTMLInputElement>("key-sink");
      sink.dispatchEvent(new InputEvent("beforeinput", { inputType: "insertText", data: "a", bubbles: true, cancelable: true }));
      expect(byId("progress-fill").style.width).toBe("50%");
      sink.dispatchEvent(new InputEvent("beforeinput", { inputType: "deleteContentBackward", bubbles: true, cancelable: true }));
      expect(byId("code").querySelectorAll("span")[0].className).toBe("ch current");
    });

    it("fits the app frame to the visual viewport so the soft keyboard covers nothing", async () => {
      const vv = Object.assign(new EventTarget(), { height: 420.4, offsetTop: 12.6, scale: 1 });
      vi.stubGlobal("visualViewport", vv);
      await boot({ touch: true });
      const app = byId("app");
      expect(app.style.height).toBe("");
      vv.dispatchEvent(new Event("resize"));
      expect(app.style.height).toBe("420px");
      expect(app.style.top).toBe("13px");
      vv.height = 800;
      vv.offsetTop = 0;
      vv.dispatchEvent(new Event("scroll"));
      expect(app.style.height).toBe("800px");
      expect(app.style.top).toBe("0px");
      // While pinch-zoomed the layout goes back to full size instead of following.
      vv.scale = 2;
      vv.dispatchEvent(new Event("resize"));
      expect(app.style.height).toBe("");
      expect(app.style.top).toBe("");
    });

    it("refocuses the input after resuming and after toggling sound", async () => {
      const h = await boot({ touch: true });
      h.game.start(CONFIG);
      const sink = byId<HTMLInputElement>("key-sink");
      await user.click(screen.getByRole("button", { name: "ポーズ" }));
      await user.click(screen.getByRole("button", { name: "RESUME" }));
      expect(document.activeElement).toBe(sink);
      await user.click(screen.getByRole("button", { name: "効果音" }));
      expect(document.activeElement).toBe(sink);
    });
  });
});
