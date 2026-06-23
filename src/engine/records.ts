// Best-record persistence. The store is injected (an interface matching the
// localStorage API) so this module is pure and 100% testable in Node.

import type { Rank } from "./scoring.js";

export interface RecordStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BestRecord {
  readonly wpm: number;
  readonly accuracy: number;
  readonly score: number;
  readonly rank: Rank;
}

const KEY = "snippet-sprint:bests:v1";

export function loadBests(store: RecordStore): Record<string, BestRecord> {
  const raw = store.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, BestRecord>;
    }
    return {};
  } catch {
    return {};
  }
}

export function bestFor(store: RecordStore, id: string): BestRecord | null {
  return loadBests(store)[id] ?? null;
}

export interface SaveOutcome {
  readonly best: BestRecord;
  readonly improved: boolean;
}

/** Persist `record` for `id` only if it beats the existing score. */
export function saveResult(
  store: RecordStore,
  id: string,
  record: BestRecord,
): SaveOutcome {
  const bests = loadBests(store);
  const prev = bests[id];
  const improved = !prev || record.score > prev.score;
  if (improved) {
    bests[id] = record;
    store.setItem(KEY, JSON.stringify(bests));
    return { best: record, improved: true };
  }
  return { best: prev, improved: false };
}
