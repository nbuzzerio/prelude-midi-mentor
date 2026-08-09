import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffBuilderMobileKeyboardSheet } from "./staff-builder-mobile-keyboard-sheet";

vi.mock("./staff-builder-virtual-keyboard", () => ({ StaffBuilderVirtualKeyboard: ({ onVirtualPitchToggle }: { onVirtualPitchToggle: (midi: number) => void }) => <button onClick={() => onVirtualPitchToggle(60)} type="button">Mobile pitch</button> }));
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function renderSheet(overrides: Partial<Parameters<typeof StaffBuilderMobileKeyboardSheet>[0]> = {}) {
  const scoreRegion = document.createElement("div");
  const scoreRegionRef = createRef<HTMLElement>();
  scoreRegionRef.current = scoreRegion;
  const props = { pending: { treble: [60], bass: [] }, onVirtualPitchToggle: vi.fn(), onLock: vi.fn(), onClose: vi.fn(), scoreRegionRef, ...overrides };
  return { props, scoreRegion, ...render(<StaffBuilderMobileKeyboardSheet {...props} />) };
}

describe("StaffBuilderMobileKeyboardSheet", () => {
  it("offers Close, Enter, and the shared keyboard without closing after Enter", () => {
    const { props } = renderSheet();
    expect(screen.getByRole("region", { name: "Virtual keyboard" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close virtual keyboard" }));
    fireEvent.click(screen.getByRole("button", { name: "Mobile pitch" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock pitches and continue" }));
    expect(props.onVirtualPitchToggle).toHaveBeenCalledWith(60);
    expect(props.onLock).toHaveBeenCalledOnce();
    expect(screen.getByRole("region", { name: "Virtual keyboard" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close virtual keyboard" }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("retains native disabled Enter semantics", () => {
    const lock = vi.fn();
    renderSheet({ lockDisabled: true, onLock: lock });
    const enter = screen.getByRole("button", { name: "Lock pitches and continue" }) as HTMLButtonElement;
    expect(enter.disabled).toBe(true);
    fireEvent.click(enter);
    expect(lock).not.toHaveBeenCalled();
  });

  it("only corrects visibility when the score is obscured and works without visualViewport", () => {
    const scroll = vi.fn();
    let scoreBottom = 200;
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("staff-builder-mobile-keyboard-sheet")
        ? ({ height: 200 } as DOMRect)
        : ({ bottom: scoreBottom } as DOMRect);
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scroll,
    });

    const first = renderSheet();
    expect(scroll).not.toHaveBeenCalled();
    first.unmount();
    scoreBottom = window.innerHeight;
    renderSheet();
    expect(scroll).toHaveBeenCalledWith({ block: "nearest" });
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });
});
