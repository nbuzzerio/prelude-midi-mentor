import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_STAFF_BUILDER_CAPTURE_STATE } from "../staff-builder-capture";
import { appendStaffBuilderMeasure, createStaffBuilderScore, insertUnresolvedStaffBuilderNotes } from "../staff-builder-score";
import { setStaffBuilderEventDuration } from "../staff-builder-rhythm";
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
  it("applies an exact overflow duration suggestion as one history mutation and revalidates", () => {
    const original = score();
    const current = { ...original, measures: [{ ...original.measures[0]!, events: [
      { id: "late", kind: "notes" as const, staff: "treble" as const, startTick: 1800, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [{ id: "p", midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 }] },
      { id: "bass", kind: "rest" as const, staff: "bass" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const } },
    ] }] };
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    act(() => result.current.validation.activate());
    const correction = result.current.validation.activeIssue!.corrections.find(({ kind }) => kind === "set-duration")!;
    expect(correction).toEqual({ kind: "set-duration", eventId: "late", duration: "sixteenth" });
    act(() => result.current.validation.applyCorrection(correction));
    expect(result.current.score.measures[0]?.events.find(({ id }) => id === "late")?.rhythm).toEqual({ status: "final", duration: "sixteenth" });
    expect(result.current.score.measures[0]?.events.find(({ id }) => id === "bass")).toBe(current.measures[0]?.events.find(({ id }) => id === "bass"));
    expect(result.current.validation.issues.some(({ code }) => code === "event-overflow")).toBe(false);
    expect(result.current.validation.issues.some(({ code }) => code === "gap")).toBe(true);
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.score.measures[0]?.events.find(({ id }) => id === "late")?.rhythm).toEqual({ status: "final", duration: "quarter" });
    expect(result.current.validation.issues.some(({ code }) => code === "event-overflow")).toBe(true);
  });

  it("navigates assign-duration issues to the selected Rhythm event without history and recalculates after editing", () => {
    const current = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    const eventId = current.measures[0]!.events[0]!.id;
    const onDraftChange = vi.fn();
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange }));
    act(() => result.current.validation.activate());
    const correction = result.current.validation.activeIssue!.corrections.find(({ kind }) => kind === "assign-duration")!;
    act(() => result.current.validation.applyCorrection(correction));
    expect(result.current.editorPass).toBe("rhythm");
    expect(result.current.rhythm.selection).toEqual({ measureIndex: 0, eventId });
    expect(result.current.validation.status).toBe("Assign a final duration to correct this issue.");
    expect(result.current.canUndo).toBe(false);
    expect(onDraftChange).toHaveBeenLastCalledWith(current, expect.objectContaining({ editorPass: "rhythm", rhythmState: { measureIndex: 0, selectedEventId: eventId } }));
    act(() => result.current.rhythm.assignDuration("quarter"));
    expect(result.current.validation.issues.some(({ code }) => code === "unresolved-rhythm")).toBe(false);
  });

  it("navigates overlap shortening to the preceding duration-causing event without history", () => {
    const original = score();
    const pitch = (id: string, midiNumber: number) => ({ id, midiNumber, letter: "C" as const, accidental: "natural" as const, octave: 4 });
    const current = { ...original, measures: [{ ...original.measures[0]!, events: [
      { id: "a", kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "half" as const }, pitches: [pitch("ap", 60)] },
      { id: "b", kind: "notes" as const, staff: "treble" as const, startTick: 480, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [pitch("bp", 62)] },
      { id: "r", kind: "rest" as const, staff: "bass" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const } },
    ] }] };
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    act(() => result.current.validation.activate());
    expect(result.current.validation.activeIssue?.code).toBe("overlap");
    const correction = result.current.validation.activeIssue!.corrections.find(({ kind }) => kind === "shorten-duration")!;
    expect(correction).toEqual({ kind: "shorten-duration", eventId: "a" });
    act(() => result.current.validation.applyCorrection(correction));
    expect(result.current.editorPass).toBe("rhythm");
    expect(result.current.rhythm.selection).toEqual({ measureIndex: 0, eventId: "a" });
    expect(result.current.validation.status).toBe("Shorten this event to correct the overlap or overflow.");
    expect(result.current.canUndo).toBe(false);
    act(() => result.current.rhythm.assignDuration("quarter"));
    expect(result.current.validation.issues.some(({ code }) => code === "overlap")).toBe(false);
  });
  it("activates the earliest issue, advances after correction, and reconciles Undo", () => {
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    expect(result.current.validation.issues.map(({ code }) => code)).toEqual(["gap", "gap"]);
    act(() => result.current.validation.activate());
    expect(result.current.validation.activeIssue?.target.staff).toBe("treble");
    act(() => result.current.validation.applyCorrection(result.current.validation.activeIssue!.corrections[0]!));
    expect(result.current.validation.activeIssue?.target.staff).toBe("bass");
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.validation.issues).toHaveLength(2);
  });
  it("owns the default cursor and changes step duration without changing pending input", () => {
    const onDraftChange = vi.fn();
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange, confirmDiscardPending: () => true }));
    act(() => result.current.addMidiPitch(64));
    act(() => result.current.setStepDuration("eighth"));
    expect(result.current.captureState).toMatchObject({ cursor: { measureIndex: 0, offsetTicks: 0 }, stepDuration: "eighth", inputMode: "grand" });
    expect(result.current.pending.treble).toEqual([64]);
    act(() => result.current.nextPosition());
    expect(result.current.captureState.cursor.offsetTicks).toBe(240);
  });

  it.each([
    ["quarter", 480],
    ["eighth", 240],
    ["sixteenth", 120],
  ] as const)("keeps captured rhythm at quarter while %s Step Duration advances independently", (stepDuration, offsetTicks) => {
    const onDraftChange = vi.fn();
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange }));
    act(() => result.current.setStepDuration(stepDuration));
    act(() => result.current.addMidiPitch(60));
    act(() => result.current.lockAndContinue());
    expect(result.current.score.measures[0]?.events[0]?.rhythm).toEqual({ status: "final", duration: "quarter" });
    expect(result.current.captureState.cursor.offsetTicks).toBe(offsetTicks);
    expect(onDraftChange).toHaveBeenLastCalledWith(result.current.score, expect.objectContaining({ captureState: expect.objectContaining({ stepDuration, cursor: { measureIndex: 0, offsetTicks } }) }));
  });

  it("sorts and deduplicates MIDI notes while keeping staff pending groups independent", () => {
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    act(() => { result.current.addMidiPitch(67); result.current.addMidiPitch(60); result.current.addMidiPitch(67); });
    expect(result.current.pending.treble).toEqual([60, 67]);
    act(() => result.current.setInputMode("bass"));
    act(() => { result.current.addMidiPitch(60); result.current.toggleVirtualPitch(48); });
    expect(result.current.pending).toEqual({ treble: [60, 67], bass: [48, 60] });
    act(() => result.current.toggleVirtualPitch(60));
    expect(result.current.pending.bass).toEqual([48]);
  });

  it("routes MIDI and virtual input in Grand Staff mode and preserves pending groups across modes", () => {
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    act(() => { [48, 55, 60, 64, 60].forEach(result.current.addMidiPitch); });
    expect(result.current.pending).toEqual({ treble: [60, 64], bass: [48, 55] });
    act(() => result.current.toggleVirtualPitch(55));
    expect(result.current.pending.bass).toEqual([48]);
    act(() => result.current.setInputMode("treble"));
    act(() => result.current.toggleVirtualPitch(48));
    expect(result.current.pending).toEqual({ treble: [48, 60, 64], bass: [48] });
    act(() => result.current.setInputMode("grand"));
    expect(result.current.pending).toEqual({ treble: [48, 60, 64], bass: [48] });
  });

  it("toggles only the routed copy when the same pitch is pending on both staffs", () => {
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    act(() => result.current.setInputMode("treble"));
    act(() => result.current.addMidiPitch(48));
    act(() => result.current.setInputMode("bass"));
    act(() => result.current.addMidiPitch(48));
    expect(result.current.pending).toEqual({ treble: [48], bass: [48] });
    act(() => result.current.setInputMode("grand"));
    act(() => result.current.toggleVirtualPitch(48));
    expect(result.current.pending).toEqual({ treble: [48], bass: [] });
    act(() => result.current.toggleVirtualPitch(48));
    expect(result.current.pending).toEqual({ treble: [48], bass: [48] });
    act(() => result.current.clearCurrentEntry());
    expect(result.current.pending).toEqual({ treble: [], bass: [] });
  });

  it("locks both staffs as final quarter events, clears pending, spells for the key, and advances once", () => {
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score("g-major"), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    act(() => { result.current.addMidiPitch(66); result.current.setInputMode("bass"); });
    act(() => result.current.addMidiPitch(54));
    act(() => result.current.lockAndContinue());
    const events = result.current.score.measures[0]?.events ?? [];
    expect(events).toHaveLength(2);
    expect(events.every((event) => event.startTick === 0 && event.rhythm.status === "final" && event.rhythm.duration === "quarter")).toBe(true);
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
    expect(result.current.score.measures[0]?.events[0]).toMatchObject({ startTick: 480, rhythm: { status: "final", duration: "quarter" }, pitches: [{ midiNumber: 64 }] });
  });

  it("protects pending input while entering Rhythm Correction and persists the selected pass", () => {
    const current = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    const confirmDiscardPending = vi.fn(() => false);
    const onDraftChange = vi.fn();
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange, confirmDiscardPending }));
    act(() => result.current.addMidiPitch(64));
    act(() => result.current.switchToRhythm());
    expect(result.current.editorPass).toBe("capture");
    expect(result.current.pending.treble).toEqual([64]);
    confirmDiscardPending.mockReturnValue(true);
    act(() => result.current.switchToRhythm());
    expect(result.current.editorPass).toBe("rhythm");
    expect(result.current.pending.treble).toEqual([]);
    expect(result.current.rhythm.selection).toMatchObject({ measureIndex: 0 });
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ editorPass: "rhythm", rhythmState: expect.objectContaining({ measureIndex: 0 }) }));
    act(() => result.current.switchToCapture());
    expect(result.current.editorPass).toBe("capture");
  });

  it("retains a Rhythm Correction selection across passes and measures", () => {
    let current = appendStaffBuilderMeasure(score());
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 1, staff: "bass", startTick: 240, midiNumbers: [48] });
    const secondId = current.measures[1]!.events[0]!.id;
    const onDraftChange = vi.fn();
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange }));
    act(() => result.current.switchToRhythm());
    act(() => result.current.rhythm.nextEvent());
    expect(result.current.rhythm.selection).toEqual({ measureIndex: 1, eventId: secondId });
    act(() => result.current.switchToCapture());
    act(() => result.current.switchToRhythm());
    expect(result.current.rhythm.selection).toEqual({ measureIndex: 1, eventId: secondId });
    expect(onDraftChange).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ rhythmState: { measureIndex: 1, selectedEventId: secondId } }));
  });

  it("preserves the prior rhythm selection when a pending-input pass switch is cancelled", () => {
    let current = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "treble", startTick: 240, midiNumbers: [62] });
    const selectedId = current.measures[0]!.events[1]!.id;
    const confirmDiscardPending = vi.fn(() => false);
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, initialEditorPass: "rhythm", initialRhythmState: { measureIndex: 0, selectedEventId: selectedId }, onDraftChange: vi.fn(), confirmDiscardPending }));
    act(() => result.current.switchToCapture());
    act(() => result.current.addMidiPitch(64));
    act(() => result.current.switchToRhythm());
    expect(result.current.editorPass).toBe("capture");
    expect(result.current.rhythm.selection).toEqual({ measureIndex: 0, eventId: selectedId });
    expect(result.current.pending.treble).toEqual([64]);
  });

  it("falls back when a prior selection was replaced during capture", () => {
    const current = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    const oldId = current.measures[0]!.events[0]!.id;
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, initialEditorPass: "rhythm", initialRhythmState: { measureIndex: 0, selectedEventId: oldId }, onDraftChange: vi.fn() }));
    act(() => result.current.switchToCapture());
    act(() => result.current.addMidiPitch(67));
    act(() => result.current.lockAndContinue());
    const replacementId = result.current.score.measures[0]!.events[0]!.id;
    expect(replacementId).not.toBe(oldId);
    act(() => result.current.switchToRhythm());
    expect(result.current.rhythm.selection).toEqual({ measureIndex: 0, eventId: replacementId });
  });

  it("selects the earliest unresolved event on first entry", () => {
    let current = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "treble", startTick: 240, midiNumbers: [62] });
    const first = { measureIndex: 0, eventId: current.measures[0]!.events[0]!.id };
    const resolved = setStaffBuilderEventDuration(current, first, "quarter");
    expect(resolved.ok).toBe(true);
    current = resolved.score;
    const unresolvedId = current.measures[0]!.events[1]!.id;
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    act(() => result.current.switchToRhythm());
    expect(result.current.rhythm.selection).toEqual({ measureIndex: 0, eventId: unresolvedId });
  });

  it("disables Rhythm Correction without events", () => {
    const { result } = renderHook(() => useStaffBuilderEditor({ score: score(), initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, onDraftChange: vi.fn() }));
    expect(result.current.canEnterRhythm).toBe(false);
    act(() => result.current.switchToRhythm());
    expect(result.current.editorPass).toBe("capture");
  });

  it("records rhythm mutations in score-only Undo/Redo and persists each history position", () => {
    const current = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    const onDraftChange = vi.fn();
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, initialEditorPass: "rhythm", initialRhythmState: { measureIndex: 0, selectedEventId: current.measures[0]?.events[0]?.id ?? null }, onDraftChange }));
    act(() => result.current.rhythm.assignDuration("half"));
    expect(result.current.rhythm.selectedEvent?.rhythm).toEqual({ status: "final", duration: "half" });
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.rhythm.selectedEvent?.rhythm).toEqual({ status: "unresolved" });
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.redo());
    expect(result.current.rhythm.selectedEvent?.rhythm).toEqual({ status: "final", duration: "half" });
    expect(onDraftChange).toHaveBeenCalledTimes(3);
  });

  it("does not record history or persist no-op rhythm actions", () => {
    let current = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    const selection = { measureIndex: 0, eventId: current.measures[0]!.events[0]!.id };
    const finalized = setStaffBuilderEventDuration(current, selection, "quarter");
    expect(finalized.ok).toBe(true);
    current = finalized.score;
    const pitch = current.measures[0]!.events[0]!;
    expect(pitch.kind).toBe("notes");
    const pitchId = pitch.kind === "notes" ? pitch.pitches[0]!.id : "";
    const pitchLetter = pitch.kind === "notes" ? pitch.pitches[0]!.letter : "C";
    const onDraftChange = vi.fn();
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, initialEditorPass: "rhythm", initialRhythmState: { measureIndex: 0, selectedEventId: selection.eventId }, onDraftChange }));
    act(() => result.current.rhythm.assignDuration("quarter"));
    act(() => result.current.rhythm.moveToStaff("treble"));
    act(() => result.current.rhythm.respellPitch(pitchId, pitchLetter));
    expect(result.current.canUndo).toBe(false);
    expect(onDraftChange).not.toHaveBeenCalled();
  });

  it("clears stale Undo and Redo when Fast Capture locks a changed score", () => {
    const current = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    const selectedEventId = current.measures[0]!.events[0]!.id;
    const initialCaptureState = { ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, cursor: { measureIndex: 0, offsetTicks: 480 } };
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState, initialEditorPass: "rhythm", initialRhythmState: { measureIndex: 0, selectedEventId }, onDraftChange: vi.fn() }));
    act(() => result.current.rhythm.assignDuration("half"));
    act(() => result.current.rhythm.assignDuration("quarter"));
    act(() => result.current.undo());
    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(true);
    act(() => result.current.switchToCapture());
    act(() => result.current.addMidiPitch(64));
    act(() => result.current.lockAndContinue());
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
    expect(result.current.undo()).toBe(false);
    expect(result.current.score.measures[0]!.events.some(({ startTick }) => startTick === 480)).toBe(true);

    act(() => result.current.switchToRhythm());
    act(() => result.current.rhythm.assignDuration("eighth"));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.undo());
    expect(result.current.score.measures[0]!.events.some(({ startTick }) => startTick === 480)).toBe(true);
  });

  it("clears stale Rhythm history when Fast Capture replaces an event", () => {
    const current = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    const selectedEventId = current.measures[0]!.events[0]!.id;
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, initialEditorPass: "rhythm", initialRhythmState: { measureIndex: 0, selectedEventId }, onDraftChange: vi.fn() }));
    act(() => result.current.rhythm.assignDuration("half"));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.switchToCapture());
    act(() => result.current.addMidiPitch(67));
    act(() => result.current.lockAndContinue());
    expect(result.current.canUndo).toBe(false);
    const event = result.current.score.measures[0]!.events.find(({ startTick, staff }) => startTick === 0 && staff === "treble");
    expect(event?.kind === "notes" ? event.pitches.map(({ midiNumber }) => midiNumber) : []).toEqual([67]);
  });

  it("clears Rhythm history when capture navigation appends a measure", () => {
    const current = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    const selectedEventId = current.measures[0]!.events[0]!.id;
    const initialCaptureState = { ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, cursor: { measureIndex: 0, offsetTicks: 1440 } };
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState, initialEditorPass: "rhythm", initialRhythmState: { measureIndex: 0, selectedEventId }, onDraftChange: vi.fn() }));
    act(() => result.current.rhythm.assignDuration("half"));
    act(() => result.current.switchToCapture());
    act(() => result.current.nextPosition());
    expect(result.current.score.measures).toHaveLength(2);
    expect(result.current.canUndo).toBe(false);
  });

  it("preserves Rhythm history across score-neutral capture and selection actions", () => {
    let current = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "treble", startTick: 960, midiNumbers: [64] });
    const selectedEventId = current.measures[0]!.events[0]!.id;
    const { result } = renderHook(() => useStaffBuilderEditor({ score: current, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, initialEditorPass: "rhythm", initialRhythmState: { measureIndex: 0, selectedEventId }, onDraftChange: vi.fn() }));
    act(() => result.current.rhythm.assignDuration("half"));
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.switchToCapture());
    act(() => result.current.nextPosition());
    act(() => result.current.setStepDuration("eighth"));
    act(() => result.current.setInputMode("bass"));
    act(() => result.current.addMidiPitch(48));
    act(() => result.current.clearCurrentEntry());
    expect(result.current.canUndo).toBe(true);
    act(() => result.current.switchToRhythm());
    act(() => result.current.rhythm.nextEvent());
    expect(result.current.canUndo).toBe(true);
  });

  it("clears history when a different authoritative source score replaces the current score", () => {
    const original = insertUnresolvedStaffBuilderNotes(score(), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60] });
    const selectedEventId = original.measures[0]!.events[0]!.id;
    const { result, rerender } = renderHook(({ source }) => useStaffBuilderEditor({ score: source, initialCaptureState: DEFAULT_STAFF_BUILDER_CAPTURE_STATE, initialEditorPass: "rhythm", initialRhythmState: { measureIndex: 0, selectedEventId }, onDraftChange: vi.fn() }), { initialProps: { source: original } });
    act(() => result.current.rhythm.assignDuration("half"));
    expect(result.current.canUndo).toBe(true);
    const replacement = insertUnresolvedStaffBuilderNotes(original, { measureIndex: 0, staff: "bass", startTick: 480, midiNumbers: [48] });
    rerender({ source: replacement });
    expect(result.current.score).toBe(replacement);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
