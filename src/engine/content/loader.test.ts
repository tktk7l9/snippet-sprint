import { describe, expect, it, vi } from "vitest";

// A cold loader (fresh module registry) so the first-load paths are observable;
// content.test.ts covers the rules over everything once loaded.
describe("content loader (cold)", () => {
  it("shares one in-flight request between concurrent loads of the same language", async () => {
    vi.resetModules();
    const m = await import("./index.js");
    expect(m.isLoaded(["go"])).toBe(false);
    expect(m.poolFor(["go"])).toEqual([]);
    const [a, b] = await Promise.all([m.loadLanguage("go"), m.loadLanguage("go")]);
    expect(a).toBe(b);
    expect(m.isLoaded(["go"])).toBe(true);
    expect(m.isLoaded(["go", "py"])).toBe(false);
    expect(await m.loadLanguage("go")).toBe(a);
  });
});
