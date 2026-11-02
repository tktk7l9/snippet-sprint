// Renders a TypingSession into a target element as per-character spans,
// updating only the spans whose state changed. When the snippet is taller than
// its panel (phones), the panel scrolls and follows the cursor.

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
    this.el.scrollTop = 0;
  }

  refresh(session: TypingSession): void {
    for (let i = 0; i < this.spans.length; i++) {
      const cls = this.classFor(session, i);
      if (cls !== this.cache[i]) {
        this.spans[i].className = cls;
        this.cache[i] = cls;
      }
    }
    this.follow(session.index);
  }

  /**
   * Keep the cursor line visible inside a scrolling panel, with a line of
   * context above it, so the next characters are always on screen (SHIG 85).
   */
  private follow(index: number): void {
    const span = this.spans[index];
    const view = this.el.clientHeight;
    if (!span || this.el.scrollHeight <= view) return;
    const top = span.offsetTop;
    const bottom = top + span.offsetHeight;
    const margin = span.offsetHeight * 1.5;
    if (top - margin < this.el.scrollTop || bottom + margin > this.el.scrollTop + view) {
      this.el.scrollTop = Math.max(0, top - view / 3);
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
