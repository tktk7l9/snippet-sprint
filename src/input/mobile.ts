// Mobile soft-keyboard support. A hidden, focusable input summons the native
// keyboard; we read characters from `beforeinput` events (which mobile keyboards
// fire reliably, unlike keydown) and keep the field empty.

import type { KeyboardHooks } from "./keyboard.js";

export function isTouchDevice(): boolean {
  return window.matchMedia("(pointer: coarse)").matches;
}

export function attachMobileInput(
  sink: HTMLInputElement,
  hooks: Pick<KeyboardHooks, "onChar" | "onBackspace">,
): () => void {
  const onBeforeInput = (e: Event): void => {
    const ev = e as InputEvent;
    if (ev.inputType === "insertLineBreak") {
      hooks.onChar("\n");
      ev.preventDefault();
      return;
    }
    if (ev.inputType === "deleteContentBackward") {
      hooks.onBackspace();
      ev.preventDefault();
      return;
    }
    if (ev.data) {
      for (const ch of ev.data) hooks.onChar(ch);
      ev.preventDefault();
    }
  };

  sink.addEventListener("beforeinput", onBeforeInput);
  // keep the field cleared so each insertion is independent
  const clear = (): void => {
    sink.value = "";
  };
  sink.addEventListener("input", clear);

  return () => {
    sink.removeEventListener("beforeinput", onBeforeInput);
    sink.removeEventListener("input", clear);
  };
}

/** Bring up the soft keyboard by focusing the hidden sink. */
export function focusSink(sink: HTMLInputElement): void {
  sink.value = "";
  sink.focus();
}
