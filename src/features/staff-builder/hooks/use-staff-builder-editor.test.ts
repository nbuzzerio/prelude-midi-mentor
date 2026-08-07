import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STAFF_BUILDER_CAPTURE_STATE } from "../staff-builder-capture";
import { appendStaffBuilderMeasure, createStaffBuilderScore } from "../staff-builder-score";
import { useStaffBuilderEditor } from "./use-staff-builder-editor";

function score(keyId: "c-major" | "g-major" = "c-major") {
  let id = 0;
  return createStaffBuilderScore({
    title: "Capture", tempoBpm: 100, initialKeySignatureId: keyId, initialTimeSignature: "4/4",
    factories: { createId: () => `id-${++id}`, now: () => `2026-08-06T12:00:${String(id).padStart(2, "0")}.000Z` },
  });
}

afterEach(cleanup);

describe("useStaffBuilderEditor", () => {
  it("owns the default cursor and changes step duration without changing pending input", () => {
    const onDraftChange = vi.fn();
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange, confirmDiscardPending: () => true }));
    act(() => result.current.addMidiPitch(64));
    act(() => result.current.setStepDuration("eighth"));
    expect(result.current.captureState).toMatchObject({ cursor: { measureIndex: 0, offsetTicks: 0 }, stepDuration: "eighth", activeStaff: "treble" });
    expect(result.current.pending.treble).toEqual([64]);
    act(() => result.current.nextPosition());
    expect(result.current.captureState.cursor.offsetTicks).toBe(240);
  });

  it("sorts and deduplicates MIDI notes while keeping staff pending groups independent", () => {
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    act(() => { result.current.addMidiPitch(67); result.current.addMidiPitch(60); result.current.addMidiPitch(67); });
    expect(result.current.pending.treble).toEqual([60, 67]);
    act(() => result.current.setActiveStaff("bass"));
    act(() => { result.current.addMidiPitch(60); result.current.toggleVirtualPitch(48); });
    expect(result.current.pending).toEqual({ treble: [60, 67], bass: [48, 60] });
    act(() => result.current.toggleVirtualPitch(60));
    expect(result.current.pending.bass).toEqual([48]);
  });

  it("locks both staffs as unresolved events, clears pending, spells for the key, and advances once", () => {
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score("g-major"), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    act(() => { result.current.addMidiPitch(66); result.current.setActiveStaff("bass"); });
    act(() => result.current.addMidiPitch(54));
    act(() => result.current.lockAndContinue());
    const events = result.current.score.measures[0]?.events ?? [];
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.startTick === 0 && event.rhythm.status === "unresolved")).toBe(true);
    expect(events.map((event) => event.kind === "notes" ? event.pitches[0]?.letter + event.pitches[0]?.accidental : "")).toEqual(["Fsharp", "Fsharp"]);
    expect(result.current.pending).toEqual({ treble: [], bass: [] });
    expect(result.current.captureState.cursor.offsetTicks).toBe(480);
  });

  it("replaces an existing staff event as a unit and empty lock behaves as Next Position", () => {
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    act(() => { result.current.addMidiPitch(60); result.current.addMidiPitch(64); });
    act(() => result.current.lockAndContinue());
    act(() => result.current.previousPosition());
    act(() => result.current.addMidiPitch(67));
    act(() => result.current.lockAndContinue());
    const note = result.current.score.measures[0]?.events[0];
    expect(note?.kind === "notes" ? note.pitches.map(({ midiNumber }) => midiNumber) : []).toEqual([67]);
    act(() => result.current.lockAndContinue());
    expect(result.current.captureState.cursor.offsetTicks).toBe(960);
  });

  it("protects dirty navigation and clears pending without moving or deleting committed events", () => {
    const confirmDiscardPending = vi.fn(() => false);
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn(), confirmDiscardPending }));
    act(() => result.current.addMidiPitch(60));
    act(() => result.current.nextPosition());
    expect(result.current.captureState.cursor.offsetTicks).toBe(0);
    expect(result.current.pending.treble).toEqual([60]);
    confirmDiscardPending.mockReturnValue(true);
    act(() => result.current.nextPosition());
    expect(result.current.captureState.cursor.offsetTicks).toBe(480);
    expect(result.current.pending.treble).toEqual([]);
    act(() => result.current.addMidiPitch(62));
    act(() => result.current.lockAndContinue());
    act(() => result.current.addMidiPitch(64));
    act(() => result.current.clearCurrentEntry());
    expect(result.current.score.measures[0]?.events).toHaveLength(1);
    expect(result.current.captureState.cursor.offsetTicks).toBe(960);
  });

  it("appends one measure only when forward movement crosses the final boundary", () => {
    const initialCaptureState = { ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, cursor: { measureIndex: 0, offsetTicks: 1440 } };
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState, onDraftChange: vi.fn() }));
    act(() => result.current.nextPosition());
    expect(result.current.score.measures).toHaveLength(2);
    expect(result.current.captureState.cursor).toEqual({ measureIndex: 1, offsetTicks: 0 });
  });

  it("normalizes an overshoot into an existing measure to tick zero without appending", () => {
    const current = appendStaffBuilderMeasure(score());
    const initialCaptureState = { ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, cursor: { measureIndex: 0, offsetTicks: 1800 } };
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState, onDraftChange: vi.fn() }));
    act(() => result.current.nextPosition());
    expect(result.current.captureState.cursor).toEqual({ measureIndex: 1, offsetTicks: 0 });
    expect(result.current.score.measures).toHaveLength(2);
  });

  it("exposes a position label using the effective current time signature", () => {
    const current = { ...score(), initialTimeSignature: "6/8" as const };
    const initialCaptureState = { ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, cursor: { measureIndex: 0, offsetTicks: 120 } };
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState, onDraftChange: vi.fn() }));
    expect(result.current.positionLabel).toBe("Eighth-note position 1, second sixteenth-note position (compound meter; tick 120)");
  });

  it("keeps pending preview inputs ephemeral through clear, navigation confirmation, and lock", () => {
    const current = score();
    const before = JSON.stringify(current);
    const onDraftChange = vi.fn();
    const confirmDiscardPending = vi.fn(() => false);
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange, confirmDiscardPending }));
    act(() => result.current.addMidiPitch(60));
    expect(result.current.pending.treble).toEqual([60]);
    expect(JSON.stringify(result.current.score)).toBe(before);
    expect(onDraftChange).not.toHaveBeenCalled();
    act(() => result.current.nextPosition());
    expect(result.current.pending.treble).toEqual([60]);
    confirmDiscardPending.mockReturnValue(true);
    act(() => result.current.nextPosition());
    expect(result.current.pending.treble).toEqual([]);
    act(() => result.current.addMidiPitch(62));
    act(() => result.current.clearCurrentEntry());
    expect(result.current.pending.treble).toEqual([]);
    act(() => result.current.addMidiPitch(64));
    act(() => result.current.lockAndContinue());
    expect(result.current.pending.treble).toEqual([]);
    expect(result.current.score.measures[0]?.events[0]).toMatchObject({ startTick: 480, rhythm: { status: "unresolved" }, pitches: [{ midiNumber: 64 }] });
  });
});
