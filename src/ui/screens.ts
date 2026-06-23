// Overlay screens: start (language/category/difficulty picker), results
// (rank + stats + mistake analysis), pause and help.

import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  DIFFICULTY_LABELS,
  DIFFICULTY_ORDER,
  LANGUAGE_LABELS,
  LANGUAGE_ORDER,
} from "../engine/content/types.js";
import type { Category, Difficulty, Language } from "../engine/content/types.js";
import type { BestRecord } from "../engine/records.js";
import type { Rank } from "../engine/scoring.js";
import type { MissEntry } from "../engine/stats.js";
import {
  MODE_LABELS,
  MODE_ORDER,
  type ModeId,
  type PlayConfig,
} from "../modes/types.js";
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

  private mode: ModeId = "sprint";
  private readonly selectedLangs = new Set<Language>(LANGUAGE_ORDER);
  private difficulty: Difficulty | "mixed" = "mixed";
  private category: Category | "all" = "all";

  constructor(handlers: ScreenHandlers) {
    this.buildModePills();
    this.buildLangPills();
    this.buildDiffPills();
    this.buildCatPills();

    byId("start-btn").addEventListener("click", () => handlers.onStart(this.config()));
    byId("btn-retry").addEventListener("click", () => handlers.onRetry());
    byId("btn-next").addEventListener("click", () => handlers.onNext());
    byId("btn-menu").addEventListener("click", () => handlers.onMenu());
    byId("pause-menu").addEventListener("click", () => handlers.onMenu());
    byId("help-close").addEventListener("click", () => this.hideHelp());
  }

  config(): PlayConfig {
    return {
      mode: this.mode,
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

  // ---- start screen pills ----
  private buildModePills(): void {
    const container = byId("mode-pills");
    const buttons: HTMLButtonElement[] = [];
    for (const id of MODE_ORDER) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = id === this.mode ? "pill active" : "pill";
      btn.textContent = MODE_LABELS[id];
      btn.addEventListener("click", () => {
        this.mode = id;
        for (const b of buttons) b.classList.remove("active");
        btn.classList.add("active");
      });
      buttons.push(btn);
      container.appendChild(btn);
    }
  }

  private buildLangPills(): void {
    const container = byId("lang-pills");
    for (const lang of LANGUAGE_ORDER) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pill active";
      btn.textContent = LANGUAGE_LABELS[lang];
      btn.addEventListener("click", () => {
        if (this.selectedLangs.has(lang)) {
          if (this.selectedLangs.size === 1) return; // keep at least one
          this.selectedLangs.delete(lang);
          btn.classList.remove("active");
        } else {
          this.selectedLangs.add(lang);
          btn.classList.add("active");
        }
      });
      container.appendChild(btn);
    }
  }

  private buildDiffPills(): void {
    const container = byId("diff-pills");
    const opts: { id: Difficulty | "mixed"; label: string }[] = [
      { id: "mixed", label: "Mixed" },
      ...DIFFICULTY_ORDER.map((d) => ({ id: d, label: DIFFICULTY_LABELS[d] })),
    ];
    const buttons: HTMLButtonElement[] = [];
    for (const opt of opts) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.dataset.diff = "1";
      btn.className = opt.id === this.difficulty ? "pill active" : "pill";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        this.difficulty = opt.id;
        for (const b of buttons) b.classList.remove("active");
        btn.classList.add("active");
      });
      buttons.push(btn);
      container.appendChild(btn);
    }
  }

  private buildCatPills(): void {
    const container = byId("cat-pills");
    const opts: { id: Category | "all"; label: string }[] = [
      { id: "all", label: "All" },
      ...CATEGORY_ORDER.map((c) => ({ id: c, label: CATEGORY_LABELS[c] })),
    ];
    const buttons: HTMLButtonElement[] = [];
    for (const opt of opts) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = opt.id === this.category ? "pill active" : "pill";
      btn.textContent = opt.label;
      btn.addEventListener("click", () => {
        this.category = opt.id;
        for (const b of buttons) b.classList.remove("active");
        btn.classList.add("active");
      });
      buttons.push(btn);
      container.appendChild(btn);
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
