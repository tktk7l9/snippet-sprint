// Falling Tokens arcade: code fragments descend; type a token's first character
// to lock on, then clear it before it hits the floor. 3D text via canvas sprites.

import * as THREE from "three";
import { tokenPool } from "../engine/content/tokens.js";
import { FallingGame, type FallingToken } from "../engine/falling.js";
import { rankByThresholds } from "../engine/scoring.js";
import { byId } from "../ui/dom.js";
import type { GameMode, ModeServices, PlayConfig } from "./types.js";

const MAX_LIVES = 3;
const SCORE_TIERS = { S: 1200, A: 800, B: 500, C: 250 };

class TokenSprite {
  readonly sprite: THREE.Sprite;
  private readonly canvas = document.createElement("canvas");
  private readonly c2d: CanvasRenderingContext2D;
  private readonly tex: THREE.CanvasTexture;
  private lastKey = "";

  constructor(readonly token: FallingToken) {
    this.canvas.width = 256;
    this.canvas.height = 64;
    this.c2d = this.canvas.getContext("2d") as CanvasRenderingContext2D;
    this.tex = new THREE.CanvasTexture(this.canvas);
    const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false });
    this.sprite = new THREE.Sprite(mat);
    const w = Math.max(2.4, token.text.length * 0.62);
    this.sprite.scale.set(w, w * 0.25, 1);
    this.draw(false);
  }

  sync(locked: boolean): void {
    this.sprite.position.set(this.token.x, this.token.y, 2);
    this.draw(locked);
  }

  private draw(locked: boolean): void {
    const key = `${this.token.progress}:${locked}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    const ctx = this.c2d;
    ctx.clearRect(0, 0, 256, 64);
    ctx.font = "bold 40px ui-monospace, monospace";
    ctx.textBaseline = "middle";
    const text = this.token.text;
    let x = (256 - ctx.measureText(text).width) / 2;
    for (let i = 0; i < text.length; i++) {
      const typed = i < this.token.progress;
      ctx.fillStyle = typed ? "#5cf2ff" : locked ? "#ffffff" : "#aeb6d8";
      ctx.shadowColor = "#5cf2ff";
      ctx.shadowBlur = locked && !typed ? 10 : 0;
      ctx.fillText(text[i], x, 32);
      x += ctx.measureText(text[i]).width;
    }
    this.tex.needsUpdate = true;
  }

  dispose(): void {
    this.tex.dispose();
    (this.sprite.material as THREE.SpriteMaterial).dispose();
  }
}

export class FallingMode implements GameMode {
  readonly id = "falling" as const;

  private readonly group = new THREE.Group();
  private readonly sprites = new Map<number, TokenSprite>();
  private readonly view = byId("falling-view");
  private readonly scoreEl = byId("fall-score");
  private readonly levelEl = byId("fall-level");
  private readonly comboEl = byId("fall-combo");
  private readonly livesEl = byId("fall-lives");

  private game: FallingGame | null = null;
  private ended = false;

  constructor(private readonly services: ModeServices) {
    this.services.ctx.scene.add(this.group);
  }

  begin(config: PlayConfig): void {
    this.clearSprites();
    this.game = new FallingGame({ tokens: tokenPool(config.difficulty), lives: MAX_LIVES });
    this.ended = false;
    this.view.classList.add("show");
    this.refreshStats();
  }

  inputChar(ch: string): void {
    const game = this.game;
    if (!game || game.gameOver) return;

    const out = game.input(ch);
    const expected = out.correct ? out.expected : out.expected || ch;
    const combo = this.services.record(out.correct, expected);

    if (out.correct) {
      this.services.audio.key();
      this.services.effects.spark();
      if (out.destroyed) {
        this.removeSprite(out.destroyed.id);
        if (combo > 0 && combo % 10 === 0) {
          this.services.effects.shockwave();
          this.services.audio.combo(combo);
          this.services.toast(`COMBO ×${combo}`);
        }
      }
    } else {
      this.services.audio.error();
      this.services.effects.shakeImpulse(0.3);
    }
    this.refreshStats();
  }

  backspace(): void {
    /* no-op in arcade mode */
  }

  update(dt: number, _now: number): void {
    const game = this.game;
    if (!game) return;

    const { spawned, landed } = game.tick(dt);
    for (const t of spawned) this.addSprite(t);
    for (const t of landed) {
      this.removeSprite(t.id);
      this.services.effects.shakeImpulse(0.6);
      this.services.audio.error();
    }

    const lockedId = game.locked?.id ?? -1;
    for (const ts of this.sprites.values()) ts.sync(ts.token.id === lockedId);

    this.refreshStats();

    if (game.gameOver && !this.ended) {
      this.ended = true;
      this.services.finish({
        score: game.score,
        rank: rankByThresholds(game.score, SCORE_TIERS),
        recordKey: "falling",
      });
    }
  }

  signals() {
    const lives = this.game?.lives ?? MAX_LIVES;
    return {
      progress: 0,
      combo: this.services.stats(performance.now()).combo,
      accuracy: 1,
      active: this.game !== null && !this.game.gameOver,
      danger: lives <= 1 ? 0.6 : 0,
    };
  }

  end(): void {
    this.view.classList.remove("show");
    this.clearSprites();
  }

  private addSprite(token: FallingToken): void {
    const ts = new TokenSprite(token);
    this.sprites.set(token.id, ts);
    this.group.add(ts.sprite);
  }

  private removeSprite(id: number): void {
    const ts = this.sprites.get(id);
    if (!ts) return;
    this.group.remove(ts.sprite);
    ts.dispose();
    this.sprites.delete(id);
  }

  private clearSprites(): void {
    for (const ts of this.sprites.values()) {
      this.group.remove(ts.sprite);
      ts.dispose();
    }
    this.sprites.clear();
  }

  private refreshStats(): void {
    const game = this.game;
    if (!game) return;
    this.scoreEl.textContent = String(game.score);
    this.levelEl.textContent = String(game.level);
    this.comboEl.textContent = String(this.services.stats(performance.now()).combo);
    const empty = Math.max(0, MAX_LIVES - game.lives);
    this.livesEl.textContent = "♥".repeat(game.lives) + "♡".repeat(empty);
  }
}
