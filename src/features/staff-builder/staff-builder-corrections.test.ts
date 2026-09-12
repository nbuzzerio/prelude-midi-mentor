import { describe, expect, it } from "vitest";
import { createStaffBuilderContinuationAndTies, createStaffBuilderTies, decomposeStaffBuilderGap, fillAllStaffBuilderGapsWithRests, fillStaffBuilderGapWithRests, getExactStaffBuilderFittingDuration, getStaffBuilderPitchTieCandidate, getStaffBuilderTieDestinationCandidates, removeStaffBuilderTie, splitStaffBuilderEventAcrossBarline } from "./staff-builder-corrections";
import type { StaffBuilderScore } from "./staff-builder-types";
import { validateStaffBuilderScore } from "./staff-builder-validation";

const factories = () => { let id = 0; return { createId: () => `new-${++id}`, now: () => "2026-01-02T00:00:00.000Z" }; };
const base = (): StaffBuilderScore => ({ schemaVersion: 3, annotations: [], id: "s", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events: [{ id: "from", kind: "notes", staff: "treble", startTick: 1440, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "fp", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }, { id: "fe", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 }] }] }, { id: "m2", events: [] }], ties: [] });

describe("Staff Builder corrections", () => {
  it("returns only an exact supported duration for the remaining measure span", () => {
    expect(getExactStaffBuilderFittingDuration(1920, 1560)).toBe("dotted-eighth");
    expect(getExactStaffBuilderFittingDuration(1920, 1680)).toBe("eighth");
    expect(getExactStaffBuilderFittingDuration(1920, 1800)).toBe("sixteenth");
    expect(getExactStaffBuilderFittingDuration(1920, 1440)).toBe("quarter");
    expect(getExactStaffBuilderFittingDuration(1920, 1320)).toBeNull();
  });
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

  it("atomically fills safe gaps across measures and staves with beat-aware rests", () => {
    const note = (id: string, staff: "treble" | "bass", startTick: number, duration: "quarter" | "dotted-quarter") => ({ id, kind: "notes" as const, staff, startTick, rhythm: { status: "final" as const, duration }, pitches: [{ id: `${id}-p`, midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 }] });
    const original: StaffBuilderScore = { ...base(), measures: [
      { id: "m1", events: [note("m1-note", "treble", 480, "quarter")] },
      { id: "m2", timeSignatureChange: "6/8", events: [note("m2-note", "treble", 720, "dotted-quarter")] },
    ] };
    const result = fillAllStaffBuilderGapsWithRests(original, [
      { measureIndex: 0, staff: "treble", startTick: 0, endTick: 480 },
      { measureIndex: 0, staff: "treble", startTick: 960, endTick: 1920 },
      { measureIndex: 0, staff: "bass", startTick: 0, endTick: 1920 },
      { measureIndex: 1, staff: "treble", startTick: 0, endTick: 720 },
      { measureIndex: 1, staff: "bass", startTick: 0, endTick: 1440 },
    ], factories());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.score.updatedAt).toBe("2026-01-02T00:00:00.000Z");
    expect(result.score.measures[0]?.events.filter(({ kind }) => kind === "rest").map(({ staff, startTick, rhythm }) => ({ staff, startTick, duration: rhythm.status === "final" ? rhythm.duration : null }))).toEqual([
      { staff: "treble", startTick: 0, duration: "quarter" },
      { staff: "treble", startTick: 960, duration: "quarter" },
      { staff: "treble", startTick: 1440, duration: "quarter" },
      { staff: "bass", startTick: 0, duration: "whole" },
    ]);
    expect(result.score.measures[1]?.events.filter(({ kind }) => kind === "rest").map(({ staff, rhythm }) => ({ staff, duration: rhythm.status === "final" ? rhythm.duration : null }))).toEqual([
      { staff: "treble", duration: "dotted-quarter" },
      { staff: "bass", duration: "dotted-half" },
    ]);
    expect(original.measures.flatMap(({ events }) => events).some(({ kind }) => kind === "rest")).toBe(false);
  });

  it("rejects stale bulk gaps before generating IDs or partially changing the score", () => {
    let created = 0;
    const original = { ...base(), measures: [{ id: "m1", events: [] }] };
    const result = fillAllStaffBuilderGapsWithRests(original, [
      { measureIndex: 0, staff: "treble", startTick: 0, endTick: 1920 },
      { measureIndex: 0, staff: "bass", startTick: 0, endTick: 960 },
    ], { createId: () => `id-${++created}`, now: () => "changed" });
    expect(result).toEqual({ ok: false, error: "stale-correction", score: original });
    expect(result.score).toBe(original);
    expect(created).toBe(0);
  });

  it("fills only true staff-union gaps in polyphonic material", () => {
    const source: StaffBuilderScore = { ...base(), measures: [{ id: "m1", events: [
      { id: "long", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "half" }, pitches: [{ id: "lp", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 }] },
      { id: "later", kind: "notes", staff: "treble", startTick: 480, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "sp", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] },
    ] }] };
    const result = fillAllStaffBuilderGapsWithRests(source, [{ measureIndex: 0, staff: "treble", startTick: 960, endTick: 1920 }], factories());
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.score.measures[0]?.events.filter(({ kind }) => kind === "rest")).toHaveLength(2);
  });

  it("rejects a voice-local gap as stale when staff-wide coverage exists", () => {
    const source: StaffBuilderScore = { ...base(), measures: [{ id: "m1", events: [
      { id: "whole", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: "wp", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 }] },
      { id: "later", kind: "notes", staff: "treble", startTick: 480, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "lp", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] },
    ] }] };
    expect(fillAllStaffBuilderGapsWithRests(source, [{ measureIndex: 0, staff: "treble", startTick: 0, endTick: 480 }], factories())).toEqual({ ok: false, error: "stale-correction", score: source });
  });

  it("never fills a requested gap that intersects an authored event", () => {
    const source = base();
    expect(fillStaffBuilderGapWithRests(source, { measureIndex: 0, staff: "treble", startTick: 1200, endTick: 1920, factories: factories() })).toEqual({ ok: false, error: "conflict", score: source });
    expect(source.measures[0]?.events).toHaveLength(1);
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

  it("finds only contiguous sounding-compatible destinations and permits enharmonic chains", () => {
    const a = { id: "a", kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [{ id: "ap", midiNumber: 61, letter: "C" as const, accidental: "sharp" as const, octave: 4 }] };
    const b = { ...a, id: "b", startTick: 480, pitches: [{ id: "bp", midiNumber: 61, letter: "D" as const, accidental: "flat" as const, octave: 4 }] };
    const c = { ...a, id: "c", startTick: 960, pitches: [{ ...a.pitches[0], id: "cp" }] };
    const gap = { ...a, id: "gap", startTick: 1440, pitches: [{ ...a.pitches[0], id: "gp" }] };
    const source: StaffBuilderScore = { ...base(), measures: [{ id: "m1", events: [a, b, c, gap] }] };
    expect(getStaffBuilderTieDestinationCandidates(source, "a", ["ap"]).map(({ id }) => id)).toEqual(["b"]);
    const first = createStaffBuilderTies(source, { fromEventId: "a", toEventId: "b", fromPitchIds: ["ap"], factories: factories() });
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const second = createStaffBuilderTies(first.score, { fromEventId: "b", toEventId: "c", fromPitchIds: ["bp"], factories: factories() });
    expect(second.ok && second.score.ties).toHaveLength(2);
    expect(createStaffBuilderTies(source, { fromEventId: "a", toEventId: "gap", fromPitchIds: ["ap"], factories: factories() })).toMatchObject({ ok: false, error: "invalid-timing" });
  });

  it("discovers and authors independent incoming and outgoing ties through a four-event chain", () => {
    const event = (id: string, startTick: number, pitchId: string, midiNumber = 61, letter: "C" | "D" = "C") => ({
      id, kind: "notes" as const, staff: "treble" as const, startTick,
      rhythm: { status: "final" as const, duration: "quarter" as const },
      pitches: [{ id: pitchId, midiNumber, letter, accidental: letter === "C" ? "sharp" as const : "flat" as const, octave: 4 }],
    });
    const a = event("a", 0, "ap");
    const b = event("b", 480, "bp", 61, "D");
    const c = event("c", 960, "cp");
    const d = event("d", 1440, "dp", 61, "D");
    let current: StaffBuilderScore = { ...base(), measures: [{ id: "m1", events: [a, b, c, d] }], ties: [] };
    expect(getStaffBuilderPitchTieCandidate(current, "b", "bp", "incoming")).toMatchObject({ eventId: "a", pitchId: "ap" });
    expect(getStaffBuilderPitchTieCandidate(current, "b", "bp", "outgoing")).toMatchObject({ eventId: "c", pitchId: "cp" });
    for (const [fromEventId, toEventId, fromPitchId] of [["a", "b", "ap"], ["b", "c", "bp"], ["c", "d", "cp"]] as const) {
      const result = createStaffBuilderTies(current, { fromEventId, toEventId, fromPitchIds: [fromPitchId], factories: factories() });
      expect(result.ok).toBe(true);
      if (result.ok) current = result.score;
    }
    expect(current.ties).toHaveLength(3);
    expect(current.ties.filter((tie) => tie.toEventId === "b" || tie.fromEventId === "b")).toHaveLength(2);
    expect(current.ties.filter((tie) => tie.toEventId === "c" || tie.fromEventId === "c")).toHaveLength(2);
    expect(getStaffBuilderPitchTieCandidate(current, "b", "bp", "incoming")).toBeNull();
    expect(getStaffBuilderPitchTieCandidate(current, "b", "bp", "outgoing")).toBeNull();
  });

  it("chains chord pitches independently while leaving unchecked siblings freshly attacked", () => {
    const chord = (id: string, startTick: number, suffix: string) => ({ id, kind: "notes" as const, staff: "treble" as const, startTick, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [
      { id: `d-${suffix}`, midiNumber: 74, letter: "D" as const, accidental: "natural" as const, octave: 5 },
      { id: `f-${suffix}`, midiNumber: 77, letter: "F" as const, accidental: "natural" as const, octave: 5 },
      { id: `a-${suffix}`, midiNumber: 81, letter: "A" as const, accidental: "natural" as const, octave: 5 },
    ] });
    const first = chord("first", 0, "1");
    const middle = chord("middle", 480, "2");
    const last = chord("last", 960, "3");
    let current: StaffBuilderScore = { ...base(), measures: [{ id: "m1", events: [first, middle, last] }], ties: [] };
    const tieFactories = factories();
    for (const [fromEventId, toEventId, pitchIds] of [["first", "middle", ["d-1", "f-1"]], ["middle", "last", ["d-2", "f-2"]]] as const) {
      const result = createStaffBuilderTies(current, { fromEventId, toEventId, fromPitchIds: pitchIds, factories: tieFactories });
      expect(result.ok).toBe(true);
      if (result.ok) current = result.score;
    }
    expect(current.ties).toHaveLength(4);
    expect(current.ties.some((tie) => tie.fromPitchId.startsWith("a-") || tie.toPitchId.startsWith("a-"))).toBe(false);
    const incoming = current.ties.find((tie) => tie.toPitchId === "d-2")!;
    const removed = removeStaffBuilderTie(current, incoming.id, factories());
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(removed.score.ties.some((tie) => tie.fromPitchId === "d-2")).toBe(true);
      const outgoing = removed.score.ties.find((tie) => tie.fromPitchId === "f-2")!;
      const removedOutgoing = removeStaffBuilderTie(removed.score, outgoing.id, factories());
      expect(removedOutgoing.ok && removedOutgoing.score.ties.some((tie) => tie.toPitchId === "f-2")).toBe(true);
    }
  });

  it("rejects different-MIDI, non-contiguous, second-direction, and cyclic ties", () => {
    const original = base();
    const mismatched = { id: "mismatch", kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [{ id: "mp", midiNumber: 62, letter: "D" as const, accidental: "natural" as const, octave: 4 }] };
    const gapped = { ...mismatched, id: "gapped", startTick: 480, pitches: [{ ...mismatched.pitches[0], id: "gp", midiNumber: 60, letter: "C" as const }] };
    const source: StaffBuilderScore = { ...original, measures: [original.measures[0]!, { ...original.measures[1]!, events: [mismatched, gapped] }] };
    expect(getStaffBuilderPitchTieCandidate(source, "from", "fp", "outgoing")).toBeNull();
    expect(createStaffBuilderTies(source, { fromEventId: "from", toEventId: "mismatch", fromPitchIds: ["fp"], factories: factories() })).toMatchObject({ ok: false });
    expect(createStaffBuilderTies(source, { fromEventId: "from", toEventId: "gapped", fromPitchIds: ["fp"], factories: factories() })).toMatchObject({ ok: false });
    const conflicts: StaffBuilderScore = { ...source, ties: [
      { id: "out-1", fromEventId: "from", fromPitchId: "fp", toEventId: "mismatch", toPitchId: "mp" },
      { id: "out-2", fromEventId: "from", fromPitchId: "fp", toEventId: "gapped", toPitchId: "gp" },
      { id: "in-2", fromEventId: "gapped", fromPitchId: "gp", toEventId: "mismatch", toPitchId: "mp" },
      { id: "cycle", fromEventId: "mismatch", fromPitchId: "mp", toEventId: "from", toPitchId: "fp" },
    ] };
    const codes = validateStaffBuilderScore(conflicts).map(({ code }) => code);
    expect(codes).toEqual(expect.arrayContaining(["conflicting-incoming-tie", "conflicting-outgoing-tie", "tie-cycle"]));
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
