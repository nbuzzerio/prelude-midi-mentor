import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Accidental, Beam, Dot, Formatter, Stave, StaveConnector, StaveNote, StaveTie, Stem, Voice } from "vexflow";
import type { StaffBuilderScore } from "../staff-builder-types";
import { renderStaffBuilderMeasure } from "./render-staff-builder-measure";
import { projectStaffBuilderPendingPreview } from "./staff-builder-notation";

function score(): StaffBuilderScore {
  return {
    schemaVersion: 3, annotations: [], id: "score", title: "Renderer", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    tempoBpm: 100, initialKeySignatureId: "g-major", initialTimeSignature: "4/4",
    measures: [{ id: "measure", events: [
      { id: "chord", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "dotted-eighth" }, pitches: [
        { id: "p1", midiNumber: 65, letter: "F", accidental: "natural", octave: 4 },
        { id: "p2", midiNumber: 69, letter: "A", accidental: "natural", octave: 4 },
      ] },
      { id: "note", kind: "notes", staff: "treble", startTick: 360, rhythm: { status: "final", duration: "sixteenth" }, pitches: [{ id: "p3", midiNumber: 67, letter: "G", accidental: "natural", octave: 4 }] },
      { id: "rest", kind: "rest", staff: "bass", startTick: 480, rhythm: { status: "final", duration: "quarter" } },
    ] }],
    ties: [{ id: "tie", fromEventId: "chord", fromPitchId: "p2", toEventId: "note", toPitchId: "p3" }],
  };
}

function unresolvedScore(ticks: readonly number[]): StaffBuilderScore {
  return {
    ...score(),
    initialKeySignatureId: "c-major",
    measures: [{ id: "measure", events: ticks.map((startTick, index) => ({
      id: `event-${index}`,
      kind: "notes" as const,
      staff: "treble" as const,
      startTick,
      rhythm: { status: "unresolved" as const },
      pitches: [{ id: `pitch-${index}`, midiNumber: 60 + index, letter: "C" as const, accidental: "natural" as const, octave: 4 }],
    })) }],
    ties: [],
  };
}

function polyphonicScore(): StaffBuilderScore {
  return { ...score(), initialKeySignatureId: "c-major", measures: [{ id: "measure", events: [
    { id: "upper", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "dotted-quarter" }, pitches: [{ id: "upper-p", midiNumber: 66, letter: "F", accidental: "sharp", octave: 4 }] },
    { id: "lower", kind: "notes", staff: "treble", startTick: 480, rhythm: { status: "final", duration: "eighth" }, pitches: [{ id: "lower-p", midiNumber: 65, letter: "F", accidental: "natural", octave: 4 }] },
    { id: "later", kind: "notes", staff: "treble", startTick: 720, rhythm: { status: "final", duration: "eighth" }, pitches: [{ id: "later-p", midiNumber: 67, letter: "G", accidental: "natural", octave: 4 }] },
    { id: "bass-long", kind: "notes", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: "bass-p", midiNumber: 48, letter: "C", accidental: "natural", octave: 3 }] },
  ] }], ties: [{ id: "tie", fromEventId: "lower", fromPitchId: "lower-p", toEventId: "later", toPitchId: "later-p" }] };
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({
      width: text.length * 8,
      actualBoundingBoxAscent: 8,
      actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: text.length * 8,
      fontBoundingBoxAscent: 8,
      fontBoundingBoxDescent: 2,
    }),
  } as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

describe("renderStaffBuilderMeasure", () => {
  it("renders a selected single staff without changing the grand-staff default", () => {
    const draws = vi.spyOn(Stave.prototype, "draw");
    const connectors = vi.spyOn(StaveConnector.prototype, "draw");
    const treble = renderStaffBuilderMeasure(document.createElement("div"), score(), 0, { visibleStaff: "treble" });
    expect(draws).toHaveBeenCalledTimes(1);
    expect(connectors).not.toHaveBeenCalled();
    expect([...treble.anchors.events.keys()]).not.toContain("rest");
    draws.mockClear();
    const bass = renderStaffBuilderMeasure(document.createElement("div"), score(), 0, { visibleStaff: "bass" });
    expect(draws).toHaveBeenCalledTimes(1);
    expect([...bass.anchors.events.keys()]).toEqual(["rest"]);
    draws.mockClear();
    renderStaffBuilderMeasure(document.createElement("div"), score(), 0);
    expect(draws).toHaveBeenCalledTimes(2);
  });

  it("constructs, joins, and draws multiple public VexFlow voices per staff", () => {
    const draws = vi.spyOn(Voice.prototype, "draw");
    const joins = vi.spyOn(Formatter.prototype, "joinVoices");
    const accidentals = vi.spyOn(Accidental, "applyAccidentals");
    const beams = vi.spyOn(Beam, "generateBeams");
    const result = renderStaffBuilderMeasure(document.createElement("div"), polyphonicScore(), 0);
    expect(result.projection.voices.treble).toHaveLength(2);
    expect(draws).toHaveBeenCalledTimes(3);
    expect(joins.mock.calls.map(([voices]) => voices.length)).toEqual([2, 1]);
    expect(accidentals.mock.calls.map(([voices]) => voices.length)).toEqual([2, 1]);
    expect(beams).toHaveBeenCalledTimes(3);
    expect(beams.mock.calls.slice(0, 2).every((call) => call[1]?.maintainStemDirections === true)).toBe(true);
  });

  it("alternates stems for three voices while preserving one-voice automatic behavior", () => {
    const stems = vi.spyOn(StaveNote.prototype, "setStemDirection");
    const threeVoices: StaffBuilderScore = { ...score(), measures: [{ id: "measure", events: [
      { id: "high", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: "h", midiNumber: 72, letter: "C", accidental: "natural", octave: 5 }] },
      { id: "middle", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "half" }, pitches: [{ id: "m", midiNumber: 67, letter: "G", accidental: "natural", octave: 4 }] },
      { id: "low", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "l", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] },
    ] }], ties: [] };
    renderStaffBuilderMeasure(document.createElement("div"), threeVoices, 0);
    expect(stems.mock.calls.map(([direction]) => direction)).toEqual(expect.arrayContaining([Stem.UP, Stem.DOWN, Stem.UP]));
    stems.mockClear();
    renderStaffBuilderMeasure(document.createElement("div"), { ...score(), measures: [{ id: "measure", events: [{ id: "only", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: "only-p", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] }] }], ties: [] }, 0);
    expect(stems.mock.calls.every(([direction]) => direction !== Stem.DOWN)).toBe(true);
  });

  it("retains every polyphonic source anchor, excludes ghosts, and preserves temporal geometry", () => {
    const current = polyphonicScore();
    const polyphonic = renderStaffBuilderMeasure(document.createElement("div"), current, 0);
    const empty = renderStaffBuilderMeasure(document.createElement("div"), { ...current, measures: [{ id: "measure", events: [] }], ties: [] }, 0);
    expect([...polyphonic.anchors.events.keys()].sort()).toEqual(["bass-long", "later", "lower", "upper"]);
    expect([...polyphonic.anchors.authoritativeEvents.keys()].sort()).toEqual(["bass-long", "later", "lower", "upper"]);
    expect(polyphonic.anchors.timeline).toEqual(empty.anchors.timeline);
    expect([...polyphonic.anchors.positions.values()]).toEqual([...empty.anchors.positions.values()]);
  });

  it("renders same-onset different-duration events and authored note/rest polyphony", () => {
    const current: StaffBuilderScore = { ...score(), measures: [{ id: "measure", events: [
      { id: "half", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "half" }, pitches: [{ id: "hp", midiNumber: 76, letter: "E", accidental: "natural", octave: 5 }] },
      { id: "quarter", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "qp", midiNumber: 72, letter: "C", accidental: "natural", octave: 5 }] },
      { id: "rest", kind: "rest", staff: "treble", startTick: 480, rhythm: { status: "final", duration: "quarter" } },
    ] }], ties: [] };
    const result = renderStaffBuilderMeasure(document.createElement("div"), current, 0);
    expect([...result.anchors.events.keys()].sort()).toEqual(["half", "quarter", "rest"]);
    expect(result.projection.staves.treble.find((item) => item.kind !== "spacer" && item.eventId === "half")).toMatchObject({ layoutDurationTicks: 960 });
    expect(result.projection.staves.treble.find((item) => item.kind !== "spacer" && item.eventId === "quarter")).toMatchObject({ layoutDurationTicks: 480 });
  });
  it("uses public VexFlow contracts for dots, accidentals, beams, ties, and SVG output", () => {
    const dots = vi.spyOn(Dot, "buildAndAttach");
    const accidentals = vi.spyOn(Accidental, "applyAccidentals");
    const beams = vi.spyOn(Beam, "generateBeams");
    const tieDraw = vi.spyOn(StaveTie.prototype, "draw");
    const keySignatures = vi.spyOn(Stave.prototype, "addKeySignature");
    const timeSignatures = vi.spyOn(Stave.prototype, "addTimeSignature");
    const connectors = vi.spyOn(StaveConnector.prototype, "setType");
    const container = document.createElement("div");
    const result = renderStaffBuilderMeasure(container, score(), 0);
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(dots).toHaveBeenCalled();
    expect(accidentals).toHaveBeenCalledTimes(2);
    expect(beams).toHaveBeenCalledTimes(2);
    expect(beams.mock.calls[0]?.[1]).toMatchObject({ groups: expect.any(Array), beamRests: false });
    expect(tieDraw).toHaveBeenCalledTimes(1);
    expect(keySignatures).toHaveBeenCalledTimes(2);
    expect(timeSignatures).toHaveBeenCalledTimes(2);
    expect(connectors.mock.calls.map(([type]) => type)).toEqual([StaveConnector.type.BRACE, StaveConnector.type.SINGLE_LEFT]);
    expect(result.projection).toMatchObject({ keySignatureId: "g-major", timeSignature: "4/4" });
  });

  it("renders effective signatures for initial, explicit-change, and inherited isolated measures", () => {
    const keySignatures = vi.spyOn(Stave.prototype, "addKeySignature");
    const timeSignatures = vi.spyOn(Stave.prototype, "addTimeSignature");
    const current: StaffBuilderScore = { ...score(), initialKeySignatureId: "c-major", measures: [
      { id: "m1", events: [] },
      { id: "m2", keySignatureChange: "g-major", timeSignatureChange: "6/8", events: [] },
      { id: "m3", events: [] },
    ] };
    const initial = renderStaffBuilderMeasure(document.createElement("div"), current, 0).projection;
    const explicit = renderStaffBuilderMeasure(document.createElement("div"), current, 1).projection;
    const inherited = renderStaffBuilderMeasure(document.createElement("div"), current, 2).projection;
    expect(initial).toMatchObject({ keySignatureId: "c-major", timeSignature: "4/4", introducesKeySignature: false, introducesTimeSignature: false });
    expect(explicit).toMatchObject({ keySignatureId: "g-major", timeSignature: "6/8", introducesKeySignature: true, introducesTimeSignature: true });
    expect(inherited).toMatchObject({ keySignatureId: "g-major", timeSignature: "6/8", introducesKeySignature: false, introducesTimeSignature: false });
    expect(keySignatures.mock.calls.map(([key]) => key)).toEqual(["C", "C", "G", "G", "G", "G"]);
    expect(timeSignatures.mock.calls.map(([time]) => time)).toEqual(["4/4", "4/4", "6/8", "6/8", "6/8", "6/8"]);
  });

  it.each([
    ["2/4", 8], ["3/4", 12], ["4/4", 16], ["6/8", 12],
  ] as const)("creates a complete deterministic sixteenth grid for empty %s", (time, count) => {
    const empty = { ...score(), initialTimeSignature: time, measures: [{ id: "empty", events: [] }], ties: [] };
    const result = renderStaffBuilderMeasure(document.createElement("div"), empty, 0);
    expect(result.anchors.positions).toHaveLength(count);
    expect(result.anchors.positions.get(0)?.x).toBe(result.anchors.timeline.rhythmicStartX);
    expect(result.anchors.timeline.capacityTicks).toBe(count * 120);
  });

  it("keeps temporal positions unchanged when event content and durations change", () => {
    const empty = { ...score(), measures: [{ id: "measure", events: [] }], ties: [] };
    const populated = score();
    const changed = { ...populated, measures: [{ ...populated.measures[0]!, events: populated.measures[0]!.events.map((event) => ({ ...event, rhythm: { status: "final" as const, duration: "quarter" as const } })) }] };
    const emptyRender = renderStaffBuilderMeasure(document.createElement("div"), empty, 0);
    const populatedRender = renderStaffBuilderMeasure(document.createElement("div"), populated, 0);
    const changedRender = renderStaffBuilderMeasure(document.createElement("div"), changed, 0);
    expect([...populatedRender.anchors.positions.values()]).toEqual([...emptyRender.anchors.positions.values()]);
    expect([...changedRender.anchors.positions.values()]).toEqual([...emptyRender.anchors.positions.values()]);
  });

  it("returns plain event and cross-staff position anchors with useful invariants", () => {
    const result = renderStaffBuilderMeasure(document.createElement("div"), score(), 0);
    expect([...result.anchors.events.keys()]).toEqual(expect.arrayContaining(["chord", "note", "rest"]));
    for (const anchor of result.anchors.events.values()) {
      expect(anchor.width).toBeGreaterThan(0);
      expect(anchor.height).toBeGreaterThan(0);
    }
    const positions = [...result.anchors.positions.values()];
    expect(positions[0]).toMatchObject({ tick: 0 });
    expect(positions.at(-1)).toMatchObject({ tick: 1800 });
    expect(positions.every(({ width }) => width > 0)).toBe(true);
    expect(positions.every(({ height }) => height > 100)).toBe(true);
    expect(positions.map(({ x }) => x)).toEqual([...positions.map(({ x }) => x)].sort((left, right) => left - right));
    for (const event of result.anchors.events.values()) expect(result.anchors.positions.get(event.startTick)).toBeDefined();
    const chord = result.anchors.events.get("chord");
    expect(chord?.x).toBeLessThanOrEqual(chord?.onsetX ?? 0);
    expect(result.coordinateSpace).toEqual({ width: result.width, height: result.height });
  });

  it.each(["c-major", "a-minor"] as const)("returns five usable public notation-control anchors for %s", (initialKeySignatureId) => {
    const result = renderStaffBuilderMeasure(document.createElement("div"), { ...score(), initialKeySignatureId }, 0);
    const controls = result.anchors.notationControls;
    expect(Object.keys(controls)).toEqual(["trebleClef", "grandStaff", "bassClef", "keySignature", "timeSignature"]);
    for (const anchor of Object.values(controls)) {
      expect(anchor.x).toBeGreaterThanOrEqual(0);
      expect(anchor.y).toBeGreaterThanOrEqual(0);
      expect(anchor.x + anchor.width).toBeLessThanOrEqual(760);
      expect(anchor.y + anchor.height).toBeLessThanOrEqual(300);
      expect(anchor.width).toBeGreaterThan(0);
      expect(anchor.height).toBeGreaterThan(0);
    }
    expect(controls.keySignature.width).toBeGreaterThanOrEqual(12);
    expect(controls.grandStaff.height).toBeGreaterThanOrEqual(44);
    expect(controls.keySignature.x + controls.keySignature.width).toBeLessThanOrEqual(controls.timeSignature.x);
  });

  it("keeps cross-staff committed and grid onsets aligned while pending chords change", () => {
    const current: StaffBuilderScore = {
      ...score(),
      initialKeySignatureId: "c-major",
      measures: [{ id: "measure", events: [
        { id: "before-treble", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "bt", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] },
        { id: "before-bass", kind: "notes", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "bb", midiNumber: 48, letter: "C", accidental: "natural", octave: 3 }] },
        { id: "after-treble", kind: "notes", staff: "treble", startTick: 480, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "at", midiNumber: 67, letter: "G", accidental: "natural", octave: 4 }] },
        { id: "after-bass", kind: "notes", staff: "bass", startTick: 480, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "ab", midiNumber: 43, letter: "G", accidental: "natural", octave: 2 }] },
      ] }],
      ties: [],
    };
    const renderPreview = (treble: readonly number[], bass: readonly number[]) => {
      const preview = projectStaffBuilderPendingPreview(current, 0, 240, { treble, bass }, "eighth");
      return renderStaffBuilderMeasure(document.createElement("div"), preview.renderScore, 0, {
        excludedEventIds: preview.previewEventIds,
        layoutDurationTicksByEventId: preview.layoutDurationTicksByEventId,
      });
    };
    const trebleOnly = renderPreview([62], []);
    const both = renderPreview([62, 65, 69], [47, 50]);
    const changedTreble = renderPreview([62, 65], [47, 50]);
    for (const result of [trebleOnly, both, changedTreble]) {
      for (const eventId of ["before-treble", "before-bass", "after-treble", "after-bass"]) {
        const anchor = result.anchors.authoritativeEvents.get(eventId);
        expect(anchor).toBeDefined();
      }
      expect(result.anchors.events.get([...result.anchors.events.keys()].find((id) => id.includes("preview")) ?? "")).toBeDefined();
      expect([...result.anchors.authoritativeEvents.keys()].some((id) => id.includes("preview"))).toBe(false);
      const positions = [...result.anchors.positions.values()];
      expect(positions.every(({ width }) => width > 0)).toBe(true);
      expect(positions.map(({ tick }) => tick)).toEqual([...positions.map(({ tick }) => tick)].sort((left, right) => left - right));
      expect(positions.map(({ x }) => x)).toEqual([...positions.map(({ x }) => x)].sort((left, right) => left - right));
      const treblePreview = result.anchors.events.get([...result.anchors.events.keys()].find((id) => id.includes(":treble:240:event")) ?? "");
      const bassPreview = result.anchors.events.get([...result.anchors.events.keys()].find((id) => id.includes(":bass:240:event")) ?? "");
      if (treblePreview && bassPreview) expect(treblePreview.onsetX).toBeCloseTo(bassPreview.onsetX, 5);
    }
    expect([...changedTreble.anchors.positions.values()]).toEqual([...both.anchors.positions.values()]);
    expect(changedTreble.anchors.timeline).toEqual(both.anchors.timeline);
  });

  it.each([{ ticks: [0, 240] }, { ticks: [0, 120, 240] }])("renders unresolved quarter-note visuals at distinct increasing onsets $ticks", ({ ticks }) => {
    const result = renderStaffBuilderMeasure(document.createElement("div"), unresolvedScore(ticks), 0);
    const eventOnsets = ticks.map((_tick, index) => result.anchors.events.get(`event-${index}`)?.onsetX ?? 0);
    expect(eventOnsets).toEqual([...eventOnsets].sort((left, right) => left - right));
    expect(new Set(eventOnsets).size).toBe(ticks.length);
    ticks.forEach((tick) => expect(result.anchors.positions.get(tick)).toBeDefined());
  });

  it.each([1800, 1680])("aligns a boundary-capped unresolved event at formatted tick %i without score mutation", (tick) => {
    const current = unresolvedScore([tick]);
    const before = JSON.stringify(current);
    const result = renderStaffBuilderMeasure(document.createElement("div"), current, 0);
    const event = result.anchors.events.get("event-0");
    const position = result.anchors.positions.get(tick);
    expect(event).toBeDefined();
    expect(position).toBeDefined();
    expect(result.projection.staves.treble.find((item) => item.kind !== "spacer")).toMatchObject({
      layoutDurationTicks: 1920 - tick,
      visualDuration: { duration: "quarter" },
    });
    expect(JSON.stringify(current)).toBe(before);
  });
});
