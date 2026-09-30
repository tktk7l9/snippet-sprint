// @vitest-environment jsdom
//
// Bootstrap: the start screen ships immediately; the Three.js game chunk is
// loaded on the first interaction and the snippet-availability filter rides
// along with it.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, within } from "@testing-library/dom";
import userEvent from "@testing-library/user-event";
import { isShown, mountApp, trackGlobalListeners } from "./test/dom.js";
import { byId } from "./ui/dom.js";

const mocks = vi.hoisted(() => ({
  controller: { start: vi.fn(), retry: vi.fn(), next: vi.fn(), menu: vi.fn() },
  createGame: vi.fn(),
  availableCategories: vi.fn(),
  availableDifficulties: vi.fn(),
}));

vi.mock("./game.js", () => ({ createGame: mocks.createGame }));
vi.mock("./engine/availability.js", () => ({
  availableCategories: mocks.availableCategories,
  availableDifficulties: mocks.availableDifficulties,
}));

async function flush(): Promise<void> {
  // Dynamic imports resolve over a few event-loop turns.
  await new Promise((r) => setTimeout(r, 0));
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
  });
  afterEach(() => {
    untrack();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("shows the start screen without loading the game chunk", async () => {
    await import("./main.js");
    expect(isShown("start-screen")).toBe(true);
    expect(document.activeElement).toBe(byId("start-btn"));
    expect(mocks.createGame).not.toHaveBeenCalled();
    expect(document.head.querySelector("script[data-cf-beacon]")).toBeNull();
  });

  it("loads the game once and starts it with the chosen config on START", async () => {
    await import("./main.js");
    await user.click(screen.getByRole("button", { name: "START" }));
    await flush();
    expect(mocks.createGame).toHaveBeenCalledTimes(1);
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

  it("warms the game chunk and enables filter feasibility on the first interaction", async () => {
    await import("./main.js");
    window.dispatchEvent(new Event("pointerdown"));
    await flush();
    expect(mocks.createGame).toHaveBeenCalledTimes(1);
    expect(mocks.availableCategories).toHaveBeenCalledWith(["ts"]);
    expect(mocks.availableDifficulties).toHaveBeenCalledWith(["ts"], "all");
    const cats = within(byId("cat-pills"));
    expect((cats.getByRole("button", { name: "Flow" }) as HTMLButtonElement).disabled).toBe(true);
    expect((cats.getByRole("button", { name: "Basics" }) as HTMLButtonElement).disabled).toBe(false);
    // A second interaction does not load anything again.
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a" }));
    await flush();
    expect(mocks.createGame).toHaveBeenCalledTimes(1);
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
