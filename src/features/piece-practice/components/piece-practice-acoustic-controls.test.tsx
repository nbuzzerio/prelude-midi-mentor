import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PiecePracticeAcousticControls, PiecePracticeAcousticSetup } from "./piece-practice-acoustic-controls";
import type { PiecePracticeInputConfiguration } from "../piece-practice-acoustic-types";
import type { usePiecePracticeAcousticInput } from "../hooks/use-piece-practice-acoustic-input";
import { createCalibrationSession } from "@/features/instrument-learning/calibration-session";

afterEach(cleanup);
describe("acoustic setup and feedback", () => {
  it("offers default Normal tolerance, descriptive instrument choices, and bounded custom input", () => {
    function Setup() {
      const [configuration, onChange] = useState<PiecePracticeInputConfiguration>({ mode: "microphone", instrument: "violin", pitchToleranceCents: 25 });
      const [preset, onPreset] = useState("Normal");
      return <PiecePracticeAcousticSetup {...{ configuration, onChange, preset, onPreset }} />;
    }
    render(<Setup />);
    expect((screen.getByLabelText("Pitch tolerance") as HTMLSelectElement).value).toBe("Normal");
    expect(screen.getByText(/same acoustic detector/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Instrument"), { target: { value: "ocarina" } });
    fireEvent.change(screen.getByLabelText("Pitch tolerance"), { target: { value: "Custom" } });
    fireEvent.change(screen.getByLabelText("Custom pitch tolerance (cents)"), { target: { value: "50" } });
    expect(screen.getByRole("alert").textContent).toContain("1 to 49");
    fireEvent.change(screen.getByLabelText("Custom pitch tolerance (cents)"), { target: { value: "49" } });
    expect(screen.queryByRole("alert")).toBeNull();
  });
  it("distinguishes accepted sharp feedback from in-tune and announces only discrete evidence", () => {
    const expected = { sourceEventId: "e", sourcePitchId: "p", midiNumber: 66, letter: "F" as const, accidental: "sharp" as const, octave: 4, staff: "treble" as const };
    const input: ReturnType<typeof usePiecePracticeAcousticInput> = {
      calibrationAccepted: null,
      calibrationFeedback: { frequencyHz: null, status: "Last heard", assessment: null, activity: "Listening - Sound detected - Measuring pitch", failureReason: null, liveFrequencyHz: null, lastHeardHz: null, progress: null, confirming: false, lastHeardAt: null, ambiguity: null },
      phase: "practice", calibration: createCalibrationSession("test"), calibrationHz: null, calibrationAction: vi.fn(), enterPractice: vi.fn(), skipCalibrationAndStartPractice: vi.fn(),
      analysis: { enabled: true, notice: null, changeEnabled: vi.fn(), export: vi.fn() },
      recording: { enabled: false, phase: "off", message: "Performance recording off.", elapsedMs: 0, segments: [], retainedBytes: 0, limitReached: false, setEnabled: vi.fn(), hasUnsavedAudio: vi.fn(() => false) },
      status: { state: "listening", message: "Listening" }, needsQuiet: false,
      reading: { state: "stable", fresh: true, ageMs: 0, pitch: { semitone: 66, frequencyHz: 376.69 } },
      start: vi.fn(), stop: vi.fn(), resetInput: vi.fn(), skipCurrentTarget: vi.fn(),
      lastAttempt: { source: "microphone", sequence: 0, measureIndex: 0, sourceMeasureId: "m", targetId: "t", checkId: "c", occurredAtActiveMs: 100,
        expectedPitches: [expected], expectedSemitone: 66, frequencyHz: 440 * 2 ** ((66 - 69) / 12) * 2 ** (31 / 1200), nearestSemitone: 66,
        centsFromExpected: 31, pitchToleranceCents: 40, accepted: true, rejection: null, articulation: "after-quiet", confirmationDelayMs: 80 },
    };
    const target = { id: "live", attackedPitches: [expected], expectedMidiNumbers: [66] } as unknown as import("../piece-practice-types").PiecePracticeTarget;
    const view = render(<PiecePracticeAcousticControls input={input} available target={target} />);
    const live = screen.getByLabelText("Live microphone pitch");
    const details = screen.getByText(/Practice Details/).closest("details")!;
    const gradedFrequencyLabel = `Detected frequency at graded attempt: ${input.lastAttempt!.frequencyHz.toFixed(2)} Hz`;
    expect(details.querySelector("summary")!.textContent).toBe("Practice Details · Last graded attempt");
    expect(details.textContent).not.toContain("Last heard");
    expect(details.open).toBe(false);
    expect(live.textContent).toContain("Live");
    expect(live.textContent).toContain("Target frequency: 369.99 Hz");
    expect(live.textContent).toContain("Detected frequency: 376.69 Hz");
    expect(live.closest('[aria-live]')).toBeNull();
    expect(screen.getByText(gradedFrequencyLabel).closest('[aria-live]')).toBeNull();
    expect(live.textContent).toContain("369.99 Hz");
    expect(live.textContent).toContain("376.69 Hz");
    expect(live.textContent).toContain("+31.0¢ · SHARP");
    expect(live.querySelectorAll('.text-\\[64px\\]')).toHaveLength(2);
    view.rerender(<PiecePracticeAcousticControls input={{ ...input, reading: { ...input.reading, pitch: { semitone: 78, frequencyHz: 739.99 } } }} available target={target} />);
    expect(live.textContent).toContain("739.99 Hz");
    expect(live.textContent).toContain("+1200.0¢");
    expect(screen.getByText(gradedFrequencyLabel).closest("details")).toBe(details);
    view.rerender(<PiecePracticeAcousticControls input={{ ...input, reading: { ...input.reading, pitch: { semitone: 66, frequencyHz: 369.99 } } }} available target={target} />);
    expect(live.textContent).toContain("CENTERED");
    view.rerender(<PiecePracticeAcousticControls input={{ ...input, reading: { ...input.reading, pitch: { semitone: 66, frequencyHz: 360 } } }} available target={target} />);
    expect(live.textContent).toContain("FLAT");
    expect(live.textContent).toContain("360.00 Hz");
    expect(live.textContent).toMatch(/.47\.4/);
    view.rerender(<PiecePracticeAcousticControls input={input} available target={{ ...target, attackedPitches: [], expectedMidiNumbers: [78] }} />);
    expect(live.textContent).toContain("739.99 Hz");
    expect(live.textContent).toContain("FLAT");
    for (const reading of [{ ...input.reading, fresh: false }, { ...input.reading, state: "uncertain" as const }, { ...input.reading, pitch: null }, { ...input.reading, ageMs: null }, { ...input.reading, ageMs: -1 }, { ...input.reading, ageMs: 10000 }]) {
      view.rerender(<PiecePracticeAcousticControls input={{ ...input, reading }} available target={target} />);
      expect(live.textContent).not.toContain("376.69 Hz");
      expect(live.textContent).toContain("Detected frequency: unavailable");
      expect(live.textContent).toContain("Cents unavailable");
      expect(live.textContent).not.toContain("Last heard");
      expect(details.textContent).toContain(gradedFrequencyLabel);
    }
    view.rerender(<PiecePracticeAcousticControls input={{ ...input, status: { state: "idle", message: "Off" } }} available target={target} />);
    expect(live.textContent).toContain("No current pitch");
    expect(details.textContent).toContain(gradedFrequencyLabel);
    view.rerender(<PiecePracticeAcousticControls input={input} available target={target} />);
    expect(screen.getByText("Expected: F♯4")).toBeTruthy();
    expect(screen.getByText(/Heard: F♯4 · 31.0¢ sharp/)).toBeTruthy();
    expect(screen.getByText("✓ Accepted within ±40¢")).toBeTruthy();
    expect(screen.queryByText(/in tune/i)).toBeNull();
    expect(screen.getByText("Listening · F♯4").closest('[aria-live]')).toBeNull();
    fireEvent.click(screen.getByText(/Practice Details/));
    expect(details.open).toBe(true);
    view.rerender(<PiecePracticeAcousticControls input={{ ...input, lastAttempt: null }} available target={target} />);
    expect(details.querySelector("summary")!.textContent).toBe("Practice Details");
    expect(screen.queryByText(gradedFrequencyLabel)).toBeNull();
  });
});
