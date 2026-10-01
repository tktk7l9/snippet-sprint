import { describe, expect, it } from "vitest";
import { fitFrame } from "./viewport.js";

describe("fitFrame", () => {
  it("follows the visual viewport when a soft keyboard shrinks it (SHIG 30, 85)", () => {
    expect(fitFrame({ height: 480, offsetTop: 0, scale: 1 })).toEqual({ height: 480, top: 0 });
    // iOS also shifts the visual viewport down when the page is nudged up.
    expect(fitFrame({ height: 450.4, offsetTop: 30.6, scale: 1 })).toEqual({ height: 450, top: 31 });
  });

  it("leaves the layout alone while pinch-zoomed", () => {
    expect(fitFrame({ height: 300, offsetTop: 120, scale: 2 })).toBeNull();
  });

  it("tolerates the sub-percent scale jitter browsers report", () => {
    expect(fitFrame({ height: 800, offsetTop: 0, scale: 1.004 })).toEqual({ height: 800, top: 0 });
  });
});
