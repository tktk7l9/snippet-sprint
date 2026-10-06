// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { KEY_GRACE_MS } from "../engine/activation.js";
import { LANGUAGE_LABELS, LANGUAGE_ORDER, type Snippet } from "../engine/content/types.js";
import { isShown, mountApp, pressKey } from "../test/dom.js";
import { byId } from "./dom.js";
import { Screens, type ResultData, type ScreenHandlers } from "./screens.js";

const PREFS_KEY = "snippet-sprint:prefs:v1";

function makeHandlers(): ScreenHandlers {
  return { onStart: vi.fn(), onRetry: vi.fn(), onNext: vi.fn(), onMenu: vi.fn() };
}

function pill(group: string, name: string): HTMLButtonElement {
  return within(byId(group)).getByRole("button", { name }) as HTMLButtonElement;
}

function pressedNames(group: string): string[] {
  return [...byId(group).querySelectorAll<HTMLButtonElement>(".pill")]
    .filter((b) => b.getAttribute("aria-pressed") === "true")
    .map((b) => b.textContent ?? "");
}

const snippet: Snippet = {
  id: "fixture",
  language: "go",
  category: "flow",
  difficulty: "easy",
  label: "for loop",
  description: "fixture snippet",
  code: "ab",
};

const baseResult: ResultData = {
  rank: "A",
  wpm: 61,
  accuracy: 0.955,
  score: 1234,
  maxCombo: 27,
  misses: [],
  best: null,
  improved: false,
  previous: null,
  snippet,
};

describe("Screens", () => {
  let handlers: ScreenHandlers;
  const user = userEvent.setup();
  // Screens registers a window keydown listener that stays alive after the
  // test's DOM is replaced; hiding every instance's overlays keeps a stale
  // listener from claiming the next test's Enter.
  const created: Screens[] = [];
  const create = (h: ScreenHandlers = handlers): Screens => {
    const s = new Screens(h);
    created.push(s);
    return s;
  };

  beforeEach(() => {
    localStorage.clear();
    mountApp();
    handlers = makeHandlers();
  });
  afterEach(() => {
    for (const s of created.splice(0)) s.hideAll();
    vi.restoreAllMocks();
  });

  describe("start screen", () => {
    it("offers a pill for every language in the content model, labelled like the HUD", () => {
      create().showStart();
      const pills = [...byId("lang-pills").querySelectorAll<HTMLButtonElement>(".pill")];
      expect(pills.map((b) => b.dataset.id).sort()).toEqual([...LANGUAGE_ORDER].sort());
      for (const b of pills) {
        expect(b.textContent).toBe(LANGUAGE_LABELS[b.dataset.id as keyof typeof LANGUAGE_LABELS]);
      }
    });

    it("shows the start overlay with START focused and defaults selected", () => {
      create().showStart();
      expect(isShown("start-screen")).toBe(true);
      expect(document.activeElement).toBe(byId("start-btn"));
      expect(pressedNames("lang-pills")).toEqual(["TS/JS"]);
      expect(pressedNames("cat-pills")).toEqual(["All"]);
      expect(pressedNames("diff-pills")).toEqual(["Mixed"]);
    });

    it("starts with the current selection on a START click", async () => {
      create().showStart();
      await user.click(screen.getByRole("button", { name: "START" }));
      expect(handlers.onStart).toHaveBeenCalledWith({
        languages: ["ts"],
        difficulty: "mixed",
        category: "all",
      });
    });

    it("adds and removes languages, keeping at least one selected", async () => {
      const screens = create();
      screens.showStart();
      await user.click(pill("lang-pills", "Python"));
      expect(pressedNames("lang-pills")).toEqual(["TS/JS", "Python"]);
      await user.click(pill("lang-pills", "TS/JS"));
      expect(pressedNames("lang-pills")).toEqual(["Python"]);
      // Deselecting the last one is refused and the pill shakes to say why.
      await user.click(pill("lang-pills", "Python"));
      expect(pressedNames("lang-pills")).toEqual(["Python"]);
      expect(pill("lang-pills", "Python").classList.contains("shake")).toBe(true);
      expect(screens.config().languages).toEqual(["py"]);
    });

    it("picks a single category and difficulty", async () => {
      const screens = create();
      screens.showStart();
      await user.click(pill("cat-pills", "Flow"));
      await user.click(pill("diff-pills", "Hard"));
      expect(pressedNames("cat-pills")).toEqual(["Flow"]);
      expect(pressedNames("diff-pills")).toEqual(["Hard"]);
      expect(pill("cat-pills", "All").getAttribute("aria-pressed")).toBe("false");
      expect(screens.config()).toEqual({ languages: ["ts"], category: "flow", difficulty: "hard" });
    });

    it("returns focus to START after a pointer pick so Enter still plays", async () => {
      create().showStart();
      await user.click(pill("cat-pills", "Basics"));
      expect(document.activeElement).toBe(byId("start-btn"));
    });

    it("keeps a keyboard user's place in the tab order after Space on a pill", async () => {
      create().showStart();
      const target = pill("diff-pills", "Easy");
      target.focus();
      await user.keyboard(" ");
      expect(pressedNames("diff-pills")).toEqual(["Easy"]);
      expect(document.activeElement).toBe(target);
    });

    it("persists the selection and restores it on the next visit", async () => {
      create().showStart();
      await user.click(pill("lang-pills", "Go"));
      await user.click(pill("cat-pills", "Async"));
      await user.click(pill("diff-pills", "Medium"));
      expect(JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}")).toEqual({
        languages: ["ts", "go"],
        category: "async",
        difficulty: "medium",
      });

      mountApp();
      const again = create(makeHandlers());
      again.showStart();
      expect(pressedNames("lang-pills")).toEqual(["TS/JS", "Go"]);
      expect(pressedNames("cat-pills")).toEqual(["Async"]);
      expect(pressedNames("diff-pills")).toEqual(["Medium"]);
    });

    it("starts on Enter when nothing else has focus", () => {
      create().showStart();
      (document.activeElement as HTMLElement).blur();
      const e = pressKey("Enter");
      expect(handlers.onStart).toHaveBeenCalledTimes(1);
      expect(e.defaultPrevented).toBe(true);
    });

    it("does not double-start on Enter while START itself is focused", () => {
      create().showStart();
      pressKey("Enter");
      // The button's own click handles it; the window shortcut stays out.
      expect(handlers.onStart).not.toHaveBeenCalled();
    });

    it("ignores Enter with modifiers, during IME composition, or off the start screen", () => {
      const screens = create();
      screens.showStart();
      (document.activeElement as HTMLElement).blur();
      pressKey("Enter", { metaKey: true });
      pressKey("Enter", { isComposing: true });
      screens.showHelp();
      pressKey("Enter");
      screens.hideHelp();
      screens.hideStart();
      pressKey("Enter");
      expect(handlers.onStart).not.toHaveBeenCalled();
    });

    it("stops the start Enter before the game keyboard sees it", () => {
      create().showStart();
      (document.activeElement as HTMLElement).blur();
      const later = vi.fn();
      window.addEventListener("keydown", later);
      pressKey("Enter");
      expect(later).not.toHaveBeenCalled();
      window.removeEventListener("keydown", later);
    });
  });

  describe("availability", () => {
    it("disables filters with no snippet and falls back to All / Mixed", async () => {
      const screens = create();
      screens.showStart();
      await user.click(pill("cat-pills", "Algorithms"));
      await user.click(pill("diff-pills", "Hard"));
      screens.setAvailability({
        categories: () => new Set(["basics", "flow"]),
        difficulties: () => new Set(["easy"]),
      });
      expect(pill("cat-pills", "Algorithms").disabled).toBe(true);
      expect(pill("cat-pills", "Basics").disabled).toBe(false);
      expect(pill("cat-pills", "All").disabled).toBe(false);
      expect(pill("diff-pills", "Hard").disabled).toBe(true);
      expect(pill("diff-pills", "Mixed").disabled).toBe(false);
      expect(pressedNames("cat-pills")).toEqual(["All"]);
      expect(pressedNames("diff-pills")).toEqual(["Mixed"]);
      expect(screens.config()).toEqual({ languages: ["ts"], category: "all", difficulty: "mixed" });
    });

    it("re-evaluates feasibility for the chosen languages and category", async () => {
      const screens = create();
      screens.showStart();
      const difficulties = vi.fn((_langs: readonly string[], cat: string) =>
        cat === "flow" ? new Set(["hard" as const]) : new Set(["easy" as const, "hard" as const]),
      );
      screens.setAvailability({ categories: () => new Set(["flow", "basics"]), difficulties });
      await user.click(pill("cat-pills", "Flow"));
      expect(difficulties).toHaveBeenLastCalledWith(["ts"], "flow");
      expect(pill("diff-pills", "Easy").disabled).toBe(true);
      expect(pill("diff-pills", "Hard").disabled).toBe(false);
    });
  });

  describe("results screen", () => {
    it("renders rank, stats, and a no-miss headline with NEXT focused", () => {
      const screens = create();
      screens.showResults(baseResult);
      expect(isShown("results")).toBe(true);
      expect(isShown("start-screen")).toBe(false);
      expect(byId("result-rank").textContent).toBe("A");
      expect(byId("result-wpm").textContent).toBe("61");
      expect(byId("result-acc").textContent).toBe("96%");
      expect(byId("result-score").textContent).toBe("1234");
      expect(byId("result-combo").textContent).toBe("27");
      expect(byId("result-best").textContent).toBe("");
      expect(within(byId("mistakes")).getByRole("heading", { level: 2 }).textContent).toBe("ノーミス 🎯");
      expect(document.activeElement).toBe(byId("btn-next"));
    });

    it("says what was typed and names only the floors the next rank still needs", () => {
      const screens = create();
      screens.showResults(baseResult);
      expect(byId("result-meta").textContent).toBe("Go · Flow · Easy · for loop");
      expect(byId("result-meta").querySelector(".meta-lang")?.textContent).toBe("Go");
      // 61 WPM already beats the S floor, so only accuracy is asked for.
      expect(byId("result-goal").textContent).toBe("次のランク S まで: 正確率 98% 以上");
      screens.showResults({ ...baseResult, rank: "D", wpm: 10, accuracy: 0.5 });
      expect(byId("result-goal").textContent).toBe("次のランク C まで: WPM 18 以上 · 正確率 80% 以上");
      screens.showResults({ ...baseResult, rank: "S", wpm: 80, accuracy: 0.99 });
      expect(byId("result-goal").textContent).toBe("最高ランクです");
    });

    it("replaces the snippet context instead of appending on the next result", () => {
      const screens = create();
      screens.showResults(baseResult);
      screens.showResults({ ...baseResult, snippet: { ...snippet, language: "py", label: "list comp" } });
      expect(byId("result-meta").textContent).toBe("Python · Flow · Easy · list comp");
      expect(byId("result-meta").querySelectorAll(".meta-lang")).toHaveLength(1);
    });

    it("shows the standing best when the run did not beat it", () => {
      const best = { wpm: 70, accuracy: 0.98, score: 2000, rank: "S" as const };
      create().showResults({ ...baseResult, best, previous: best });
      expect(byId("result-best").textContent).toBe("BEST · WPM 70 · 98% · 2000pt");
      expect(within(byId("mistakes")).getByRole("heading", { level: 2 }).textContent).toBe("ノーミス 🎯");
    });

    it("celebrates a new best and shows the previous best it beat", () => {
      create().showResults({
        ...baseResult,
        improved: true,
        best: { wpm: 61, accuracy: 0.955, score: 1234, rank: "A" },
        previous: { wpm: 50, accuracy: 0.9, score: 900, rank: "B" },
      });
      expect(byId("result-best").textContent).toBe("前回ベスト 900pt → 1234pt");
      expect(within(byId("mistakes")).getByRole("heading", { level: 2 }).textContent).toBe("ノーミス · ベスト更新 🎉");
    });

    it("calls a first clear a first clear rather than echoing its own numbers", () => {
      create().showResults({
        ...baseResult,
        improved: true,
        best: { wpm: 61, accuracy: 0.955, score: 1234, rank: "A" },
      });
      expect(byId("result-best").textContent).toBe("初クリア · ベストとして記録");
    });

    it("lists mistakes with readable glyphs and bars scaled to the worst one", () => {
      create().showResults({
        ...baseResult,
        misses: [
          { char: " ", count: 40 },
          { char: "\n", count: 20 },
          { char: "\t", count: 10 },
          { char: "{", count: 1 },
        ],
      });
      expect(within(byId("mistakes")).getByRole("heading", { level: 2 }).textContent).toBe("弱点分析（つまずいた記号）");
      const rows = [...byId("mistakes").querySelectorAll(".miss-row")];
      expect(rows.map((r) => r.querySelector(".miss-key")?.textContent)).toEqual(["␣", "↵", "⇥", "{"]);
      expect(rows.map((r) => r.querySelector(".miss-count")?.textContent)).toEqual(["×40", "×20", "×10", "×1"]);
      const widths = rows.map((r) => (r.querySelector(".miss-bar") as HTMLElement).style.width);
      // A rare miss still gets a visible 12px bar instead of a sliver.
      expect(widths).toEqual(["240px", "120px", "60px", "12px"]);
    });

    it("uses the improved headline for a run with mistakes too", () => {
      create().showResults({
        ...baseResult,
        improved: true,
        misses: [{ char: "a", count: 1 }],
      });
      expect(within(byId("mistakes")).getByRole("heading", { level: 2 }).textContent).toBe("弱点分析 · ベスト更新 🎉");
    });

    it("clears the previous run's mistakes when a clean run follows", () => {
      const screens = create();
      screens.showResults({ ...baseResult, misses: [{ char: "a", count: 3 }] });
      screens.showResults(baseResult);
      expect(byId("mistakes").querySelectorAll(".miss-row")).toHaveLength(0);
    });

    it("routes RETRY / NEXT / MENU clicks to the handlers", async () => {
      const screens = create();
      screens.showResults(baseResult);
      const results = within(byId("results"));
      await user.click(results.getByRole("button", { name: "RETRY" }));
      await user.click(results.getByRole("button", { name: "NEXT" }));
      await user.click(results.getByRole("button", { name: "MENU" }));
      expect(handlers.onRetry).toHaveBeenCalledTimes(1);
      expect(handlers.onNext).toHaveBeenCalledTimes(1);
      expect(handlers.onMenu).toHaveBeenCalledTimes(1);
    });

    it("ignores an Enter that leaks from typing right after the results appear", () => {
      vi.spyOn(performance, "now").mockReturnValue(1000);
      const screens = create();
      screens.showResults(baseResult);
      // Keyboard activation of the focused NEXT button (detail === 0).
      byId("btn-next").dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
      expect(handlers.onNext).not.toHaveBeenCalled();
      vi.spyOn(performance, "now").mockReturnValue(1000 + KEY_GRACE_MS);
      byId("btn-next").dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 0 }));
      expect(handlers.onNext).toHaveBeenCalledTimes(1);
    });

    it("hides the results overlay on request", () => {
      const screens = create();
      screens.showResults(baseResult);
      screens.hideResults();
      expect(isShown("results")).toBe(false);
    });
  });

  describe("pause and help overlays", () => {
    it("shows pause with RESUME focused and reports the paused state", () => {
      const screens = create();
      screens.showPause();
      expect(isShown("pause-overlay")).toBe(true);
      expect(screens.isPaused()).toBe(true);
      expect(document.activeElement).toBe(byId("pause-resume"));
      screens.hidePause();
      expect(screens.isPaused()).toBe(false);
    });

    it("sends the pause MENU button to the menu handler", async () => {
      create().showPause();
      await user.click(within(byId("pause-overlay")).getByRole("button", { name: "MENU" }));
      expect(handlers.onMenu).toHaveBeenCalledTimes(1);
    });

    it("opens help and closes it with CLOSE", async () => {
      const screens = create();
      screens.showHelp();
      expect(screens.isHelpOpen()).toBe(true);
      await user.click(screen.getByRole("button", { name: "CLOSE" }));
      expect(screens.isHelpOpen()).toBe(false);
      expect(isShown("help-overlay")).toBe(false);
    });

    it("opens help from the start screen, traps Tab inside it, and returns focus to START", async () => {
      create().showStart();
      await user.click(within(byId("start-screen")).getByRole("button", { name: "遊び方" }));
      expect(isShown("help-overlay")).toBe(true);
      expect(isShown("start-screen")).toBe(true);
      expect(byId("help-overlay").getAttribute("role")).toBe("dialog");
      expect(byId("help-overlay").getAttribute("aria-modal")).toBe("true");
      // The start screen underneath is inert so Tab cannot escape to its pills.
      expect(byId("start-screen").inert).toBe(true);
      expect(document.activeElement).toBe(byId("help-close"));
      await user.click(screen.getByRole("button", { name: "CLOSE" }));
      expect(isShown("help-overlay")).toBe(false);
      expect(byId("start-screen").inert).toBe(false);
      expect(document.activeElement).toBe(byId("start-btn"));
    });

    it("closes help with Escape on the start screen", () => {
      const screens = create();
      screens.showStart();
      screens.showHelp();
      const e = pressKey("Escape");
      expect(e.defaultPrevented).toBe(true);
      expect(screens.isHelpOpen()).toBe(false);
      expect(document.activeElement).toBe(byId("start-btn"));
    });

    it("leaves Escape to the game when help is closed or opened mid-run", () => {
      const screens = create();
      screens.showStart();
      // Help closed: nothing to do.
      expect(pressKey("Escape").defaultPrevented).toBe(false);
      // Help over a run (start screen hidden): the game keyboard owns Escape.
      screens.hideStart();
      screens.showHelp();
      expect(pressKey("Escape").defaultPrevented).toBe(false);
      expect(screens.isHelpOpen()).toBe(true);
      // Closing it mid-run must not pull focus to the hidden START button.
      byId("help-close").focus();
      screens.hideHelp();
      expect(document.activeElement).not.toBe(byId("start-btn"));
    });

    it("tells players that Backspace only cancels the mistake", () => {
      create();
      const body = byId("help-overlay").textContent ?? "";
      expect(body).toContain("ミスだけを取り消せます");
      expect(body).not.toContain("1文字戻れます");
    });

    it("hideAll clears every overlay at once", () => {
      const screens = create();
      screens.showStart();
      screens.showPause();
      screens.showHelp();
      screens.hideAll();
      for (const id of ["start-screen", "results", "pause-overlay", "help-overlay"]) {
        expect(isShown(id)).toBe(false);
      }
      // A start screen left inert would be unusable the next time it is shown.
      expect(byId("start-screen").inert).toBe(false);
    });
  });
});
