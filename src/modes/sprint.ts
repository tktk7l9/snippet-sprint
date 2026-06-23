// Snippet Sprint: type one whole snippet, measured for WPM / accuracy / rank.

import type { Snippet } from "../engine/content/types.js";
import { selectSnippet } from "../engine/select.js";
import { computeScore } from "../engine/scoring.js";
import { TypingSession } from "../engine/typing.js";
import { Hud } from "../ui/hud.js";
import type { GameMode, ModeServices, PlayConfig } from "./types.js";

export class SprintMode implements GameMode {
  readonly id = "sprint" as const;

  private readonly hud = new Hud();
  private session: TypingSession | null = null;
  private current: Snippet | null = null;

  constructor(private readonly services: ModeServices) {}

  begin(config: PlayConfig): void {
    const next = selectSnippet({
      languages: config.languages,
      difficulty: config.difficulty,
      category: config.category,
      excludeId: this.current?.id,
    });
    this.load(next);
  }

  private load(snippet: Snippet): void {
    this.current = snippet;
    this.session = new TypingSession(snippet.code);
    this.hud.setMeta(snippet);
    this.hud.mountSnippet(this.session);
    this.hud.setProgress(0);
    this.hud.setStats(this.services.stats(performance.now()));
    this.hud.show();
  }

  inputChar(ch: string): void {
    const session = this.session;
    if (!session || !this.current || session.isComplete()) return;

    const now = performance.now();
    const r = session.input(ch);
    const combo = this.services.record(r.correct, r.expected);

    if (r.correct) {
      this.services.audio.key();
      this.services.effects.spark();
      if (combo > 0 && combo % 10 === 0) {
        this.services.effects.shockwave();
        this.services.audio.combo(combo);
        this.services.toast(`COMBO ×${combo}`);
      }
    } else {
      this.services.audio.error();
      this.services.effects.shakeImpulse();
      this.hud.shake();
    }

    this.hud.refresh(session);
    this.hud.setProgress(session.progress);
    this.hud.setStats(this.services.stats(now));

    if (r.completed) this.finish();
  }

  backspace(): void {
    if (this.session) {
      this.session.backspace();
      this.hud.refresh(this.session);
    }
  }

  update(_dt: number, now: number): void {
    this.hud.setStats(this.services.stats(now));
  }

  signals() {
    const snap = this.services.stats(performance.now());
    return {
      progress: this.session?.progress ?? 0,
      combo: snap.combo,
      accuracy: snap.accuracy,
      active: this.session !== null && !this.session.isComplete(),
      language: this.current?.language,
    };
  }

  end(): void {
    this.hud.hide();
  }

  private finish(): void {
    if (!this.current) return;
    const snap = this.services.stats(performance.now());
    const { score, rank } = computeScore({
      wpm: snap.wpm,
      accuracy: snap.accuracy,
      maxCombo: snap.maxCombo,
      length: this.current.code.length,
    });
    this.services.finish({ score, rank, recordKey: `sprint:${this.current.id}` });
  }
}
