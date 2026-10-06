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
const RANKS: readonly string[] = ["S", "A", "B", "C", "D"];

function isBestRecord(value: unknown): value is BestRecord {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    Number.isFinite(r.wpm) &&
    Number.isFinite(r.accuracy) &&
    Number.isFinite(r.score) &&
    typeof r.rank === "string" &&
    RANKS.includes(r.rank)
  );
}

/** Load all best records; entries that do not look like a record are dropped
 *  (stored JSON is user-editable, so every field is checked). */
export function loadBests(store: RecordStore): Record<string, BestRecord> {
  const raw = store.getItem(KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out: Record<string, BestRecord> = {};
    for (const [id, value] of Object.entries(parsed)) {
      // Assigning out["__proto__"] would swap the prototype instead of adding a key.
      if (id === "__proto__") continue;
      if (isBestRecord(value)) {
        out[id] = { wpm: value.wpm, accuracy: value.accuracy, score: value.score, rank: value.rank };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function bestFor(store: RecordStore, id: string): BestRecord | null {
  const bests = loadBests(store);
  return Object.hasOwn(bests, id) ? bests[id] : null;
}

export interface SaveOutcome {
  readonly best: BestRecord;
  readonly improved: boolean;
  /** The record on file before this run (null on a first clear), for "what improved" (SHIG 28). */
  readonly previous: BestRecord | null;
}

/** Persist `record` for `id` only if it beats the existing score. */
export function saveResult(
  store: RecordStore,
  id: string,
  record: BestRecord,
): SaveOutcome {
  const bests = loadBests(store);
  const prev = bests[id] ?? null;
  const improved = !prev || record.score > prev.score;
  if (improved) {
    bests[id] = record;
    store.setItem(KEY, JSON.stringify(bests));
    return { best: record, improved: true, previous: prev };
  }
  return { best: prev, improved: false, previous: prev };
}
