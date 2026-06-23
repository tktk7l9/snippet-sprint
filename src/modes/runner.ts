// Code Runner: type a stream of code lines to rush through a neon tunnel.
// Correct keys accelerate, mistakes brake and fill the crash meter. Distance = score.

import { selectSnippet } from "../engine/select.js";
import { RunnerGame } from "../engine/runner.js";
import { rankByThresholds } from "../engine/scoring.js";
import { CodeView } from "../ui/codeview.js";
import { byId } from "../ui/dom.js";
import { shakeEl } from "../ui/feedback.js";
import type { GameMode, ModeServices, PlayConfig } from "./types.js";

const DIST_TIERS = { S: 2000, A: 1200, B: 700, C: 300 };

// A line provider that draws lines from the selected snippets, trimming
// indentation and skipping blank lines, picking a fresh snippet when drained.
function makeLineProvider(config: PlayConfig): () => string {
  let queue: string[] = [];
  let lastId: string | undefined;
  return () => {
    while (queue.length === 0) {
      const snip = selectSnippet({
        languages: config.languages,
        difficulty: config.difficulty,
        category: config.category,
        excludeId: lastId,
      });
      lastId = snip.id;
      queue = snip.code
        .split("\n")
        .map((line) => line.trimStart())
        .filter((line) => line.length > 0);
    }
    return queue.shift() as string;
  };
}

export class RunnerMode implements GameMode {
  readonly id = "runner" as const;

  private readonly view = byId("runner-view");
  private readonly lineEl = byId<HTMLPreElement>("runner-line");
  private readonly codeView = new CodeView(this.lineEl);
  private readonly speedEl = byId("run-speed");
  private readonly distEl = byId("run-dist");
  private readonly comboEl = byId("run-combo");
  private readonly crashEl = byId("crash-fill");

  private game: RunnerGame | null = null;
  private ended = false;

  constructor(private readonly services: ModeServices) {}

  begin(config: PlayConfig): void {
    this.game = new RunnerGame({ nextLine: makeLineProvider(config) });
    this.ended = false;
    this.codeView.mount(this.game.session);
    this.view.classList.add("show");
    this.refreshStats();
  }

  inputChar(ch: string): void {
    const game = this.game;
    if (!game || game.gameOver) return;

    const r = game.input(ch);
    const combo = this.services.record(r.correct, r.expected);

    if (r.correct) {
      this.services.audio.key();
      this.services.effects.spark();
      if (r.lineComplete) {
        this.codeView.mount(game.session);
      } else {
        this.codeView.refresh(game.session);
      }
      if (combo > 0 && combo % 10 === 0) {
        this.services.effects.shockwave();
        this.services.audio.combo(combo);
        this.services.toast(`COMBO ×${combo}`);
      }
    } else {
      this.services.audio.error();
      this.services.effects.shakeImpulse();
      shakeEl(this.lineEl);
      this.codeView.refresh(game.session);
    }

    this.refreshStats();
    this.checkGameOver();
  }

  backspace(): void {
    if (this.game) {
      this.game.backspace();
      this.codeView.refresh(this.game.session);
    }
  }

  update(dt: number, _now: number): void {
    if (!this.game) return;
    this.game.tick(dt);
    this.refreshStats();
    this.checkGameOver();
  }

  signals() {
    const speed = this.game?.speed ?? 0;
    const crash = this.game?.crash ?? 0;
    return {
      progress: 0,
      combo: this.services.stats(performance.now()).combo,
      accuracy: 1,
      active: this.game !== null && !this.game.gameOver,
      rush: Math.min(1, speed / 60),
      danger: crash,
    };
  }

  end(): void {
    this.view.classList.remove("show");
  }

  private checkGameOver(): void {
    if (this.game && this.game.gameOver && !this.ended) {
      this.ended = true;
      const dist = Math.round(this.game.distance);
      this.services.finish({
        score: dist,
        rank: rankByThresholds(dist, DIST_TIERS),
        recordKey: "runner",
      });
    }
  }

  private refreshStats(): void {
    const game = this.game;
    if (!game) return;
    this.speedEl.textContent = String(Math.round(game.speed));
    this.distEl.textContent = `${Math.round(game.distance)}m`;
    this.comboEl.textContent = String(this.services.stats(performance.now()).combo);
    this.crashEl.style.width = `${Math.round(game.crash * 100)}%`;
  }
}
