import sw from "../public/sw.js?raw";
import { describe, expect, it } from "vitest";

// The service worker is plain JS outside the TypeScript build, so pin the two
// rules that keep a bad response from being served offline forever.
describe("public/sw.js", () => {
  it("only handles same-origin GET requests", () => {
    expect(sw).toContain('req.method !== "GET" || new URL(req.url).origin !== location.origin');
  });

  it("caches only successful responses (both navigations and assets)", () => {
    expect(sw.match(/if \(res\.ok\)/g)).toHaveLength(2);
  });

  it("deletes caches from older versions on activate", () => {
    expect(sw).toContain("keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))");
  });
});
