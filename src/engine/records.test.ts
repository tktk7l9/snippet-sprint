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
});

describe("bestFor", () => {
  it("returns the record when present, otherwise null", () => {
    const store = returning(JSON.stringify({ x: rec(5) }));
    expect(bestFor(store, "x")).toEqual(rec(5));
    expect(bestFor(store, "missing")).toBeNull();
  });
});

describe("saveResult", () => {
  it("persists new records and only overwrites on improvement", () => {
    const store = new MapStore();

    const first = saveResult(store, "x", rec(100));
    expect(first).toEqual({ best: rec(100), improved: true });

    const worse = saveResult(store, "x", rec(50));
    expect(worse).toEqual({ best: rec(100), improved: false });

    const better = saveResult(store, "x", rec(200));
    expect(better).toEqual({ best: rec(200), improved: true });

    const other = saveResult(store, "y", rec(10));
    expect(other).toEqual({ best: rec(10), improved: true });
    expect(bestFor(store, "y")).toEqual(rec(10));
  });
});
