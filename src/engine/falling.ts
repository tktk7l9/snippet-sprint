// Pure logic for the Falling Tokens arcade mode. Tokens descend from the top;
// the typist locks onto a token by typing its first character, then clears it.
// Deterministic: inject rng and drive time via tick(dt).

export interface FallingToken {
  readonly id: number;
  readonly text: string;
  /** Correctly typed leading characters. */
  progress: number;
  readonly x: number;
  y: number;
  readonly speed: number;
}

export interface InputOutcome {
  readonly correct: boolean;
  /** The expected character (empty when the keystroke matched no token). */
  readonly expected: string;
  /** The token that was cleared by this keystroke, if any. */
  readonly destroyed: FallingToken | null;
}

export interface TickOutcome {
  readonly spawned: FallingToken[];
  readonly landed: FallingToken[];
}

export const SPAWN_Y = 11;
export const FLOOR_Y = -6;
export const X_RANGE = 8;

const LEVEL_STEP = 300;
const BASE_SPEED = 2.2;
const SPEED_PER_LEVEL = 0.45;
const BASE_INTERVAL = 1.7;
const MIN_INTERVAL = 0.55;

export class FallingGame {
  tokens: FallingToken[] = [];
  lives: number;
  score = 0;
  level = 1;
  gameOver = false;

  private readonly pool: string[];
  private readonly rng: () => number;
  private spawnTimer = 0;
  private nextId = 1;
  private lockedId: number | null = null;

  constructor(opts: { tokens: string[]; rng?: () => number; lives?: number }) {
    this.pool = opts.tokens.length > 0 ? opts.tokens : ["x"];
    this.rng = opts.rng ?? Math.random;
    this.lives = opts.lives ?? 3;
  }

  get locked(): FallingToken | null {
    return this.tokens.find((t) => t.id === this.lockedId) ?? null;
  }

  private speed(): number {
    return BASE_SPEED + (this.level - 1) * SPEED_PER_LEVEL;
  }

  private interval(): number {
    return Math.max(MIN_INTERVAL, BASE_INTERVAL - (this.level - 1) * 0.12);
  }

  spawn(): FallingToken {
    const text = this.pool[Math.floor(this.rng() * this.pool.length)] ?? this.pool[0];
    const x = (this.rng() * 2 - 1) * X_RANGE;
    const token: FallingToken = {
      id: this.nextId++,
      text,
      progress: 0,
      x,
      y: SPAWN_Y,
      speed: this.speed(),
    };
    this.tokens.push(token);
    return token;
  }

  input(ch: string): InputOutcome {
    if (this.gameOver) return { correct: false, expected: "", destroyed: null };

    let target = this.locked;
    if (!target) {
      const matches = this.tokens.filter((t) => t.text[t.progress] === ch);
      if (matches.length === 0) return { correct: false, expected: "", destroyed: null };
      target = matches.reduce((a, b) => (b.y < a.y ? b : a));
      this.lockedId = target.id;
    }

    const expected = target.text[target.progress];
    if (ch !== expected) {
      // wrong key while locked: a mistake, but keep the lock
      return { correct: false, expected, destroyed: null };
    }

    target.progress++;
    if (target.progress >= target.text.length) {
      this.score += 10 + target.text.length * 5;
      this.level = 1 + Math.floor(this.score / LEVEL_STEP);
      const cleared = target;
      this.tokens = this.tokens.filter((t) => t.id !== cleared.id);
      this.lockedId = null;
      return { correct: true, expected, destroyed: cleared };
    }
    return { correct: true, expected, destroyed: null };
  }

  tick(dt: number): TickOutcome {
    const spawned: FallingToken[] = [];
    const landed: FallingToken[] = [];
    if (this.gameOver) return { spawned, landed };

    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      spawned.push(this.spawn());
      this.spawnTimer = this.interval();
    }

    for (const t of this.tokens) t.y -= t.speed * dt;

    const survivors: FallingToken[] = [];
    for (const t of this.tokens) {
      if (t.y <= FLOOR_Y) {
        landed.push(t);
        if (t.id === this.lockedId) this.lockedId = null;
      } else {
        survivors.push(t);
      }
    }
    this.tokens = survivors;

    if (landed.length > 0) {
      this.lives -= landed.length;
      if (this.lives <= 0) {
        this.lives = 0;
        this.gameOver = true;
      }
    }
    return { spawned, landed };
  }
}
