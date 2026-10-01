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
import { loadMuted, saveMuted } from "./engine/prefs.js";
import { fitFrame } from "./engine/viewport.js";
import { SprintMode } from "./modes/sprint.js";
import type { GameMode, ModeServices, PlayConfig } from "./modes/types.js";
import type { Snippet } from "./engine/content/types.js";
import type { Screens } from "./ui/screens.js";
import { safeStore } from "./storage.js";

export interface GameController {
  start(config: PlayConfig): void;
  retry(): void;
  next(): void;
  menu(): void;
}

type AppState = "menu" | "playing" | "paused" | "results";

const IDLE: StageSignals = { progress: 0, combo: 0, accuracy: 1, active: false };

const store: RecordStore = safeStore;

export function createGame(screens: Screens): GameController {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const canvas = byId<HTMLCanvasElement>("scene");
  const ctx = createRenderContext(canvas, reducedMotion);
  const stage = new Stage(ctx);
  const effects = new EffectsLayer(reducedMotion);
  ctx.scene.add(effects.group);

  const audio = new AudioEngine();
  // The mute choice survives a reload like the other prefs (SHIG 42, 12).
  audio.enabled = !loadMuted(store);
  const sink = byId<HTMLInputElement>("key-sink");
  const playHud = byId("play-hud");
  const app = byId("app");

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
      finishRun(opts.score, opts.rank, opts.recordKey, opts.snippet);
    },
    toast,
  };

  const sprint: GameMode = new SprintMode(services);

  setMuted(!audio.enabled);

  function startRun(cfg: PlayConfig, replay = false): void {
    config = cfg;
    audio.resume();
    stats = new StatsTracker();
    active?.end();
    active = sprint;
    screens.hideAll();
    playHud.classList.add("show");
    active.begin(cfg, replay);
    state = "playing";
    if (isTouchDevice()) focusSink(sink);
  }

  function finishRun(score: number, rank: Rank, recordKey: string, snippet: Snippet): void {
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
      previous: outcome.previous,
      snippet,
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
      startRun(config, true);
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
    byId("app").addEventListener("pointerdown", (e) => {
      // Taps on on-screen controls (PAUSE / HELP / sound) should not pop the keyboard.
      if ((e.target as Element | null)?.closest("button")) return;
      if (state === "playing") focusSink(sink);
    });
  }

  byId("help-fab").addEventListener("click", () => {
    if (state === "playing") suspend("help");
    else screens.showHelp();
  });
  byId("help-close").addEventListener("click", () => unsuspend());
  // On-screen escape hatch for touch players, who have no Esc key (SHIG 60, 82).
  byId("pause-fab").addEventListener("click", () => suspend("pause"));
  byId("pause-resume").addEventListener("click", () => unsuspend());
  byId("pause-retry").addEventListener("click", () => onRestart());
  byId("status-bar").addEventListener("click", () => {
    const muted = !audio.toggle();
    setMuted(muted);
    saveMuted(store, muted);
    // Tapping the toggle moved focus to it and closed the soft keyboard; bring
    // it back so a touch player can keep typing without another tap.
    if (state === "playing" && isTouchDevice()) focusSink(sink);
  });
  window.addEventListener("resize", () => ctx.resize());

  // Keep the whole HUD above the soft keyboard: size the app frame to the
  // visual viewport instead of the layout viewport (SHIG 30, 85, 82).
  const vv = window.visualViewport;
  if (vv && isTouchDevice()) {
    const fit = (): void => {
      const frame = fitFrame(vv);
      // The canvas keeps the window size so the backdrop still fills the screen behind the keyboard.
      app.style.height = frame ? `${frame.height}px` : "";
      app.style.top = frame ? `${frame.top}px` : "";
    };
    vv.addEventListener("resize", fit);
    vv.addEventListener("scroll", fit);
  }

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
    // RETRY replays the same snippet; NEXT draws a different one (SHIG 37).
    retry: () => {
      if (config) startRun(config, true);
    },
    next: () => {
      if (config) startRun(config);
    },
    menu: () => toMenu(),
  };
}
