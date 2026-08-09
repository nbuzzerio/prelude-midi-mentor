import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STAFF_BUILDER_CAPTURE_STATE } from "../staff-builder-capture";
import { StaffBuilderCaptureStrip } from "./staff-builder-capture-strip";

afterEach(cleanup);

describe("StaffBuilderCaptureStrip", () => {
  const actions = () => ({ step: vi.fn(), previous: vi.fn(), lock: vi.fn(), rest: vi.fn(), next: vi.fn(), clear: vi.fn() });

  it("uses glyph steps and decorative Lucide icons while preserving callbacks", () => {
    const a = actions();
    render(<StaffBuilderCaptureStrip captureState={DEFAULT_STAFF_BUILDER_CAPTURE_STATE} hasPending onClear={a.clear} onLock={a.lock} onNext={a.next} onPrevious={a.previous} onRest={a.rest} onStepDurationChange={a.step} />);
    expect(screen.getByRole("button", { name: "Quarter-note step" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Eighth-note step" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock pitches and continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Add rest at current position" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Position" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Current Entry" }));
    expect(a.step).toHaveBeenCalledWith("eighth");
    expect(a.lock).toHaveBeenCalledOnce();
    expect(a.rest).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Add rest at current position" }).querySelector('[data-glyph-family="rest"]')).toBeTruthy();
    expect(a.next).toHaveBeenCalledOnce();
    expect(a.clear).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", { name: "Next Position" }).querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("disables Previous at origin and only shows Clear with pending pitches", () => {
    const a = actions();
    const { rerender } = render(<StaffBuilderCaptureStrip captureState={DEFAULT_STAFF_BUILDER_CAPTURE_STATE} hasPending={false} onClear={a.clear} onLock={a.lock} onNext={a.next} onPrevious={a.previous} onRest={a.rest} onStepDurationChange={a.step} />);
    expect((screen.getByRole("button", { name: "Previous Position" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Clear Current Entry" })).toBeNull();
    rerender(<StaffBuilderCaptureStrip captureState={{ ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, cursor: { measureIndex: 0, offsetTicks: 240 } }} hasPending onClear={a.clear} onLock={a.lock} onNext={a.next} onPrevious={a.previous} onRest={a.rest} onStepDurationChange={a.step} />);
    expect((screen.getByRole("button", { name: "Previous Position" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByRole("button", { name: "Clear Current Entry" })).toBeTruthy();
  });

  it("shows a labelled decorative keyboard launcher only for mobile presentation", () => {
    const a = actions();
    const open = vi.fn();
    const { rerender } = render(<StaffBuilderCaptureStrip captureState={DEFAULT_STAFF_BUILDER_CAPTURE_STATE} hasPending={false} onClear={a.clear} onLock={a.lock} onNext={a.next} onOpenKeyboard={open} onPrevious={a.previous} onRest={a.rest} onStepDurationChange={a.step} />);
    expect(screen.queryByRole("button", { name: "Open virtual keyboard" })).toBeNull();
    rerender(<StaffBuilderCaptureStrip captureState={DEFAULT_STAFF_BUILDER_CAPTURE_STATE} hasPending={false} onClear={a.clear} onLock={a.lock} onNext={a.next} onOpenKeyboard={open} onPrevious={a.previous} onRest={a.rest} onStepDurationChange={a.step} showKeyboardLauncher />);
    const launcher = screen.getByRole("button", { name: "Open virtual keyboard" });
    fireEvent.click(launcher);
    expect(open).toHaveBeenCalledOnce();
    expect(launcher.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
