import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderPrintFlow } from "./staff-builder-print-flow";

const score: StaffBuilderScore = {
  schemaVersion: 3, annotations: [], id: "persisted", title: "Persisted Print", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
  tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], measures: Array.from({ length: 6 }, (_value, index) => ({ id: `m${index + 1}`, events: [] })),
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ measureText: (text: string) => ({ width: text.length * 8 }) } as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.runOnlyPendingTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("StaffBuilderPrintFlow", () => {
  it("prints custom ranges from the supplied score and closes on afterprint", () => {
    const close = vi.fn();
    const print = vi.fn();
    vi.stubGlobal("print", print);
    render(<StaffBuilderPrintFlow onClose={close} score={score} />);
    fireEvent.click(screen.getByLabelText("Measure ranges", { selector: "input[type=radio]" }));
    fireEvent.change(screen.getByLabelText("Measure ranges", { selector: "input[type=text]" }), { target: { value: "2-3, 6" } });
    fireEvent.click(screen.getByRole("radio", { name: "5" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Print / Save PDF" }));
    expect([...document.querySelectorAll<HTMLElement>("[data-measure-number-lane=bottom]")].map(({ textContent }) => textContent)).toEqual(["Measure 2", "Measure 3", "Measure 6"]);
    act(() => vi.advanceTimersByTime(0));
    expect(print).toHaveBeenCalledOnce();
    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(close).toHaveBeenCalledOnce();
  });

  it("falls back, cleans up on unmount, and supports a later flow instance", () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    const firstClose = vi.fn();
    const first = render(<StaffBuilderPrintFlow onClose={firstClose} score={score} />);
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    act(() => vi.advanceTimersByTime(1_000));
    expect(firstClose).toHaveBeenCalledOnce();
    first.unmount();
    act(() => vi.runOnlyPendingTimers());
    const second = render(<StaffBuilderPrintFlow onClose={vi.fn()} score={score} />);
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    act(() => vi.advanceTimersByTime(0));
    expect(print).toHaveBeenCalledTimes(2);
    second.unmount();
  });
});
