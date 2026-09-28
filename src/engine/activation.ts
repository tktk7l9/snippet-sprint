// Guards against keystrokes that "leak" from typing into a freshly shown
// screen. The results screen focuses NEXT, so an Enter pressed out of habit
// right after the final character would skip the results entirely (SHIG 57).

/** How long keyboard activation is ignored after a screen appears. */
export const KEY_GRACE_MS = 600;

/**
 * True when a click came from the keyboard (`detail === 0`) too soon after the
 * screen was shown to be a deliberate choice. Pointer clicks always pass.
 */
export function isStrayKeyActivation(
  detail: number,
  shownAt: number,
  now: number,
  graceMs: number = KEY_GRACE_MS,
): boolean {
  return detail === 0 && now - shownAt < graceMs;
}
