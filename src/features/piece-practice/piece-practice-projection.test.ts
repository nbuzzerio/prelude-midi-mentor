import { describe, expect, it } from "vitest";
import { durationToTicks, getMeasureCapacityTicks, type StaffBuilderDuration, type StaffBuilderTimeSignature } from "@/features/staff-builder/staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScoreV1, StaffBuilderStaff, StaffBuilderTie } from "@/features/staff-builder/staff-builder-types";
import type { NoteLetter } from "@/lib/music/note-utils";
import { projectStaffBuilderPieceForPractice } from "./piece-practice-projection";

const NOW = "2026-08-10T12:00:00.000Z";
const DURATIONS_DESCENDING: readonly StaffBuilderDuration[] = [
  "whole", "dotted-half", "half", "dotted-quarter", "quarter", "dotted-eighth", "eighth", "sixteenth",
];

function pitch(id: string, midiNumber: number, letter: NoteLetter = "C", accidental: StaffBuilderPitch["accidental"] = "natural", octave = 4): StaffBuilderPitch {
  return { id, midiNumber, letter, accidental, octave };
}

function notes(id: string, staff: StaffBuilderStaff, startTick: number, duration: StaffBuilderDuration, pitches: readonly StaffBuilderPitch[]): StaffBuilderEvent {
  return { id, kind: "notes", staff, startTick, rhythm: { status: "final", duration }, pitches };
}

function rest(id: string, staff: StaffBuilderStaff, startTick: number, duration: StaffBuilderDuration): StaffBuilderEvent {
  return { id, kind: "rest", staff, startTick, rhythm: { status: "final", duration } };
}

function restsForGap(staff: StaffBuilderStaff, startTick: number, endTick: number, prefix: string): StaffBuilderEvent[] {
  const result: StaffBuilderEvent[] = [];
  let cursor = startTick;
  while (cursor < endTick) {
    const duration = DURATIONS_DESCENDING.find((candidate) => durationToTicks(candidate) <= endTick - cursor);
    if (!duration) throw new Error(`Cannot fill ${endTick - cursor} ticks.`);
    result.push(rest(`${prefix}-${cursor}`, staff, cursor, duration));
    cursor += durationToTicks(duration);
  }
  return result;
}

function completeMeasure(id: string, capacityTicks: number, authored: readonly StaffBuilderEvent[], timeSignatureChange?: StaffBuilderTimeSignature) {
  const events: StaffBuilderEvent[] = [...authored];
  for (const staff of ["treble", "bass"] as const) {
    const staffEvents = authored.filter((event) => event.staff === staff).sort((left, right) => left.startTick - right.startTick);
    let cursor = 0;
    staffEvents.forEach((event) => {
      events.push(...restsForGap(staff, cursor, event.startTick, `${id}-${staff}-gap`));
      if (event.rhythm.status === "final") cursor = event.startTick + durationToTicks(event.rhythm.duration);
    });
    events.push(...restsForGap(staff, cursor, capacityTicks, `${id}-${staff}-tail`));
  }
  return { id, ...(timeSignatureChange ? { timeSignatureChange } : {}), events };
}

function score(options: Readonly<{
  measures?: readonly ReturnType<typeof completeMeasure>[];
  events?: readonly StaffBuilderEvent[];
  timeSignature?: StaffBuilderTimeSignature;
  ties?: readonly StaffBuilderTie[];
}> = {}): StaffBuilderScoreV1 {
  const timeSignature = options.timeSignature ?? "4/4";
  return {
    schemaVersion: 1,
    id: "piece",
    title: "Projection study",
    createdAt: NOW,
    updatedAt: NOW,
    tempoBpm: 96,
    initialKeySignatureId: "c-major",
    initialTimeSignature: timeSignature,
    measures: options.measures ?? [completeMeasure("m1", getMeasureCapacityTicks(timeSignature), options.events ?? [])],
    ties: options.ties ?? [],
  };
}

function projected(source: StaffBuilderScoreV1) {
  const result = projectStaffBuilderPieceForPractice(source);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.issues.map(({ code }) => code).join(", "));
  return result.piece;
}

describe("Staff Builder piece-practice projection", () => {
  it("projects one note as one attack", () => {
    const piece = projected(score({ events: [notes("n1", "treble", 0, "whole", [pitch("p1", 60)])] }));
    expect(piece.measures[0]?.targets).toHaveLength(1);
    expect(piece.measures[0]?.targets[0]?.expectedMidiNumbers).toEqual([60]);
  });

  it("orders sequential notes by onset", () => {
    const piece = projected(score({ events: [
      notes("later", "treble", 480, "quarter", [pitch("p2", 62, "D")]),
      notes("first", "treble", 0, "quarter", [pitch("p1", 60)]),
    ] }));
    expect(piece.measures[0]?.targets.map(({ startTick }) => startTick)).toEqual([0, 480]);
  });

  it("projects a chord as one attack", () => {
    const piece = projected(score({ events: [notes("chord", "treble", 0, "whole", [pitch("g", 67, "G"), pitch("c", 60), pitch("e", 64, "E")])] }));
    expect(piece.measures[0]?.targets[0]?.expectedMidiNumbers).toEqual([60, 64, 67]);
    expect(piece.measures[0]?.targets[0]?.attackedPitches).toHaveLength(3);
  });

  it("groups same-onset treble and bass events", () => {
    const piece = projected(score({ events: [
      notes("treble", "treble", 0, "whole", [pitch("tp", 64, "E")]),
      notes("bass", "bass", 0, "whole", [pitch("bp", 48, "C", "natural", 3)]),
    ] }));
    expect(piece.measures[0]?.targets).toHaveLength(1);
    expect(piece.measures[0]?.targets[0]).toMatchObject({ expectedMidiNumbers: [48, 64], sourceEventIds: ["bass", "treble"] });
  });

  it("merges a treble chord and simultaneous bass note", () => {
    const piece = projected(score({ events: [
      notes("treble-chord", "treble", 0, "whole", [pitch("c", 60), pitch("e", 64, "E")]),
      notes("bass-note", "bass", 0, "whole", [pitch("bass-c", 36, "C", "natural", 2)]),
    ] }));
    expect(piece.measures[0]?.targets[0]?.expectedMidiNumbers).toEqual([36, 60, 64]);
  });

  it("preserves independent treble and bass rhythms", () => {
    const piece = projected(score({ events: [
      notes("t0", "treble", 0, "quarter", [pitch("t0p", 64, "E")]),
      notes("t480", "treble", 480, "quarter", [pitch("t480p", 65, "F")]),
      notes("b0", "bass", 0, "half", [pitch("b0p", 48, "C", "natural", 3)]),
    ] }));
    expect(piece.measures[0]?.targets.map(({ startTick, expectedMidiNumbers }) => [startTick, expectedMidiNumbers])).toEqual([
      [0, [48, 64]],
      [480, [65]],
    ]);
  });

  it("does not re-require a sustained pitch at a later onset", () => {
    const piece = projected(score({ events: [
      notes("bass-long", "bass", 0, "half", [pitch("bass", 48, "C", "natural", 3)]),
      notes("treble-1", "treble", 0, "quarter", [pitch("e", 64, "E")]),
      notes("treble-2", "treble", 480, "quarter", [pitch("f", 65, "F")]),
    ] }));
    expect(piece.measures[0]?.targets[1]?.expectedMidiNumbers).toEqual([65]);
  });

  it("deduplicates identical sounding cross-staff pitches while retaining both sources", () => {
    const piece = projected(score({ events: [
      notes("treble-c", "treble", 0, "whole", [pitch("treble-p", 60)]),
      notes("bass-c", "bass", 0, "whole", [pitch("bass-p", 60)]),
    ] }));
    const target = piece.measures[0]?.targets[0];
    expect(target?.expectedMidiNumbers).toEqual([60]);
    expect(target?.sourceEventIds).toEqual(["bass-c", "treble-c"]);
    expect(target?.attackedPitches.map(({ sourcePitchId }) => sourcePitchId)).toEqual(["treble-p", "bass-p"]);
  });

  it("retains written enharmonic spelling independently from sounding-pitch deduplication", () => {
    const piece = projected(score({ events: [
      notes("sharp", "treble", 0, "whole", [pitch("sharp-p", 61, "C", "sharp")]),
      notes("flat", "bass", 0, "whole", [pitch("flat-p", 61, "D", "flat")]),
    ] }));
    expect(piece.measures[0]?.targets[0]?.expectedMidiNumbers).toEqual([61]);
    expect(piece.measures[0]?.targets[0]?.attackedPitches.map(({ letter, accidental }) => `${letter}:${accidental}`)).toEqual(["C:sharp", "D:flat"]);
  });

  it("retains rests as source events without creating answer targets", () => {
    const piece = projected(score());
    const measure = piece.measures[0];
    expect(measure?.targets).toEqual([]);
    expect(measure?.sourceEvents.every(({ kind }) => kind === "rest")).toBe(true);
    expect(measure?.restEventIds).toHaveLength(2);
  });

  it("projects an explicitly authored rest-only measure successfully", () => {
    const source = score({ events: [rest("treble-rest", "treble", 0, "whole"), rest("bass-rest", "bass", 0, "whole")] });
    const measure = projected(source).measures[0];
    expect(measure?.targets).toEqual([]);
    expect(measure?.restEventIds).toEqual(["bass-rest", "treble-rest"]);
  });

  it.each([
    "quarter", "eighth", "sixteenth", "dotted-eighth", "dotted-quarter", "half", "whole",
  ] as const)("preserves %s duration metadata and exact tick length", (duration) => {
    const source = score({ events: [notes("event", "treble", 0, duration, [pitch("p", 60)])] });
    const sourceEvent = projected(source).measures[0]?.sourceEvents.find(({ sourceEventId }) => sourceEventId === "event");
    const attackedPitch = projected(source).measures[0]?.targets[0]?.attackedPitches[0];
    expect(sourceEvent).toMatchObject({ duration, durationTicks: durationToTicks(duration) });
    expect(attackedPitch).toMatchObject({ duration, durationTicks: durationToTicks(duration) });
  });

  it("does not change onset grouping when a duration changes without changing onset", () => {
    const quarter = projected(score({ events: [notes("event", "treble", 0, "quarter", [pitch("p", 60)])] }));
    const half = projected(score({ events: [notes("event", "treble", 0, "half", [pitch("p", 60)])] }));
    expect(quarter.measures[0]?.targets.map(({ startTick, expectedMidiNumbers }) => ({ startTick, expectedMidiNumbers })))
      .toEqual(half.measures[0]?.targets.map(({ startTick, expectedMidiNumbers }) => ({ startTick, expectedMidiNumbers })));
  });

  it("retains a valid cross-measure tie on both pitch endpoints", () => {
    const tie: StaffBuilderTie = { id: "tie", fromEventId: "source", fromPitchId: "source-p", toEventId: "destination", toPitchId: "destination-p" };
    const source = score({
      measures: [
        completeMeasure("m1", 1920, [notes("source", "treble", 0, "whole", [pitch("source-p", 60)])]),
        completeMeasure("m2", 1920, [notes("destination", "treble", 0, "whole", [pitch("destination-p", 60)])]),
      ],
      ties: [tie],
    });
    const piece = projected(source);
    const sourcePitch = (piece.measures[0]?.sourceEvents.find(({ sourceEventId }) => sourceEventId === "source") as Extract<(typeof piece.measures)[number]["sourceEvents"][number], { kind: "notes" }>).pitches[0];
    const destinationPitch = (piece.measures[1]?.sourceEvents.find(({ sourceEventId }) => sourceEventId === "destination") as Extract<(typeof piece.measures)[number]["sourceEvents"][number], { kind: "notes" }>).pitches[0];
    expect(sourcePitch).toMatchObject({ outgoingTieIds: ["tie"], requiresAttack: true });
    expect(destinationPitch).toMatchObject({ incomingTieIds: ["tie"], requiresAttack: false });
  });

  it("excludes a fully tied destination event from attack targets", () => {
    const source = tiedScore([
      pitch("destination-p", 60),
    ], [{ id: "tie", fromPitchId: "source-p", toPitchId: "destination-p" }]);
    expect(projected(source).measures[1]?.targets).toEqual([]);
  });

  it("requires only newly attacked pitches in a partially tied destination chord", () => {
    const source = tiedScore([
      pitch("destination-p", 60), pitch("e", 64, "E"), pitch("g", 67, "G"),
    ], [{ id: "tie", fromPitchId: "source-p", toPitchId: "destination-p" }]);
    const target = projected(source).measures[1]?.targets[0];
    expect(target?.expectedMidiNumbers).toEqual([64, 67]);
    expect(target?.attackedPitches.map(({ sourcePitchId }) => sourcePitchId)).toEqual(["e", "g"]);
  });

  it("keeps the outgoing tie source pitch as a required attack", () => {
    const piece = projected(tiedScore([pitch("destination-p", 60)], [{ id: "tie", fromPitchId: "source-p", toPitchId: "destination-p" }]));
    expect(piece.measures[0]?.targets[0]?.expectedMidiNumbers).toEqual([60]);
    expect(piece.measures[0]?.targets[0]?.attackedPitches[0]?.outgoingTieIds).toEqual(["tie"]);
  });

  it("rejects a same-measure tie through existing Staff Builder validation", () => {
    const source = score({
      events: [
        notes("from", "treble", 0, "quarter", [pitch("from-p", 60)]),
        notes("to", "treble", 480, "quarter", [pitch("to-p", 60)]),
      ],
      ties: [{ id: "invalid", fromEventId: "from", fromPitchId: "from-p", toEventId: "to", toPitchId: "to-p" }],
    });
    const result = projectStaffBuilderPieceForPractice(source);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map(({ code }) => code)).toContain("tie-not-cross-measure");
  });

  it("rejects unresolved, same-position-conflicting, and overflowing source material through Staff Builder validation", () => {
    const invalid = score();
    const unresolved: StaffBuilderEvent = { id: "bad", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "unresolved" }, pitches: [pitch("bad-p", 60)] };
    const source = { ...invalid, measures: [{ id: "m1", events: [unresolved, notes("conflict-a", "treble", 480, "quarter", [pitch("conflict-a-p", 62, "D")]), notes("conflict-b", "treble", 480, "quarter", [pitch("conflict-b-p", 64, "E")]), notes("overflow", "bass", 1800, "quarter", [pitch("overflow-p", 48, "C", "natural", 3)])] }] };
    const result = projectStaffBuilderPieceForPractice(source);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.map(({ code }) => code)).toEqual(expect.arrayContaining(["unresolved-rhythm", "same-position-conflict", "event-overflow"]));
  });

  it("projects same-staff polyphonic attacks without re-requiring a sustained pitch", () => {
    const source = score({ timeSignature: "6/8", measures: [{ id: "m1", events: [
      notes("sustain", "treble", 0, "dotted-quarter", [pitch("e", 64, "E")]),
      notes("c", "treble", 480, "eighth", [pitch("c-p", 60)]),
      notes("d", "treble", 720, "eighth", [pitch("d-p", 62, "D")]),
      rest("tail", "treble", 960, "quarter"),
      rest("bass", "bass", 0, "dotted-half"),
    ] }] });
    expect(projected(source).measures[0]?.targets.map(({ startTick, expectedMidiNumbers }) => ({ startTick, expectedMidiNumbers }))).toEqual([
      { startTick: 0, expectedMidiNumbers: [64] },
      { startTick: 480, expectedMidiNumbers: [60] },
      { startTick: 720, expectedMidiNumbers: [62] },
    ]);
  });

  it("uses deterministic measure, target, source-event, and absolute-tick ordering", () => {
    const source = score({ measures: [
      completeMeasure("m1", 1920, [notes("z", "bass", 480, "quarter", [pitch("zp", 48, "C", "natural", 3)]), notes("a", "treble", 0, "quarter", [pitch("ap", 60)])]),
      completeMeasure("m2", 1920, [notes("second", "treble", 240, "eighth", [pitch("second-p", 62, "D")])]),
    ] });
    const piece = projected(source);
    expect(piece.measures.map(({ sourceMeasureId }) => sourceMeasureId)).toEqual(["m1", "m2"]);
    expect(piece.measures[0]?.targets.map(({ startTick }) => startTick)).toEqual([0, 480]);
    expect(piece.measures[1]?.targets[0]).toMatchObject({ startTick: 240, absoluteStartTick: 2160 });
    expect(piece.measures[0]?.sourceEvents.map(({ startTick, staff }) => `${startTick}:${staff}`)).toEqual([
      "0:treble", "0:bass", "480:treble", "480:bass", "960:bass",
    ]);
  });

  it.each(["2/4", "3/4", "4/4", "6/8"] as const)("preserves %s measure capacity and context", (timeSignature) => {
    const piece = projected(score({ timeSignature }));
    expect(piece.measures[0]).toMatchObject({ capacityTicks: getMeasureCapacityTicks(timeSignature), timeSignature });
  });

  it("does not mutate the source score", () => {
    const source = tiedScore([pitch("destination-p", 60), pitch("e", 64, "E")], [{ id: "tie", fromPitchId: "source-p", toPitchId: "destination-p" }]);
    const before = structuredClone(source);
    projectStaffBuilderPieceForPractice(source);
    expect(source).toEqual(before);
  });

  it("produces equivalent output on repeated projection", () => {
    const source = tiedScore([pitch("destination-p", 60), pitch("e", 64, "E")], [{ id: "tie", fromPitchId: "source-p", toPitchId: "destination-p" }]);
    expect(projectStaffBuilderPieceForPractice(source)).toEqual(projectStaffBuilderPieceForPractice(source));
  });
});

function tiedScore(destinationPitches: readonly StaffBuilderPitch[], ties: readonly Readonly<{ id: string; fromPitchId: string; toPitchId: string }>[]): StaffBuilderScoreV1 {
  return score({
    measures: [
      completeMeasure("m1", 1920, [notes("source", "treble", 0, "whole", [pitch("source-p", 60)])]),
      completeMeasure("m2", 1920, [notes("destination", "treble", 0, "whole", destinationPitches)]),
    ],
    ties: ties.map((tie) => ({ ...tie, fromEventId: "source", toEventId: "destination" })),
  });
}
