import { describe, expect, it } from "vitest";
import type { StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScoreV1 } from "./staff-builder-types";
import type { StaffBuilderDuration } from "./staff-builder-time";
import { validateStaffBuilderScore } from "./staff-builder-validation";

const pitch = (id: string, midiNumber = 60): StaffBuilderPitch => ({ id, midiNumber, letter: "C", accidental: "natural", octave: 4 });
const note = (id: string, staff: "treble" | "bass", startTick: number, duration: StaffBuilderDuration = "whole", pitches = [pitch(`${id}-p`)]): StaffBuilderEvent => ({ id, kind: "notes", staff, startTick, rhythm: { status: "final", duration }, pitches });
const rest = (id: string, staff: "treble" | "bass", startTick: number, duration: StaffBuilderDuration): StaffBuilderEvent => ({ id, kind: "rest", staff, startTick, rhythm: { status: "final", duration } });
const score = (measures: StaffBuilderScoreV1["measures"], time: StaffBuilderScoreV1["initialTimeSignature"] = "4/4", ties: StaffBuilderScoreV1["ties"] = []): StaffBuilderScoreV1 => ({ schemaVersion: 1, id: "s", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: time, measures, ties });

describe("Staff Builder structural validation", () => {
  it.each([
    ["2/4", "half"], ["3/4", "dotted-half"], ["4/4", "whole"], ["6/8", "dotted-half"],
  ] as const)("accepts complete independent voices in %s", (time, duration) => {
    expect(validateStaffBuilderScore(score([{ id: "m", events: [note("t", "treble", 0, duration), note("b", "bass", 0, duration)] }], time))).toEqual([]);
  });

  it("accepts independent 6/8 subdivisions on treble and bass", () => {
    const events = [
      note("t1", "treble", 0, "dotted-quarter"), note("t2", "treble", 720, "eighth"),
      note("t3", "treble", 960, "eighth"), note("t4", "treble", 1200, "eighth"),
      note("b1", "bass", 0, "dotted-quarter"), note("b2", "bass", 720, "dotted-quarter"),
    ];
    expect(validateStaffBuilderScore(score([{ id: "m", events }], "6/8"))).toEqual([]);
  });

  it.each([
    ["2/4", [note("t", "treble", 0, "half"), note("b1", "bass", 0, "quarter"), note("b2", "bass", 480, "quarter")]],
    ["3/4", [note("t", "treble", 0, "dotted-half"), note("b1", "bass", 0, "half"), note("b2", "bass", 960, "quarter")]],
    ["4/4", [note("t", "treble", 0, "whole"), note("b1", "bass", 0, "half"), note("b2", "bass", 960, "half")]],
  ] as const)("accepts mismatched cross-staff subdivisions in %s", (time, events) => {
    expect(validateStaffBuilderScore(score([{ id: "m", events }], time))).toEqual([]);
  });

  it("treats a chord as one rhythmic event and permits a simultaneous opposite-staff onset", () => {
    const chord = note("chord", "treble", 0, "whole", [pitch("c", 60), pitch("e", 64), pitch("g", 67)]);
    expect(validateStaffBuilderScore(score([{ id: "m", events: [chord, note("bass", "bass", 0, "whole")] }]))).toEqual([]);
  });

  it("orders unresolved, invalid timing, conflict, and suppressed coverage issues deterministically", () => {
    const unresolved: StaffBuilderEvent = { id: "u", kind: "notes", staff: "treble", startTick: 121, rhythm: { status: "unresolved" }, pitches: [pitch("up")] };
    const current = score([{ id: "m", events: [unresolved, note("outside", "bass", 2040, "quarter")] }]);
    const issues = validateStaffBuilderScore(current);
    expect(issues.map(({ code }) => code)).toEqual(["unresolved-rhythm", "off-grid-start", "start-outside-measure"]);
    expect(validateStaffBuilderScore(structuredClone(current)).map(({ id }) => id)).toEqual(issues.map(({ id }) => id));
  });

  it("accepts complete same-staff polyphony and cross-staff simultaneity", () => {
    const current = score([{ id: "m", events: [note("sustain", "treble", 0, "whole", [pitch("e", 64)]), note("a", "treble", 0, "quarter", [pitch("c", 60)]), note("b", "treble", 480, "quarter", [pitch("d", 62)]), note("c", "treble", 960, "quarter", [pitch("f", 65)]), note("d", "treble", 1440, "quarter", [pitch("g", 67)]), note("bass", "bass", 0, "whole")] }]);
    expect(validateStaffBuilderScore(current)).toEqual([]);
  });

  it("accepts a complete Hallelujah-style 6/8 overlap without secondary-voice rests", () => {
    const events = [
      note("e", "treble", 0, "dotted-quarter", [pitch("ep", 64)]),
      note("c", "treble", 480, "eighth", [pitch("cp", 60)]),
      note("d", "treble", 720, "eighth", [pitch("dp", 62)]),
      rest("tail", "treble", 960, "quarter"),
      rest("bass", "bass", 0, "dotted-half"),
    ];
    expect(validateStaffBuilderScore(score([{ id: "m", events }], "6/8"))).toEqual([]);
  });

  it("reports only true staff-wide gaps, not voice-local gaps", () => {
    const covered = score([{ id: "m", events: [note("whole", "treble", 0), note("local", "treble", 480, "quarter"), note("bass", "bass", 0)] }]);
    expect(validateStaffBuilderScore(covered)).toEqual([]);
    const uncovered = score([{ id: "m", events: [note("a", "treble", 0, "quarter"), note("b", "treble", 960, "quarter"), note("bass", "bass", 0)] }]);
    expect(validateStaffBuilderScore(uncovered).filter(({ code }) => code === "gap").map(({ target }) => target)).toEqual(expect.arrayContaining([
      expect.objectContaining({ staff: "treble", positionTicks: 480, endTicks: 960 }),
      expect.objectContaining({ staff: "treble", positionTicks: 1440, endTicks: 1920 }),
    ]));
  });

  it("enforces the approved same-position rules", () => {
    const valid = score([{ id: "m", events: [note("long", "treble", 0, "whole", [pitch("high", 72)]), note("short", "treble", 0, "quarter", [pitch("low", 60)]), rest("bass", "bass", 0, "whole")] }]);
    expect(validateStaffBuilderScore(valid)).toEqual([]);
    const sameDuration = score([{ id: "m", events: [note("a", "treble", 0, "whole", [pitch("a", 60)]), note("b", "treble", 0, "whole", [pitch("b", 64)]), rest("bass", "bass", 0, "whole")] }]);
    expect(validateStaffBuilderScore(sameDuration).map(({ code }) => code)).toContain("same-position-conflict");
    const duplicatePitch = score([{ id: "m", events: [note("a", "treble", 0, "whole", [pitch("a", 60)]), note("b", "treble", 0, "half", [pitch("b", 60)]), rest("bass", "bass", 0, "whole")] }]);
    expect(validateStaffBuilderScore(duplicatePitch).map(({ code }) => code)).toContain("same-position-conflict");
    const duplicateRests = score([{ id: "m", events: [rest("a", "treble", 0, "whole"), rest("b", "treble", 0, "half"), rest("bass", "bass", 0, "whole")] }]);
    expect(validateStaffBuilderScore(duplicateRests).map(({ code }) => code)).toContain("same-position-conflict");
  });

  it("reports gaps and duration overflow", () => {
    const issues = validateStaffBuilderScore(score([{ id: "m", events: [note("a", "treble", 480, "whole"), note("b", "bass", 0, "half")] }]));
    expect(issues.map(({ code }) => code)).toEqual(expect.arrayContaining(["gap", "event-overflow"]));
    const gap = issues.find(({ code }) => code === "gap");
    expect(gap?.message).toMatch(/empty beats in measure 1/i);
    expect(gap?.message).not.toMatch(/tick|structural gap/i);
  });

  it.each([
    [1560, "dotted-eighth"],
    [1680, "eighth"],
    [1800, "sixteenth"],
    [1440, "quarter"],
  ] as const)("suggests the exact duration %s ticks before the barline", (startTick, duration) => {
    const overflow = validateStaffBuilderScore(score([{ id: "m", events: [note("late", "treble", startTick, "half"), note("bass", "bass", 0)] }])).find(({ code }) => code === "event-overflow");
    expect(overflow).toMatchObject({
      message: "This half note extends past the end of measure 1.",
      corrections: [{ kind: "set-duration", eventId: "late", duration }, { kind: "shorten-duration", eventId: "late" }, { kind: "delete-event", eventId: "late" }],
    });
    expect(overflow?.message).not.toMatch(/tick|overflow/i);
  });

  it("does not suggest an inexact fitting duration", () => {
    const overflow = validateStaffBuilderScore(score([{ id: "m", events: [note("late", "treble", 1320, "whole"), note("bass", "bass", 0)] }])).find(({ code }) => code === "event-overflow");
    expect(overflow?.corrections.some(({ kind }) => kind === "set-duration")).toBe(false);
    expect(overflow?.corrections[0]).toEqual({ kind: "shorten-duration", eventId: "late" });
  });

  it("validates dangling, duplicate, conflicting, adjacent, staff, and written tie identity", () => {
    const source = note("from", "treble", 1440, "quarter");
    const destination = note("to", "bass", 0, "whole", [{ ...pitch("to-p"), letter: "B", accidental: "sharp", octave: 3 }]);
    const current = score([{ id: "m1", events: [source, note("b1", "bass", 0)] }, { id: "m2", events: [destination, note("t2", "treble", 0)] }], "4/4", [
      { id: "x", fromEventId: "from", fromPitchId: "from-p", toEventId: "to", toPitchId: "to-p" },
      { id: "y", fromEventId: "from", fromPitchId: "from-p", toEventId: "to", toPitchId: "to-p" },
      { id: "z", fromEventId: "missing", fromPitchId: "p", toEventId: "to", toPitchId: "to-p" },
    ]);
    const codes = validateStaffBuilderScore(current).map(({ code }) => code);
    expect(codes).toEqual(expect.arrayContaining(["tie-staff-mismatch", "tie-pitch-mismatch", "duplicate-tie", "conflicting-incoming-tie", "conflicting-outgoing-tie", "tie-endpoint-missing"]));
  });
});
