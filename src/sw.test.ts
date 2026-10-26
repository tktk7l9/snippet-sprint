import sw from "../public/sw.js?raw";
import { describe, expect, it } from "vitest";

// The service worker is plain JS outside the TypeScript build, so pin the rules
// that keep a bad response from being served offline forever.
describe("public/sw.js", () => {
  it("only handles same-origin GET requests", () => {
    expect(sw).toContain('req.method !== "GET" || new URL(req.url).origin !== location.origin');
  });

  it("caches only successful, non-redirected responses through one helper (navigations and assets)", () => {
    expect(sw).toContain("if (!res.ok || res.redirected) return;");
    expect(sw.match(/store\(event, (?:SHELL_URL|req), res\)/g)).toHaveLength(2);
    expect(sw).not.toMatch(/c\.put\((?!key)/);
  });

  it("keeps the worker alive until the write lands and swallows a failed write", () => {
    expect(sw).toMatch(/event\.waitUntil\(\s*caches\s*\.open\(CACHE\)\s*\.then\(\(c\) => c\.put\(key, copy\)\)\s*\.catch\(\(\) => \{\}\)/);
  });

  it("caches the shell under / (the host redirects /index.html, and a redirected response cannot answer a navigation)", () => {
    expect(sw).toContain('const SHELL_URL = "/";');
    expect(sw).not.toContain('"/index.html"');
    expect(sw).toContain("caches.match(SHELL_URL, { ignoreVary: true })");
  });

  it("precaches the hashed entry script and stylesheet named by the cached shell", () => {
    expect(sw).toContain("cache.match(SHELL_URL)");
    expect(sw).toContain('(?:src|href)="(\\/assets\\/[^"]+)"');
  });

  it("serves cached files whatever the Vary header says (module scripts send an Origin header, the precache did not)", () => {
    expect(sw.match(/caches\.match\([^)]*\{ ignoreVary: true \}\)/g)).toHaveLength(2);
  });

  it("deletes caches from older versions on activate", () => {
    expect(sw).toContain('const CACHE = "snippet-sprint-v2";');
    expect(sw).toContain("keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))");
  });
});
