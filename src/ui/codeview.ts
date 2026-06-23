// Renders a TypingSession into a target element as per-character spans,
// updating only the spans whose state changed.

import type { TypingSession } from "../engine/typing.js";

export class CodeView {
  private spans: HTMLSpanElement[] = [];
  private cache: string[] = [];

  constructor(private readonly el: HTMLElement) {}

  mount(session: TypingSession): void {
    this.el.textContent = "";
    this.spans = [];
    this.cache = [];
    const frag = document.createDocumentFragment();
    session.cells.forEach((cell, i) => {
      const span = document.createElement("span");
      span.textContent = cell.char === "\n" ? "↵\n" : cell.char;
      const cls = this.classFor(session, i);
      span.className = cls;
      this.cache.push(cls);
      this.spans.push(span);
      frag.appendChild(span);
    });
    this.el.appendChild(frag);
  }

  refresh(session: TypingSession): void {
    for (let i = 0; i < this.spans.length; i++) {
      const cls = this.classFor(session, i);
      if (cls !== this.cache[i]) {
        this.spans[i].className = cls;
        this.cache[i] = cls;
      }
    }
  }

  private classFor(session: TypingSession, i: number): string {
    const cell = session.cells[i];
    const ret = cell.char === "\n" ? " ret" : "";
    if (i === session.index) {
      return `ch current${session.hasError ? " error" : ""}${ret}`;
    }
    if (cell.status === "correct") return `ch correct${ret}`;
    return `ch pending${ret}`;
  }
}
