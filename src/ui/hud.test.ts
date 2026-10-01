// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Snippet } from "../engine/content/types.js";
import { TypingSession } from "../engine/typing.js";
import { isShown, mountApp } from "../test/dom.js";
import { byId } from "./dom.js";
import { Hud } from "./hud.js";

const snippet: Snippet = {
  id: "py-x",
  language: "py",
  category: "flow",
  difficulty: "hard",
  label: "x",
  description: "条件分岐の例",
  code: "if x:\n    y",
};

describe("Hud", () => {
  beforeEach(() => {
    mountApp();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("shows and hides the sprint view", () => {
    const hud = new Hud();
    hud.show();
    expect(isShown("sprint-view")).toBe(true);
    hud.hide();
    expect(isShown("sprint-view")).toBe(false);
  });

  it("writes human labels for language, category and difficulty", () => {
    new Hud().setMeta(snippet);
    expect(byId("meta-lang").textContent).toBe("Python");
    expect(byId("meta-cat").textContent).toBe("Flow · Hard");
    expect(byId("code-desc").textContent).toBe("条件分岐の例");
  });

  it("mounts the snippet and reflects typing progress in the code panel", () => {
    const hud = new Hud();
    const session = new TypingSession(snippet.code);
    hud.mountSnippet(session);
    expect(byId("code").textContent).toBe("if x:↵\n    y");
    session.input("i");
    hud.refresh(session);
    const spans = byId("code").querySelectorAll("span");
    expect(spans[0].className).toBe("ch correct");
    expect(spans[1].className).toBe("ch current");
  });

  it("formats live stats as the player sees them", () => {
    new Hud().setStats({
      wpm: 42,
      accuracy: 0.9567,
      combo: 7,
      maxCombo: 9,
      elapsedMs: 12345,
      keystrokes: 20,
      mistakes: 1,
    });
    expect(byId("stat-wpm").textContent).toBe("42");
    expect(byId("stat-acc").textContent).toBe("96%");
    expect(byId("stat-combo").textContent).toBe("7");
    expect(byId("stat-time").textContent).toBe("12.3s");
  });

  it("maps progress fractions to the bar width", () => {
    const hud = new Hud();
    hud.setProgress(0.333);
    expect(byId("progress-fill").style.width).toBe("33%");
    hud.setProgress(1);
    expect(byId("progress-fill").style.width).toBe("100%");
  });

  it("shakes the code panel on a mistake", () => {
    new Hud().shake();
    expect(byId("code").classList.contains("shake")).toBe(true);
    vi.advanceTimersByTime(200);
    expect(byId("code").classList.contains("shake")).toBe(false);
  });
});
