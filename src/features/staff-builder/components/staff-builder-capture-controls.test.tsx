import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STAFF_BUILDER_CAPTURE_STATE } from "../staff-builder-capture";
import { StaffBuilderCaptureControls } from "./staff-builder-capture-controls";

vi.mock("@/components/midi/midi-status", () => ({ default: () => <button type="button">Connect MIDI</button> }));
vi.mock("@/components/notation/piano-keyboard", () => ({ default: ({ activeMidiNumbers, onNoteToggle }: { activeMidiNumbers: Set<number>; onNoteToggle: (midi: number) => void }) => <div><output>Active MIDI: {[...activeMidiNumbers].sort((a, b) => a - b).join(", ") || "none"}</output><button aria-pressed={activeMidiNumbers.has(60)} onClick={() => onNoteToggle(60)} type="button">Virtual C4</button></div> }));

afterEach(cleanup);

describe("StaffBuilderCaptureControls", () => {
  it("dispatches fallback staff routing and virtual keyboard actions without duplicating score-adjacent controls", () => {
    const actions = { staff: vi.fn(), toggle: vi.fn() };
    render(<StaffBuilderCaptureControls captureState={{ ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, cursor: { measureIndex: 1, offsetTicks: 240 } }} midi={{ connectMidi: vi.fn(), deviceName: null, error: null, status: "disconnected" }} onInputModeChange={actions.staff} onVirtualPitchToggle={actions.toggle} pending={{ treble: [60], bass: [48] }} positionLabel="Beat 1, eighth-note subdivision (tick 240)" />);
    expect(screen.getByRole("heading", { name: "Capture Notes" })).toBeTruthy();
    expect(screen.queryByText("Fast Capture")).toBeNull();
    expect(screen.queryByRole("button", { name: "Bass Only" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Input Options: Grand Staff/ }));
    expect(screen.getByText(/Grand Staff automatically routes B3 and lower/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Bass Only" }));
    fireEvent.click(screen.getByRole("button", { name: "Virtual C4" }));
    expect(actions.staff).toHaveBeenCalledWith("bass");
    expect(screen.queryByRole("button", { name: "Previous Position" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Lock pitches and continue" })).toBeNull();
    expect(actions.toggle).toHaveBeenCalledWith(60);
    expect(screen.getByText(/Measure 2, Beat 1, eighth-note subdivision \(tick 240\)/)).toBeTruthy();
    expect(screen.getByText(/pending treble MIDI pitches 60; pending bass MIDI pitches 48/)).toBeTruthy();
  });

  it("keeps Input Options collapsed by default", () => {
    render(<StaffBuilderCaptureControls captureState={DEFAULT_STAFF_BUILDER_CAPTURE_STATE} midi={{ connectMidi: vi.fn(), deviceName: null, error: null, status: "disconnected" }} onInputModeChange={vi.fn()} onVirtualPitchToggle={vi.fn()} pending={{ treble: [], bass: [] }} positionLabel="Beat 1 (quarter-note beat; tick 0)" />);
    expect(screen.getByRole("button", { name: /Input Options: Grand Staff/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("highlights the deduplicated union of both pending staffs in every input mode", () => {
    const props = {
      midi: { connectMidi: vi.fn(), deviceName: null, error: null, status: "disconnected" as const },
      onInputModeChange: vi.fn(), onVirtualPitchToggle: vi.fn(),
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

  it("unmounts the inline virtual keyboard for mobile presentation", () => {
    const props = { captureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, midi: { connectMidi: vi.fn(), deviceName: null, error: null, status: "disconnected" as const }, onInputModeChange: vi.fn(), onVirtualPitchToggle: vi.fn(), pending: { treble: [], bass: [] }, positionLabel: "Beat 1" };
    const { rerender } = render(<StaffBuilderCaptureControls {...props} />);
    expect(screen.getByTestId("staff-builder-virtual-keyboard")).toBeTruthy();
    rerender(<StaffBuilderCaptureControls {...props} showVirtualKeyboard={false} />);
    expect(screen.queryByTestId("staff-builder-virtual-keyboard")).toBeNull();
  });
});
