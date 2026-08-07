import { describe, expect, it } from "vitest";
import type { StaffBuilderEvent, StaffBuilderScoreV1 } from "./staff-builder-types";
import { convertStaffBuilderEventToRest, deleteStaffBuilderEvent, getInitialStaffBuilderRhythmSelection, getStaffBuilderEventSelections, getStaffBuilderPitchSpellingCandidates, moveStaffBuilderEventSelection, moveStaffBuilderEventToStaff, respellStaffBuilderPitch, setStaffBuilderEventDuration } from "./staff-builder-rhythm";

const pitch = (id: string, midiNumber = 61) => ({ id, midiNumber, letter: "C" as const, accidental: "sharp" as const, octave: 4 });
const event = (id: string, staff: "treble" | "bass", startTick: number, rhythm: StaffBuilderEvent["rhythm"] = { status: "unresolved" }): StaffBuilderEvent => ({ id, kind: "notes", staff, startTick, rhythm, pitches: [pitch(`${id}-pitch`)] });
function score(events: readonly StaffBuilderEvent[], ties: StaffBuilderScoreV1["ties"] = []): StaffBuilderScoreV1 { return { schemaVersion: 1, id: "score", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events }, { id: "m2", events: [event("later", "treble", 0)] }], ties }; }
const now = { now: () => "2026-01-02T00:00:00.000Z" };

describe("Staff Builder rhythm operations", () => {
  it("orders selections by measure, tick, treble before bass, and ID", () => {
    const current = score([event("z", "bass", 0), event("b", "treble", 240), event("a", "treble", 240), event("t", "treble", 0)]);
    expect(getStaffBuilderEventSelections(current).map(({ eventId }) => eventId)).toEqual(["t", "z", "a", "b", "later"]);
  });

  it("selects the earliest unresolved event and does not wrap movement", () => {
    const current = score([event("final", "treble", 0, { status: "final", duration: "quarter" }), event("unresolved", "bass", 0)]);
    const initial = getInitialStaffBuilderRhythmSelection(current)!;
    expect(initial.eventId).toBe("unresolved");
    expect(moveStaffBuilderEventSelection(current, initial, "previous").eventId).toBe("final");
    const last = { measureIndex: 1, eventId: "later" };
    expect(moveStaffBuilderEventSelection(current, last, "next")).toEqual(last);
  });

  it.each(["whole", "dotted-half", "half", "dotted-quarter", "quarter", "dotted-eighth", "eighth", "sixteenth"] as const)("assigns %s without changing event identity or placement", (duration) => {
    const current = score([event("selected", "treble", 240)]);
    const before = JSON.stringify(current);
    const result = setStaffBuilderEventDuration(current, { measureIndex: 0, eventId: "selected" }, duration, now);
    expect(result.ok && result.score.measures[0]?.events[0]).toMatchObject({ id: "selected", staff: "treble", startTick: 240, rhythm: { status: "final", duration } });
    expect(JSON.stringify(current)).toBe(before);
  });

  it("converts to a final rest while preserving event identity and placement", () => {
    const result = convertStaffBuilderEventToRest(score([event("selected", "bass", 120)]), { measureIndex: 0, eventId: "selected" }, "eighth", now);
    expect(result.ok && result.score.measures[0]?.events[0]).toEqual({ id: "selected", kind: "rest", staff: "bass", startTick: 120, rhythm: { status: "final", duration: "eighth" } });
  });

  it("moves staff without changing event content and rejects a target conflict", () => {
    const selected = event("selected", "treble", 0, { status: "final", duration: "half" });
    const moved = moveStaffBuilderEventToStaff(score([selected]), { measureIndex: 0, eventId: "selected" }, "bass", now);
    expect(moved.ok && moved.score.measures[0]?.events[0]).toMatchObject({ id: "selected", staff: "bass", rhythm: selected.rhythm, pitches: selected.kind === "notes" ? selected.pitches : [] });
    expect(moveStaffBuilderEventToStaff(score([selected, event("conflict", "bass", 0)]), { measureIndex: 0, eventId: "selected" }, "bass", now)).toMatchObject({ ok: false, error: "staff-conflict" });
  });

  it("respells one pitch without changing its ID or MIDI number", () => {
    const current = score([event("selected", "treble", 0)]);
    expect(getStaffBuilderPitchSpellingCandidates(pitch("p")).map(({ letter }) => letter)).toEqual(["C", "D"]);
    const result = respellStaffBuilderPitch(current, { measureIndex: 0, eventId: "selected" }, "selected-pitch", "D", now);
    expect(result.ok && result.score.measures[0]?.events[0]).toMatchObject({ pitches: [{ id: "selected-pitch", midiNumber: 61, letter: "D", accidental: "flat", octave: 4 }] });
  });

  it("deletes and selects next, then previous, without removing the measure", () => {
    const current = score([event("first", "treble", 0), event("second", "treble", 240)]);
    const first = deleteStaffBuilderEvent(current, { measureIndex: 0, eventId: "first" }, now);
    expect(first.selection?.eventId).toBe("second");
    const later = deleteStaffBuilderEvent(first.result.score, { measureIndex: 1, eventId: "later" }, now);
    expect(later.selection?.eventId).toBe("second");
    expect(later.result.score.measures).toHaveLength(2);
  });

  it("rejects deletion and rest conversion for tied events while allowing duration, staff, and spelling edits", () => {
    const tied = score([event("selected", "treble", 0)], [{ id: "tie", fromEventId: "selected", fromPitchId: "selected-pitch", toEventId: "later", toPitchId: "later-pitch" }]);
    const selection = { measureIndex: 0, eventId: "selected" };
    expect(deleteStaffBuilderEvent(tied, selection, now).result).toMatchObject({ ok: false, error: "tied-event", score: tied });
    expect(convertStaffBuilderEventToRest(tied, selection, "quarter", now)).toMatchObject({ ok: false, error: "tied-event", score: tied });
    expect(setStaffBuilderEventDuration(tied, selection, "half", now).ok).toBe(true);
    expect(moveStaffBuilderEventToStaff(tied, selection, "bass", now).ok).toBe(true);
    expect(respellStaffBuilderPitch(tied, selection, "selected-pitch", "D", now).ok).toBe(true);
  });
});
