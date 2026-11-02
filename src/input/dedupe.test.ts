import { describe, expect, it } from "vitest";
import { ECHO_WINDOW_MS, KeyEcho } from "./dedupe.js";

function clock(start = 1000): { now: () => number; advance(ms: number): void } {
  let t = start;
  return { now: () => t, advance: (ms) => (t += ms) };
}

describe("KeyEcho", () => {
  it("treats the beforeinput that follows a handled keydown as its echo", () => {
    const echo = new KeyEcho(clock().now);
    echo.claim("a");
    expect(echo.isEcho("a")).toBe(true);
  });

  it("lets soft-keyboard text through when no keydown claimed it", () => {
    const echo = new KeyEcho(clock().now);
    expect(echo.isEcho("a")).toBe(false);
  });

  it("uses each claim once, so a second identical character still counts", () => {
    const echo = new KeyEcho(clock().now);
    echo.claim("a");
    expect(echo.isEcho("a")).toBe(true);
    expect(echo.isEcho("a")).toBe(false);
  });

  it("only drops text that matches the claimed character", () => {
    const echo = new KeyEcho(clock().now);
    echo.claim("a");
    expect(echo.isEcho("b")).toBe(false);
    // A mismatch also spends the claim.
    expect(echo.isEcho("a")).toBe(false);
  });

  it("does not drop multi-character insertions such as autocomplete", () => {
    const echo = new KeyEcho(clock().now);
    echo.claim("a");
    expect(echo.isEcho("ab")).toBe(false);
  });

  it("forgets a claim whose echo never came (keydown with the sink unfocused)", () => {
    const c = clock();
    const echo = new KeyEcho(c.now);
    echo.claim("a");
    c.advance(ECHO_WINDOW_MS);
    expect(echo.isEcho("a")).toBe(true);
    echo.claim("a");
    c.advance(ECHO_WINDOW_MS + 1);
    expect(echo.isEcho("a")).toBe(false);
  });

  it("reads performance.now by default", () => {
    const echo = new KeyEcho();
    echo.claim("x");
    expect(echo.isEcho("x")).toBe(true);
  });
});
