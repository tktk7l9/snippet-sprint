// Shared DOM fixture for UI tests. The markup comes from the real index.html so
// the tests exercise the same ids/classes that ship, not a hand-copied stub.

import html from "../../index.html?raw";

const body = html.slice(html.indexOf("<body>") + "<body>".length, html.indexOf("</body>"));
// Strip the module script tag; vitest must not try to execute main.ts here.
const appMarkup = body.replace(/<script[^>]*><\/script>/g, "");

/** Reset document.body to the app markup. Call in beforeEach. */
export function mountApp(): void {
  document.body.innerHTML = appMarkup;
}

/** Elements visible to the player are overlays with the "show" class. */
export function isShown(id: string): boolean {
  return document.getElementById(id)?.classList.contains("show") ?? false;
}

/** Fire a keydown on window the way the browser does for a physical key. */
export function pressKey(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
  const e = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true, ...init });
  window.dispatchEvent(e);
  return e;
}

/** Install a matchMedia stub; jsdom ships none. `matches` lists queries that match. */
export function stubMatchMedia(matches: readonly string[] = []): void {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: matches.includes(query),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}

/**
 * Record every listener added to window/document from now on and return a
 * function that removes them. Modules such as game.ts and main.ts attach
 * global listeners that would otherwise leak into the next test.
 */
export function trackGlobalListeners(): () => void {
  const added: Array<[EventTarget, string, EventListenerOrEventListenerObject]> = [];
  const originals = new Map<EventTarget, EventTarget["addEventListener"]>();
  for (const target of [window, document] as EventTarget[]) {
    const original = target.addEventListener.bind(target);
    originals.set(target, target.addEventListener);
    target.addEventListener = ((type: string, listener: EventListenerOrEventListenerObject | null, options?: unknown) => {
      if (listener) added.push([target, type, listener]);
      original(type, listener, options as AddEventListenerOptions);
    }) as EventTarget["addEventListener"];
  }
  return () => {
    for (const [target, type, listener] of added) target.removeEventListener(type, listener);
    for (const [target, fn] of originals) target.addEventListener = fn;
  };
}
