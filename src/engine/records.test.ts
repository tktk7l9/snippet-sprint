import { describe, expect, it } from "vitest";
import { bestFor, loadBests, saveResult, type BestRecord, type RecordStore } from "./records.js";

const returning = (val: string | null): RecordStore => ({
  getItem: () => val,
  setItem: () => {},
});

class MapStore implements RecordStore {
  private map = new Map<string, string>();
  getItem(k: string): string | null {
    return this.map.has(k) ? (this.map.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.map.set(k, v);
  }
}

const rec = (score: number): BestRecord => ({
  wpm: score,
  accuracy: 0.9,
  score,
  rank: "B",
});

describe("loadBests", () => {
  it("returns an empty map when nothing is stored", () => {
    expect(loadBests(returning(null))).toEqual({});
  });

  it("parses a stored object", () => {
    const data = JSON.stringify({ x: rec(10) });
    expect(loadBests(returning(data))).toEqual({ x: rec(10) });
  });

  it("ignores stored JSON null", () => {
    expect(loadBests(returning("null"))).toEqual({});
  });

  it("ignores stored non-object JSON", () => {
    expect(loadBests(returning('"hello"'))).toEqual({});
  });

  it("ignores malformed JSON", () => {
    expect(loadBests(returning("{not json"))).toEqual({});
  });

  it("ignores a stored array", () => {
    expect(loadBests(returning("[1,2]"))).toEqual({});
  });

  it("drops entries whose fields are not a record and strips extra keys", () => {
    const data = JSON.stringify({
      ok: { ...rec(10), extra: "x" },
      str: "nope",
      nul: null,
      nan: { wpm: "10", accuracy: 0.9, score: 10, rank: "B" },
      rank: { wpm: 10, accuracy: 0.9, score: 10, rank: "Z" },
      missing: { wpm: 10, accuracy: 0.9 },
    });
    expect(loadBests(returning(data))).toEqual({ ok: rec(10) });
  });
});

describe("bestFor", () => {
  it("returns the record when present, otherwise null", () => {
    const store = returning(JSON.stringify({ x: rec(5) }));
    expect(bestFor(store, "x")).toEqual(rec(5));
    expect(bestFor(store, "missing")).toBeNull();
  });

  it("never answers with something inherited from Object.prototype", () => {
    const store = returning('{"__proto__": {"wpm": 5, "accuracy": 0.9, "score": 5, "rank": "B"}}');
    expect(Object.getPrototypeOf(loadBests(store))).toBe(Object.prototype);
    expect(bestFor(store, "constructor")).toBeNull();
    expect(bestFor(store, "toString")).toBeNull();
    expect(bestFor(store, "__proto__")).toBeNull();
  });
});

describe("saveResult", () => {
  it("persists new records and only overwrites on improvement", () => {
    const store = new MapStore();

    const first = saveResult(store, "x", rec(100));
    expect(first).toEqual({ best: rec(100), improved: true, previous: null });

    const worse = saveResult(store, "x", rec(50));
    expect(worse).toEqual({ best: rec(100), improved: false, previous: rec(100) });

    // The beaten record rides along so the results screen can show what improved (SHIG 28).
    const better = saveResult(store, "x", rec(200));
    expect(better).toEqual({ best: rec(200), improved: true, previous: rec(100) });

    const other = saveResult(store, "y", rec(10));
    expect(other).toEqual({ best: rec(10), improved: true, previous: null });
    expect(bestFor(store, "y")).toEqual(rec(10));
  });
});
