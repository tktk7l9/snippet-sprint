import { describe, expect, it } from "vitest";
import { KEY_GRACE_MS, isStrayKeyActivation } from "./activation.js";

describe("isStrayKeyActivation", () => {
  it("ignores keyboard activation inside the grace period", () => {
    expect(isStrayKeyActivation(0, 1000, 1000)).toBe(true);
    expect(isStrayKeyActivation(0, 1000, 1000 + KEY_GRACE_MS - 1)).toBe(true);
  });

  it("accepts keyboard activation once the grace period has passed", () => {
    expect(isStrayKeyActivation(0, 1000, 1000 + KEY_GRACE_MS)).toBe(false);
  });

  it("always accepts pointer clicks", () => {
    expect(isStrayKeyActivation(1, 1000, 1000)).toBe(false);
  });

  it("honours a custom grace period", () => {
    expect(isStrayKeyActivation(0, 0, 50, 100)).toBe(true);
    expect(isStrayKeyActivation(0, 0, 150, 100)).toBe(false);
  });
});
