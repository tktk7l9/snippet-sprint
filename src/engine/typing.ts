// Pure typing session: tracks the cursor over a target string, validates
// keystrokes in "strict" mode (only the correct character advances), and
// auto-skips leading indentation after a newline so the typist focuses on code.

export type CellStatus = "pending" | "correct";

export interface Cell {
  readonly char: string;
  status: CellStatus;
  /** True if this cell was auto-filled (skipped indentation), not typed. */
  auto: boolean;
}

export interface InputResult {
  /** Whether the typed character matched the expected one. */
  readonly correct: boolean;
  /** Whether the session is now complete. */
  readonly completed: boolean;
  /** The character that was expected at the cursor (for mistake analysis). */
  readonly expected: string;
  /** Number of cells the cursor advanced (includes auto-skipped indentation). */
  readonly advanced: number;
}

const isIndent = (ch: string): boolean => ch === " " || ch === "\t";

export class TypingSession {
  readonly target: string;
  readonly cells: Cell[];
  private idx = 0;
  /** True when the current cell has been mistyped since the last advance. */
  private errored = false;
  /** Character-producing keystrokes (correct + wrong); excludes auto-skips. */
  keystrokes = 0;
  mistakes = 0;

  constructor(target: string) {
    this.target = target;
    this.cells = [...target].map((char) => ({
      char,
      status: "pending" as CellStatus,
      auto: false,
    }));
  }

  /** Current cursor position (index into `cells`). */
  get index(): number {
    return this.idx;
  }

  /** True if the current cell has an outstanding mistake. */
  get hasError(): boolean {
    return this.errored;
  }

  isComplete(): boolean {
    return this.idx >= this.cells.length;
  }

  /** Fraction 0..1 of cells settled as correct. */
  get progress(): number {
    if (this.cells.length === 0) return 1;
    return this.idx / this.cells.length;
  }

  /** Feed one typed character. Enter must be passed as "\n". */
  input(ch: string): InputResult {
    if (this.isComplete()) {
      return { correct: false, completed: true, expected: "", advanced: 0 };
    }
    const expected = this.cells[this.idx].char;
    if (ch === expected) {
      this.keystrokes++;
      this.errored = false;
      this.cells[this.idx].status = "correct";
      this.idx++;
      let advanced = 1;
      if (expected === "\n") {
        advanced += this.skipIndent();
      }
      return {
        correct: true,
        completed: this.isComplete(),
        expected,
        advanced,
      };
    }
    this.keystrokes++;
    this.mistakes++;
    this.errored = true;
    return { correct: false, completed: false, expected, advanced: 0 };
  }

  /** Step back one settled cell (mistake recovery). Returns false at the start. */
  backspace(): boolean {
    this.errored = false;
    if (this.idx === 0) return false;
    this.idx--;
    this.cells[this.idx].status = "pending";
    this.cells[this.idx].auto = false;
    return true;
  }

  // Mark and skip over leading indentation, returning how many cells were filled.
  private skipIndent(): number {
    let n = 0;
    while (this.idx < this.cells.length && isIndent(this.cells[this.idx].char)) {
      this.cells[this.idx].status = "correct";
      this.cells[this.idx].auto = true;
      this.idx++;
      n++;
    }
    return n;
  }
}
