// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { safeStore } from "./storage.js";

describe("safeStore", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("round-trips through localStorage", () => {
    safeStore.setItem("k", "v");
    expect(safeStore.getItem("k")).toBe("v");
    expect(safeStore.getItem("missing")).toBeNull();
  });

  it("swallows a write failure (quota / private mode)", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota", "QuotaExceededError");
    });
    expect(() => safeStore.setItem("k", "v")).not.toThrow();
  });

  it("returns null when reading throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    expect(safeStore.getItem("k")).toBeNull();
  });
});
