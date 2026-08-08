import { describe, expect, it } from "vitest";
import type { StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScoreV1 } from "./staff-builder-types";
import type { StaffBuilderDuration } from "./staff-builder-time";
import { validateStaffBuilderScore } from "./staff-builder-validation";

const pitch = (id: string, midiNumber = 60): StaffBuilderPitch => ({ id, midiNumber, letter: "C", accidental: "natural", octave: 4 });
const note = (id: string, staff: "treble" | "bass", startTick: number, duration: StaffBuilderDuration = "whole", pitches = [pitch(`${id}-p`)]): StaffBuilderEvent => ({ id, kind: "notes", staff, startTick, rhythm: { status: "final", duration }, pitches });
const score = (measures: StaffBuilderScoreV1["measures"], time: StaffBuilderScoreV1["initialTimeSignature"] = "4/4", ties: StaffBuilderScoreV1["ties"] = []): StaffBuilderScoreV1 => ({ schemaVersion: 1, id: "s", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: time, measures, ties });

describe("Staff Builder structural validation", () => {
  it.each([
    ["2/4", "half"], ["3/4", "dotted-half"], ["4/4", "whole"], ["6/8", "dotted-half"],
  ] as const)("accepts complete independent voices in %s", (time, duration) => {
    expect(validateStaffBuilderScore(score([{ id: "m", events: [note("t", "treble", 0, duration), note("b", "bass", 0, duration)] }], time))).toEqual([]);
  });

  it("orders unresolved, invalid timing, conflict, and suppressed coverage issues deterministically", () => {
    const unresolved: StaffBuilderEvent = { id: "u", kind: "notes", staff: "treble", startTick: 121, rhythm: { status: "unresolved" }, pitches: [pitch("up")] };
    const current = score([{ id: "m", events: [unresolved, note("outside", "bass", 2040, "quarter")] }]);
    const issues = validateStaffBuilderScore(current);
    expect(issues.map(({ code }) => code)).toEqual(["unresolved-rhythm", "off-grid-start", "start-outside-measure"]);
    expect(validateStaffBuilderScore(structuredClone(current)).map(({ id }) => id)).toEqual(issues.map(({ id }) => id));
  });

  it("reports same-staff conflicts and overlaps while permitting cross-staff simultaneity", () => {
    const current = score([{ id: "m", events: [note("a", "treble", 0, "half"), note("b", "treble", 480, "quarter"), note("c", "bass", 0, "whole")] }]);
    expect(validateStaffBuilderScore(current).map(({ code }) => code)).toContain("overlap");
    const simultaneous = score([{ id: "m", events: [note("a", "treble", 0), note("c", "bass", 0)] }]);
    expect(validateStaffBuilderScore(simultaneous)).toEqual([]);
  });

  it("targets the previously occupying event for overlap shortening", () => {
    const current = score([{ id: "m", events: [note("a", "treble", 0, "half"), note("b", "treble", 480, "quarter"), note("bass", "bass", 0)] }]);
    const overlap = validateStaffBuilderScore(current).find(({ code }) => code === "overlap");
    expect(overlap).toMatchObject({ target: { eventId: "b", positionTicks: 480 }, corrections: [{ kind: "shorten-duration", eventId: "a" }, { kind: "delete-event", eventId: "b" }] });
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
