// Physical-keyboard capture. Typing keys are only intercepted while actively
// playing; Escape/Tab work while in a game (playing or paused). On menus and
// the results screen nothing is captured, so normal focus navigation works.

export interface KeyboardHooks {
  onChar(ch: string): void;
  onBackspace(): void;
  onEscape(): void;
  onRestart(): void;
  /** True only while actively typing (game in progress, not paused). */
  isTyping(): boolean;
  /** True while in a game (playing or paused) — enables Esc / Tab. */
  isInGame(): boolean;
}

export function attachKeyboard(hooks: KeyboardHooks): () => void {
  const handler = (e: KeyboardEvent): void => {
    // leave OS / browser shortcuts (copy, devtools, ...) alone
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (e.key === "Escape") {
      if (hooks.isInGame()) {
        e.preventDefault();
        hooks.onEscape();
      }
      return;
    }
    if (e.key === "Tab") {
      // only hijack Tab in-game; otherwise allow focus navigation
      if (hooks.isInGame()) {
        e.preventDefault();
        hooks.onRestart();
      }
      return;
    }

    if (!hooks.isTyping()) return;

    if (e.key === "Backspace") {
      e.preventDefault();
      hooks.onBackspace();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      hooks.onChar("\n");
      return;
    }
    if (e.key.length === 1) {
      if (e.key === " ") e.preventDefault(); // don't scroll the page
      hooks.onChar(e.key);
    }
  };

  window.addEventListener("keydown", handler);
  return () => window.removeEventListener("keydown", handler);
}
