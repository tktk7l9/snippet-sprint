// Overlay screens: start (language/category/difficulty picker), results
// (rank + stats + mistake analysis), pause and help.

import { LANGUAGE_ORDER } from "../engine/content/types.js";
import type { Category, Difficulty, Language } from "../engine/content/types.js";
import type { BestRecord } from "../engine/records.js";
import type { Rank } from "../engine/scoring.js";
import type { MissEntry } from "../engine/stats.js";
import type { PlayConfig } from "../modes/types.js";
import { byId } from "./dom.js";

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

export class Screens {
  private readonly startEl = byId("start-screen");
  private readonly resultsEl = byId("results");
  private readonly pauseEl = byId("pause-overlay");
  private readonly helpEl = byId("help-overlay");

  private readonly selectedLangs = new Set<Language>(LANGUAGE_ORDER);
  private difficulty: Difficulty | "mixed" = "mixed";
  private category: Category | "all" = "all";

  constructor(handlers: ScreenHandlers) {
    // Pills are pre-rendered in the HTML (avoids layout shift); bind handlers.
    this.bindSingle("cat-pills", (id) => (this.category = id as Category | "all"));
    this.bindSingle("diff-pills", (id) => (this.difficulty = id as Difficulty | "mixed"));
    this.bindLangs();

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

  // ---- visibility ----
  showStart(): void {
    this.hideAll();
    this.startEl.classList.add("show");
  }
  hideStart(): void {
    this.startEl.classList.remove("show");
  }
  showResults(data: ResultData): void {
    this.hideAll();
    this.populateResults(data);
    this.resultsEl.classList.add("show");
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
  private bindSingle(containerId: string, onPick: (id: string) => void): void {
    const btns = [...byId(containerId).querySelectorAll<HTMLButtonElement>(".pill")];
    for (const btn of btns) {
      btn.addEventListener("click", () => {
        for (const b of btns) b.classList.remove("active");
        btn.classList.add("active");
        onPick(btn.dataset.id ?? "");
      });
    }
  }

  /** Multi-select languages: toggle, but keep at least one active. */
  private bindLangs(): void {
    const btns = [...byId("lang-pills").querySelectorAll<HTMLButtonElement>(".pill")];
    for (const btn of btns) {
      const id = (btn.dataset.id ?? "") as Language;
      btn.addEventListener("click", () => {
        if (this.selectedLangs.has(id)) {
          if (this.selectedLangs.size === 1) return; // keep at least one
          this.selectedLangs.delete(id);
          btn.classList.remove("active");
        } else {
          this.selectedLangs.add(id);
          btn.classList.add("active");
        }
      });
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
