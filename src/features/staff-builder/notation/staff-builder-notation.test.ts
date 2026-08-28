import { describe, expect, it } from "vitest";
import { STAFF_BUILDER_DURATIONS, durationToTicks, type StaffBuilderDuration, type StaffBuilderTimeSignature } from "../staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScore } from "../staff-builder-types";
import { getStaffBuilderVisualDuration, projectStaffBuilderMeasure, projectStaffBuilderPendingPreview } from "./staff-builder-notation";

const pitch = (id: string, letter = "C", accidental: StaffBuilderPitch["accidental"] = "natural", octave = 4, midiNumber = 60): StaffBuilderPitch => ({ id, letter: letter as StaffBuilderPitch["letter"], accidental, octave, midiNumber });
const note = (id: string, staff: "treble" | "bass", startTick: number, rhythm: StaffBuilderEvent["rhythm"], pitches = [pitch(`${id}-pitch`)]): StaffBuilderEvent => ({ id, kind: "notes", staff, startTick, rhythm, pitches });
const rest = (id: string, staff: "treble" | "bass", startTick: number, duration: StaffBuilderDuration): StaffBuilderEvent => ({ id, kind: "rest", staff, startTick, rhythm: { status: "final", duration } });

function score(options: Readonly<{
  time?: StaffBuilderTimeSignature;
  measures?: StaffBuilderScore["measures"];
  ties?: StaffBuilderScore["ties"];
}> = {}): StaffBuilderScore {
  return {
    schemaVersion: 3, annotations: [], id: "score", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
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
    ["eighth-note", [0, 240]],
    ["sixteenth-note", [0, 120, 240]],
  ] as const)("preserves overlapping unresolved %s onsets and full quarter-note visuals", (_label, ticks) => {
    const events = ticks.map((startTick, index) => note(`event-${index}`, "treble", startTick, { status: "unresolved" }));
    const current = score({ measures: [{ id: "m1", events }] });
    const before = JSON.stringify(current);
    const projectedEvents = projectStaffBuilderMeasure(current, 0).staves.treble.filter((item) => item.kind !== "spacer");
    expect(projectedEvents.map(({ startTick }) => startTick)).toEqual(ticks);
    expect(projectedEvents.map(({ layoutDurationTicks }) => layoutDurationTicks)).toEqual(ticks.map(() => 480));
    expect(projectedEvents.every(({ visualDuration }) => visualDuration.duration === "quarter")).toBe(true);
    expect(JSON.stringify(current)).toBe(before);
    expect(current.measures[0]?.events.every(({ rhythm }) => rhythm.status === "unresolved")).toBe(true);
  });

  it("projects Hallelujah-style overlap into two voices without truncating dotted duration", () => {
    const events = [
      note("sustain", "treble", 0, { status: "final", duration: "dotted-quarter" }, [pitch("e", "E", "natural", 4, 64)]),
      note("c", "treble", 480, { status: "final", duration: "eighth" }),
      note("d", "treble", 720, { status: "final", duration: "eighth" }),
    ];
    const projection = projectStaffBuilderMeasure(score({ time: "6/8", measures: [{ id: "m1", events }] }), 0);
    expect(projection.voices.treble).toHaveLength(2);
    expect(projection.voices.treble.map((voice) => voice.tickables.filter((item) => item.kind !== "spacer").map(({ eventId }) => eventId))).toEqual([["sustain", "d"], ["c"]]);
    expect(projection.staves.treble.find((item) => item.kind !== "spacer" && item.eventId === "sustain")).toMatchObject({ layoutDurationTicks: 720, visualDuration: { duration: "dotted-quarter", dots: 1 } });
  });

  it("projects nested overlap into the minimum three stable voices", () => {
    const events = [
      note("low", "treble", 0, { status: "final", duration: "quarter" }, [pitch("low-p", "C", "natural", 4, 60)]),
      note("whole", "treble", 0, { status: "final", duration: "whole" }, [pitch("whole-p", "C", "natural", 5, 72)]),
      note("middle", "treble", 0, { status: "final", duration: "half" }, [pitch("middle-p", "G", "natural", 4, 67)]),
      note("later", "treble", 480, { status: "final", duration: "quarter" }),
    ];
    const first = projectStaffBuilderMeasure(score({ measures: [{ id: "m1", events }] }), 0);
    const reordered = projectStaffBuilderMeasure(score({ measures: [{ id: "m1", events: [...events].reverse() }] }), 0);
    const ids = (projection: typeof first) => projection.voices.treble.map((voice) => voice.tickables.filter((item) => item.kind !== "spacer").map(({ eventId }) => eventId));
    expect(ids(first)).toEqual([["whole"], ["middle"], ["low", "later"]]);
    expect(ids(reordered)).toEqual(ids(first));
  });

  it("preserves same-onset different-duration notes and note/rest as separate source tickables", () => {
    const events = [
      note("half", "treble", 0, { status: "final", duration: "half" }, [pitch("high", "E", "natural", 5, 76)]),
      note("quarter", "treble", 0, { status: "final", duration: "quarter" }, [pitch("low", "C", "natural", 5, 72)]),
      rest("authored-rest", "treble", 480, "quarter"),
    ];
    const projection = projectStaffBuilderMeasure(score({ measures: [{ id: "m1", events }] }), 0);
    expect(projection.voices.treble).toHaveLength(2);
    expect(projection.staves.treble.filter((item) => item.kind !== "spacer").map(({ eventId }) => eventId).sort()).toEqual(["authored-rest", "half", "quarter"]);
    expect(projection.staves.treble.filter((item) => item.kind === "spacer").every((item) => !("eventId" in item))).toBe(true);
  });

  it("derives treble and bass voices independently without mutating source", () => {
    const events = [
      note("t-long", "treble", 0, { status: "final", duration: "whole" }), note("t-short", "treble", 480, { status: "final", duration: "quarter" }),
      note("b-long", "bass", 0, { status: "final", duration: "whole" }), note("b-short", "bass", 960, { status: "final", duration: "quarter" }),
    ];
    const current = score({ measures: [{ id: "m1", events }] });
    const before = structuredClone(current);
    const projection = projectStaffBuilderMeasure(current, 0);
    expect(projection.voices.treble).toHaveLength(2);
    expect(projection.voices.bass).toHaveLength(2);
    expect(current).toEqual(before);
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
    expect(projection.unavailableTies).toEqual([]);
    expect(projection.boundaryTies).toEqual([{ tieId: "crossing", eventId: "to", pitchIndex: 0, direction: "outgoing", description: "Tie continues to the adjacent measure." }]);
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

  it("defensively omits impossible starts and clips overflowing layout without changing the score", () => {
    const outside = note("outside", "treble", 2040, { status: "final", duration: "quarter" });
    const overflow = note("overflow", "bass", 1800, { status: "final", duration: "quarter" });
    const current = score({ measures: [{ id: "m1", events: [outside, overflow] }] });
    const before = JSON.stringify(current);
    const projection = projectStaffBuilderMeasure(current, 0);
    expect(projection.invalidEventIds).toEqual(["outside"]);
    expect(projection.staves.treble.some((item) => item.kind !== "spacer" && item.eventId === "outside")).toBe(false);
    expect(projection.staves.bass.find((item) => item.kind !== "spacer")).toMatchObject({ eventId: "overflow", layoutDurationTicks: 120 });
    expect(JSON.stringify(current)).toBe(before);
  });

  it("projects simultaneous treble and bass pending previews at the cursor with effective-key spelling", () => {
    const current = { ...score(), initialKeySignatureId: "g-major" as const };
    const before = JSON.stringify(current);
    const preview = projectStaffBuilderPendingPreview(current, 0, 240, { treble: [69, 66], bass: [54] });
    expect(preview.events.treble).toMatchObject({ staff: "treble", startTick: 240, rhythm: { status: "final", duration: "quarter" }, pitches: [
      { midiNumber: 66, letter: "F", accidental: "sharp" },
      { midiNumber: 69, letter: "A", accidental: "natural" },
    ] });
    expect(preview.events.bass).toMatchObject({ staff: "bass", startTick: 240, pitches: [{ midiNumber: 54, letter: "F", accidental: "sharp" }] });
    expect(projectStaffBuilderMeasure(preview.renderScore, 0).staves.treble.find((item) => item.kind !== "spacer")).toMatchObject({ startTick: 240, unresolved: false, visualDuration: { duration: "quarter" } });
    expect(JSON.stringify(current)).toBe(before);
  });

  it("uses deterministic preview IDs for equivalent inputs", () => {
    const current = score();
    const first = projectStaffBuilderPendingPreview(current, 0, 120, { treble: [64, 60], bass: [] });
    const second = projectStaffBuilderPendingPreview(current, 0, 120, { treble: [60, 64], bass: [] });
    expect(first.events.treble?.id).toBe(second.events.treble?.id);
    expect(first.events.treble?.kind === "notes" ? first.events.treble.pitches.map(({ id }) => id) : []).toEqual(
      second.events.treble?.kind === "notes" ? second.events.treble.pitches.map(({ id }) => id) : [],
    );
    expect(first.events.treble?.id).toContain(":0:treble:120:event");
  });

  it.each([
    ["quarter", 480],
    ["eighth", 240],
    ["sixteenth", 120],
  ] as const)("keeps pending musical duration at quarter while capping %s render layout to %i ticks", (stepDuration, layoutTicks) => {
    const current = score();
    const before = JSON.stringify(current);
    const preview = projectStaffBuilderPendingPreview(current, 0, 720, { treble: [60, 64], bass: [48, 52] }, stepDuration);
    expect(Object.values(preview.events).every((event) => event?.rhythm.status === "final" && event.rhythm.duration === "quarter")).toBe(true);
    expect([...preview.layoutDurationTicksByEventId.values()]).toEqual([layoutTicks, layoutTicks]);
    const projection = projectStaffBuilderMeasure(preview.renderScore, 0, { layoutDurationTicksByEventId: preview.layoutDurationTicksByEventId });
    expect([...projection.staves.treble, ...projection.staves.bass]
      .filter((item): item is Extract<typeof item, { kind: "notes" | "rest" }> => item.kind !== "spacer" && preview.previewEventIds.has(item.eventId))
      .map(({ layoutDurationTicks }) => layoutDurationTicks)).toEqual([layoutTicks, layoutTicks]);
    expect(JSON.stringify(current)).toBe(before);
  });

  it.each([1800, 1680])("clips a pending quarter preview at the final boundary from tick %i", (startTick) => {
    const preview = projectStaffBuilderPendingPreview(score(), 0, startTick, { treble: [60], bass: [] }, "quarter");
    const event = projectStaffBuilderMeasure(preview.renderScore, 0, { layoutDurationTicksByEventId: preview.layoutDurationTicksByEventId })
      .staves.treble.find((item) => item.kind !== "spacer");
    expect(event).toMatchObject({ startTick, layoutDurationTicks: 1920 - startTick, visualDuration: { duration: "quarter" } });
  });

  it("keeps deterministic preview identity and layout metadata while one pending staff changes", () => {
    const current = score();
    const first = projectStaffBuilderPendingPreview(current, 0, 360, { treble: [60], bass: [48, 52] }, "sixteenth");
    const second = projectStaffBuilderPendingPreview(current, 0, 360, { treble: [60, 64, 67], bass: [48, 52] }, "sixteenth");
    expect(second.events.bass?.id).toBe(first.events.bass?.id);
    expect(second.events.bass?.kind === "notes" ? second.events.bass.pitches : []).toEqual(first.events.bass?.kind === "notes" ? first.events.bass.pitches : []);
    expect([...second.layoutDurationTicksByEventId.values()]).toEqual([120, 120]);
    expect(second.previewEventIds).toEqual(new Set([second.events.treble?.id, second.events.bass?.id]));
  });

  it("projects a bass-only pending preview without adding a treble event", () => {
    const preview = projectStaffBuilderPendingPreview(score(), 0, 360, { treble: [], bass: [48] });
    expect(preview.events.treble).toBeNull();
    expect(preview.events.bass).toMatchObject({ staff: "bass", startTick: 360, pitches: [{ midiNumber: 48 }] });
    expect(preview.renderScore.measures[0]?.events).toHaveLength(1);
  });

  it("replaces a same-position committed event only in the render score and labels pending separately", () => {
    const committed = note("committed", "treble", 0, { status: "unresolved" }, [pitch("committed-pitch", "C", "natural", 4, 60)]);
    const current = score({ measures: [{ id: "m1", events: [committed] }] });
    const before = JSON.stringify(current);
    const preview = projectStaffBuilderPendingPreview(current, 0, 0, { treble: [67], bass: [] });
    expect(preview.renderScore.measures[0]?.events).toHaveLength(1);
    expect(preview.renderScore.measures[0]?.events[0]).toMatchObject({ id: expect.stringContaining("__staff-builder-preview"), pitches: [{ midiNumber: 67 }] });
    expect(preview.events.treble?.rhythm).toEqual({ status: "final", duration: "quarter" });
    expect(preview.summary.treble).toContain("Pending treble preview: note G4 at tick 0");
    expect(preview.summary.bass).toBe("Pending bass preview: none.");
    expect(JSON.stringify(current)).toBe(before);
    expect(current.measures[0]?.events[0]).toBe(committed);
  });
});
