// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stubMatchMedia } from "../test/dom.js";
import { attachMobileInput, focusSink, isTouchDevice } from "./mobile.js";

function beforeInput(sink: HTMLInputElement, inputType: string, data: string | null = null): InputEvent {
  const e = new InputEvent("beforeinput", { inputType, data, bubbles: true, cancelable: true });
  sink.dispatchEvent(e);
  return e;
}

describe("isTouchDevice", () => {
  it("reads the coarse-pointer media query", () => {
    stubMatchMedia(["(pointer: coarse)"]);
    expect(isTouchDevice()).toBe(true);
    stubMatchMedia([]);
    expect(isTouchDevice()).toBe(false);
  });
});

describe("attachMobileInput", () => {
  let sink: HTMLInputElement;
  const hooks = { onChar: vi.fn(), onBackspace: vi.fn() };
  let detach: () => void;

  beforeEach(() => {
    document.body.innerHTML = '<input id="key-sink" type="text" />';
    sink = document.getElementById("key-sink") as HTMLInputElement;
    hooks.onChar.mockReset();
    hooks.onBackspace.mockReset();
    detach = attachMobileInput(sink, hooks);
  });
  afterEach(() => detach());

  it("feeds each inserted character and keeps the field empty", () => {
    const e = beforeInput(sink, "insertText", "ab");
    expect(hooks.onChar.mock.calls).toEqual([["a"], ["b"]]);
    expect(e.defaultPrevented).toBe(true);
    sink.value = "ab";
    sink.dispatchEvent(new Event("input", { bubbles: true }));
    expect(sink.value).toBe("");
  });

  it("maps a soft-keyboard return to a newline", () => {
    const e = beforeInput(sink, "insertLineBreak");
    expect(hooks.onChar).toHaveBeenCalledWith("\n");
    expect(e.defaultPrevented).toBe(true);
  });

  it("maps delete-backward to backspace", () => {
    const e = beforeInput(sink, "deleteContentBackward");
    expect(hooks.onBackspace).toHaveBeenCalledTimes(1);
    expect(hooks.onChar).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(true);
  });

  it("ignores input types with no data (e.g. composition updates)", () => {
    const e = beforeInput(sink, "insertCompositionText", null);
    expect(hooks.onChar).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });

  it("stops listening once detached", () => {
    detach();
    detach = () => {};
    beforeInput(sink, "insertText", "z");
    sink.value = "z";
    sink.dispatchEvent(new Event("input", { bubbles: true }));
    expect(hooks.onChar).not.toHaveBeenCalled();
    expect(sink.value).toBe("z");
  });
});

describe("focusSink", () => {
  it("clears and focuses the hidden input to summon the keyboard", () => {
    document.body.innerHTML = '<input id="key-sink" type="text" value="junk" />';
    const sink = document.getElementById("key-sink") as HTMLInputElement;
    focusSink(sink);
    expect(sink.value).toBe("");
    expect(document.activeElement).toBe(sink);
  });
});
