// A touch device with a physical keyboard attached delivers each key twice:
// once as a window `keydown` (read by keyboard.ts) and again as `beforeinput`
// on the focused hidden sink (read by mobile.ts). The keydown path claims the
// character it handled; the sink then drops the matching echo that follows
// within the same keystroke. Soft keyboards send no usable keydown, so their
// text never has a claim and always goes through.

/** How long a keydown claim waits for its echo. Both events share one task, so this is generous. */
export const ECHO_WINDOW_MS = 50;

export class KeyEcho {
  private pending: { ch: string; at: number } | null = null;

  constructor(private readonly now: () => number = () => performance.now()) {}

  /** The keydown path handled `ch`; its `beforeinput` echo should be ignored. */
  claim(ch: string): void {
    this.pending = { ch, at: this.now() };
  }

  /** True when `data` is the echo of the last claimed keydown. Each claim is used up by one check. */
  isEcho(data: string): boolean {
    const p = this.pending;
    this.pending = null;
    return p !== null && p.ch === data && this.now() - p.at <= ECHO_WINDOW_MS;
  }
}
