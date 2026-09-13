import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderLyricCuesPass } from "./staff-builder-lyric-cues-pass";

afterEach(cleanup);
const event = (id: string) => ({ id, kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [{ id: `${id}-p`, midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 }] });
const score = (events = [event("a")], annotations: StaffBuilderScore["annotations"] = []): StaffBuilderScore => ({ schemaVersion: 3, annotations, id: "s", title: "Song", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m", events }], ties: [] });
const props = { captureState: { cursor: { measureIndex: 0, offsetTicks: 0 }, stepDuration: "quarter" as const, inputMode: "grand" as const }, selectedEventId: null, onSelectEvent: vi.fn(), onPrevious: vi.fn(), onStepDurationChange: vi.fn() };
describe("StaffBuilderLyricCuesPass", () => {
  it("loads an existing cue and commits by button and Enter", () => { const commit = vi.fn(() => true); render(<StaffBuilderLyricCuesPass {...props} onCommitAndAdvance={commit} score={score(undefined, [{ id: "cue", kind: "lyric-cue", anchor: { kind: "event", eventId: "a" }, text: "Bells" }])} />); const input = screen.getByLabelText("Lyric Cue"); expect((input as HTMLInputElement).value).toBe("Bells"); fireEvent.click(screen.getByRole("button", { name: "Lock In / Next" })); fireEvent.change(input, { target: { value: "Ring" } }); fireEvent.keyDown(input, { key: "Enter" }); expect(commit).toHaveBeenNthCalledWith(1, "Bells", "a"); expect(commit).toHaveBeenNthCalledWith(2, "Ring", "a"); });
  it("advances an empty position without a target", () => { const commit = vi.fn(() => true); render(<StaffBuilderLyricCuesPass {...props} onCommitAndAdvance={commit} score={score([])} />); fireEvent.click(screen.getByRole("button", { name: "Lock In / Next" })); expect(commit).toHaveBeenCalledWith("", null); });
  it("routes button and Enter through the shared boundary while announcing ambiguity", () => { const commit = vi.fn(() => false); render(<StaffBuilderLyricCuesPass {...props} onCommitAndAdvance={commit} score={score([event("a"), event("b")])} />); fireEvent.click(screen.getByRole("button", { name: "Lock In / Next" })); fireEvent.keyDown(screen.getByLabelText("Lyric Cue"), { key: "Enter" }); expect(commit).toHaveBeenCalledTimes(2); expect(commit).toHaveBeenCalledWith("", null); expect(screen.getByRole("alert").textContent).toMatch(/Choose/); expect(screen.getAllByRole("radio")).toHaveLength(2); });
  it("preserves typing across unrelated rerenders and resets for target or authoritative cue changes", () => {
    const commit = vi.fn(() => true);
    const first = score([event("a"), { ...event("b"), startTick: 480 }], [{ id: "cue-a", kind: "lyric-cue", anchor: { kind: "event", eventId: "a" }, text: "First" }, { id: "cue-b", kind: "lyric-cue", anchor: { kind: "event", eventId: "b" }, text: "Second" }]);
    const { rerender } = render(<StaffBuilderLyricCuesPass {...props} onCommitAndAdvance={commit} score={first} />);
    fireEvent.change(screen.getByLabelText("Lyric Cue"), { target: { value: "Unsaved" } });
    rerender(<StaffBuilderLyricCuesPass {...props} onCommitAndAdvance={commit} score={{ ...first }} />);
    expect((screen.getByLabelText("Lyric Cue") as HTMLInputElement).value).toBe("Unsaved");
    rerender(<StaffBuilderLyricCuesPass {...props} captureState={{ ...props.captureState, cursor: { measureIndex: 0, offsetTicks: 480 } }} onCommitAndAdvance={commit} score={first} />);
    expect((screen.getByLabelText("Lyric Cue") as HTMLInputElement).value).toBe("Second");
    const edited = { ...first, annotations: first.annotations.map((cue) => cue.id === "cue-b" && cue.kind === "lyric-cue" ? { ...cue, text: "Changed" } : cue) };
    rerender(<StaffBuilderLyricCuesPass {...props} captureState={{ ...props.captureState, cursor: { measureIndex: 0, offsetTicks: 480 } }} onCommitAndAdvance={commit} score={edited} />);
    expect((screen.getByLabelText("Lyric Cue") as HTMLInputElement).value).toBe("Changed");
    rerender(<StaffBuilderLyricCuesPass {...props} captureState={{ ...props.captureState, cursor: { measureIndex: 0, offsetTicks: 480 } }} onCommitAndAdvance={commit} score={{ ...edited, annotations: edited.annotations.filter(({ id }) => id !== "cue-b") }} />);
    expect((screen.getByLabelText("Lyric Cue") as HTMLInputElement).value).toBe("");
  });
});
