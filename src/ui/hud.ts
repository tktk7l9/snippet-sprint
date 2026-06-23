// Sprint-mode HUD: snippet (via CodeView), live stats, progress and meta.

import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  LANGUAGE_LABELS,
} from "../engine/content/types.js";
import type { Snippet } from "../engine/content/types.js";
import type { StatsSnapshot } from "../engine/stats.js";
import type { TypingSession } from "../engine/typing.js";
import { CodeView } from "./codeview.js";
import { byId } from "./dom.js";
import { shakeEl } from "./feedback.js";

export class Hud {
  private readonly root = byId("sprint-view");
  private readonly codeEl = byId<HTMLPreElement>("code");
  private readonly code = new CodeView(this.codeEl);
  private readonly wpmEl = byId("stat-wpm");
  private readonly accEl = byId("stat-acc");
  private readonly comboEl = byId("stat-combo");
  private readonly timeEl = byId("stat-time");
  private readonly metaLangEl = byId("meta-lang");
  private readonly metaCatEl = byId("meta-cat");
  private readonly descEl = byId("code-desc");
  private readonly progressEl = byId("progress-fill");

  show(): void {
    this.root.classList.add("show");
  }
  hide(): void {
    this.root.classList.remove("show");
  }

  setMeta(snippet: Snippet): void {
    this.metaLangEl.textContent = LANGUAGE_LABELS[snippet.language];
    this.metaCatEl.textContent = `${CATEGORY_LABELS[snippet.category]} · ${DIFFICULTY_LABELS[snippet.difficulty]}`;
    this.descEl.textContent = snippet.description;
  }

  mountSnippet(session: TypingSession): void {
    this.code.mount(session);
  }

  refresh(session: TypingSession): void {
    this.code.refresh(session);
  }

  setStats(snap: StatsSnapshot): void {
    this.wpmEl.textContent = String(snap.wpm);
    this.accEl.textContent = `${Math.round(snap.accuracy * 100)}%`;
    this.comboEl.textContent = String(snap.combo);
    this.timeEl.textContent = `${(snap.elapsedMs / 1000).toFixed(1)}s`;
  }

  setProgress(fraction: number): void {
    this.progressEl.style.width = `${Math.round(fraction * 100)}%`;
  }

  shake(): void {
    shakeEl(this.codeEl);
  }
}
