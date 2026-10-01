// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pressKey } from "../test/dom.js";
import { attachKeyboard, type KeyboardHooks } from "./keyboard.js";

function makeHooks(state: { typing: boolean; inGame: boolean }): KeyboardHooks {
  return {
    onChar: vi.fn(),
    onBackspace: vi.fn(),
    onEscape: vi.fn(),
    onRestart: vi.fn(),
    isTyping: () => state.typing,
    isInGame: () => state.inGame,
  };
}

describe("attachKeyboard", () => {
  let detach: () => void = () => {};
  afterEach(() => detach());

  describe("while typing", () => {
    const state = { typing: true, inGame: true };
    let hooks: KeyboardHooks;
    beforeEach(() => {
      hooks = makeHooks(state);
      detach = attachKeyboard(hooks);
    });

    it("forwards printable characters", () => {
      pressKey("a");
      pressKey("{");
      expect(hooks.onChar).toHaveBeenNthCalledWith(1, "a");
      expect(hooks.onChar).toHaveBeenNthCalledWith(2, "{");
    });

    it("forwards Space but stops the page from scrolling", () => {
      const e = pressKey(" ");
      expect(hooks.onChar).toHaveBeenCalledWith(" ");
      expect(e.defaultPrevented).toBe(true);
    });

    it("does not prevent default for ordinary letters", () => {
      const e = pressKey("a");
      expect(e.defaultPrevented).toBe(false);
    });

    it("maps Enter to a newline character", () => {
      const e = pressKey("Enter");
      expect(hooks.onChar).toHaveBeenCalledWith("\n");
      expect(e.defaultPrevented).toBe(true);
    });

    it("routes Backspace to the backspace hook", () => {
      const e = pressKey("Backspace");
      expect(hooks.onBackspace).toHaveBeenCalledTimes(1);
      expect(hooks.onChar).not.toHaveBeenCalled();
      expect(e.defaultPrevented).toBe(true);
    });

    it("ignores non-printable keys such as Shift and arrows", () => {
      pressKey("Shift");
      pressKey("ArrowLeft");
      pressKey("F5");
      expect(hooks.onChar).not.toHaveBeenCalled();
    });

    it("leaves browser shortcuts alone", () => {
      const e1 = pressKey("c", { metaKey: true });
      const e2 = pressKey("r", { ctrlKey: true });
      const e3 = pressKey("Escape", { altKey: true });
      expect(hooks.onChar).not.toHaveBeenCalled();
      expect(hooks.onEscape).not.toHaveBeenCalled();
      expect([e1, e2, e3].some((e) => e.defaultPrevented)).toBe(false);
    });

    it("pauses on Escape and restarts on Tab", () => {
      const esc = pressKey("Escape");
      const tab = pressKey("Tab");
      expect(hooks.onEscape).toHaveBeenCalledTimes(1);
      expect(hooks.onRestart).toHaveBeenCalledTimes(1);
      expect(esc.defaultPrevented).toBe(true);
      expect(tab.defaultPrevented).toBe(true);
      expect(hooks.onChar).not.toHaveBeenCalled();
    });
  });

  describe("while paused", () => {
    it("still handles Escape and Tab but swallows no characters", () => {
      const hooks = makeHooks({ typing: false, inGame: true });
      detach = attachKeyboard(hooks);
      pressKey("a");
      pressKey("Backspace");
      pressKey("Escape");
      pressKey("Tab");
      expect(hooks.onChar).not.toHaveBeenCalled();
      expect(hooks.onBackspace).not.toHaveBeenCalled();
      expect(hooks.onEscape).toHaveBeenCalledTimes(1);
      expect(hooks.onRestart).toHaveBeenCalledTimes(1);
    });
  });

  describe("on menus", () => {
    it("captures nothing so Tab keeps navigating focus", () => {
      const hooks = makeHooks({ typing: false, inGame: false });
      detach = attachKeyboard(hooks);
      const tab = pressKey("Tab");
      const esc = pressKey("Escape");
      pressKey("a");
      expect(tab.defaultPrevented).toBe(false);
      expect(esc.defaultPrevented).toBe(false);
      expect(hooks.onRestart).not.toHaveBeenCalled();
      expect(hooks.onEscape).not.toHaveBeenCalled();
      expect(hooks.onChar).not.toHaveBeenCalled();
    });
  });

  it("stops listening once detached", () => {
    const hooks = makeHooks({ typing: true, inGame: true });
    detach = attachKeyboard(hooks);
    detach();
    detach = () => {};
    pressKey("a");
    expect(hooks.onChar).not.toHaveBeenCalled();
  });
});
