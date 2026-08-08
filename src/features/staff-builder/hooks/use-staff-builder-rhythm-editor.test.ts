import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StaffBuilderEvent, StaffBuilderScoreV1 } from "../staff-builder-types";
import { useStaffBuilderRhythmEditor } from "./use-staff-builder-rhythm-editor";

const note = (id: string, startTick: number, staff: "treble" | "bass" = "treble"): StaffBuilderEvent => ({ id, kind: "notes", staff, startTick, rhythm: { status: "unresolved" }, pitches: [{ id: `${id}-pitch`, midiNumber: 61, letter: "C", accidental: "sharp", octave: 4 }] });
const score = (events: readonly StaffBuilderEvent[], ties: StaffBuilderScoreV1["ties"] = []): StaffBuilderScoreV1 => ({ schemaVersion: 1, id: "score", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events }], ties });

describe("useStaffBuilderRhythmEditor", () => {
  it("selects deterministically, navigates without wrapping, and reports selection changes", () => {
    const onSelectionChange = vi.fn();
    const { result } = renderHook(() => useStaffBuilderRhythmEditor({ score: score([note("a", 0), note("b", 240)]), initialState: { measureIndex: 0, selectedEventId: null }, onMutation: vi.fn(), onSelectionChange }));
    expect(result.current.selection?.eventId).toBe("a");
    act(() => result.current.nextEvent());
    expect(result.current.selection?.eventId).toBe("b");
    act(() => result.current.nextEvent());
    expect(result.current.selection?.eventId).toBe("b");
    expect(onSelectionChange).toHaveBeenLastCalledWith({ measureIndex: 0, eventId: "b" });
  });

  it("dispatches duration, rest, staff, spelling, and deletion mutations", () => {
    const onMutation = vi.fn();
    const current = score([note("a", 0), note("b", 240)]);
    const { result } = renderHook(() => useStaffBuilderRhythmEditor({ score: current, initialState: { measureIndex: 0, selectedEventId: "a" }, onMutation, onSelectionChange: vi.fn() }));
    act(() => { result.current.assignDuration("half"); result.current.moveToStaff("bass"); result.current.respellPitch("a-pitch", "D"); });
    expect(onMutation).toHaveBeenCalledTimes(3);
    act(() => result.current.convertToRest("quarter"));
    expect(onMutation).toHaveBeenCalledTimes(4);
    act(() => result.current.deleteEvent());
    expect(onMutation).toHaveBeenLastCalledWith(expect.anything(), { measureIndex: 0, eventId: "b" });
  });

  it("surfaces tied-event and staff-conflict restrictions without mutation", () => {
    const onMutation = vi.fn();
    const tied = score([note("a", 0), note("conflict", 0, "bass")], [{ id: "tie", fromEventId: "a", fromPitchId: "a-pitch", toEventId: "a", toPitchId: "a-pitch" }]);
    const { result } = renderHook(() => useStaffBuilderRhythmEditor({ score: tied, initialState: { measureIndex: 0, selectedEventId: "a" }, onMutation, onSelectionChange: vi.fn() }));
    act(() => result.current.deleteEvent());
    expect(result.current.status).toMatch(/tie-editing phase/);
    act(() => result.current.moveToStaff("bass"));
    expect(result.current.status).toMatch(/destination staff/);
    expect(onMutation).not.toHaveBeenCalled();
  });

  it("owns an empty target measure and selects only the first deterministic event in that measure", () => {
    const first = note("first", 240, "bass");
    const earlier = note("earlier", 0);
    const current: StaffBuilderScoreV1 = {
      ...score([]),
      measures: [
        { id: "m1", events: [note("outside", 0)] },
        { id: "m2", events: [] },
        { id: "m3", events: [first, earlier] },
      ],
    };
    const { result } = renderHook(() => useStaffBuilderRhythmEditor({ score: current, initialState: { measureIndex: 0, selectedEventId: "outside" }, onMutation: vi.fn(), onSelectionChange: vi.fn() }));
    let selection;
    act(() => { selection = result.current.goToMeasure(1); });
    expect(selection).toBeNull();
    expect(result.current.measureIndex).toBe(1);
    expect(result.current.selection).toBeNull();
    act(() => { selection = result.current.goToMeasure(2); });
    expect(selection).toEqual({ measureIndex: 2, eventId: "earlier" });
    expect(result.current.measureIndex).toBe(2);
    expect(result.current.selection?.eventId).toBe("earlier");
  });

  it("restores persisted empty-measure ownership and retains it across an authoritative-score rerender", () => {
    const current: StaffBuilderScoreV1 = {
      ...score([]),
      measures: [
        { id: "m1", events: [note("outside", 0)] },
        { id: "m2", events: [] },
      ],
    };
    const initialState = { measureIndex: 1, selectedEventId: null };
    const { result, rerender } = renderHook(({ authoritativeScore }) => useStaffBuilderRhythmEditor({ score: authoritativeScore, initialState, onMutation: vi.fn(), onSelectionChange: vi.fn() }), {
      initialProps: { authoritativeScore: current },
    });
    expect(result.current.measureIndex).toBe(1);
    expect(result.current.selection).toBeNull();
    expect(result.current.selectedEvent).toBeNull();
    rerender({ authoritativeScore: current });
    expect(result.current.measureIndex).toBe(1);
    expect(result.current.selection).toBeNull();
  });

  it("restores a valid event and reconciles a stale event ID through the existing fallback", () => {
    const current: StaffBuilderScoreV1 = {
      ...score([]),
      measures: [{ id: "m1", events: [note("valid", 0)] }, { id: "m2", events: [] }],
    };
    const valid = renderHook(() => useStaffBuilderRhythmEditor({ score: current, initialState: { measureIndex: 0, selectedEventId: "valid" }, onMutation: vi.fn(), onSelectionChange: vi.fn() }));
    expect(valid.result.current.selection).toEqual({ measureIndex: 0, eventId: "valid" });
    valid.unmount();
    const stale = renderHook(() => useStaffBuilderRhythmEditor({ score: current, initialState: { measureIndex: 1, selectedEventId: "missing" }, onMutation: vi.fn(), onSelectionChange: vi.fn() }));
    expect(stale.result.current.selection).toEqual({ measureIndex: 0, eventId: "valid" });
    stale.unmount();
  });
});
