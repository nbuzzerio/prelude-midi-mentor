import { describe, expect, it } from "vitest";
import { createStaffBuilderContinuationAndTies, createStaffBuilderTies, decomposeStaffBuilderGap, fillStaffBuilderGapWithRests, removeStaffBuilderTie, splitStaffBuilderEventAcrossBarline } from "./staff-builder-corrections";
import type { StaffBuilderScoreV1 } from "./staff-builder-types";

const factories = () => { let id = 0; return { createId: () => `new-${++id}`, now: () => "2026-01-02T00:00:00.000Z" }; };
const base = (): StaffBuilderScoreV1 => ({ schemaVersion: 1, id: "s", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events: [{ id: "from", kind: "notes", staff: "treble", startTick: 1440, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "fp", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }, { id: "fe", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 }] }] }, { id: "m2", events: [] }], ties: [] });

describe("Staff Builder corrections", () => {
  it.each([["2/4", 960, "half"], ["3/4", 1440, "dotted-half"], ["4/4", 1920, "whole"], ["6/8", 1440, "dotted-half"]] as const)("uses an exact full-measure rest in %s", (time, capacity, duration) => {
    expect(decomposeStaffBuilderGap(time, capacity, 0, capacity)).toEqual([{ startTick: 0, duration }]);
  });

  it("respects simple and compound beat boundaries for partial gaps", () => {
    expect(decomposeStaffBuilderGap("4/4", 1920, 240, 960)).toEqual([{ startTick: 240, duration: "eighth" }, { startTick: 480, duration: "quarter" }]);
    expect(decomposeStaffBuilderGap("6/8", 1440, 240, 960)).toEqual([{ startTick: 240, duration: "quarter" }, { startTick: 720, duration: "eighth" }]);
  });

  it("fills rests immutably with injected IDs", () => {
    const original = { ...base(), measures: [{ id: "m1", events: [] }] };
    const result = fillStaffBuilderGapWithRests(original, { measureIndex: 0, staff: "bass", startTick: 0, endTick: 1920, factories: factories() });
    expect(result.ok && result.score.measures[0]?.events[0]).toMatchObject({ id: "new-1", kind: "rest", rhythm: { duration: "whole" } });
    expect(original.measures[0]?.events).toEqual([]);
  });

  it("creates and removes explicit partial chord ties", () => {
    const original = base();
    const continuation = { id: "to", kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [{ id: "tp", midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 }] };
    const withDestination = { ...original, measures: [original.measures[0]!, { ...original.measures[1]!, events: [continuation] }] };
    const created = createStaffBuilderTies(withDestination, { fromEventId: "from", toEventId: "to", fromPitchIds: ["fp"], factories: factories() });
    expect(created.ok && created.score.ties).toHaveLength(1);
    const removed = created.ok ? removeStaffBuilderTie(created.score, created.score.ties[0]!.id, factories()) : created;
    expect(removed.ok && removed.score.ties).toEqual([]);
    expect(removed.ok && removed.score.measures).toEqual(withDestination.measures);
  });

  it("creates a continuation with new pitch and tie IDs", () => {
    const result = createStaffBuilderContinuationAndTies(base(), { fromEventId: "from", fromPitchIds: ["fp"], remainderDuration: "quarter", factories: factories() });
    expect(result.ok && result.score.measures[1]?.events[0]).toMatchObject({ id: "new-1", pitches: [{ id: "new-2" }] });
    expect(result.ok && result.score.ties[0]).toMatchObject({ id: "new-3", fromPitchId: "fp", toPitchId: "new-2" });
  });

  it("normalizes exactly one representable boundary and rejects a longer chain", () => {
    const shortSource = { ...base(), measures: [{ ...base().measures[0]!, events: [{ ...base().measures[0]!.events[0]!, startTick: 1680 }] }, base().measures[1]!] };
    const result = splitStaffBuilderEventAcrossBarline(shortSource, { eventId: "from", targetDuration: "half", fromPitchIds: ["fp"], factories: factories() });
    expect(result.ok && result.score.measures[0]?.events[0]?.rhythm).toEqual({ status: "final", duration: "eighth" });
    const twoFour = { ...base(), initialTimeSignature: "2/4" as const, measures: [{ ...base().measures[0]!, events: [{ ...base().measures[0]!.events[0]!, startTick: 840 }] }, { id: "m2", events: [] }] };
    expect(splitStaffBuilderEventAcrossBarline(twoFour, { eventId: "from", targetDuration: "whole", fromPitchIds: ["fp"], factories: factories() })).toMatchObject({ ok: false, error: "unsupported-span" });
  });
});
