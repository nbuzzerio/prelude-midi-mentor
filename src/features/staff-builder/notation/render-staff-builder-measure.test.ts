import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Accidental, Beam, Dot, Stave, StaveConnector, StaveTie } from "vexflow";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { renderStaffBuilderMeasure } from "./render-staff-builder-measure";

function score(): StaffBuilderScoreV1 {
  return {
    schemaVersion: 1, id: "score", title: "Renderer", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
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

function unresolvedScore(ticks: readonly number[]): StaffBuilderScoreV1 {
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
    for (const event of result.anchors.events.values()) {
      const position = result.anchors.positions.get(event.startTick);
      expect(position).toBeDefined();
      expect(Math.abs(event.onsetX - (position?.x ?? 0))).toBeLessThan(1);
    }
    const chord = result.anchors.events.get("chord");
    expect(chord?.x).toBeLessThanOrEqual(chord?.onsetX ?? 0);
  });

  it.each([{ ticks: [0, 240] }, { ticks: [0, 120, 240] }])("renders unresolved quarter-note visuals at distinct increasing onsets $ticks", ({ ticks }) => {
    const result = renderStaffBuilderMeasure(document.createElement("div"), unresolvedScore(ticks), 0);
    const eventOnsets = ticks.map((_tick, index) => result.anchors.events.get(`event-${index}`)?.onsetX ?? 0);
    expect(eventOnsets).toEqual([...eventOnsets].sort((left, right) => left - right));
    expect(new Set(eventOnsets).size).toBe(ticks.length);
    ticks.forEach((tick, index) => {
      expect(Math.abs(eventOnsets[index] - (result.anchors.positions.get(tick)?.x ?? 0))).toBeLessThan(1);
    });
  });

  it.each([1800, 1680])("aligns a boundary-capped unresolved event at formatted tick %i without score mutation", (tick) => {
    const current = unresolvedScore([tick]);
    const before = JSON.stringify(current);
    const result = renderStaffBuilderMeasure(document.createElement("div"), current, 0);
    const event = result.anchors.events.get("event-0");
    const position = result.anchors.positions.get(tick);
    expect(event).toBeDefined();
    expect(position).toBeDefined();
    expect(Math.abs((event?.onsetX ?? 0) - (position?.x ?? 0))).toBeLessThan(1);
    expect(result.projection.staves.treble.find((item) => item.kind !== "spacer")).toMatchObject({
      layoutDurationTicks: 1920 - tick,
      visualDuration: { duration: "quarter" },
    });
    expect(JSON.stringify(current)).toBe(before);
  });
});
