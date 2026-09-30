// Overlay screens: start (language/category/difficulty picker), results
// (rank + stats + mistake analysis), pause and help.

import {
  CATEGORY_LABELS,
  DIFFICULTY_LABELS,
  LANGUAGE_LABELS,
  type Category,
  type Difficulty,
  type Language,
  type Snippet,
} from "../engine/content/types.js";
import type { BestRecord } from "../engine/records.js";
import type { Rank } from "../engine/scoring.js";
import { bestLine, goalLine } from "../engine/resultText.js";
import type { MissEntry } from "../engine/stats.js";
import type { PlayConfig } from "../modes/types.js";
import { isStrayKeyActivation } from "../engine/activation.js";
import { loadPrefs, savePrefs } from "../engine/prefs.js";
import { safeStore } from "../storage.js";
import { byId } from "./dom.js";
import { shakeEl } from "./feedback.js";

export type { PlayConfig };

export interface ResultData {
  rank: Rank;
  wpm: number;
  accuracy: number;
  score: number;
  maxCombo: number;
  misses: MissEntry[];
  best: BestRecord | null;
  improved: boolean;
  /** The record this run was measured against (null on a first clear). */
  previous: BestRecord | null;
  /** What was typed, so the results screen has context (SHIG 24, 59). */
  snippet: Snippet;
}

/** Filter feasibility, injected lazily so the snippet data stays out of the initial bundle. */
export interface Availability {
  categories(languages: readonly Language[]): Set<Category>;
  difficulties(languages: readonly Language[], category: Category | "all"): Set<Difficulty>;
}

export interface ScreenHandlers {
  onStart(config: PlayConfig): void;
  onRetry(): void;
  onNext(): void;
  onMenu(): void;
}

const RANK_COLOR: Record<Rank, string> = {
  S: "#ffd86b",
  A: "#5cf2ff",
  B: "#c77dff",
  C: "#ffb86b",
  D: "#7f86a3",
};

function charLabel(ch: string): string {
  if (ch === " ") return "␣";
  if (ch === "\n") return "↵";
  if (ch === "\t") return "⇥";
  return ch;
}

function pills(containerId: string): HTMLButtonElement[] {
  return [...byId(containerId).querySelectorAll<HTMLButtonElement>(".pill")];
}

function setPressed(btn: HTMLButtonElement, on: boolean): void {
  btn.classList.toggle("active", on);
  btn.setAttribute("aria-pressed", String(on));
}

export class Screens {
  private readonly startEl = byId("start-screen");
  private readonly resultsEl = byId("results");
  private readonly pauseEl = byId("pause-overlay");
  private readonly helpEl = byId("help-overlay");

  private readonly startBtn = byId<HTMLButtonElement>("start-btn");
  private readonly langBtns = pills("lang-pills");
  private readonly catBtns = pills("cat-pills");
  private readonly diffBtns = pills("diff-pills");

  private readonly selectedLangs: Set<Language>;
  private difficulty: Difficulty | "mixed";
  private category: Category | "all";
  private availability: Availability | null = null;
  private resultsShownAt = 0;

  constructor(handlers: ScreenHandlers) {
    // Restore the last selection so returning players start where they left off (SHIG 42).
    const prefs = loadPrefs(safeStore);
    this.selectedLangs = new Set(prefs.languages);
    this.category = prefs.category;
    this.difficulty = prefs.difficulty;

    // Pills are pre-rendered in the HTML (avoids layout shift); bind handlers.
    this.bindSingle(this.catBtns, (id) => (this.category = id as Category | "all"));
    this.bindSingle(this.diffBtns, (id) => (this.difficulty = id as Difficulty | "mixed"));
    this.bindLangs();
    this.syncPills();

    this.startBtn.addEventListener("click", () => handlers.onStart(this.config()));
    // The hint promises "Enter to start"; keep that true after a click on the
    // background has moved focus off START (SHIG 22, 47).
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" || e.isComposing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (!this.startEl.classList.contains("show") || this.isHelpOpen()) return;
      const focused = document.activeElement;
      if (focused && focused !== document.body) return;
      e.preventDefault();
      // The game's own keydown listener runs after this one; without this it
      // would see the same Enter as the first typed character once play starts.
      e.stopImmediatePropagation();
      handlers.onStart(this.config());
    });
    // Esc closes help outside a run; in-game Esc is owned by the keyboard handler (SHIG 60).
    window.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || !this.isHelpOpen()) return;
      if (!this.startEl.classList.contains("show")) return;
      e.preventDefault();
      this.hideHelp();
    });
    const resultAction = (id: string, run: () => void): void => {
      byId(id).addEventListener("click", (e) => {
        if (isStrayKeyActivation(e.detail, this.resultsShownAt, performance.now())) return;
        run();
      });
    };
    resultAction("btn-retry", () => handlers.onRetry());
    resultAction("btn-next", () => handlers.onNext());
    resultAction("btn-menu", () => handlers.onMenu());
    byId("pause-menu").addEventListener("click", () => handlers.onMenu());
    byId("help-close").addEventListener("click", () => this.hideHelp());
    byId("start-help").addEventListener("click", () => this.showHelp());
  }

  config(): PlayConfig {
    return {
      languages: [...this.selectedLangs],
      difficulty: this.difficulty,
      category: this.category,
    };
  }

  /** Enable feasibility checks once the snippet data has loaded. */
  setAvailability(availability: Availability): void {
    this.availability = availability;
    this.syncPills();
  }

  // ---- visibility ----
  showStart(): void {
    this.hideAll();
    this.startEl.classList.add("show");
    // Enter starts right away for keyboard players (SHIG 22, 47).
    this.startBtn.focus({ preventScroll: true });
  }
  hideStart(): void {
    this.startEl.classList.remove("show");
  }
  showResults(data: ResultData): void {
    this.hideAll();
    this.populateResults(data);
    this.renderContext(data);
    this.resultsEl.classList.add("show");
    this.resultsShownAt = performance.now();
    byId("btn-next").focus({ preventScroll: true });
  }
  hideResults(): void {
    this.resultsEl.classList.remove("show");
  }
  showPause(): void {
    this.pauseEl.classList.add("show");
    byId("pause-resume").focus({ preventScroll: true });
  }
  hidePause(): void {
    this.pauseEl.classList.remove("show");
  }
  isPaused(): boolean {
    return this.pauseEl.classList.contains("show");
  }
  showHelp(): void {
    this.helpEl.classList.add("show");
    // Keep Tab inside the help while it covers the start screen (SHIG 60).
    this.startEl.inert = true;
    // The overlay is aria-modal, so focus must move inside it; otherwise it stays
    // on the HELP button that assistive tech now treats as hidden. Enter/Esc then
    // closes it right away, so keyboard users are not stranded (SHIG 8, 33, 22, 94).
    byId("help-close").focus({ preventScroll: true });
  }
  hideHelp(): void {
    this.helpEl.classList.remove("show");
    this.startEl.inert = false;
    // Hand focus back to the main action when the start screen is underneath.
    if (this.startEl.classList.contains("show")) this.startBtn.focus({ preventScroll: true });
  }
  isHelpOpen(): boolean {
    return this.helpEl.classList.contains("show");
  }
  hideAll(): void {
    this.startEl.classList.remove("show");
    this.resultsEl.classList.remove("show");
    this.pauseEl.classList.remove("show");
    this.helpEl.classList.remove("show");
    this.startEl.inert = false;
  }

  // ---- start screen pills (bind to pre-rendered buttons) ----
  /** Single-select group: clicking activates one button and reports its data-id. */
  private bindSingle(btns: HTMLButtonElement[], onPick: (id: string) => void): void {
    for (const btn of btns) {
      btn.addEventListener("click", (e) => {
        onPick(btn.dataset.id ?? "");
        this.changed(e);
      });
    }
  }

  /** Multi-select languages: toggle, but keep at least one active. */
  private bindLangs(): void {
    for (const btn of this.langBtns) {
      const id = (btn.dataset.id ?? "") as Language;
      btn.addEventListener("click", (e) => {
        if (this.selectedLangs.has(id)) {
          if (this.selectedLangs.size === 1) {
            // Show why nothing happened, right where the user tapped (SHIG 66).
            shakeEl(btn);
            this.refocusStart(e);
            return;
          }
          this.selectedLangs.delete(id);
        } else {
          this.selectedLangs.add(id);
        }
        this.changed(e);
      });
    }
  }

  private changed(e: MouseEvent): void {
    this.syncPills();
    savePrefs(safeStore, this.config());
    this.refocusStart(e);
  }

  /**
   * After a pointer pick, hand focus back to START so Enter plays; keyboard
   * users (detail === 0) keep their place in the tab order.
   */
  private refocusStart(e: MouseEvent): void {
    if (e.detail > 0) this.startBtn.focus({ preventScroll: true });
  }

  /**
   * Reflect the selection on every pill (class + aria-pressed, SHIG 96) and
   * disable filters that have no snippet for the chosen languages (SHIG 13, 32).
   * A selection that became impossible falls back to All / Mixed.
   */
  private syncPills(): void {
    const langs = [...this.selectedLangs];
    const cats = this.availability?.categories(langs);
    if (cats && this.category !== "all" && !cats.has(this.category)) this.category = "all";
    const diffs = this.availability?.difficulties(langs, this.category);
    if (diffs && this.difficulty !== "mixed" && !diffs.has(this.difficulty)) this.difficulty = "mixed";

    for (const btn of this.langBtns) {
      setPressed(btn, this.selectedLangs.has(btn.dataset.id as Language));
    }
    for (const btn of this.catBtns) {
      const id = btn.dataset.id as Category | "all";
      setPressed(btn, id === this.category);
      btn.disabled = !!cats && id !== "all" && !cats.has(id);
    }
    for (const btn of this.diffBtns) {
      const id = btn.dataset.id as Difficulty | "mixed";
      setPressed(btn, id === this.difficulty);
      btn.disabled = !!diffs && id !== "mixed" && !diffs.has(id);
    }
  }

  // ---- results ----
  /** Snippet identity and the next rank to aim for (SHIG 24, 55, 89). */
  private renderContext(data: ResultData): void {
    const meta = byId("result-meta");
    meta.textContent = "";
    const lang = document.createElement("span");
    lang.className = "meta-lang";
    lang.textContent = LANGUAGE_LABELS[data.snippet.language];
    meta.append(
      lang,
      ` · ${CATEGORY_LABELS[data.snippet.category]} · ${DIFFICULTY_LABELS[data.snippet.difficulty]} · ${data.snippet.label}`,
    );
    byId("result-goal").textContent = goalLine(data.wpm, data.accuracy);
  }

  private populateResults(data: ResultData): void {
    byId("result-rank").textContent = data.rank;
    // Color the heading (not the inner span) so the glow keeps following the rank.
    byId("result-heading").style.color = RANK_COLOR[data.rank];

    byId("result-wpm").textContent = String(data.wpm);
    byId("result-acc").textContent = `${Math.round(data.accuracy * 100)}%`;
    byId("result-score").textContent = String(data.score);
    byId("result-combo").textContent = String(data.maxCombo);

    const bestEl = byId("result-best");
    bestEl.style.cssText = "font-size:12px;letter-spacing:0.12em;color:var(--dim);font-family:ui-monospace,monospace;";
    bestEl.textContent = bestLine(data);

    const box = byId("mistakes");
    box.innerHTML = "";
    const title = document.createElement("h2");

    if (data.misses.length === 0) {
      title.textContent = data.improved ? "ノーミス · ベスト更新 🎉" : "ノーミス 🎯";
      box.appendChild(title);
      return;
    }

    title.textContent = data.improved ? "弱点分析 · ベスト更新 🎉" : "弱点分析（つまずいた記号）";
    box.appendChild(title);

    const max = data.misses[0].count;
    for (const m of data.misses) {
      const row = document.createElement("div");
      row.className = "miss-row";

      const key = document.createElement("span");
      key.className = "miss-key";
      key.textContent = charLabel(m.char);

      const bar = document.createElement("div");
      bar.className = "miss-bar";
      bar.setAttribute("aria-hidden", "true"); // the count next to it carries the value
      bar.style.width = `${Math.max(12, (m.count / max) * 240)}px`;

      const count = document.createElement("span");
      count.className = "miss-count";
      count.textContent = `×${m.count}`;

      row.append(key, bar, count);
      box.appendChild(row);
    }
  }
}
