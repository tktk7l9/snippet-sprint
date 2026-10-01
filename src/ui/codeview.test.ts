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
});
