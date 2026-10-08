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
      phase: "practice", calibration: createCalibrationSession("test"), calibrationHz: null, calibrationAction: vi.fn(), enterPractice: vi.fn(),
      analysis: { enabled: true, notice: null, changeEnabled: vi.fn(), export: vi.fn() },
      status: { state: "listening", message: "Listening" }, needsQuiet: false,
      reading: { state: "stable", fresh: true, ageMs: 0, pitch: { semitone: 66, frequencyHz: 376.69 } },
      start: vi.fn(), stop: vi.fn(), resetInput: vi.fn(), skipCurrentTarget: vi.fn(),
      lastAttempt: { source: "microphone", sequence: 0, measureIndex: 0, sourceMeasureId: "m", targetId: "t", checkId: "c", occurredAtActiveMs: 100,
        expectedPitches: [expected], expectedSemitone: 66, frequencyHz: 440 * 2 ** ((66 - 69) / 12) * 2 ** (31 / 1200), nearestSemitone: 66,
        centsFromExpected: 31, pitchToleranceCents: 40, accepted: true, rejection: null, articulation: "after-quiet", confirmationDelayMs: 80 },
    };
    render(<PiecePracticeAcousticControls input={input} available />);
    expect(screen.getByText("Expected: F♯4")).toBeTruthy();
    expect(screen.getByText(/Heard: F♯4 · 31.0¢ sharp/)).toBeTruthy();
    expect(screen.getByText("✓ Accepted within ±40¢")).toBeTruthy();
    expect(screen.queryByText(/in tune/i)).toBeNull();
    expect(screen.getByText("Listening · F♯4").closest('[aria-live]')).toBeNull();
  });
});
