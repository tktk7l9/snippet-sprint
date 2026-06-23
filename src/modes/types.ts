// Shared contracts for a game mode. main.ts owns the shared services (renderer,
// effects, audio, stats, results) and drives the active mode.

import type { AudioEngine } from "../audio/audio.js";
import type { Category, Difficulty, Language } from "../engine/content/types.js";
import type { Rank } from "../engine/scoring.js";
import type { StatsSnapshot } from "../engine/stats.js";
import type { EffectsLayer } from "../render/effects.js";
import type { RenderContext } from "../render/renderer.js";
import type { StageSignals } from "../render/stage.js";

export type ModeId = "sprint";

export interface PlayConfig {
  languages: Language[];
  difficulty: Difficulty | "mixed";
  category: Category | "all";
}

export interface ModeServices {
  ctx: RenderContext;
  effects: EffectsLayer;
  audio: AudioEngine;
  /** Record a keystroke into the shared stats; returns the resulting combo. */
  record(correct: boolean, expected: string): number;
  /** Current shared stats snapshot. */
  stats(now: number): StatsSnapshot;
  /** End the run and show results. `score` is the headline metric. */
  finish(opts: { score: number; rank: Rank; recordKey: string }): void;
  toast(text: string): void;
}

export interface GameMode {
  readonly id: ModeId;
  begin(config: PlayConfig): void;
  inputChar(ch: string): void;
  backspace(): void;
  /** Advance simulation + per-frame HUD/3D. Called only while playing. */
  update(dt: number, now: number): void;
  /** Signals for the shared background stage. Called every frame. */
  signals(): StageSignals;
  /** Cleanup: hide the view and remove any 3D objects. */
  end(): void;
}
