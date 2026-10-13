import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createCalibrationSession, assessCalibration, changeCalibrationTolerance } from "../calibration-session";
import { emptyCalibrationMeasurement, CALIBRATION_POLICY, VIOLIN_REFERENCES } from "../calibration-types";
import { ViolinPreflight } from "./violin-preflight";

afterEach(() => { cleanup(); vi.useRealTimers(); });
describe("adjustable calibration presentation", () => {
  it("shows a labelled native 1–30 step-1 slider with numerical and accessible value feedback", () => {
    function Fixture() {
      const [calibration, setCalibration] = useState(() => createCalibrationSession("v4", null, 10));
      return <ViolinPreflight calibration={calibration} frequencyHz={null} listening={false} onAction={vi.fn()} onEnterPractice={vi.fn()}
        onToleranceChange={value => setCalibration(current => changeCalibrationTolerance(current, value))} />;
    }
    render(<Fixture />);
    const slider = screen.getByRole("slider", { name: "Calibration tolerance: ±10 cents" }) as HTMLInputElement;
    expect([slider.type, slider.min, slider.max, slider.step]).toEqual(["range", "1", "30", "1"]);
    expect(slider.getAttribute("aria-valuetext")).toBe("Plus or minus 10 cents");
    fireEvent.click(screen.getByRole("button", { name: "Decrease calibration tolerance by 1 cent" })); expect(slider.value).toBe("9");
    fireEvent.click(screen.getByRole("button", { name: "Increase calibration tolerance by 1 cent" })); expect(slider.value).toBe("10");
    fireEvent.change(slider, { target: { value: "1" } }); expect(slider.getAttribute("aria-valuetext")).toBe("Plus or minus 1 cent");
    expect((screen.getByRole("button", { name: "Decrease calibration tolerance by 1 cent" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(slider, { target: { value: "30" } }); expect((screen.getByRole("button", { name: "Increase calibration tolerance by 1 cent" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it.each(["listening", "accepted", "starting"])("disables tolerance changes during %s", mode => {
    const measurement = { ...emptyCalibrationMeasurement(), status: "valid" as const, stable: true, tuning: "within-band" as const, medianHz: 196, cents: 0 };
    render(<ViolinPreflight calibration={createCalibrationSession("v4", null, 10)} frequencyHz={196} listening={mode === "listening"}
      accepted={mode === "accepted" ? { referenceIndex: 0, measurement } : null} toleranceLocked={mode === "starting"} onToleranceChange={vi.fn()} onAction={vi.fn()} onEnterPractice={vi.fn()} />);
    expect((screen.getByRole("slider") as HTMLInputElement).disabled).toBe(true);
    for (const name of ["Decrease calibration tolerance by 1 cent", "Increase calibration tolerance by 1 cent"]) expect((screen.getByRole("button", { name }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/stop listening/i)).toBeTruthy();
  });
  it("keeps fixed tuning quality separate from a wide acceptance window and measured signed cents", () => {
    render(<ViolinPreflight calibration={createCalibrationSession("v4", null, 30)} frequencyHz={VIOLIN_REFERENCES[0].frequencyHz * 2 ** (28 / 1200)} listening={false}
      onToleranceChange={vi.fn()} onAction={vi.fn()} onEnterPractice={vi.fn()} />);
    expect(screen.getByText("Concert-pitch deviation").nextElementSibling?.textContent).toContain("+28.0 cents");
    expect(screen.getByText("Estimated deviation band").nextElementSibling?.textContent).toContain("RED · Significantly off");
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toBe("Plus or minus 30 cents");
    expect(screen.getByText(/does not establish one-cent microphone accuracy/)).toBeTruthy();
  });
});
describe("violin preflight presentation", () => {
  it.each([
    [-5, "Excellent / centered"], [5, "Excellent / centered"], [5.01, "Ready for practice"],
    [-10, "Ready for practice"], [10, "Ready for practice"], [10.01, "Adjust tuning"],
    [-25, "Adjust tuning"], [25, "Adjust tuning"], [25.01, "Significantly off"],
  ])("shows independent ideal/acceptance/adjustment guidance at %s cents", (cents, guidance) => {
    render(<ViolinPreflight calibration={createCalibrationSession("c")} frequencyHz={VIOLIN_REFERENCES[0].frequencyHz * 2 ** (Number(cents) / 1200)} listening onAction={vi.fn()} onEnterPractice={vi.fn()} />);
    expect(screen.getByText("Estimated deviation band").nextElementSibling?.textContent).toContain(String(guidance));
    expect(screen.queryByText("Accepted")).toBeNull();
    expect(screen.getByRole("button", { name: "Skip Calibration and Start Practice" })).toBeTruthy();
  });
  it("keeps measurement fields, guidance, confirmation and controls mounted across detector and tuning states", () => {
    const initial = createCalibrationSession("c");
    const action = vi.fn();
    const view = render(<ViolinPreflight calibration={initial} frequencyHz={null} listening={false} onAction={action} onEnterPractice={vi.fn()} />);
    const rows = Array.from(view.container.querySelectorAll("dt, dd"));
    const guidance = screen.getByText("Guidance").parentElement;
    const confirmation = screen.getByText("Accepted confirmation").parentElement;
    const progress = screen.getByText("Tuning preparation").parentElement;
    const certification = screen.getByText("Calibration").parentElement;
    const controls = screen.getAllByRole("button");
    for (const tuning of ["near-target", "needs-adjustment", "within-band"] as const) {
      const measurement = { ...emptyCalibrationMeasurement(), status: "valid" as const, stable: true, tuning, medianHz: 196, cents: tuning === "within-band" ? 0 : 12, p10Cents: 0, p90Cents: 1 };
      for (const status of ["Live", "Uncertain", "Last heard"] as const) {
        view.rerender(<ViolinPreflight calibration={assessCalibration(initial, measurement)} frequencyHz={null} listening
          feedback={{ frequencyHz: 196, assessment: measurement, status, activity: "Listening - Sound detected - Measuring pitch", failureReason: null, liveFrequencyHz: null, lastHeardHz: null, progress: null, confirming: false, lastHeardAt: 1000, ambiguity: null }}
          accepted={tuning === "within-band" ? { referenceIndex: 0, measurement } : null} onAction={action} onEnterPractice={vi.fn()} />);
        expect(Array.from(view.container.querySelectorAll("dt, dd"))).toEqual(rows);
        expect(screen.getByText("Guidance").parentElement).toBe(guidance);
        expect(screen.getByText("Accepted confirmation").parentElement).toBe(confirmation);
        expect(screen.getByText("Tuning preparation").parentElement).toBe(progress);
        expect(screen.getByText("Calibration").parentElement).toBe(certification);
        expect(screen.getAllByRole("button")).toEqual(controls);
        expect(screen.getByText("Detected frequency").closest('[aria-live], [role="status"]')).toBeNull();
      }
    }
  });
  it.each([
    [-65, "RED", "text-red-200", false], [-25, "YELLOW", "text-yellow-200", false],
    [10, "GREEN", "text-green-200", true], [2, "GREEN", "text-green-200", true],
    [10.01, "YELLOW", "text-yellow-200", true], [25.01, "RED", "text-red-200", true],
  ] as const)("colors a %s-cent estimate independently of unverified calibration", (cents, band, color, listening) => {
    const frequencyHz = VIOLIN_REFERENCES[1].frequencyHz * 2 ** (cents / 1200);
    render(<ViolinPreflight calibration={{ ...createCalibrationSession("c"), referenceIndex: 1 }} frequencyHz={frequencyHz}
      listening={listening} onAction={vi.fn()} onEnterPractice={vi.fn()} />);
    expect(screen.getByText("Concert-pitch deviation").parentElement?.className).toContain(color);
    expect(screen.getByText("Estimated deviation band").nextElementSibling?.textContent).toContain(band);
    expect(screen.getByText("Reading status").nextElementSibling?.textContent).toContain(listening ? "Live estimate" : "Last heard");
    expect(screen.getByText("Reading status").nextElementSibling?.textContent).toContain("verified");
    expect(screen.getByText("Collecting")).toBeTruthy();
    expect(screen.queryByText("Accepted")).toBeNull();
    expect(screen.queryByText(/Fine-tuner|peg/)).toBeNull();
  });
  it.each([[-10, "FLAT"], [0, "CENTERED"], [10, "SHARP"]] as const)("shows expected-relative direction beside Hz: %s cents", (cents, direction) => {
    const frequencyHz = 440 * 2 ** ((55 - 69) / 12) * 2 ** (cents / 1200);
    render(<ViolinPreflight calibration={createCalibrationSession("c")} frequencyHz={frequencyHz} listening onAction={vi.fn()} onEnterPractice={vi.fn()} />);
    expect(screen.getByText("Detected frequency").nextElementSibling?.textContent).toBe(`${frequencyHz.toFixed(2)} Hz \u00b7 ${direction}`);
    for (const label of ["Detected note", "Expected note"]) expect(screen.getByText(label).nextElementSibling?.className).toContain("text-[50px]");
    expect(screen.getByText("Concert-pitch deviation").nextElementSibling?.textContent).toBe(`${cents >= 0 ? "+" : ""}${cents.toFixed(1)} cents \u00b7 ${direction}`);
  });
  it("shows G3 target Hz with bounded announcements and keyboard actions", () => {
    const action = vi.fn(); render(<ViolinPreflight calibration={createCalibrationSession("c")} frequencyHz={196} listening onAction={action} onEnterPractice={vi.fn()} />);
    expect(screen.getByText("195.998 Hz")).toBeTruthy();
    expect(screen.getByText("Detected frequency").closest('[aria-live], [role="status"]')).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Skip String" }));
    expect(action.mock.calls).toEqual([["skip"]]);
  });
  it.each(["within-band", "near-target", "needs-adjustment"] as const)("shows assessed tuning while the acoustic owner handles confirmation: %s", (tuning) => {
    vi.useFakeTimers(); const action = vi.fn();
    const calibration = assessCalibration(createCalibrationSession("c"), { ...emptyCalibrationMeasurement(), status: "valid", tuning,
      stable: true, medianHz: 196, cents: tuning === "within-band" ? 0 : 20, p10Cents: 0, p90Cents: 1 });
    render(<ViolinPreflight calibration={calibration} frequencyHz={196} listening onAction={action} onEnterPractice={vi.fn()} />);
    act(() => vi.advanceTimersByTime(CALIBRATION_POLICY.acknowledgmentMs));
    expect(action).not.toHaveBeenCalled();
    if (tuning !== "within-band") { expect(screen.getByText(/Lower the string/)).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Continue" })); expect(action).toHaveBeenCalledWith("continue"); }
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
  it("shows held note, frequency and signed cents explicitly as Last heard", () => {
    const calibration = assessCalibration(createCalibrationSession("c"), { ...emptyCalibrationMeasurement(), status: "valid", tuning: "near-target", stable: true,
      medianHz: 197, cents: 8.8, p10Cents: 8, p90Cents: 9 });
    const feedback = { frequencyHz: 197, status: "Last heard" as const, assessment: calibration.measurement, activity: "Listening - Sound detected - Measuring pitch", failureReason: null, liveFrequencyHz: null, lastHeardHz: null, progress: null, confirming: false, lastHeardAt: 1000, ambiguity: null };
    render(<ViolinPreflight calibration={{ ...calibration, phase: "collecting", measurement: emptyCalibrationMeasurement() }} frequencyHz={null} feedback={feedback} listening={false} onAction={vi.fn()} onEnterPractice={vi.fn()} />);
    expect(screen.getByText("Reading status").nextElementSibling?.textContent).toContain("Last heard");
    expect(screen.getByText("Detected frequency").nextElementSibling?.textContent).toBe("197.00 Hz \u00b7 SHARP");
    expect(screen.getAllByText(/SHARP/)).toHaveLength(2);
    expect(screen.getByText(/Last stable assessment/)).toBeTruthy();
  });
});


describe("violin ambient-noise advisory", () => {
  const title = "Background noise can affect calibration";
  const message = "Steady humming or droning sounds from air conditioners, fans, and appliances can interfere with pitch stability measurements—even when the displayed note looks in tune. If calibration stays Uncertain, try reducing background noise and playing again.";

  it.each(VIOLIN_REFERENCES.map((reference, referenceIndex) => [reference.note, referenceIndex] as const))("places a static informational notice immediately after the open %s heading", (note, referenceIndex) => {
    render(<ViolinPreflight calibration={{ ...createCalibrationSession("advisory", null, 10), referenceIndex }} frequencyHz={null}
      listening={false} onToleranceChange={vi.fn()} onAction={vi.fn()} onEnterPractice={vi.fn()} />);
    const heading = screen.getByRole("heading", { name: "Check open " + note, level: 2 });
    const notice = screen.getByRole("complementary", { name: title });
    expect(heading.nextElementSibling).toBe(notice);
    expect(screen.getByRole("heading", { name: title, level: 3 }).parentElement).toBe(notice);
    expect(screen.getByText(message).parentElement).toBe(notice);
    expect(notice.closest('[aria-live], [role="status"], [role="alert"]')).toBeNull();
    expect(notice.querySelector('[aria-live], [role="status"], [role="alert"]')).toBeNull();
  });

  it("keeps the same notice through listening, in-tune Uncertain feedback and acceptance", () => {
    const calibration = createCalibrationSession("advisory", null, 10);
    const action = vi.fn();
    const measurement = { ...emptyCalibrationMeasurement(), status: "valid" as const, stable: true, tuning: "within-band" as const,
      medianHz: VIOLIN_REFERENCES[0].frequencyHz, cents: 0, p10Cents: 0, p90Cents: 0 };
    const props = { calibration, frequencyHz: measurement.medianHz, onAction: action, onEnterPractice: vi.fn(), onToleranceChange: vi.fn() };
    const view = render(<ViolinPreflight {...props} listening={false} />);
    const notice = screen.getByRole("complementary", { name: title });
    view.rerender(<ViolinPreflight {...props} listening />);
    expect(screen.getByRole("complementary", { name: title })).toBe(notice);
    view.rerender(<ViolinPreflight {...props} listening feedback={{ frequencyHz: measurement.medianHz, assessment: measurement,
      status: "Uncertain", activity: "Listening - Sound detected - Measuring pitch", failureReason: null, liveFrequencyHz: null,
      lastHeardHz: null, progress: null, confirming: false, lastHeardAt: 1000, ambiguity: null }} />);
    expect(screen.getByText("Uncertain")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: title })).toBe(notice);
    view.rerender(<ViolinPreflight {...props} listening accepted={{ referenceIndex: 0, measurement }} />);
    expect(screen.getByText("Accepted")).toBeTruthy();
    expect(screen.getByRole("complementary", { name: title })).toBe(notice);
    expect(action).not.toHaveBeenCalled();
  });

  it("preserves tolerance, Continue, string skip and optional full-calibration skip behavior", () => {
    const action = vi.fn(), skip = vi.fn(), toleranceChange = vi.fn();
    const calibration = createCalibrationSession("advisory", null, 10);
    const props = { calibration, frequencyHz: null, listening: false, onAction: action, onEnterPractice: vi.fn(), onToleranceChange: toleranceChange, onSkipCalibration: skip };
    const view = render(<ViolinPreflight {...props} />);
    const slider = screen.getByRole("slider") as HTMLInputElement;
    const continueButton = screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement;
    const stringSkip = screen.getByRole("button", { name: "Skip String" }) as HTMLButtonElement;
    const fullSkip = screen.getByRole("button", { name: "Skip Calibration and Start Practice" }) as HTMLButtonElement;
    expect([slider.value, slider.min, slider.max, slider.step, slider.disabled]).toEqual(["10", "1", "30", "1", false]);
    expect(continueButton.disabled).toBe(true);
    fireEvent.click(stringSkip); expect(action.mock.calls).toEqual([["skip"]]);
    fireEvent.click(fullSkip); expect(skip).toHaveBeenCalledOnce();
    fireEvent.change(slider, { target: { value: "11" } }); expect(toleranceChange).toHaveBeenCalledWith(11);
    const measurement = { ...emptyCalibrationMeasurement(), status: "valid" as const, stable: true, tuning: "near-target" as const,
      medianHz: 197, cents: 8.8, p10Cents: 8, p90Cents: 9 };
    view.rerender(<ViolinPreflight {...props} calibration={assessCalibration(calibration, measurement)} listening />);
    expect(slider.disabled).toBe(true); expect(continueButton.disabled).toBe(false);
    fireEvent.click(continueButton); expect(action).toHaveBeenLastCalledWith("continue");
    view.rerender(<ViolinPreflight {...props} accepted={{ referenceIndex: 0, measurement }} />);
    expect(slider.disabled).toBe(true); expect(stringSkip.disabled).toBe(true); expect(continueButton.disabled).toBe(true);
    expect(fullSkip.disabled).toBe(false);
    expect(screen.getByText("Tuning preparation")).toBeTruthy();
    expect(screen.getByText("Accepted confirmation")).toBeTruthy();
  });

  it("keeps the completed summary and entry flow separate from open-string advice", () => {
    const enter = vi.fn();
    render(<ViolinPreflight calibration={{ ...createCalibrationSession("advisory", null, 10), phase: "summary" }} frequencyHz={null}
      listening={false} onAction={vi.fn()} onEnterPractice={enter} />);
    expect(screen.queryByRole("complementary", { name: title })).toBeNull();
    expect(screen.getByRole("heading", { name: "Violin preflight summary" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Enter Piece Practice" })); expect(enter).toHaveBeenCalledOnce();
  });
});
