// Tiny WebAudio synth — no asset files, so it stays within a `self`-only CSP.
// Lazily creates the AudioContext on the first user gesture.

type Wave = OscillatorType;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  enabled = true;

  /** Create/resume the context. Call from a user gesture (e.g. START). */
  resume(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === "suspended") void ctx.resume();
  }

  toggle(): boolean {
    this.enabled = !this.enabled;
    if (this.enabled) this.resume();
    return this.enabled;
  }

  key(): void {
    this.blip(420 + Math.random() * 80, 0.05, "triangle", 0.05);
  }

  error(): void {
    this.blip(120, 0.16, "sawtooth", 0.07);
  }

  combo(level: number): void {
    const base = 520;
    const steps = Math.min(4, 1 + Math.floor(level / 10));
    for (let i = 0; i < steps; i++) {
      this.blip(base * Math.pow(1.18, i), 0.09, "square", 0.05, i * 0.05);
    }
  }

  complete(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((f, i) => this.blip(f, 0.18, "triangle", 0.06, i * 0.07));
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new AudioContext();
    } catch {
      this.ctx = null;
    }
    return this.ctx;
  }

  private blip(
    freq: number,
    dur: number,
    type: Wave,
    gain: number,
    delay = 0,
  ): void {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
}
