// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/dom";
import { mountApp } from "../test/dom.js";
import { byId } from "./dom.js";
import { setMuted, shakeEl, toast } from "./feedback.js";

describe("byId", () => {
  beforeEach(mountApp);

  it("returns the element for a known id", () => {
    expect(byId("toast").id).toBe("toast");
  });

  it("names the missing id in the error so a markup change is obvious", () => {
    expect(() => byId("nope")).toThrow("#nope missing");
  });
});

describe("toast", () => {
  beforeEach(() => {
    mountApp();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("shows the text and hides it again after 900ms", () => {
    toast("COMBO ×10");
    const el = byId("toast");
    expect(el.textContent).toBe("COMBO ×10");
    expect(el.classList.contains("show")).toBe(true);
    vi.advanceTimersByTime(899);
    expect(el.classList.contains("show")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(el.classList.contains("show")).toBe(false);
  });

  it("restarts the timer when a second toast replaces the first", () => {
    toast("first");
    vi.advanceTimersByTime(800);
    toast("second");
    vi.advanceTimersByTime(200);
    const el = byId("toast");
    expect(el.textContent).toBe("second");
    expect(el.classList.contains("show")).toBe(true);
    vi.advanceTimersByTime(700);
    expect(el.classList.contains("show")).toBe(false);
  });
});

describe("setMuted", () => {
  beforeEach(mountApp);

  it("creates one real button with an accessible label and pressed state", () => {
    setMuted(false);
    const pill = screen.getByRole("button", { name: "効果音", pressed: true });
    expect(pill.textContent).toContain("SOUND");
    expect(pill.classList.contains("on")).toBe(true);
    expect(byId("status-bar").querySelectorAll("button")).toHaveLength(1);
  });

  it("updates the same button in place when muted so focus survives", () => {
    setMuted(false);
    const pill = screen.getByRole("button", { name: "効果音" });
    pill.focus();
    setMuted(true);
    expect(document.activeElement).toBe(pill);
    expect(pill.getAttribute("aria-pressed")).toBe("false");
    expect(pill.textContent).toContain("MUTED");
    expect(pill.classList.contains("off")).toBe(true);
    expect(byId("status-bar").querySelectorAll("button")).toHaveLength(1);
  });
});

describe("shakeEl", () => {
  beforeEach(() => {
    mountApp();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("adds the shake class and removes it after the animation", () => {
    const el = byId("code");
    shakeEl(el);
    expect(el.classList.contains("shake")).toBe(true);
    vi.advanceTimersByTime(200);
    expect(el.classList.contains("shake")).toBe(false);
  });

  it("re-triggers on a rapid second shake instead of cutting it short", () => {
    const el = byId("code");
    shakeEl(el);
    vi.advanceTimersByTime(150);
    shakeEl(el);
    vi.advanceTimersByTime(100);
    expect(el.classList.contains("shake")).toBe(true);
    vi.advanceTimersByTime(100);
    expect(el.classList.contains("shake")).toBe(false);
  });
});
