// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { TypingSession } from "../engine/typing.js";
import { CodeView } from "./codeview.js";

function classes(el: HTMLElement): string[] {
  return [...el.querySelectorAll("span")].map((s) => s.className);
}

describe("CodeView", () => {
  let el: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '<pre id="code"></pre>';
    el = document.getElementById("code") as HTMLElement;
  });

  it("renders one span per character with the cursor on the first", () => {
    const view = new CodeView(el);
    view.mount(new TypingSession("ab"));
    expect(el.textContent).toBe("ab");
    expect(classes(el)).toEqual(["ch current", "ch pending"]);
  });

  it("shows newlines as a visible return glyph and marks them", () => {
    const view = new CodeView(el);
    view.mount(new TypingSession("a\nb"));
    expect(el.textContent).toBe("a↵\nb");
    expect(classes(el)[1]).toBe("ch pending ret");
  });

  it("advances the cursor and settles typed characters on refresh", () => {
    const view = new CodeView(el);
    const session = new TypingSession("abc");
    view.mount(session);
    session.input("a");
    view.refresh(session);
    expect(classes(el)).toEqual(["ch correct", "ch current", "ch pending"]);
  });

  it("flags the current cell red after a mistake and clears it on recovery", () => {
    const view = new CodeView(el);
    const session = new TypingSession("ab");
    view.mount(session);
    session.input("x");
    view.refresh(session);
    expect(classes(el)[0]).toBe("ch current error");
    session.input("a");
    view.refresh(session);
    expect(classes(el)).toEqual(["ch correct", "ch current"]);
  });

  it("only rewrites spans whose state changed", () => {
    const view = new CodeView(el);
    const session = new TypingSession("abc");
    view.mount(session);
    const spans = [...el.querySelectorAll("span")];
    const last = spans[2];
    last.className = "sentinel";
    session.input("a");
    view.refresh(session);
    // The third cell is still pending, so its span was not touched.
    expect(last.className).toBe("sentinel");
  });

  it("replaces the previous snippet on remount", () => {
    const view = new CodeView(el);
    view.mount(new TypingSession("first"));
    view.mount(new TypingSession("xy"));
    expect(el.textContent).toBe("xy");
    expect(el.querySelectorAll("span")).toHaveLength(2);
  });

  describe("in a panel shorter than the snippet", () => {
    // jsdom has no layout: give each span a line box and the panel a height.
    function layOut(lineHeight: number, panel: number, total: number): void {
      Object.defineProperty(el, "clientHeight", { configurable: true, value: panel });
      Object.defineProperty(el, "scrollHeight", { configurable: true, value: total });
      el.querySelectorAll("span").forEach((span, i) => {
        Object.defineProperty(span, "offsetTop", { configurable: true, value: i * lineHeight });
        Object.defineProperty(span, "offsetHeight", { configurable: true, value: lineHeight });
      });
    }

    it("scrolls so the cursor line stays in view, and starts at the top on remount", () => {
      const view = new CodeView(el);
      const session = new TypingSession("a\nb\nc\nd\ne\nf\ng\nh");
      view.mount(session);
      layOut(10, 40, 150); // one span per 10px line: every character sits on its own line
      session.input("a");
      view.refresh(session); // cursor at 10px: comfortably inside
      expect(el.scrollTop).toBe(0);
      for (const ch of "\nb\nc") session.input(ch);
      view.refresh(session); // cursor at 50px: below the 40px panel
      expect(el.scrollTop).toBeCloseTo(50 - 40 / 3);
      view.mount(new TypingSession("xy"));
      expect(el.scrollTop).toBe(0);
    });

    it("leaves the scroll alone when the cursor is already visible, or nothing overflows", () => {
      const view = new CodeView(el);
      const session = new TypingSession("abcdefgh");
      view.mount(session);
      layOut(10, 40, 40);
      for (const ch of "abcdefg") session.input(ch);
      view.refresh(session);
      expect(el.scrollTop).toBe(0);
      layOut(10, 40, 80);
      el.scrollTop = 0;
      const short = new TypingSession("ab");
      view.mount(short);
      layOut(10, 40, 80);
      short.input("a");
      view.refresh(short);
      expect(el.scrollTop).toBe(0);
    });

    it("does nothing once the cursor has run past the last character", () => {
      const view = new CodeView(el);
      const session = new TypingSession("ab");
      view.mount(session);
      layOut(10, 5, 20);
      el.scrollTop = 7;
      session.input("a");
      session.input("b");
      view.refresh(session);
      expect(el.scrollTop).toBe(7);
    });
  });
});
