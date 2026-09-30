// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "./audio.js";

interface FakeOsc {
  type: string;
  frequency: { setValueAtTime: ReturnType<typeof vi.fn> };
  connect: ReturnType<typeof vi.fn>;
  start: ReturnType<typeof vi.fn>;
  stop: ReturnType<typeof vi.fn>;
}

function installFakeAudioContext(state: "running" | "suspended" = "running") {
  const oscs: FakeOsc[] = [];
  const instances: FakeCtx[] = [];
  class FakeCtx {
    state = state;
    currentTime = 10;
    destination = {};
    resume = vi.fn(() => Promise.resolve());
    createOscillator(): FakeOsc {
      const osc: FakeOsc = {
        type: "sine",
        frequency: { setValueAtTime: vi.fn() },
        connect: vi.fn(() => ({ connect: vi.fn() })),
        start: vi.fn(),
        stop: vi.fn(),
      };
      oscs.push(osc);
      return osc;
    }
    createGain() {
      return {
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(() => ({ connect: vi.fn() })),
      };
    }
    constructor() {
      instances.push(this);
    }
  }
  vi.stubGlobal("AudioContext", FakeCtx);
  return { oscs, instances };
}

describe("AudioEngine", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("starts enabled and toggles off and on", () => {
    installFakeAudioContext();
    const audio = new AudioEngine();
    expect(audio.enabled).toBe(true);
    expect(audio.toggle()).toBe(false);
    expect(audio.toggle()).toBe(true);
  });

  it("creates the context lazily and resumes a suspended one", () => {
    const { instances } = installFakeAudioContext("suspended");
    const audio = new AudioEngine();
    expect(instances).toHaveLength(0);
    audio.resume();
    audio.resume();
    expect(instances).toHaveLength(1);
    expect(instances[0].resume).toHaveBeenCalledTimes(2);
  });

  it("does not call resume on an already running context", () => {
    const { instances } = installFakeAudioContext("running");
    new AudioEngine().resume();
    expect(instances[0].resume).not.toHaveBeenCalled();
  });

  it("plays nothing while muted", () => {
    const { oscs } = installFakeAudioContext();
    const audio = new AudioEngine();
    audio.toggle();
    audio.key();
    audio.error();
    audio.complete();
    expect(oscs).toHaveLength(0);
  });

  it("schedules one blip per key press and a low sawtooth for errors", () => {
    const { oscs } = installFakeAudioContext();
    const audio = new AudioEngine();
    audio.key();
    expect(oscs).toHaveLength(1);
    expect(oscs[0].type).toBe("triangle");
    expect(oscs[0].start).toHaveBeenCalledWith(10);
    audio.error();
    expect(oscs[1].type).toBe("sawtooth");
    expect(oscs[1].frequency.setValueAtTime).toHaveBeenCalledWith(120, 10);
  });

  it("layers more notes as the combo grows, capped at four", () => {
    const { oscs } = installFakeAudioContext();
    const audio = new AudioEngine();
    audio.combo(10);
    expect(oscs).toHaveLength(2);
    audio.combo(30);
    expect(oscs).toHaveLength(6);
    audio.combo(90);
    expect(oscs).toHaveLength(10);
  });

  it("plays a four-note arpeggio on completion with rising delays", () => {
    const { oscs } = installFakeAudioContext();
    new AudioEngine().complete();
    expect(oscs).toHaveLength(4);
    expect(oscs.map((o) => o.start.mock.calls[0][0])).toEqual([10, 10.07, 10.14, 10.21]);
  });

  it("stays silent and does not throw when WebAudio is unavailable", () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("no audio");
        }
      },
    );
    const audio = new AudioEngine();
    expect(() => {
      audio.resume();
      audio.key();
    }).not.toThrow();
  });

  it("re-resumes the context when sound is switched back on", () => {
    const { instances } = installFakeAudioContext("suspended");
    const audio = new AudioEngine();
    audio.toggle();
    expect(instances).toHaveLength(0);
    audio.toggle();
    expect(instances).toHaveLength(1);
    expect(instances[0].resume).toHaveBeenCalledTimes(1);
  });
});

describe("AudioEngine randomness", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0.5));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("varies the key pitch around 420Hz", () => {
    const { oscs } = installFakeAudioContext();
    new AudioEngine().key();
    expect(oscs[0].frequency.setValueAtTime).toHaveBeenCalledWith(460, 10);
  });
});
