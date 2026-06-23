// Shared transient UI feedback used across all modes: the center toast, the
// audio status pill, and a reusable element shake.

import { byId } from "./dom.js";

let toastTimer = 0;
const shakeTimers = new WeakMap<HTMLElement, number>();

export function toast(text: string): void {
  const el = byId("toast");
  el.textContent = text;
  el.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el.classList.remove("show"), 900);
}

export function setMuted(muted: boolean): void {
  const bar = byId("status-bar");
  bar.innerHTML = "";
  const pill = document.createElement("div");
  pill.className = `status-pill ${muted ? "off" : "on"}`;
  pill.textContent = muted ? "🔇 MUTED" : "🔊 SOUND";
  bar.appendChild(pill);
}

export function shakeEl(el: HTMLElement): void {
  el.classList.remove("shake");
  void el.offsetWidth; // force reflow so the animation retriggers
  el.classList.add("shake");
  window.clearTimeout(shakeTimers.get(el));
  shakeTimers.set(
    el,
    window.setTimeout(() => el.classList.remove("shake"), 200),
  );
}
