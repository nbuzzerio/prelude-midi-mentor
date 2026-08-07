import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STAFF_BUILDER_CAPTURE_STATE } from "../staff-builder-capture";
import { StaffBuilderCaptureControls } from "./staff-builder-capture-controls";

vi.mock("@/components/midi/midi-status", () => ({ default: () => <button type="button">Connect MIDI</button> }));
vi.mock("@/components/notation/piano-keyboard", () => ({ default: ({ activeMidiNumbers, onNoteToggle }: { activeMidiNumbers: Set<number>; onNoteToggle: (midi: number) => void }) => <div><output>Active MIDI: {[...activeMidiNumbers].sort((a, b) => a - b).join(", ") || "none"}</output><button aria-pressed={activeMidiNumbers.has(60)} onClick={() => onNoteToggle(60)} type="button">Virtual C4</button></div> }));

afterEach(cleanup);

describe("StaffBuilderCaptureControls", () => {
  it("dispatches staff, step, navigation, lock, clear, and virtual keyboard actions", () => {
    const actions = { staff: vi.fn(), step: vi.fn(), previous: vi.fn(), lock: vi.fn(), next: vi.fn(), clear: vi.fn(), toggle: vi.fn() };
    render(<StaffBuilderCaptureControls captureState={{ ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, cursor: { measureIndex: 1, offsetTicks: 240 } }} midi={{ connectMidi: vi.fn(), deviceName: null, error: null, status: "disconnected" }} onClear={actions.clear} onInputModeChange={actions.staff} onLock={actions.lock} onNext={actions.next} onPrevious={actions.previous} onStepDurationChange={actions.step} onVirtualPitchToggle={actions.toggle} pending={{ treble: [60], bass: [48] }} positionLabel="Beat 1, eighth-note subdivision (tick 240)" />);
    expect(screen.getByText(/Grand Staff automatically sends B3 and lower/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bass Only" }));
    fireEvent.change(screen.getByLabelText("Step Duration"), { target: { value: "sixteenth" } });
    fireEvent.click(screen.getByRole("button", { name: "Previous Position" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock & Continue" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Position" }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Current Entry" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual C4" }));
    expect(actions.staff).toHaveBeenCalledWith("bass");
    expect(actions.step).toHaveBeenCalledWith("sixteenth");
    expect(actions.previous).toHaveBeenCalledOnce();
    expect(actions.lock).toHaveBeenCalledOnce();
    expect(actions.next).toHaveBeenCalledOnce();
    expect(actions.clear).toHaveBeenCalledOnce();
    expect(actions.toggle).toHaveBeenCalledWith(60);
    expect(screen.getByText(/Measure 2, Beat 1, eighth-note subdivision \(tick 240\)/)).toBeTruthy();
    expect(screen.getByText(/pending treble MIDI pitches 60; pending bass MIDI pitches 48/)).toBeTruthy();
  });

  it("disables previous at the score origin and clear when no pitches are pending", () => {
    render(<StaffBuilderCaptureControls captureState={DEFAULT_STAFF_BUILDER_CAPTURE_STATE} midi={{ connectMidi: vi.fn(), deviceName: null, error: null, status: "disconnected" }} onClear={vi.fn()} onInputModeChange={vi.fn()} onLock={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} onStepDurationChange={vi.fn()} onVirtualPitchToggle={vi.fn()} pending={{ treble: [], bass: [] }} positionLabel="Beat 1 (quarter-note beat; tick 0)" />);
    expect(screen.getByRole("button", { name: "Grand Staff" }).getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("button", { name: "Previous Position" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Clear Current Entry" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("highlights the deduplicated union of both pending staffs in every input mode", () => {
    const props = {
      midi: { connectMidi: vi.fn(), deviceName: null, error: null, status: "disconnected" as const },
      onClear: vi.fn(), onInputModeChange: vi.fn(), onLock: vi.fn(), onNext: vi.fn(), onPrevious: vi.fn(), onStepDurationChange: vi.fn(), onVirtualPitchToggle: vi.fn(),
      positionLabel: "Beat 1 (quarter-note beat; tick 0)",
    };
    const { rerender } = render(<StaffBuilderCaptureControls {...props} captureState={{ ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, inputMode: "treble" }} pending={{ treble: [48], bass: [72] }} />);
    expect(screen.getByText("Active MIDI: 48, 72")).toBeTruthy();
    rerender(<StaffBuilderCaptureControls {...props} captureState={DEFAULT_STAFF_BUILDER_CAPTURE_STATE} pending={{ treble: [48, 60], bass: [60, 72] }} />);
    expect(screen.getByText("Active MIDI: 48, 60, 72")).toBeTruthy();
    rerender(<StaffBuilderCaptureControls {...props} captureState={{ ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, inputMode: "bass" }} pending={{ treble: [48], bass: [72] }} />);
    expect(screen.getByText("Active MIDI: 48, 72")).toBeTruthy();
    rerender(<StaffBuilderCaptureControls {...props} captureState={DEFAULT_STAFF_BUILDER_CAPTURE_STATE} pending={{ treble: [], bass: [] }} />);
    expect(screen.getByText("Active MIDI: none")).toBeTruthy();
  });
});
