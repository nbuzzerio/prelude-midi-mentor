import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffBuilderRhythmControls } from "./staff-builder-rhythm-controls";

afterEach(cleanup);
const selectedEvent = { id: "event", kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "unresolved" as const }, pitches: [{ id: "pitch", midiNumber: 61, letter: "C" as const, accidental: "sharp" as const, octave: 4 }] };

describe("StaffBuilderRhythmControls", () => {
  it("requires a target duration and dispatches editing, navigation, history, spelling, and deletion", () => {
    const actions = { previous: vi.fn(), next: vi.fn(), duration: vi.fn(), rest: vi.fn(), staff: vi.fn(), spell: vi.fn(), delete: vi.fn(), undo: vi.fn(), redo: vi.fn() };
    render(<StaffBuilderRhythmControls canNext canPrevious canRedo canUndo eventCount={2} onAssignDuration={actions.duration} onConvertToRest={actions.rest} onDelete={actions.delete} onMoveToStaff={actions.staff} onNext={actions.next} onPrevious={actions.previous} onRedo={actions.redo} onRespellPitch={actions.spell} onUndo={actions.undo} selectedDescription="Selected event description" selectedEvent={selectedEvent} selectedIndex={0} status={null} />);
    expect((screen.getByRole("button", { name: "Assign Duration" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Target Duration"), { target: { value: "dotted-quarter" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign Duration" }));
    fireEvent.click(screen.getByRole("button", { name: "Convert to Rest" }));
    fireEvent.click(screen.getByRole("button", { name: "Bass" }));
    fireEvent.change(screen.getByLabelText("MIDI 61"), { target: { value: "D" } });
    fireEvent.click(screen.getByRole("button", { name: "Previous Event" })); fireEvent.click(screen.getByRole("button", { name: "Next Event" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo" })); fireEvent.click(screen.getByRole("button", { name: "Redo" })); fireEvent.click(screen.getByRole("button", { name: "Delete Event" }));
    expect(actions.duration).toHaveBeenCalledWith("dotted-quarter"); expect(actions.rest).toHaveBeenCalledWith("dotted-quarter"); expect(actions.staff).toHaveBeenCalledWith("bass"); expect(actions.spell).toHaveBeenCalledWith("pitch", "D"); expect(actions.delete).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByText("Selected event description"));
  });

  it("announces restrictions and disables boundaries and unavailable history", () => {
    render(<StaffBuilderRhythmControls canNext={false} canPrevious={false} canRedo={false} canUndo={false} eventCount={1} onAssignDuration={vi.fn()} onConvertToRest={vi.fn()} onDelete={vi.fn()} onMoveToStaff={vi.fn()} onNext={vi.fn()} onPrevious={vi.fn()} onRedo={vi.fn()} onRespellPitch={vi.fn()} onUndo={vi.fn()} selectedDescription="Selected" selectedEvent={selectedEvent} selectedIndex={0} status="Tied events cannot be removed." />);
    expect(screen.getByRole("status").textContent).toContain("Tied events");
    expect((screen.getByRole("button", { name: "Previous Event" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Undo" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
