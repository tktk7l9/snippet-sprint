// @vitest-environment jsdom
//
// Bootstrap: the start screen ships immediately; the Three.js game chunk is
// loaded on the first interaction, snippets load per language on demand, and a
// round starts once the chosen languages are in.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { isShown, mountApp, trackGlobalListeners } from "./test/dom.js";
import { byId } from "./ui/dom.js";

const mocks = vi.hoisted(() => ({
  loaded: new Set<string>(),
  controller: { start: vi.fn(), retry: vi.fn(), next: vi.fn(), menu: vi.fn() },
  createGame: vi.fn(),
  availableCategories: vi.fn(),
  availableDifficulties: vi.fn(),
  loadLanguages: vi.fn(),
  isLoaded: vi.fn(),
  poolFor: vi.fn(),
  warmAll: vi.fn(),
}));

vi.mock("./game.js", () => ({ createGame: mocks.createGame }));
vi.mock("./engine/availability.js", () => ({
  availableCategories: mocks.availableCategories,
  availableDifficulties: mocks.availableDifficulties,
}));
vi.mock("./engine/content/index.js", () => ({
  loadLanguages: mocks.loadLanguages,
  isLoaded: mocks.isLoaded,
  poolFor: mocks.poolFor,
  warmAll: mocks.warmAll,
}));

async function flush(): Promise<void> {
  // Dynamic imports resolve over a few event-loop turns.
  await new Promise((r) => setTimeout(r, 0));
}

function stubIdle(): void {
  Object.defineProperty(window, "requestIdleCallback", {
    value: (cb: () => void) => {
      cb();
      return 1;
    },
    configurable: true,
  });
}

function stubConnection(saveData: boolean): void {
  Object.defineProperty(navigator, "connection", { value: { saveData }, configurable: true });
}

describe("main bootstrap", () => {
  const user = userEvent.setup();
  let untrack: () => void = () => {};

  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    mountApp();
    untrack = trackGlobalListeners();
    mocks.createGame.mockReset().mockReturnValue(mocks.controller);
    for (const fn of Object.values(mocks.controller)) fn.mockReset();
    mocks.availableCategories.mockReset().mockReturnValue(new Set(["basics"]));
    mocks.availableDifficulties.mockReset().mockReturnValue(new Set(["easy"]));
    mocks.loaded.clear();
    mocks.loadLanguages.mockReset().mockImplementation(async (langs: readonly string[]) => {
      for (const l of langs) mocks.loaded.add(l);
      return [];
    });
    mocks.isLoaded.mockReset().mockImplementation((langs: readonly string[]) => langs.every((l) => mocks.loaded.has(l)));
    mocks.poolFor.mockReset().mockReturnValue([]);
    mocks.warmAll.mockReset().mockResolvedValue(undefined);
  });
  afterEach(() => {
    untrack();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.useRealTimers();
    delete (window as { requestIdleCallback?: unknown }).requestIdleCallback;
    delete (navigator as { connection?: unknown }).connection;
  });

  it("shows the start screen without loading the game chunk or any snippet", async () => {
    await import("./main.js");
    expect(isShown("start-screen")).toBe(true);
    expect(document.activeElement).toBe(byId("start-btn"));
    expect(mocks.createGame).not.toHaveBeenCalled();
    expect(mocks.loadLanguages).not.toHaveBeenCalled();
    expect(document.head.querySelector("script[data-cf-beacon]")).toBeNull();
  });

  it("loads the game and the chosen languages once, then starts with the config on START", async () => {
    await import("./main.js");
    await user.click(screen.getByRole("button", { name: "START" }));
    await flush();
    expect(mocks.createGame).toHaveBeenCalledTimes(1);
    expect(mocks.loadLanguages).toHaveBeenCalledWith(["ts"]);
    expect(mocks.controller.start).toHaveBeenCalledWith({
      languages: ["ts"],
      difficulty: "mixed",
      category: "all",
    });
    await user.click(screen.getByRole("button", { name: "START" }));
    await flush();
    expect(mocks.createGame).toHaveBeenCalledTimes(1);
    expect(mocks.controller.start).toHaveBeenCalledTimes(2);
  });

  it("warms the game chunk and the selected language's snippets on the first interaction", async () => {
    mocks.loaded.add("ts");
    await import("./main.js");
    window.dispatchEvent(new Event("pointerdown"));
    await flush();
    expect(mocks.createGame).toHaveBeenCalledTimes(1);
    // Feasibility is answered from the loaded pool of the selection.
    expect(mocks.poolFor).toHaveBeenCalledWith(["ts"]);
    expect(mocks.availableCategories).toHaveBeenCalledWith(["ts"], []);
    expect(mocks.availableDifficulties).toHaveBeenCalledWith(["ts"], "all", []);
    const cats = within(byId("cat-pills"));
    expect((cats.getByRole("button", { name: "Flow" }) as HTMLButtonElement).disabled).toBe(true);
    expect((cats.getByRole("button", { name: "Basics" }) as HTMLButtonElement).disabled).toBe(false);
    // A second interaction does not load anything again.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    await flush();
    expect(mocks.createGame).toHaveBeenCalledTimes(1);
  });

  it("asks for a language that is not in memory yet, keeping the filters open meanwhile", async () => {
    let release: () => void = () => {};
    mocks.loadLanguages.mockImplementationOnce(
      () =>
        new Promise<never[]>((r) => {
          release = () => {
            mocks.loaded.add("ts");
            r([]);
          };
        }),
    );
    await import("./main.js");
    window.dispatchEvent(new Event("pointerdown"));
    await flush();
    expect(mocks.loadLanguages).toHaveBeenCalledWith(["ts"]);
    expect(mocks.availableCategories).not.toHaveBeenCalled();
    const cats = within(byId("cat-pills"));
    expect((cats.getByRole("button", { name: "Flow" }) as HTMLButtonElement).disabled).toBe(false);
    release();
    await flush();
    expect(mocks.availableCategories).toHaveBeenCalledWith(["ts"], []);
    expect((cats.getByRole("button", { name: "Flow" }) as HTMLButtonElement).disabled).toBe(true);
    // A failed load (offline) is swallowed here; START reports it instead.
    mocks.loadLanguages.mockRejectedValue(new Error("offline"));
    await user.hover(within(byId("lang-pills")).getByRole("button", { name: "Rust" }));
    await flush();
    expect(mocks.loadLanguages).toHaveBeenCalledWith(["rust"]);
  });

  it("explains next to START when the snippets cannot be fetched, offers a reload, and recovers on the next try", async () => {
    const online = mocks.loadLanguages.getMockImplementation();
    mocks.loadLanguages.mockRejectedValue(new Error("offline"));
    await import("./main.js");
    // A bare click: the pointerdown warm-up is not what is under test here.
    byId("start-btn").click();
    await flush();
    expect(mocks.controller.start).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toContain("読み込めませんでした");
    expect(isShown("start-screen")).toBe(true);
    // location.reload is unforgeable in jsdom; swap the whole location global instead.
    const reload = vi.fn();
    vi.stubGlobal("location", { href: window.location.href, reload });
    await user.click(screen.getByRole("button", { name: "再読み込み" }));
    expect(reload).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
    mocks.loadLanguages.mockImplementation(online!);
    await user.click(screen.getByRole("button", { name: "START" }));
    await flush();
    expect(screen.getByRole("alert").textContent).toBe("");
    expect(byId("start-reload").hidden).toBe(true);
    expect(mocks.controller.start).toHaveBeenCalledTimes(1);
  });

  it("retries the game chunk after a failed warm-up instead of staying broken", async () => {
    mocks.createGame.mockImplementationOnce(() => {
      throw new Error("chunk failed");
    });
    await import("./main.js");
    window.dispatchEvent(new Event("pointerdown"));
    await flush();
    expect(mocks.createGame).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("alert").textContent).toBe("");
    byId("start-btn").click();
    await flush();
    expect(mocks.createGame).toHaveBeenCalledTimes(2);
    expect(mocks.controller.start).toHaveBeenCalledTimes(1);
  });

  it("warms the remaining languages in idle time after the first round starts, once", async () => {
    stubIdle();
    await import("./main.js");
    await user.click(screen.getByRole("button", { name: "START" }));
    await flush();
    expect(mocks.warmAll).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "START" }));
    await flush();
    expect(mocks.warmAll).toHaveBeenCalledTimes(1);
  });

  it("tries the warm-up again on a later START when it failed (offline), and skips it under Save-Data", async () => {
    stubIdle();
    mocks.warmAll.mockRejectedValueOnce(new Error("offline"));
    await import("./main.js");
    await user.click(screen.getByRole("button", { name: "START" }));
    await flush();
    await user.click(screen.getByRole("button", { name: "START" }));
    await flush();
    expect(mocks.warmAll).toHaveBeenCalledTimes(2);

    vi.resetModules();
    mountApp();
    mocks.warmAll.mockClear();
    stubConnection(true);
    await import("./main.js");
    await user.click(screen.getByRole("button", { name: "START" }));
    await flush();
    expect(mocks.controller.start).toHaveBeenCalledTimes(3);
    expect(mocks.warmAll).not.toHaveBeenCalled();
  });

  it("falls back to a timer when the browser has no requestIdleCallback", async () => {
    vi.useFakeTimers();
    await import("./main.js");
    byId("start-btn").click();
    await vi.advanceTimersByTimeAsync(10);
    expect(mocks.controller.start).toHaveBeenCalledTimes(1);
    expect(mocks.warmAll).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2000);
    expect(mocks.warmAll).toHaveBeenCalledTimes(1);
  });

  it("forwards results-screen actions to the loaded game", async () => {
    await import("./main.js");
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    await flush();
    const results = within(byId("results"));
    byId("results").classList.add("show");
    for (const [name, fn] of [
      ["RETRY", mocks.controller.retry],
      ["NEXT", mocks.controller.next],
      ["MENU", mocks.controller.menu],
    ] as const) {
      await user.click(results.getByRole("button", { name }));
      expect(fn).toHaveBeenCalledTimes(1);
    }
  });

  it("does nothing on results actions before the game has loaded", async () => {
    await import("./main.js");
    byId("results").classList.add("show");
    // A bare click (no pointerdown) so the warm-up path is not triggered.
    byId("btn-next").click();
    expect(mocks.controller.next).not.toHaveBeenCalled();
    expect(mocks.createGame).not.toHaveBeenCalled();
  });

  it("in production, injects the analytics beacon and registers the service worker", async () => {
    vi.stubEnv("PROD", true);
    const register = vi.fn(() => Promise.resolve());
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    await import("./main.js");
    const beacon = document.head.querySelector<HTMLScriptElement>("script[data-cf-beacon]");
    expect(beacon?.src).toBe("https://static.cloudflareinsights.com/beacon.min.js");
    expect(beacon?.type).toBe("module");
    window.dispatchEvent(new Event("load"));
    expect(register).toHaveBeenCalledWith("/sw.js");
    beacon?.remove();
    delete (navigator as { serviceWorker?: unknown }).serviceWorker;
  });
});
