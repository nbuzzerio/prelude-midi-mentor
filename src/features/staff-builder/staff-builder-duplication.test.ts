import { describe, expect, it } from "vitest";
import type { StaffBuilderScore } from "./staff-builder-types";
import { duplicateStaffBuilderScore } from "./staff-builder-duplication";

const source: StaffBuilderScore = {
  schemaVersion: 2,
  id: "source",
  title: "Study",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  tempoBpm: 92,
  initialKeySignatureId: "c-major",
  initialTimeSignature: "4/4",
  measures: [
    {
      id: "measure-1",
      events: [
        { id: "mixed", kind: "notes", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [
          { id: "p59", midiNumber: 59, letter: "B", accidental: "natural", octave: 3 },
          { id: "p60", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 },
          { id: "p61", midiNumber: 61, letter: "C", accidental: "sharp", octave: 4 },
        ] },
        { id: "treble-rest", kind: "rest", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" } },
      ],
    },
    {
      id: "measure-2",
      keySignatureChange: "g-major",
      timeSignatureChange: "3/4",
      events: [
        { id: "high", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "dotted-half" }, pitches: [
          { id: "high-pitch", midiNumber: 72, letter: "C", accidental: "natural", octave: 5 },
        ] },
        { id: "bass-rest", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "dotted-half" } },
      ],
    },
  ],
  ties: [
    { id: "retained-tie", fromEventId: "mixed", fromPitchId: "p60", toEventId: "high", toPitchId: "high-pitch" },
    { id: "filtered-tie", fromEventId: "mixed", fromPitchId: "p59", toEventId: "high", toPitchId: "high-pitch" },
  ],
  annotations: [
    { id: "measure-note", kind: "study-note", anchor: { kind: "measure", measureId: "measure-2" }, text: "Context" },
    { id: "mixed-note", kind: "bookmark", anchor: { kind: "event", eventId: "mixed" }, category: "revisit" },
    { id: "high-note", kind: "practice-mark", anchor: { kind: "event", eventId: "high" }, category: "needs-work" },
  ],
};

function factories() {
  let id = 0;
  return { createId: () => `copy-${++id}`, now: () => "2026-08-27T12:00:00.000Z" };
}

function musicalMeasures(score: StaffBuilderScore) {
  return score.measures.map((measure) => ({
    keySignatureChange: measure.keySignatureChange,
    timeSignatureChange: measure.timeSignatureChange,
    events: measure.events.map((event) => event.kind === "rest" ? {
      kind: event.kind, staff: event.staff, startTick: event.startTick, rhythm: event.rhythm,
    } : {
      kind: event.kind, staff: event.staff, startTick: event.startTick, rhythm: event.rhythm,
      pitches: event.pitches.map(({ midiNumber, letter, accidental, octave }) => ({ midiNumber, letter, accidental, octave })),
    }),
  }));
}

describe("duplicateStaffBuilderScore", () => {
  it("creates a fully independent musical copy and remaps every reference", () => {
    const before = structuredClone(source);
    const copy = duplicateStaffBuilderScore(source, "full", factories());

    expect(source).toEqual(before);
    expect(copy).toMatchObject({ title: "Study — Copy", createdAt: "2026-08-27T12:00:00.000Z", updatedAt: "2026-08-27T12:00:00.000Z", tempoBpm: 92, initialKeySignatureId: "c-major", initialTimeSignature: "4/4" });
    expect(copy.id).not.toBe(source.id);
    expect(copy.measures.map(({ id }) => id)).not.toEqual(source.measures.map(({ id }) => id));
    expect(copy.measures.flatMap(({ events }) => events.map(({ id }) => id))).not.toEqual(source.measures.flatMap(({ events }) => events.map(({ id }) => id)));
    expect(copy.measures.flatMap(({ events }) => events.flatMap((event) => event.kind === "notes" ? event.pitches.map(({ id }) => id) : [])))
      .not.toEqual(source.measures.flatMap(({ events }) => events.flatMap((event) => event.kind === "notes" ? event.pitches.map(({ id }) => id) : [])));
    expect(musicalMeasures(copy)).toEqual(musicalMeasures(source));
    expect(copy.ties).toHaveLength(2);
    expect(copy.annotations).toHaveLength(3);
    const allIds = [copy.id, ...copy.measures.map(({ id }) => id), ...copy.measures.flatMap(({ events }) => events.flatMap((event) => [event.id, ...(event.kind === "notes" ? event.pitches.map(({ id }) => id) : [])])), ...copy.ties.map(({ id }) => id), ...copy.annotations.map(({ id }) => id)];
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it("extracts Middle C and above onto treble while preserving structure and valid references", () => {
    const copy = duplicateStaffBuilderScore(source, "treble", factories());
    const noteEvents = copy.measures.flatMap(({ events }) => events.filter((event) => event.kind === "notes"));

    expect(copy.title).toBe("Study — Treble Copy");
    expect(noteEvents.every(({ staff }) => staff === "treble")).toBe(true);
    expect(noteEvents.map((event) => event.pitches.map(({ midiNumber }) => midiNumber))).toEqual([[60, 61], [72]]);
    expect(copy.measures[0]?.events.some(({ kind, staff }) => kind === "rest" && staff === "treble")).toBe(true);
    expect(copy.measures[1]?.events.some(({ kind }) => kind === "rest")).toBe(false);
    expect(copy.ties).toHaveLength(1);
    expect(copy.annotations).toHaveLength(3);
    expect(copy.measures).toHaveLength(2);
    expect(copy.measures[1]).toMatchObject({ keySignatureChange: "g-major", timeSignatureChange: "3/4" });
  });

  it("extracts below Middle C onto bass and removes empty events and their references", () => {
    const copy = duplicateStaffBuilderScore(source, "bass", factories());
    const noteEvents = copy.measures.flatMap(({ events }) => events.filter((event) => event.kind === "notes"));

    expect(copy.title).toBe("Study — Bass Copy");
    expect(noteEvents).toHaveLength(1);
    expect(noteEvents[0]).toMatchObject({ staff: "bass", pitches: [{ midiNumber: 59 }] });
    expect(copy.measures[0]?.events.some(({ kind }) => kind === "rest")).toBe(false);
    expect(copy.measures[1]?.events).toHaveLength(1);
    expect(copy.measures[1]?.events[0]).toMatchObject({ kind: "rest", staff: "bass" });
    expect(copy.ties).toEqual([]);
    expect(copy.annotations).toHaveLength(2);
    expect(copy.annotations.some((annotation) => annotation.anchor.kind === "event" && annotation.kind === "practice-mark")).toBe(false);
  });
});
