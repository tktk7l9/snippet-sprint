// localStorage wrapped so private mode / disabled storage never throws.

import type { RecordStore } from "./engine/records.js";

export const safeStore: RecordStore = {
  getItem(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  setItem(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* ignore quota / disabled storage */
    }
  },
};
