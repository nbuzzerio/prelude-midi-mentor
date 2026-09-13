import { describe, expect, it } from "vitest";
import type { StaffBuilderDuration } from "../staff-builder-time";
import type { StaffBuilderAccidental, StaffBuilderEvent, StaffBuilderMeasure, StaffBuilderNoteEvent, StaffBuilderScore } from "../staff-builder-types";
import {
  estimateStaffBuilderMeasureLayout,
  layoutStaffBuilderScoreSystems,
  translateStaffBuilderMeasureBoundsToSystem,
  translateStaffBuilderMeasurePointToSystem,
  translateStaffBuilderSystemBoundsToDocument,
  translateStaffBuilderSystemPointToDocument,
  type StaffBuilderSystemLayoutConstraints,
} from "./staff-builder-system-layout";

const constraints: StaffBuilderSystemLayoutConstraints = {
  contentWidth: 900,
  minimumMeasureWidth: 140,
  maximumMeasureWidth: 360,
  baseMusicHeight: 220,
  systemGap: 32,
};

function note(id: string, startTick: number, duration: StaffBuilderDuration = "quarter", pitches = 1, accidental: StaffBuilderAccidental = "natural", staff: "treble" | "bass" = "treble"): StaffBuilderNoteEvent {
  return {
    id, kind: "notes", staff, startTick, rhythm: { status: "final", duration },
    pitches: Array.from({ length: pitches }, (_value, index) => ({ id: `${id}-p${index}`, midiNumber: 60 + index * 4, letter: index === 0 ? "C" : "E", accidental, octave: 4 })),
  };
}

function measure(id: string, events: readonly StaffBuilderEvent[] = []): StaffBuilderMeasure {
  return { id, events };
}

function score(measures: readonly StaffBuilderMeasure[]): StaffBuilderScore {
  return {
    schemaVersion: 3, annotations: [], id: "score", title: "Layout", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], measures,
  };
}

describe("Staff Builder system layout", () => {
  it("lays out selected original measure indexes and separates disconnected runs", () => {
    const current = score(Array.from({ length: 8 }, (_value, index) => measure(`m${index + 1}`)));
    const layout = layoutStaffBuilderScoreSystems(current, constraints, [1, 2, 5, 6]);
    expect(layout.systems.flatMap(({ measures }) => measures.map(({ measureIndex }) => measureIndex))).toEqual([1, 2, 5, 6]);
    expect(layout.systems).toHaveLength(2);
    expect(layout.systems[1]?.measures[0]).toMatchObject({ measureId: "m6", measureIndex: 5, x: 0 });
  });
  it("uses the optional per-system maximum as a packing target without changing default packing", () => {
    const current = score(Array.from({ length: 10 }, (_value, index) => measure(`m${index + 1}`)));
    const printable = { ...constraints, contentWidth: 720, minimumMeasureWidth: 105, maximumMeasureWidth: 340 };
    expect(layoutStaffBuilderScoreSystems(current, { ...printable, maximumMeasuresPerSystem: 4 }, current.measures.slice(0, 8).map((_measure, index) => index)).systems.map(({ measures }) => measures.length)).toEqual([4, 4]);
    expect(layoutStaffBuilderScoreSystems(current, { ...printable, maximumMeasuresPerSystem: 5 }).systems.map(({ measures }) => measures.length)).toEqual([5, 5]);
    expect(layoutStaffBuilderScoreSystems(current, printable)).toEqual(layoutStaffBuilderScoreSystems(current, { ...printable, maximumMeasuresPerSystem: undefined }));
  });

  it("fits intended print groups proportionally into the full content width", () => {
    const fittedSystemComposition = { targetMeasureCount: 4 as const, minimumRhythmicWidth: 96, minimumCompressionRatio: 0.65, partialMaximumMeasureWidth: 340 };
    const ordinary = score(Array.from({ length: 12 }, (_value, index) => measure(`m${index + 1}`)));
    const fittedConstraints = { ...constraints, contentWidth: 720, minimumMeasureWidth: 105, maximumMeasureWidth: 340, fittedSystemComposition };
    const eight = layoutStaffBuilderScoreSystems(ordinary, fittedConstraints, Array.from({ length: 8 }, (_value, index) => index));
    const twelve = layoutStaffBuilderScoreSystems(ordinary, fittedConstraints);
    expect(eight.systems.map(({ measures }) => measures.length)).toEqual([4, 4]);
    expect(twelve.systems.map(({ measures }) => measures.length)).toEqual([4, 4, 4]);
    for (const system of twelve.systems) {
      expect(system.measures.reduce((sum, placement) => sum + placement.width, 0)).toBeCloseTo(720, 8);
      expect(system.width).toBeLessThanOrEqual(720);
    }
  });

  it("weights fitted widths by complexity and deterministically falls back below the readability floor", () => {
    const dense = (id: string) => measure(id, [note(`${id}-1`, 0, "sixteenth", 4, "sharp"), note(`${id}-2`, 120, "sixteenth", 4, "flat"), note(`${id}-3`, 240, "sixteenth", 4), note(`${id}-4`, 360, "sixteenth", 4)]);
    const mixed = score([measure("ordinary"), dense("dense")]);
    const two = layoutStaffBuilderScoreSystems(mixed, { ...constraints, contentWidth: 720, minimumMeasureWidth: 105, maximumMeasureWidth: 340, fittedSystemComposition: { targetMeasureCount: 2, minimumRhythmicWidth: 96, minimumCompressionRatio: 0.65, partialMaximumMeasureWidth: 340 } });
    expect(two.systems[0]?.measures[1]?.width).toBeGreaterThan(two.systems[0]?.measures[0]?.width ?? 0);
    expect(two.systems[0]?.width).toBeCloseTo(720, 8);
    const denseScore = score(Array.from({ length: 8 }, (_value, index) => dense(`m${index + 1}`)));
    const fitted = { ...constraints, contentWidth: 450, minimumMeasureWidth: 105, maximumMeasureWidth: 340, fittedSystemComposition: { targetMeasureCount: 4 as const, minimumRhythmicWidth: 96, minimumCompressionRatio: 0.65, partialMaximumMeasureWidth: 340 } };
    const first = layoutStaffBuilderScoreSystems(denseScore, fitted);
    const second = layoutStaffBuilderScoreSystems(denseScore, fitted);
    expect(first.systems.map(({ measures }) => measures.length)).toEqual([2, 2, 2, 2]);
    expect(second).toEqual(first);
  });

  it("fits five ordinary measures but leaves a single partial final measure conventionally narrow", () => {
    const current = score(Array.from({ length: 11 }, (_value, index) => measure(`m${index + 1}`)));
    const layout = layoutStaffBuilderScoreSystems(current, { ...constraints, contentWidth: 720, minimumMeasureWidth: 105, maximumMeasureWidth: 340, fittedSystemComposition: { targetMeasureCount: 5, minimumRhythmicWidth: 96, minimumCompressionRatio: 0.65, partialMaximumMeasureWidth: 340 } });
    expect(layout.systems.map(({ measures }) => measures.length)).toEqual([5, 5, 1]);
    expect(layout.systems[0]?.width).toBeCloseTo(720, 8);
    expect(layout.systems[1]?.width).toBeCloseTo(720, 8);
    expect(layout.systems[2]?.width).toBe(340);
  });

  it("starts disconnected runs on new systems before the configured maximum is full", () => {
    const current = score(Array.from({ length: 10 }, (_value, index) => measure(`m${index + 1}`)));
    const layout = layoutStaffBuilderScoreSystems(current, { ...constraints, maximumMeasuresPerSystem: 5 }, [0, 1, 5, 6]);
    expect(layout.systems.map(({ measures }) => measures.map(({ measureIndex }) => measureIndex))).toEqual([[0, 1], [5, 6]]);
  });

  it("breaks dense measures before the configured maximum and never overflows the content width", () => {
    const dense = (id: string) => measure(id, [note(`${id}-1`, 0, "sixteenth", 4, "sharp"), note(`${id}-2`, 120, "sixteenth", 4, "flat"), note(`${id}-3`, 240, "sixteenth", 4), note(`${id}-4`, 360, "sixteenth", 4)]);
    const current = score(Array.from({ length: 5 }, (_value, index) => dense(`m${index + 1}`)));
    const layout = layoutStaffBuilderScoreSystems(current, { ...constraints, contentWidth: 500, maximumMeasuresPerSystem: 5 });
    expect(layout.systems.length).toBeGreaterThan(1);
    expect(layout.systems.every(({ measures, width }) => measures.length <= 5 && width <= 500)).toBe(true);
  });
  it("places one measure in one system with stable identity and positive geometry", () => {
    const layout = layoutStaffBuilderScoreSystems(score([measure("m1")]), constraints);
    expect(layout.systems).toHaveLength(1);
    expect(layout.systems[0]?.measures).toEqual([expect.objectContaining({ measureId: "m1", measureIndex: 0, x: 0, width: expect.any(Number) })]);
    expect(layout.systems[0]?.measures[0]?.width).toBeGreaterThan(0);
  });

  it("packs simple measures, breaks on overflow, preserves order exactly once, and supports a final partial system", () => {
    const current = score(Array.from({ length: 7 }, (_value, index) => measure(`m${index + 1}`)));
    const layout = layoutStaffBuilderScoreSystems(current, { ...constraints, contentWidth: 650, maximumMeasureWidth: 220 });
    const placements = layout.systems.flatMap(({ measures }) => measures);
    expect(layout.systems.length).toBeGreaterThan(1);
    expect(placements.map(({ measureId }) => measureId)).toEqual(current.measures.map(({ id }) => id));
    expect(placements.map(({ measureIndex }) => measureIndex)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(new Set(placements.map(({ measureId }) => measureId))).toHaveProperty("size", 7);
    expect(layout.systems.at(-1)?.measures.length).toBeLessThan(layout.systems[0]?.measures.length ?? 0);
    expect(layout.systems.every(({ width }) => width <= 650)).toBe(true);
    expect(layoutStaffBuilderScoreSystems(current, { ...constraints, contentWidth: 650, maximumMeasureWidth: 220 })).toEqual(layout);
  });

  it("re-packs predictably at narrower widths without collapsing below the readable minimum", () => {
    const current = score(Array.from({ length: 6 }, (_value, index) => measure(`m${index}`)));
    const wide = layoutStaffBuilderScoreSystems(current, { ...constraints, contentWidth: 900 });
    const narrow = layoutStaffBuilderScoreSystems(current, { ...constraints, contentWidth: 380 });
    expect(narrow.systems.length).toBeGreaterThan(wide.systems.length);
    expect(narrow.systems.flatMap(({ measures }) => measures).every(({ width }) => width >= constraints.minimumMeasureWidth)).toBe(true);
  });

  it("allows readable horizontal overflow when requested content is narrower than one measure", () => {
    const narrow = layoutStaffBuilderScoreSystems(score([measure("m1")]), { ...constraints, contentWidth: 80 });
    expect(narrow.systems).toHaveLength(1);
    expect(narrow.systems[0]?.width).toBeGreaterThanOrEqual(constraints.minimumMeasureWidth);
    expect(narrow.width).toBe(narrow.systems[0]?.width);
  });

  it("gives rhythmic density and subdivision independent influence instead of counting pitches as attacks", () => {
    const chord = measure("chord", [note("chord-event", 0, "quarter", 4)]);
    const attacks = measure("attacks", [note("a", 0), note("b", 480), note("c", 960), note("d", 1440)]);
    const quarters = measure("quarters", [note("q1", 0), note("q2", 480)]);
    const sixteenths = measure("sixteenths", [note("s1", 0, "sixteenth"), note("s2", 120, "sixteenth")]);
    const current = score([chord, attacks, quarters, sixteenths]);
    const chordEstimate = estimateStaffBuilderMeasureLayout(current, 0, constraints);
    const attacksEstimate = estimateStaffBuilderMeasureLayout(current, 1, constraints);
    const quarterEstimate = estimateStaffBuilderMeasureLayout(current, 2, constraints);
    const sixteenthEstimate = estimateStaffBuilderMeasureLayout(current, 3, constraints);
    expect(chordEstimate.rhythmicOnsetCount).toBe(1);
    expect(attacksEstimate.rhythmicOnsetCount).toBe(4);
    expect(attacksEstimate.requestedWidth).toBeGreaterThan(chordEstimate.requestedWidth);
    expect(sixteenthEstimate.subdivisionComplexity).toBeGreaterThan(quarterEstimate.subdivisionComplexity);
    expect(sixteenthEstimate.requestedWidth).toBeGreaterThan(quarterEstimate.requestedWidth);
  });

  it("accounts separately for chord, written accidental, simultaneous-event, and polyphony burdens", () => {
    const sparse = measure("sparse", [note("plain", 0)]);
    const chord = measure("chord", [note("chord-note", 0, "quarter", 4)]);
    const accidental = measure("accidental", [note("sharp-note", 0, "quarter", 1, "sharp")]);
    const simultaneous = measure("simultaneous", [note("treble", 0), note("bass", 0, "quarter", 1, "natural", "bass")]);
    const overlapping = measure("overlap", [note("long", 0, "half"), note("later", 480, "quarter")]);
    const current = score([sparse, chord, accidental, simultaneous, overlapping]);
    const estimates = current.measures.map((_item, index) => estimateStaffBuilderMeasureLayout(current, index, constraints));
    expect(estimates[1]?.chordBurden).toBeGreaterThan(estimates[0]?.chordBurden ?? 0);
    expect(estimates[1]?.requestedWidth).toBeGreaterThan(estimates[0]?.requestedWidth ?? 0);
    expect(estimates[2]?.accidentalBurden).toBe(1);
    expect(estimates[2]?.requestedWidth).toBeGreaterThan(estimates[0]?.requestedWidth ?? 0);
    expect(estimates[3]?.simultaneousEventBurden).toBe(1);
    expect(estimates[4]?.polyphonyBurden).toBe(1);
  });

  it("estimates written accidental glyphs relative to C, G, and F major key signatures", () => {
    const pitchMeasure = (id: string, letter: "C" | "F" | "B", accidental: "natural" | "sharp" | "flat") => measure(id, [{
      ...note(`${id}-note`, 0, "quarter", 1, accidental),
      pitches: [{ id: `${id}-pitch`, midiNumber: letter === "C" ? 60 : letter === "F" ? 65 : 71, letter, accidental, octave: 4 }],
    }]);
    const cMajor = score([pitchMeasure("c-natural", "C", "natural"), pitchMeasure("f-sharp", "F", "sharp"), pitchMeasure("b-flat", "B", "flat")]);
    expect(estimateStaffBuilderMeasureLayout(cMajor, 0, constraints).accidentalBurden).toBe(0);
    expect(estimateStaffBuilderMeasureLayout(cMajor, 1, constraints).accidentalBurden).toBe(1);
    expect(estimateStaffBuilderMeasureLayout(cMajor, 2, constraints).accidentalBurden).toBe(1);

    const gMajor = { ...score([pitchMeasure("f-sharp", "F", "sharp"), pitchMeasure("f-natural", "F", "natural")]), initialKeySignatureId: "g-major" as const };
    expect(estimateStaffBuilderMeasureLayout(gMajor, 0, constraints).accidentalBurden).toBe(0);
    expect(estimateStaffBuilderMeasureLayout(gMajor, 1, constraints).accidentalBurden).toBe(1);

    const fMajor = { ...score([pitchMeasure("b-flat", "B", "flat"), pitchMeasure("b-natural", "B", "natural")]), initialKeySignatureId: "f-major" as const };
    expect(estimateStaffBuilderMeasureLayout(fMajor, 0, constraints).accidentalBurden).toBe(0);
    expect(estimateStaffBuilderMeasureLayout(fMajor, 1, constraints).accidentalBurden).toBe(1);
  });

  it("tracks accidental state within each staff and octave and resets it at the barline", () => {
    const fNatural = (id: string, startTick: number, octave = 4): StaffBuilderEvent => ({
      ...note(id, startTick),
      pitches: [{ id: `${id}-pitch`, midiNumber: 65 + (octave - 4) * 12, letter: "F", accidental: "natural", octave }],
    });
    const current = { ...score([
      measure("first", [fNatural("first-natural", 0), fNatural("repeat-natural", 480), fNatural("other-octave", 960, 5)]),
      measure("second", [fNatural("new-bar-natural", 0)]),
    ]), initialKeySignatureId: "g-major" as const };
    expect(estimateStaffBuilderMeasureLayout(current, 0, constraints).accidentalBurden).toBe(2);
    expect(estimateStaffBuilderMeasureLayout(current, 1, constraints).accidentalBurden).toBe(1);
  });

  it("models system-start overhead and internal signature-change overhead deliberately", () => {
    const current = score([measure("plain"), { ...measure("changed"), keySignatureChange: "g-major", timeSignatureChange: "3/4" }]);
    const internal = estimateStaffBuilderMeasureLayout(current, 1, constraints, false);
    const start = estimateStaffBuilderMeasureLayout(current, 1, constraints, true);
    expect(internal.signatureChangeOverhead).toBeGreaterThan(0);
    expect(internal.systemStartOverhead).toBe(0);
    expect(start.signatureChangeOverhead).toBe(0);
    expect(start.systemStartOverhead).toBeGreaterThan(internal.signatureChangeOverhead);
    expect(start.requestedWidth).toBeGreaterThan(internal.requestedWidth);
  });

  it("recomputes a moved measure with system-start overhead and remains deterministic", () => {
    const current = score([measure("dense", [note("a", 0), note("b", 240, "eighth"), note("c", 480), note("d", 720)]), measure("next")]);
    const internal = estimateStaffBuilderMeasureLayout(current, 1, constraints, false);
    const asStart = estimateStaffBuilderMeasureLayout(current, 1, constraints, true);
    const contentWidth = estimateStaffBuilderMeasureLayout(current, 0, constraints, true).requestedWidth + internal.requestedWidth - 1;
    const layout = layoutStaffBuilderScoreSystems(current, { ...constraints, contentWidth });
    expect(layout.systems).toHaveLength(2);
    expect(asStart.requestedWidth).toBeGreaterThan(internal.requestedWidth);
    expect(layout.systems[1]?.measures[0]?.width).toBeGreaterThanOrEqual(asStart.requestedWidth);
    expect(layout.systems[1]?.width).toBeLessThanOrEqual(contentWidth);
  });

  it("distributes spare width by complexity while respecting configured maxima", () => {
    const current = score([measure("sparse"), measure("dense", [note("a", 0), note("b", 240, "eighth"), note("c", 480), note("d", 720)])]);
    const distributionConstraints = { ...constraints, contentWidth: 600, maximumMeasureWidth: 500 };
    const layout = layoutStaffBuilderScoreSystems(current, distributionConstraints);
    const [sparse, dense] = layout.systems[0]?.measures ?? [];
    expect(dense?.width).toBeGreaterThan(sparse?.width ?? 0);
    expect(layout.systems[0]?.measures.every(({ width }) => width <= distributionConstraints.maximumMeasureWidth)).toBe(true);
    expect(layout.systems[0]?.width).toBeLessThanOrEqual(distributionConstraints.contentWidth);
  });

  it("adds vertical reservations to every system and continuous document geometry", () => {
    const current = score(Array.from({ length: 4 }, (_value, index) => measure(`m${index}`)));
    const zero = layoutStaffBuilderScoreSystems(current, { ...constraints, contentWidth: 350 });
    const reserved = layoutStaffBuilderScoreSystems(current, {
      ...constraints, contentWidth: 350,
      verticalReservations: { aboveStaff: 10, betweenStaves: 20, belowStaff: 30 },
    });
    expect(zero.systems[0]?.height).toBe(constraints.baseMusicHeight);
    expect(reserved.systems[0]?.height).toBe(constraints.baseMusicHeight + 60);
    expect(reserved.systems[0]?.measures[0]).toMatchObject({ y: 10, height: constraints.baseMusicHeight + 20 });
    expect(reserved.systems[1]?.y).toBe((reserved.systems[0]?.height ?? 0) + constraints.systemGap);
    expect(reserved.height - zero.height).toBe(60 * reserved.systems.length);
  });

  it("adds range reservations per system while ordinary systems remain compact", () => {
    const ordinary = measure("ordinary", [note("middle", 0)]);
    const low = { ...measure("low"), events: [{ ...note("low-d", 0), staff: "bass" as const, pitches: [{ id: "low-p", midiNumber: 26, letter: "D" as const, accidental: "natural" as const, octave: 1 }] }] };
    const high = { ...measure("high"), events: [{ ...note("high-g", 0), pitches: [{ id: "high-p", midiNumber: 127, letter: "G" as const, accidental: "natural" as const, octave: 9 }] }] };
    const layout = layoutStaffBuilderScoreSystems(score([ordinary, low, high]), { ...constraints, contentWidth: 300 });
    expect(layout.systems[0]?.height).toBe(constraints.baseMusicHeight);
    expect(layout.systems[1]?.height).toBeGreaterThan(constraints.baseMusicHeight);
    expect(layout.systems[2]?.height).toBeGreaterThan(constraints.baseMusicHeight);
    expect(layout.systems[1]?.measures[0]?.y).toBe(0);
    expect(layout.systems[2]?.measures[0]?.y).toBeGreaterThan(0);
    expect(layout.systems[1]?.y).toBe((layout.systems[0]?.height ?? 0) + constraints.systemGap);
    expect(layout.systems[2]?.y).toBe((layout.systems[1]?.y ?? 0) + (layout.systems[1]?.height ?? 0) + constraints.systemGap);
  });

  it("reserves a lyric lane only on systems containing lyric cues", () => {
    const first = measure("m1", [note("cue-event", 0)]);
    const second = measure("m2", [note("plain-event", 0)]);
    const current = { ...score([first, second]), annotations: [{ id: "lyric", kind: "lyric-cue" as const, anchor: { kind: "event" as const, eventId: "cue-event" }, text: "Bells" }] };
    const layout = layoutStaffBuilderScoreSystems(current, { ...constraints, contentWidth: 200 });
    expect(layout.systems).toHaveLength(2);
    expect(layout.systems[0]?.height).toBe(constraints.baseMusicHeight + 24);
    expect(layout.systems[1]?.height).toBe(constraints.baseMusicHeight);
    const withMeasureLabelLane = layoutStaffBuilderScoreSystems(current, { ...constraints, contentWidth: 200, verticalReservations: { aboveStaff: 0, betweenStaves: 0, belowStaff: 20 } });
    expect(withMeasureLabelLane.systems[0]?.measures[0]?.y).toBe(layout.systems[0]?.measures[0]?.y);
    expect(withMeasureLabelLane.systems[0]?.height).toBe((layout.systems[0]?.height ?? 0) + 20);
    expect(withMeasureLabelLane.systems[1]?.height).toBe((layout.systems[1]?.height ?? 0) + 20);
  });

  it("translates local points and bounds through measure, system, and document spaces", () => {
    const layout = layoutStaffBuilderScoreSystems(score([measure("m1"), measure("m2"), measure("m3")]), { ...constraints, contentWidth: 300, verticalReservations: { aboveStaff: 12, betweenStaves: 0, belowStaff: 0 } });
    const system = layout.systems[1]!;
    const placement = system.measures[0]!;
    const systemPoint = translateStaffBuilderMeasurePointToSystem({ x: 7, y: 9 }, placement);
    const documentPoint = translateStaffBuilderSystemPointToDocument(systemPoint, system);
    expect(systemPoint).toEqual({ x: placement.x + 7, y: placement.y + 9 });
    expect(documentPoint).toEqual({ x: system.x + placement.x + 7, y: system.y + placement.y + 9 });
    expect(translateStaffBuilderMeasureBoundsToSystem({ x: 7, y: 9, width: 13, height: 17 }, placement)).toEqual({ ...systemPoint, width: 13, height: 17 });
    expect(translateStaffBuilderSystemBoundsToDocument({ ...systemPoint, width: 13, height: 17 }, system)).toEqual({ ...documentPoint, width: 13, height: 17 });
  });
});
