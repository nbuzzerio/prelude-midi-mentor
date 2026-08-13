import { describe, expect, it } from "vitest";
import {
  addStaffBuilderAnnotation,
  deleteStaffBuilderAnnotation,
  isStaffBuilderAnnotationAnchorValid,
  reconcileStaffBuilderAnnotations,
  resolveStaffBuilderAnnotationAnchor,
  updateStaffBuilderAnnotation,
} from "./staff-builder-annotations";
import {
  insertStaffBuilderMeasure,
  insertStaffBuilderNotes,
} from "./staff-builder-score";
import {
  convertStaffBuilderEventToRest,
  moveStaffBuilderEventToStaff,
  respellStaffBuilderPitch,
  setStaffBuilderEventDuration,
} from "./staff-builder-rhythm";
import type { StaffBuilderAnnotation, StaffBuilderScore } from "./staff-builder-types";

function score(annotations: readonly StaffBuilderAnnotation[] = []): StaffBuilderScore {
  return {
    schemaVersion: 2,
    id: "score",
    title: "Study",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    tempoBpm: 100,
    initialKeySignatureId: "c-major",
    initialTimeSignature: "4/4",
    measures: [{ id: "measure", events: [{
      id: "event",
      kind: "notes",
      staff: "treble",
      startTick: 0,
      rhythm: { status: "final", duration: "quarter" },
      pitches: [{ id: "pitch", midiNumber: 61, letter: "C", accidental: "sharp", octave: 4 }],
    }] }],
    ties: [],
    annotations,
  };
}

const eventNote: StaffBuilderAnnotation = { id: "note", kind: "study-note", anchor: { kind: "event", eventId: "event" }, text: "Listen for the suspension." };
const measureMark: StaffBuilderAnnotation = { id: "mark", kind: "practice-mark", anchor: { kind: "measure", measureId: "measure" }, category: "rhythm" };

describe("Staff Builder annotations", () => {
  it("adds, updates, and deletes annotations immutably with authored-score timestamps", () => {
    const original = score();
    const added = addStaffBuilderAnnotation(original, eventNote, { now: () => "2026-01-02T00:00:00.000Z" });
    const updated = updateStaffBuilderAnnotation(added, { ...eventNote, text: "Resolve the suspension." }, { now: () => "2026-01-03T00:00:00.000Z" });
    const deleted = deleteStaffBuilderAnnotation(updated, eventNote.id, { now: () => "2026-01-04T00:00:00.000Z" });
    expect(original.annotations).toEqual([]);
    expect(added.annotations).toEqual([eventNote]);
    expect(added.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(updated.annotations).toEqual([{ ...eventNote, text: "Resolve the suspension." }]);
    expect(updated.updatedAt).toBe("2026-01-03T00:00:00.000Z");
    expect(deleted.annotations).toEqual([]);
    expect(deleted.updatedAt).toBe("2026-01-04T00:00:00.000Z");
    const noOpDelete = deleteStaffBuilderAnnotation(deleted, "missing", { now: () => "2026-01-05T00:00:00.000Z" });
    expect(noOpDelete).toBe(deleted);
    expect(noOpDelete.updatedAt).toBe("2026-01-04T00:00:00.000Z");
  });

  it("rejects duplicate IDs, missing updates, and missing anchors", () => {
    const current = score([eventNote]);
    expect(() => addStaffBuilderAnnotation(current, eventNote)).toThrow(/Duplicate/);
    expect(() => updateStaffBuilderAnnotation(current, { ...eventNote, id: "missing" })).toThrow(/Unknown/);
    expect(() => addStaffBuilderAnnotation(current, { ...measureMark, id: "orphan", anchor: { kind: "measure", measureId: "missing" } })).toThrow(/anchor/);
  });

  it("resolves event and measure anchors and rejects missing anchors", () => {
    const current = score();
    expect(resolveStaffBuilderAnnotationAnchor(current, eventNote.anchor)).toEqual({ kind: "event", measureId: "measure", eventId: "event" });
    expect(resolveStaffBuilderAnnotationAnchor(current, measureMark.anchor)).toEqual(measureMark.anchor);
    expect(isStaffBuilderAnnotationAnchorValid(current, { kind: "event", eventId: "missing" })).toBe(false);
    expect(isStaffBuilderAnnotationAnchorValid(current, { kind: "measure", measureId: "missing" })).toBe(false);
  });

  it("removes orphaned event and measure annotations without retargeting", () => {
    const current = score([eventNote, measureMark]);
    const withoutEvent = { ...current, measures: [{ ...current.measures[0]!, events: [] }] };
    const reconciled = reconcileStaffBuilderAnnotations(withoutEvent);
    expect(reconciled.annotations).toEqual([measureMark]);
    expect(reconciled.updatedAt).toBe(withoutEvent.updatedAt);
    expect(reconcileStaffBuilderAnnotations({ ...current, measures: [{ id: "replacement", events: current.measures[0]!.events }] }).annotations).toEqual([eventNote]);
  });

  it("removes an annotation when capture replacement creates a new event ID", () => {
    const current = score([eventNote]);
    const replaced = insertStaffBuilderNotes(current, {
      measureIndex: 0,
      staff: "treble",
      startTick: 0,
      midiNumbers: [64],
      rhythm: { status: "unresolved" },
      factories: { createId: (() => { const ids = ["replacement-pitch", "replacement-event"]; return () => ids.shift() ?? "extra"; })(), now: () => "2026-01-02T00:00:00.000Z" },
    });
    expect(reconcileStaffBuilderAnnotations(replaced).annotations).toEqual([]);
  });

  it("retains annotations across identity-preserving rhythm, staff, spelling, and rest mutations", () => {
    const original = score([eventNote]);
    const selection = { measureIndex: 0, eventId: "event" };
    const duration = setStaffBuilderEventDuration(original, selection, "half");
    expect(duration.ok && reconcileStaffBuilderAnnotations(duration.score).annotations).toEqual([eventNote]);
    const staff = moveStaffBuilderEventToStaff(original, selection, "bass");
    expect(staff.ok && reconcileStaffBuilderAnnotations(staff.score).annotations).toEqual([eventNote]);
    const spelling = respellStaffBuilderPitch(original, selection, "pitch", "D");
    expect(spelling.ok && reconcileStaffBuilderAnnotations(spelling.score).annotations).toEqual([eventNote]);
    const rest = convertStaffBuilderEventToRest(original, selection, "quarter");
    expect(rest.ok && reconcileStaffBuilderAnnotations(rest.score).annotations).toEqual([eventNote]);
  });

  it("retains existing-ID annotations when measures are inserted before or after", () => {
    const current = score([eventNote, measureMark]);
    const before = insertStaffBuilderMeasure(current, 0, { createId: () => "before", now: () => "2026-01-02T00:00:00.000Z" });
    const after = insertStaffBuilderMeasure(current, 1, { createId: () => "after", now: () => "2026-01-02T00:00:00.000Z" });
    expect(before.ok && reconcileStaffBuilderAnnotations(before.score).annotations).toEqual([eventNote, measureMark]);
    expect(after.ok && reconcileStaffBuilderAnnotations(after.score).annotations).toEqual([eventNote, measureMark]);
  });
});
