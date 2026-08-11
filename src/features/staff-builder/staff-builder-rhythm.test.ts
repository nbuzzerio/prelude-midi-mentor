import { describe, expect, it } from "vitest";
import type { StaffBuilderEvent, StaffBuilderScoreV1 } from "./staff-builder-types";
import { convertStaffBuilderEventToRest, deleteStaffBuilderEvent, getInitialStaffBuilderRhythmSelection, getStaffBuilderEventSelections, getStaffBuilderPitchSpellingCandidates, moveStaffBuilderEventSelection, moveStaffBuilderEventToStaff, respellStaffBuilderPitch, setStaffBuilderEventDuration } from "./staff-builder-rhythm";
import { deriveStaffBuilderVoices } from "./staff-builder-voices";
import { validateStaffBuilderScore } from "./staff-builder-validation";

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

  it("extends and shortens duration without moving later events or reporting overlap", () => {
    const first = event("first", "treble", 0, { status: "final", duration: "quarter" });
    const later = event("second", "treble", 480, { status: "final", duration: "quarter" });
    const current = score([first, later]);
    const extended = setStaffBuilderEventDuration(current, { measureIndex: 0, eventId: "first" }, "dotted-quarter", now);
    expect(extended.ok).toBe(true);
    if (!extended.ok) return;
    expect(extended.score.measures[0]?.events.find(({ id }) => id === "second")?.startTick).toBe(480);
    expect(deriveStaffBuilderVoices(extended.score.measures[0]!.events, "treble", 1920)).toHaveLength(2);
    expect(validateStaffBuilderScore(extended.score).some(({ code }) => code === "event-overflow")).toBe(false);
    const shortened = setStaffBuilderEventDuration(extended.score, { measureIndex: 0, eventId: "first" }, "quarter", now);
    expect(shortened.ok && deriveStaffBuilderVoices(shortened.score.measures[0]!.events, "treble", 1920)).toHaveLength(1);
  });

  it("allows destination overlap at different onsets", () => {
    const selected = event("selected", "treble", 480, { status: "final", duration: "quarter" });
    const sustain = event("sustain", "bass", 0, { status: "final", duration: "half" });
    const moved = moveStaffBuilderEventToStaff(score([selected, sustain]), { measureIndex: 0, eventId: "selected" }, "bass", now);
    expect(moved.ok).toBe(true);
    if (moved.ok) expect(deriveStaffBuilderVoices(moved.score.measures[0]!.events, "bass", 1920)).toHaveLength(2);
  });

  it("applies centralized same-position rules to staff reassignment", () => {
    const selected = { ...event("selected", "treble", 0, { status: "final", duration: "quarter" }), pitches: [pitch("selected-pitch", 65)] } as StaffBuilderEvent;
    const longer = { ...event("longer", "bass", 0, { status: "final", duration: "half" }), pitches: [pitch("longer-pitch", 60)] } as StaffBuilderEvent;
    expect(moveStaffBuilderEventToStaff(score([selected, longer]), { measureIndex: 0, eventId: "selected" }, "bass", now).ok).toBe(true);
    const equal = { ...longer, rhythm: { status: "final" as const, duration: "quarter" as const } };
    expect(moveStaffBuilderEventToStaff(score([selected, equal]), { measureIndex: 0, eventId: "selected" }, "bass", now)).toMatchObject({ ok: false, error: "staff-conflict" });
    const duplicatePitch = { ...longer, pitches: [pitch("duplicate", 65)] };
    expect(moveStaffBuilderEventToStaff(score([selected, duplicatePitch]), { measureIndex: 0, eventId: "selected" }, "bass", now)).toMatchObject({ ok: false, error: "staff-conflict" });
    const selectedRest: StaffBuilderEvent = { id: "selected-rest", kind: "rest", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "quarter" } };
    const destinationRest: StaffBuilderEvent = { id: "destination-rest", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "half" } };
    expect(moveStaffBuilderEventToStaff(score([selectedRest, destinationRest]), { measureIndex: 0, eventId: "selected-rest" }, "bass", now)).toMatchObject({ ok: false, error: "staff-conflict" });
    expect(moveStaffBuilderEventToStaff(score([selectedRest, longer]), { measureIndex: 0, eventId: "selected-rest" }, "bass", now).ok).toBe(true);
  });

  it("deletes only the selected polyphonic event and leaves every survivor unchanged", () => {
    const sustain = event("sustain", "treble", 0, { status: "final", duration: "whole" });
    const line = [0, 480, 960, 1440].map((startTick, index) => event(`line-${index}`, "treble", startTick, { status: "final", duration: "quarter" }));
    const current = score([sustain, ...line, event("bass", "bass", 0, { status: "final", duration: "whole" })]);
    const beforeSurvivors = current.measures[0]!.events.filter(({ id }) => id !== "sustain");
    const deleted = deleteStaffBuilderEvent(current, { measureIndex: 0, eventId: "sustain" }, now);
    expect(deleted.result.ok && deleted.result.score.measures[0]?.events).toEqual(beforeSurvivors);
    expect(deleted.selection?.eventId).not.toBe("sustain");
    expect(deleted.result.ok && deleted.result.score.measures[deleted.selection?.measureIndex ?? 0]?.events.some(({ id }) => id === deleted.selection?.eventId)).toBe(true);
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

  it("rejects deletion, rest conversion, and cross-staff movement for tied events while allowing duration and spelling edits", () => {
    const tied = score([event("selected", "treble", 0)], [{ id: "tie", fromEventId: "selected", fromPitchId: "selected-pitch", toEventId: "later", toPitchId: "later-pitch" }]);
    const selection = { measureIndex: 0, eventId: "selected" };
    expect(deleteStaffBuilderEvent(tied, selection, now).result).toMatchObject({ ok: false, error: "tied-event", score: tied });
    expect(convertStaffBuilderEventToRest(tied, selection, "quarter", now)).toMatchObject({ ok: false, error: "tied-event", score: tied });
    const durationChanged = setStaffBuilderEventDuration(tied, selection, "half", now);
    expect(durationChanged.ok && durationChanged.score.ties).toEqual(tied.ties);
    expect(moveStaffBuilderEventToStaff(tied, selection, "bass", now)).toEqual({ ok: false, error: "tied-event", score: tied });
    expect(respellStaffBuilderPitch(tied, selection, "selected-pitch", "D", now).ok).toBe(true);
  });

  it("keeps a valid cross-measure tie valid through derived-voice duration changes and rejects moving one endpoint", () => {
    const tiedPitch = pitch("tied-pitch", 61);
    const destinationPitch = { ...tiedPitch, id: "destination-pitch" };
    const validTied: StaffBuilderScoreV1 = {
      schemaVersion: 1, id: "tied", title: "Tie safety", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100,
      initialKeySignatureId: "c-major", initialTimeSignature: "4/4",
      measures: [
        { id: "m1", events: [
          { id: "leading-rest", kind: "rest", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "dotted-half" } },
          { id: "source", kind: "notes", staff: "treble", startTick: 1440, rhythm: { status: "final", duration: "quarter" }, pitches: [tiedPitch] },
          { id: "bass-1", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
        ] },
        { id: "m2", events: [
          { id: "destination", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [destinationPitch] },
          { id: "sustain", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: "sustain-pitch", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 }] },
          { id: "bass-2", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
        ] },
      ],
      ties: [{ id: "tie", fromEventId: "source", fromPitchId: "tied-pitch", toEventId: "destination", toPitchId: "destination-pitch" }],
    };
    expect(validateStaffBuilderScore(validTied)).toEqual([]);
    const durationChanged = setStaffBuilderEventDuration(validTied, { measureIndex: 1, eventId: "destination" }, "half", now);
    expect(durationChanged.ok).toBe(true);
    if (!durationChanged.ok) return;
    expect(deriveStaffBuilderVoices(durationChanged.score.measures[1]!.events, "treble", 1920)).toHaveLength(2);
    expect(durationChanged.score.ties).toEqual(validTied.ties);
    expect(validateStaffBuilderScore(durationChanged.score)).toEqual([]);
    const moved = moveStaffBuilderEventToStaff(validTied, { measureIndex: 0, eventId: "source" }, "bass", now);
    expect(moved).toEqual({ ok: false, error: "tied-event", score: validTied });
    expect(validateStaffBuilderScore(moved.score)).toEqual([]);
  });
});
