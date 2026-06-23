// The Three.js-heavy game runtime. Loaded on demand via dynamic import() so the
// initial bundle (just the start screen) stays small. main.ts boots this lazily.

import { createRenderContext } from "./render/renderer.js";
import { Stage, type StageSignals } from "./render/stage.js";
import { EffectsLayer } from "./render/effects.js";
import { byId } from "./ui/dom.js";
import { setMuted, toast } from "./ui/feedback.js";
import { AudioEngine } from "./audio/audio.js";
import { attachKeyboard } from "./input/keyboard.js";
import { attachMobileInput, focusSink, isTouchDevice } from "./input/mobile.js";
import { StatsTracker } from "./engine/stats.js";
import type { Rank } from "./engine/scoring.js";
import { bestFor, saveResult, type RecordStore } from "./engine/records.js";
import { SprintMode } from "./modes/sprint.js";
import { FallingMode } from "./modes/falling.js";
import { RunnerMode } from "./modes/runner.js";
import type { GameMode, ModeId, ModeServices, PlayConfig } from "./modes/types.js";
import type { Screens } from "./ui/screens.js";

export interface GameController {
  start(config: PlayConfig): void;
  retry(): void;
  next(): void;
  menu(): void;
}

type AppState = "menu" | "playing" | "paused" | "results";

const IDLE: StageSignals = { progress: 0, combo: 0, accuracy: 1, active: false };

const store: RecordStore = {
  getItem(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore quota / disabled storage */
    }
  },
};

export function createGame(screens: Screens): GameController {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = byId<HTMLCanvasElement>("scene");
  const ctx = createRenderContext(canvas, reducedMotion);
  const stage = new Stage();
  const effects = new EffectsLayer(reducedMotion);
  ctx.scene.add(stage.group);
  ctx.scene.add(effects.group);

  const audio = new AudioEngine();
  const sink = byId<HTMLInputElement>("key-sink");
  const playHud = byId("play-hud");

  let state: AppState = "menu";
  let stats = new StatsTracker();
  let config: PlayConfig | null = null;
  let active: GameMode | null = null;
  let suspendStart = 0;

  const services: ModeServices = {
    ctx,
    effects,
    audio,
    record(correct, expected) {
      stats.record(correct, expected, performance.now());
      return stats.combo;
    },
    stats(now) {
      return stats.snapshot(now);
    },
    finish(opts) {
      finishRun(opts.score, opts.rank, opts.recordKey);
    },
    toast,
  };

  const modes: Record<ModeId, GameMode> = {
    sprint: new SprintMode(services),
    falling: new FallingMode(services),
    runner: new RunnerMode(services),
  };

  setMuted(!audio.enabled);

  function startRun(cfg: PlayConfig): void {
    config = cfg;
    audio.resume();
    stats = new StatsTracker();
    active?.end();
    active = modes[cfg.mode];
    screens.hideAll();
    playHud.classList.add("show");
    active.begin(cfg);
    state = "playing";
    if (isTouchDevice()) focusSink(sink);
  }

  function finishRun(score: number, rank: Rank, recordKey: string): void {
    const now = performance.now();
    stats.finish(now);
    const snap = stats.snapshot(now);
    const outcome = saveResult(store, recordKey, {
      wpm: snap.wpm,
      accuracy: snap.accuracy,
      score,
      rank,
    });
    audio.complete();
    state = "results";
    active?.end();
    playHud.classList.remove("show");
    screens.showResults({
      rank,
      wpm: snap.wpm,
      accuracy: snap.accuracy,
      score,
      maxCombo: snap.maxCombo,
      misses: stats.topMisses(),
      best: bestFor(store, recordKey),
      improved: outcome.improved,
    });
  }

  function toMenu(): void {
    state = "menu";
    active?.end();
    active = null;
    playHud.classList.remove("show");
    screens.showStart();
  }

  // ---- input routing ----
  function routeChar(ch: string): void {
    if (state !== "playing" || screens.isHelpOpen()) return;
    active?.inputChar(ch);
  }
  function routeBackspace(): void {
    if (state !== "playing" || screens.isHelpOpen()) return;
    active?.backspace();
  }

  // ---- pause / help suspend (freezes the WPM clock) ----
  function suspend(reason: "pause" | "help"): void {
    if (state !== "playing") return;
    state = "paused";
    suspendStart = performance.now();
    if (reason === "pause") screens.showPause();
    else screens.showHelp();
  }
  function unsuspend(): void {
    if (state !== "paused") return;
    stats.shiftStart(performance.now() - suspendStart);
    state = "playing";
    screens.hidePause();
    screens.hideHelp();
    if (isTouchDevice()) focusSink(sink);
  }
  function onEscape(): void {
    if (state === "playing") suspend("pause");
    else if (state === "paused") unsuspend();
  }
  function onRestart(): void {
    if ((state === "playing" || state === "paused") && config) {
      screens.hidePause();
      screens.hideHelp();
      startRun(config);
    }
  }

  attachKeyboard({
    onChar: routeChar,
    onBackspace: routeBackspace,
    onEscape,
    onRestart,
    isTyping: () => state === "playing",
    isInGame: () => state === "playing" || state === "paused",
  });
  if (isTouchDevice()) {
    attachMobileInput(sink, { onChar: routeChar, onBackspace: routeBackspace });
    byId("app").addEventListener("pointerdown", () => {
      if (state === "playing") focusSink(sink);
    });
  }

  byId("help-fab").addEventListener("click", () => {
    if (state === "playing") suspend("help");
    else screens.showHelp();
  });
  byId("help-close").addEventListener("click", () => unsuspend());
  byId("status-bar").addEventListener("click", () => {
    setMuted(!audio.toggle());
  });
  window.addEventListener("resize", () => ctx.resize());

  // auto-pause when the tab/window loses focus so the WPM clock stays honest
  window.addEventListener("blur", () => {
    if (state === "playing") suspend("pause");
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && state === "playing") suspend("pause");
  });

  // ---- render loop ----
  let last = performance.now();
  function frame(now: number): void {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    if (state === "playing" && active) active.update(dt, now);

    const signals = state === "playing" && active ? active.signals() : IDLE;
    stage.update(dt, signals);
    effects.update(dt, ctx);
    ctx.render();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    start: (cfg) => startRun(cfg),
    retry: () => {
      if (config) startRun(config);
    },
    next: () => {
      if (config) startRun(config);
    },
    menu: () => toMenu(),
  };
}
