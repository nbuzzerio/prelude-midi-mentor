import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { appendStaffBuilderMeasure, createStaffBuilderScore, setStaffBuilderMeasureClef } from "../staff-builder-score";
import { DEFAULT_STAFF_BUILDER_CAPTURE_STATE } from "../staff-builder-capture";
import { useStaffBuilderEditor } from "../hooks/use-staff-builder-editor";
import { StaffBuilderClefControls } from "./staff-builder-clef-controls";

afterEach(cleanup);
const score = () => appendStaffBuilderMeasure(createStaffBuilderScore({ title: "Context", tempoBpm: 90, initialKeySignatureId: "c-major", initialTimeSignature: "4/4" }));

describe("measure display-clef controls", () => {
  it("shows effective and inherited clefs and authors/removes independent changes at the current measure", () => {
    const source = setStaffBuilderMeasureClef(setStaffBuilderMeasureClef(score(), 0, "bass", "treble"), 1, "treble", "bass");
    const onChange = vi.fn();
    render(<StaffBuilderClefControls measureIndex={1} onChange={onChange} score={source} />);
    expect(screen.getByText("Measure 2 display clefs: Upper Bass · Lower Treble")).toBeTruthy();
    fireEvent.click(screen.getByText("Measure 2 display clefs: Upper Bass · Lower Treble"));
    // jsdom does not implement details toggling for fireEvent.click.
    screen.getByText("Measure 2 display clefs: Upper Bass · Lower Treble").parentElement!.setAttribute("open", "");
    const upper = screen.getByRole("combobox", { name: "Upper staff display clef" });
    const lower = screen.getByRole("combobox", { name: "Lower staff display clef" });
    expect((upper as HTMLSelectElement).value).toBe("bass");
    expect((lower as HTMLSelectElement).value).toBe("inherit");
    fireEvent.change(lower, { target: { value: "bass" } });
    expect(onChange).toHaveBeenLastCalledWith(1, "bass", "bass");
    fireEvent.change(upper, { target: { value: "inherit" } });
    expect(onChange).toHaveBeenLastCalledWith(1, "treble", null);
    expect(screen.getByText(/Changes notation only; pitches stay unchanged/)).toBeTruthy();
  });

  it("offers historical defaults at measure one and preserves an explicit redundant choice", () => {
    const source = setStaffBuilderMeasureClef(score(), 0, "treble", "treble");
    const { container } = render(<StaffBuilderClefControls measureIndex={0} onChange={vi.fn()} score={source} />);
    container.querySelector("details")!.open = true;
    expect(screen.getByRole("option", { name: "Default — Treble" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Default — Bass" })).toBeTruthy();
    expect((screen.getByRole("combobox", { name: /Upper staff display clef/ }) as HTMLSelectElement).value).toBe("treble");
  });

  it("uses score history and persists authored clefs without changing pending input or score events", () => {
    const source = score();
    const onDraftChange = vi.fn();
    const { result } = renderHook(() => useStaffBuilderEditor({ score: source, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange }));
    act(() => { result.current.setMeasureClef(1, "bass", "treble"); });
    expect(result.current.score.measures[1]!.clefChanges).toEqual({ bass: "treble" });
    expect(result.current.score.measures[1]!.events).toBe(source.measures[1]!.events);
    expect(onDraftChange.mock.calls.at(-1)![0].measures[1].clefChanges).toEqual({ bass: "treble" });
    act(() => { result.current.undo(); });
    expect(result.current.score).toEqual(source);
    expect(result.current.captureState).toEqual(DEFAULT_STAFF_BUILDER_CAPTURE_STATE);
  });
});
