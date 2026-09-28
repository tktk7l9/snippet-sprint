// Overlay screens: start (language/category/difficulty picker), results
// (rank + stats + mistake analysis), pause and help.

import type { Category, Difficulty, Language } from "../engine/content/types.js";
import type { BestRecord } from "../engine/records.js";
import type { Rank } from "../engine/scoring.js";
import type { MissEntry } from "../engine/stats.js";
import type { PlayConfig } from "../modes/types.js";
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
  D: "#6c7390",
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

    byId("start-btn").addEventListener("click", () => handlers.onStart(this.config()));
    byId("btn-retry").addEventListener("click", () => handlers.onRetry());
    byId("btn-next").addEventListener("click", () => handlers.onNext());
    byId("btn-menu").addEventListener("click", () => handlers.onMenu());
    byId("pause-menu").addEventListener("click", () => handlers.onMenu());
    byId("help-close").addEventListener("click", () => this.hideHelp());
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
    this.resultsEl.classList.add("show");
    byId("btn-next").focus({ preventScroll: true });
  }
  hideResults(): void {
    this.resultsEl.classList.remove("show");
  }
  showPause(): void {
    this.pauseEl.classList.add("show");
  }
  hidePause(): void {
    this.pauseEl.classList.remove("show");
  }
  isPaused(): boolean {
    return this.pauseEl.classList.contains("show");
  }
  showHelp(): void {
    this.helpEl.classList.add("show");
  }
  hideHelp(): void {
    this.helpEl.classList.remove("show");
  }
  isHelpOpen(): boolean {
    return this.helpEl.classList.contains("show");
  }
  hideAll(): void {
    this.startEl.classList.remove("show");
    this.resultsEl.classList.remove("show");
    this.pauseEl.classList.remove("show");
    this.helpEl.classList.remove("show");
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
  private populateResults(data: ResultData): void {
    const rankEl = byId("result-rank");
    rankEl.textContent = data.rank;
    rankEl.style.color = RANK_COLOR[data.rank];

    byId("result-wpm").textContent = String(data.wpm);
    byId("result-acc").textContent = `${Math.round(data.accuracy * 100)}%`;
    byId("result-score").textContent = String(data.score);
    byId("result-combo").textContent = String(data.maxCombo);

    const bestEl = byId("result-best");
    if (data.best) {
      bestEl.textContent = `BEST · WPM ${data.best.wpm} · ${Math.round(data.best.accuracy * 100)}% · ${data.best.score}pt`;
      bestEl.style.cssText = "font-size:12px;letter-spacing:0.12em;color:var(--dim);font-family:ui-monospace,monospace;";
    } else {
      bestEl.textContent = "";
    }

    const box = byId("mistakes");
    box.innerHTML = "";
    const title = document.createElement("h3");

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
      bar.style.width = `${Math.max(12, (m.count / max) * 240)}px`;

      const count = document.createElement("span");
      count.className = "miss-count";
      count.textContent = `×${m.count}`;

      row.append(key, bar, count);
      box.appendChild(row);
    }
  }
}
