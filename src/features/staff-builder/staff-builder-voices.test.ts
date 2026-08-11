import { describe, expect, it } from "vitest";
import type { StaffBuilderDuration } from "./staff-builder-time";
import type { StaffBuilderEvent } from "./staff-builder-types";
import { deriveStaffBuilderVoices, getStaffBuilderSamePositionConflicts, getStaffBuilderStaffCoverageGaps } from "./staff-builder-voices";

const note = (id: string, startTick: number, duration: StaffBuilderDuration, midi = 60, staff: "treble" | "bass" = "treble"): StaffBuilderEvent => ({ id, kind: "notes", staff, startTick, rhythm: { status: "final", duration }, pitches: [{ id: `${id}-p`, midiNumber: midi, letter: "C", accidental: "natural", octave: 4 }] });
const rest = (id: string, startTick: number, duration: StaffBuilderDuration, staff: "treble" | "bass" = "treble"): StaffBuilderEvent => ({ id, kind: "rest", staff, startTick, rhythm: { status: "final", duration } });
const signature = (voices: ReturnType<typeof deriveStaffBuilderVoices>) => voices.map((voice) => voice.events.map(({ eventId }) => eventId));

describe("Staff Builder derived voices", () => {
  it("keeps monophonic events in one voice with voice-local gaps", () => {
    const voices = deriveStaffBuilderVoices([note("a", 240, "quarter"), note("b", 960, "half")], "treble", 1920);
    expect(signature(voices)).toEqual([["a", "b"]]);
    expect(voices[0]?.implicitGaps).toEqual([{ startTick: 0, endTick: 240 }, { startTick: 720, endTick: 960 }]);
  });

  it("uses the minimum two voices for a long note and later attacks", () => {
    const voices = deriveStaffBuilderVoices([note("long", 0, "dotted-half", 64), note("c", 480, "quarter", 60), note("d", 960, "quarter", 62)], "treble", 1920);
    expect(signature(voices)).toEqual([["long"], ["c", "d"]]);
  });

  it("derives three voices for nested simultaneous lines", () => {
    const voices = deriveStaffBuilderVoices([note("whole", 0, "whole", 72), note("half", 0, "half", 67), note("quarter", 0, "quarter", 60), note("later", 480, "quarter", 62)], "treble", 1920);
    expect(voices).toHaveLength(3);
    expect(signature(voices)).toEqual([["whole"], ["half"], ["quarter", "later"]]);
  });

  it("is stable under repeated derivation and source reorder", () => {
    const events = [note("low", 0, "quarter", 48), note("high", 0, "half", 72), note("later", 480, "quarter", 60)];
    const expected = signature(deriveStaffBuilderVoices(events, "treble", 1920));
    expect(signature(deriveStaffBuilderVoices([...events].reverse(), "treble", 1920))).toEqual(expected);
    expect(signature(deriveStaffBuilderVoices(structuredClone(events), "treble", 1920))).toEqual(expected);
  });

  it("derives treble and bass independently", () => {
    const events = [note("t1", 0, "whole"), note("t2", 480, "quarter"), note("b1", 0, "whole", 48, "bass")];
    expect(deriveStaffBuilderVoices(events, "treble", 1920)).toHaveLength(2);
    expect(deriveStaffBuilderVoices(events, "bass", 1920)).toHaveLength(1);
  });

  it("keeps a chord one authoritative derived event and does not mutate source", () => {
    const chord = { ...note("chord", 0, "whole"), kind: "notes" as const, pitches: [
      { id: "c", midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 },
      { id: "e", midiNumber: 64, letter: "E" as const, accidental: "natural" as const, octave: 4 },
    ] };
    const before = structuredClone(chord);
    expect(deriveStaffBuilderVoices([chord], "treble", 1920)[0]?.events).toHaveLength(1);
    expect(chord).toEqual(before);
  });

  it("allows note/rest coexistence and derives separate voices", () => {
    expect(getStaffBuilderSamePositionConflicts([note("n", 0, "half"), rest("r", 0, "quarter")])).toEqual([]);
    expect(deriveStaffBuilderVoices([note("n", 0, "half"), rest("r", 0, "quarter")], "treble", 1920)).toHaveLength(2);
  });

  it("computes staff-union gaps rather than voice-local gaps", () => {
    const voices = deriveStaffBuilderVoices([note("whole", 0, "whole"), note("later", 480, "quarter")], "treble", 1920);
    expect(voices[1]?.implicitGaps.length).toBeGreaterThan(0);
    expect(getStaffBuilderStaffCoverageGaps(voices.flatMap((voice) => voice.events), 1920)).toEqual([]);
  });
});

describe("Staff Builder same-position conflicts", () => {
  it("allows one chord and different-duration disjoint note events", () => {
    expect(getStaffBuilderSamePositionConflicts([note("single", 0, "quarter")])).toEqual([]);
    expect(getStaffBuilderSamePositionConflicts([note("a", 0, "half", 60), note("b", 0, "quarter", 64)])).toEqual([]);
  });

  it("rejects equal-duration separate notes", () => {
    expect(getStaffBuilderSamePositionConflicts([note("a", 0, "quarter", 60), note("b", 0, "quarter", 64)])[0]).toMatchObject({ eventIds: ["a", "b"], reasons: ["same-duration-notes"] });
  });

  it("rejects duplicate MIDI pitches even with different durations", () => {
    expect(getStaffBuilderSamePositionConflicts([note("a", 0, "half", 60), note("b", 0, "quarter", 60)])[0]?.reasons).toContain("duplicate-midi-pitch");
  });

  it("rejects two rests but ignores opposite-staff simultaneity", () => {
    expect(getStaffBuilderSamePositionConflicts([rest("a", 0, "half"), rest("b", 0, "quarter")])[0]?.reasons).toEqual(["duplicate-rests"]);
    expect(getStaffBuilderSamePositionConflicts([note("t", 0, "quarter"), note("b", 0, "quarter", 60, "bass")])).toEqual([]);
  });
});
