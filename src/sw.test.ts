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

  it("precaches the hashed entry script and stylesheet named by the cached shell", () => {
    expect(sw).toContain('cache.match("/index.html")');
    expect(sw).toContain('(?:src|href)="(\\/assets\\/[^"]+)"');
  });

  it("serves cached files whatever the Vary header says (module scripts send an Origin header, the precache did not)", () => {
    expect(sw.match(/caches\.match\([^)]*\{ ignoreVary: true \}\)/g)).toHaveLength(2);
  });

  it("deletes caches from older versions on activate", () => {
    expect(sw).toContain("keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))");
  });
});
