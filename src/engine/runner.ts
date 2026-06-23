// Pure logic for the Code Runner mode. You type a stream of code lines; correct
// keys accelerate the run, mistakes brake and fill a "crash" meter. Distance is
// the score. Lines are supplied by an injected provider so this stays testable.

import { TypingSession } from "./typing.js";

export interface RunnerInput {
  readonly correct: boolean;
  readonly expected: string;
  readonly lineComplete: boolean;
}

const MIN_SPEED = 4;
const MAX_SPEED = 60;
const FRICTION = 6; // speed lost per second
const BOOST = 3.5; // speed gained per correct key
const BRAKE = 0.55; // speed multiplier on a mistake
const LINE_BONUS = 8; // speed gained when a line is finished
const CRASH_HIT = 0.14; // crash meter gained per mistake
const CRASH_DRAIN = 0.25; // crash meter drained per second
const CRASH_RELIEF = 0.04; // crash meter drained per correct key

export class RunnerGame {
  speed = MIN_SPEED * 2;
  distance = 0;
  crash = 0;
  gameOver = false;
  session: TypingSession;

  private readonly nextLine: () => string;

  constructor(opts: { nextLine: () => string }) {
    this.nextLine = opts.nextLine;
    this.session = new TypingSession(this.nextLine());
  }

  input(ch: string): RunnerInput {
    if (this.gameOver) return { correct: false, expected: "", lineComplete: false };

    const r = this.session.input(ch);
    if (r.correct) {
      this.speed = Math.min(MAX_SPEED, this.speed + BOOST);
      this.crash = Math.max(0, this.crash - CRASH_RELIEF);
      if (r.completed) {
        this.speed = Math.min(MAX_SPEED, this.speed + LINE_BONUS);
        this.session = new TypingSession(this.nextLine());
        return { correct: true, expected: r.expected, lineComplete: true };
      }
      return { correct: true, expected: r.expected, lineComplete: false };
    }

    this.speed = Math.max(MIN_SPEED, this.speed * BRAKE);
    this.crash = Math.min(1, this.crash + CRASH_HIT);
    if (this.crash >= 1) this.gameOver = true;
    return { correct: false, expected: r.expected, lineComplete: false };
  }

  backspace(): void {
    this.session.backspace();
  }

  tick(dt: number): void {
    if (this.gameOver) return;
    this.distance += this.speed * dt;
    this.speed = Math.max(MIN_SPEED, this.speed - FRICTION * dt);
    this.crash = Math.max(0, this.crash - CRASH_DRAIN * dt);
  }
}
