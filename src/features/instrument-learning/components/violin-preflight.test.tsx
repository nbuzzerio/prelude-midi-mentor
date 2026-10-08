import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCalibrationSession, assessCalibration } from "../calibration-session";
import { emptyCalibrationMeasurement, CALIBRATION_POLICY } from "../calibration-types";
import { ViolinPreflight } from "./violin-preflight";

afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("violin preflight presentation", () => {
  it("shows G3 target Hz with bounded announcements and keyboard actions", () => {
    const action = vi.fn(); render(<ViolinPreflight calibration={createCalibrationSession("c")} frequencyHz={196} listening onAction={action} onEnterPractice={vi.fn()} />);
    expect(screen.getByText("195.998 Hz")).toBeTruthy();
    expect(screen.getByText("Detected frequency").closest('[aria-live], [role="status"]')).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry" })); fireEvent.click(screen.getByRole("button", { name: "Skip String" }));
    expect(action.mock.calls).toEqual([["retry"], ["skip"]]);
  });
  it.each(["within-band", "near-target", "needs-adjustment"] as const)("only advances green automatically: %s", (tuning) => {
    vi.useFakeTimers(); const action = vi.fn();
    const calibration = assessCalibration(createCalibrationSession("c"), { ...emptyCalibrationMeasurement(), status: "valid", tuning,
      stable: true, medianHz: 196, cents: tuning === "within-band" ? 0 : 20, p10Cents: 0, p90Cents: 1 });
    render(<ViolinPreflight calibration={calibration} frequencyHz={196} listening onAction={action} onEnterPractice={vi.fn()} />);
    act(() => vi.advanceTimersByTime(CALIBRATION_POLICY.acknowledgmentMs));
    expect(action).toHaveBeenCalledTimes(tuning === "within-band" ? 1 : 0);
    if (tuning !== "within-band") { expect(screen.getByText("Lower the string's pitch.")).toBeTruthy(); fireEvent.click(screen.getByText("Continue with warning")); expect(action).toHaveBeenCalledWith("continue"); }
  });
  it("gives no raise/lower direction for an octave ambiguity", () => {
    const calibration = assessCalibration(createCalibrationSession("c"), { ...emptyCalibrationMeasurement(), status: "ambiguous", ambiguity: "possible-harmonic-or-different-pitch" });
    render(<ViolinPreflight calibration={calibration} frequencyHz={392} listening onAction={vi.fn()} onEnterPractice={vi.fn()} />);
    expect(screen.getByText(/may be a harmonic/)).toBeTruthy(); expect(screen.queryByText(/Raise the|Lower the/)).toBeNull();
  });
  it("does not auto-advance when capture is interrupted", () => {
    vi.useFakeTimers(); const action = vi.fn();
    const calibration = assessCalibration(createCalibrationSession("c"), { ...emptyCalibrationMeasurement(), status: "valid", tuning: "within-band", medianHz: 196, cents: 0, p10Cents: 0, p90Cents: 0 });
    const view = render(<ViolinPreflight calibration={calibration} frequencyHz={196} listening onAction={action} onEnterPractice={vi.fn()} />);
    view.rerender(<ViolinPreflight calibration={calibration} frequencyHz={null} listening={false} onAction={action} onEnterPractice={vi.fn()} />);
    act(() => vi.advanceTimersByTime(1000)); expect(action).not.toHaveBeenCalled();
  });
});
