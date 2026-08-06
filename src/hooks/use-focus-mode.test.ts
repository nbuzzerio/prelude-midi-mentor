import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useFocusMode } from "./use-focus-mode";

afterEach(() => {
  cleanup();
});

function dispatchKeyDown(
  key: string,
  options: KeyboardEventInit = {},
  target: Window | Element = window,
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    bubbles: true,
    cancelable: true,
    key,
    ...options,
  });

  act(() => {
    target.dispatchEvent(event);
  });

  return event;
}

describe("useFocusMode", () => {
  it("suppresses activation while disabled", () => {
    const { result } = renderHook(() => useFocusMode(false));
    dispatchKeyDown("f");
    act(() => result.current.toggleFocusMode());
    expect(result.current.isFocusMode).toBe(false);
  });
  it("toggles focus mode with unmodified F", () => {
    const { result } = renderHook(() => useFocusMode());

    const enterEvent = dispatchKeyDown("f");

    expect(result.current.isFocusMode).toBe(true);
    expect(enterEvent.defaultPrevented).toBe(true);

    dispatchKeyDown("F");

    expect(result.current.isFocusMode).toBe(false);
  });

  it("exits with Escape but never enters with Escape", () => {
    const { result } = renderHook(() => useFocusMode());

    const inactiveEscapeEvent = dispatchKeyDown("Escape");

    expect(result.current.isFocusMode).toBe(false);
    expect(inactiveEscapeEvent.defaultPrevented).toBe(false);

    dispatchKeyDown("f");

    const activeEscapeEvent = dispatchKeyDown("Escape");

    expect(result.current.isFocusMode).toBe(false);
    expect(activeEscapeEvent.defaultPrevented).toBe(true);
  });

  it.each([
    { ctrlKey: true },
    { metaKey: true },
    { altKey: true },
    { shiftKey: true },
    { repeat: true },
  ])("ignores modified and repeated F events", (options) => {
    const { result } = renderHook(() => useFocusMode());

    const event = dispatchKeyDown("f", options);

    expect(result.current.isFocusMode).toBe(false);
    expect(event.defaultPrevented).toBe(false);
  });

  it.each(["input", "textarea", "select"])(
    "ignores F inside a %s",
    (tagName) => {
      const { result } = renderHook(() => useFocusMode());
      const element = document.createElement(tagName);

      document.body.append(element);

      const event = dispatchKeyDown("f", {}, element);

      expect(result.current.isFocusMode).toBe(false);
      expect(event.defaultPrevented).toBe(false);

      element.remove();
    },
  );

  it("ignores F inside an editable element", () => {
    const { result } = renderHook(() => useFocusMode());
    const editableElement = document.createElement("div");
    const child = document.createElement("span");

    editableElement.setAttribute("contenteditable", "true");
    editableElement.append(child);
    document.body.append(editableElement);

    dispatchKeyDown("f", {}, child);

    expect(result.current.isFocusMode).toBe(false);

    editableElement.remove();
  });

  it("removes the keyboard listener on unmount", () => {
    const { result, unmount } = renderHook(() => useFocusMode());

    unmount();
    dispatchKeyDown("f");

    expect(result.current.isFocusMode).toBe(false);
  });
});
