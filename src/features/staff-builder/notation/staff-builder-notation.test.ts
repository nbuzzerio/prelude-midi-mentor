import { describe, expect, it } from "vitest";
import { STAFF_BUILDER_DURATIONS, durationToTicks, type StaffBuilderDuration, type StaffBuilderTimeSignature } from "../staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScoreV1 } from "../staff-builder-types";
import { getStaffBuilderVisualDuration, projectStaffBuilderMeasure } from "./staff-builder-notation";

const pitch = (id: string, letter = "C", accidental: StaffBuilderPitch["accidental"] = "natural", octave = 4, midiNumber = 60): StaffBuilderPitch => ({ id, letter: letter as StaffBuilderPitch["letter"], accidental, octave, midiNumber });
const note = (id: string, staff: "treble" | "bass", startTick: number, rhythm: StaffBuilderEvent["rhythm"], pitches = [pitch(`${id}-pitch`)]): StaffBuilderEvent => ({ id, kind: "notes", staff, startTick, rhythm, pitches });
const rest = (id: string, staff: "treble" | "bass", startTick: number, duration: StaffBuilderDuration): StaffBuilderEvent => ({ id, kind: "rest", staff, startTick, rhythm: { status: "final", duration } });

function score(options: Readonly<{
  time?: StaffBuilderTimeSignature;
  measures?: StaffBuilderScoreV1["measures"];
  ties?: StaffBuilderScoreV1["ties"];
}> = {}): StaffBuilderScoreV1 {
  return {
    schemaVersion: 1, id: "score", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: options.time ?? "4/4",
    measures: options.measures ?? [{ id: "measure-1", events: [] }], ties: options.ties ?? [],
  };
}

describe("Staff Builder notation projection", () => {
  it("resolves inherited context while distinguishing explicit changes", () => {
    const current = score({ measures: [
      { id: "m1", events: [] },
      { id: "m2", keySignatureChange: "g-major", timeSignatureChange: "6/8", events: [] },
      { id: "m3", events: [] },
    ] });
    expect(projectStaffBuilderMeasure(current, 1)).toMatchObject({ keySignatureId: "g-major", timeSignature: "6/8", introducesKeySignature: true, introducesTimeSignature: true });
    expect(projectStaffBuilderMeasure(current, 2)).toMatchObject({ keySignatureId: "g-major", timeSignature: "6/8", introducesKeySignature: false, introducesTimeSignature: false });
  });

  it("projects unresolved notes as quarter-note visuals without mutating score rhythm", () => {
    const current = score({ measures: [{ id: "m1", events: [note("event", "treble", 0, { status: "unresolved" })] }] });
    const before = JSON.stringify(current);
    const event = projectStaffBuilderMeasure(current, 0).staves.treble[0];
    expect(event).toMatchObject({ kind: "notes", unresolved: true, layoutDurationTicks: 480, visualDuration: { duration: "quarter", vexflowDuration: "q", ticks: 480 } });
    expect(JSON.stringify(current)).toBe(before);
    expect(current.measures[0]?.events[0]?.rhythm).toEqual({ status: "unresolved" });
  });

  it.each([
    ["eighth-note", [0, 240], [240, 480]],
    ["sixteenth-note", [0, 120, 240], [120, 120, 480]],
  ] as const)("preserves overlapping unresolved %s onsets independently of quarter-note visuals", (_label, ticks, layoutTicks) => {
    const events = ticks.map((startTick, index) => note(`event-${index}`, "treble", startTick, { status: "unresolved" }));
    const current = score({ measures: [{ id: "m1", events }] });
    const before = JSON.stringify(current);
    const projectedEvents = projectStaffBuilderMeasure(current, 0).staves.treble.filter((item) => item.kind !== "spacer");
    expect(projectedEvents.map(({ startTick }) => startTick)).toEqual(ticks);
    expect(projectedEvents.map(({ layoutDurationTicks }) => layoutDurationTicks)).toEqual(layoutTicks);
    expect(projectedEvents.every(({ visualDuration }) => visualDuration.duration === "quarter")).toBe(true);
    expect(JSON.stringify(current)).toBe(before);
    expect(current.measures[0]?.events.every(({ rhythm }) => rhythm.status === "unresolved")).toBe(true);
  });

  it("keeps final non-overlapping events on their actual rhythmic durations", () => {
    const events = [
      note("first", "treble", 0, { status: "final", duration: "eighth" }),
      note("second", "treble", 240, { status: "final", duration: "quarter" }),
    ];
    const projectedEvents = projectStaffBuilderMeasure(score({ measures: [{ id: "m1", events }] }), 0).staves.treble.filter((item) => item.kind !== "spacer");
    expect(projectedEvents.map(({ layoutDurationTicks }) => layoutDurationTicks)).toEqual([240, 480]);
    expect(projectedEvents.map(({ startTick }) => startTick)).toEqual([0, 240]);
  });

  it.each([
    [1800, 120],
    [1680, 240],
    [1440, 480],
  ])("caps an unresolved event at tick %i to %i layout ticks without changing its quarter visual or score", (startTick, layoutDurationTicks) => {
    const event = note("boundary", "treble", startTick, { status: "unresolved" });
    const current = score({ measures: [{ id: "m1", events: [event] }] });
    const before = JSON.stringify(current);
    const projected = projectStaffBuilderMeasure(current, 0).staves.treble.find((item) => item.kind !== "spacer");
    expect(projected).toMatchObject({ startTick, layoutDurationTicks, visualDuration: { duration: "quarter", ticks: 480 } });
    expect(JSON.stringify(current)).toBe(before);
    expect(current.measures[0]?.events[0]?.rhythm).toEqual({ status: "unresolved" });
  });

  it.each(STAFF_BUILDER_DURATIONS)("maps the approved %s duration and its dots", (duration) => {
    const visual = getStaffBuilderVisualDuration(duration);
    expect(visual.ticks).toBe(durationToTicks(duration));
    expect(visual.dots).toBe(duration.startsWith("dotted-") ? 1 : 0);
  });

  it("projects rests, chords, and persisted pitch spelling", () => {
    const events = [
      note("chord", "treble", 0, { status: "final", duration: "dotted-quarter" }, [pitch("p1", "F", "sharp", 4, 66), pitch("p2", "A", "natural", 4, 69)]),
      rest("rest", "bass", 0, "half"),
    ];
    const projection = projectStaffBuilderMeasure(score({ measures: [{ id: "m1", events }] }), 0);
    expect(projection.staves.treble[0]).toMatchObject({ kind: "notes", visualDuration: { dots: 1 }, pitches: [{ letter: "F", accidental: "sharp", midiNumber: 66 }, { letter: "A" }] });
    expect(projection.staves.bass[0]).toMatchObject({ kind: "rest", visualDuration: { duration: "half" } });
    expect(projection.summary.treble).toContain("F♯4, A4");
  });

  it("uses render-only spacers to preserve rhythmic gaps and aligns simultaneous staves", () => {
    const events = [note("treble", "treble", 480, { status: "final", duration: "quarter" }), note("bass", "bass", 480, { status: "final", duration: "quarter" })];
    const projection = projectStaffBuilderMeasure(score({ measures: [{ id: "m1", events }] }), 0);
    expect(projection.staves.treble[0]).toMatchObject({ kind: "spacer", startTick: 0, durationTicks: 480 });
    expect(projection.staves.treble[1]).toMatchObject({ eventId: "treble", startTick: 480 });
    expect(projection.staves.bass[1]).toMatchObject({ eventId: "bass", startTick: 480 });
    expect(score({ measures: [{ id: "m1", events }] }).measures[0]?.events).toHaveLength(2);
  });

  it("preserves a gap that is not aligned to a notation duration without persisting a rest", () => {
    const event = note("offset", "treble", 250, { status: "final", duration: "quarter" });
    const current = score({ measures: [{ id: "m1", events: [event] }] });
    const leadingSpacers = projectStaffBuilderMeasure(current, 0).staves.treble.filter((item): item is Extract<typeof item, { kind: "spacer" }> => item.kind === "spacer" && item.startTick < 250);
    expect(leadingSpacers.reduce((sum, spacer) => sum + spacer.durationTicks, 0)).toBe(250);
    expect(current.measures[0]?.events).toEqual([event]);
  });

  it.each(["2/4", "3/4", "4/4", "6/8"] as const)("provides capacity, position anchors, and beam groups for %s", (time) => {
    const projection = projectStaffBuilderMeasure(score({ time }), 0);
    expect(projection.positionTicks[0]).toBe(0);
    expect(projection.positionTicks.at(-1)).toBe(projection.capacityTicks - 120);
    expect(projection.beams.treble.beatGroups).toEqual(time === "6/8" ? ["3/8"] : ["1/4"]);
  });

  it("projects only explicit ties with visible stable event and pitch endpoints", () => {
    const first = note("from", "treble", 0, { status: "final", duration: "quarter" }, [pitch("from-pitch")]);
    const second = note("to", "treble", 480, { status: "final", duration: "quarter" }, [pitch("to-pitch")]);
    const later = note("later", "treble", 0, { status: "final", duration: "quarter" }, [pitch("later-pitch")]);
    const current = score({ measures: [{ id: "m1", events: [first, second] }, { id: "m2", events: [later] }], ties: [
      { id: "visible", fromEventId: "from", fromPitchId: "from-pitch", toEventId: "to", toPitchId: "to-pitch" },
      { id: "crossing", fromEventId: "to", fromPitchId: "to-pitch", toEventId: "later", toPitchId: "later-pitch" },
    ] });
    const projection = projectStaffBuilderMeasure(current, 0);
    expect(projection.ties).toEqual([{ tieId: "visible", fromEventId: "from", fromPitchIndex: 0, toEventId: "to", toPitchIndex: 0 }]);
    expect(projection.unavailableTies).toEqual([{ tieId: "crossing", reason: "endpoint-outside-measure" }]);
  });

  it("provides deterministic beaming candidates for eighth and sixteenth notes only", () => {
    const events = [
      note("quarter", "treble", 0, { status: "final", duration: "quarter" }),
      note("eighth", "treble", 480, { status: "final", duration: "eighth" }),
      note("sixteenth", "treble", 720, { status: "final", duration: "sixteenth" }),
      rest("rest", "treble", 840, "sixteenth"),
    ];
    expect(projectStaffBuilderMeasure(score({ measures: [{ id: "m1", events }] }), 0).beams.treble.eventIds).toEqual(["eighth", "sixteenth"]);
  });
});
