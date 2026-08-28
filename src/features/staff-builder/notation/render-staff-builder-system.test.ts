import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Accidental, Stave, StaveConnector, StaveTie } from "vexflow";
import type { StaffBuilderMeasure, StaffBuilderNoteEvent, StaffBuilderScore } from "../staff-builder-types";
import type { StaffBuilderSystemLayout } from "./staff-builder-system-layout";
import { renderStaffBuilderSystem } from "./render-staff-builder-system";

const note = (id: string, pitchIds = [`${id}-pitch`], startTick = 0, staff: "treble" | "bass" = "treble"): StaffBuilderNoteEvent => ({
  id, kind: "notes", staff, startTick, rhythm: { status: "final", duration: "quarter" },
  pitches: pitchIds.map((pitchId, index) => ({ id: pitchId, midiNumber: 60 + index * 4, letter: index === 0 ? "C" : "E", accidental: "natural", octave: 4 })),
});

const measure = (id: string, events = [note(`${id}-event`)]): StaffBuilderMeasure => ({ id, events });

function score(measures: readonly StaffBuilderMeasure[], overrides: Partial<StaffBuilderScore> = {}): StaffBuilderScore {
  return {
    schemaVersion: 3, annotations: [], id: "score", title: "System", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z",
    tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], measures, ...overrides,
  };
}

function layout(current: StaffBuilderScore, indexes = current.measures.map((_item, index) => index), width = 680): StaffBuilderSystemLayout {
  const measureWidth = width / indexes.length;
  return {
    systemIndex: 2, x: 0, y: 300, width, height: 240,
    measures: indexes.map((measureIndex, index) => ({
      measureId: current.measures[measureIndex]!.id, measureIndex, x: index * measureWidth, y: 10, width: measureWidth, height: 220,
    })),
  };
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({
      width: text.length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2,
      actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 8, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2,
    }),
  } as CanvasRenderingContext2D);
});
afterEach(() => vi.restoreAllMocks());

describe("renderStaffBuilderSystem", () => {
  it("renders adjacent measures with one system start and aligned explicit boundaries", () => {
    const current = score([measure("m1"), measure("m2"), measure("m3")]);
    const clefs = vi.spyOn(Stave.prototype, "addClef");
    const keys = vi.spyOn(Stave.prototype, "addKeySignature");
    const times = vi.spyOn(Stave.prototype, "addTimeSignature");
    const connectors = vi.spyOn(StaveConnector.prototype, "setType");
    const container = document.createElement("div");
    const result = renderStaffBuilderSystem(container, current, layout(current));
    expect(container.querySelectorAll("svg")).toHaveLength(1);
    expect(container.querySelector("svg")).toMatchObject({ ariaHidden: "true" });
    expect(clefs).toHaveBeenCalledTimes(2);
    expect(keys).toHaveBeenCalledTimes(2);
    expect(times).toHaveBeenCalledTimes(2);
    expect(connectors.mock.calls.map(([type]) => type)).toEqual([
      StaveConnector.type.BRACE, StaveConnector.type.SINGLE_LEFT,
      StaveConnector.type.SINGLE_RIGHT, StaveConnector.type.SINGLE_RIGHT, StaveConnector.type.SINGLE_RIGHT,
    ]);
    expect(result.measures.map(({ measureId, measureIndex }) => [measureId, measureIndex])).toEqual([["m1", 0], ["m2", 1], ["m3", 2]]);
  });

  it("renders only actual internal key/time changes with previous-key cancellation context", () => {
    const current = score([
      measure("c"),
      { ...measure("g"), keySignatureChange: "g-major", timeSignatureChange: "3/4" },
      measure("inherited"),
      { ...measure("back-c"), keySignatureChange: "c-major", timeSignatureChange: "6/8" },
    ]);
    const keys = vi.spyOn(Stave.prototype, "addKeySignature");
    const times = vi.spyOn(Stave.prototype, "addTimeSignature");
    renderStaffBuilderSystem(document.createElement("div"), current, layout(current, undefined, 1000));
    expect(keys.mock.calls.map(([next, previous]) => [next, previous])).toEqual([
      ["C", undefined], ["C", undefined], ["G", "C"], ["G", "C"], ["C", "G"], ["C", "G"],
    ]);
    expect(times.mock.calls.map(([time]) => time)).toEqual(["4/4", "4/4", "3/4", "3/4", "6/8", "6/8"]);
  });

  it.each([
    ["g-major", "G"], ["f-major", "F"],
  ] as const)("renders cancellation naturals for %s to C major", (initialKeySignatureId, vexKey) => {
    const current = score([measure("old"), { ...measure("c"), keySignatureChange: "c-major" }], { initialKeySignatureId });
    const container = document.createElement("div");
    const keys = vi.spyOn(Stave.prototype, "addKeySignature");
    renderStaffBuilderSystem(container, current, layout(current));
    expect(keys).toHaveBeenCalledWith("C", vexKey);
    const naturalGlyph = "\uE261";
    expect([...container.querySelectorAll(".vf-keysignature text")].filter(({ textContent }) => textContent === naturalGlyph)).toHaveLength(2);
  });

  it("applies accidentals independently to each staff of every measure", () => {
    const current = score([measure("m1"), { ...measure("m2"), keySignatureChange: "g-major" }]);
    const accidentals = vi.spyOn(Accidental, "applyAccidentals");
    renderStaffBuilderSystem(document.createElement("div"), current, layout(current));
    expect(accidentals.mock.calls.map(([, key]) => key)).toEqual(["C", "C", "G", "G"]);
  });

  it("renders complete, outgoing, and incoming ties with independently resolved chord indexes", () => {
    const source = note("source", ["source-other", "source-tied"]);
    const destination = note("destination", ["destination-tied", "destination-other"]);
    const current = score([measure("m1", [source]), measure("m2", [destination]), measure("m3", [note("later")])], {
      ties: [
        { id: "cross", fromEventId: "source", fromPitchId: "source-tied", toEventId: "destination", toPitchId: "destination-tied" },
        { id: "outgoing", fromEventId: "destination", fromPitchId: "destination-tied", toEventId: "later", toPitchId: "later-pitch" },
      ],
    });
    const setNotes = vi.spyOn(StaveTie.prototype, "setNotes");
    renderStaffBuilderSystem(document.createElement("div"), current, layout(current, [0, 1]));
    expect(setNotes.mock.calls.map(([notes]) => notes)).toEqual(expect.arrayContaining([
      expect.objectContaining({ firstNote: expect.anything(), lastNote: expect.anything(), firstIndexes: [1], lastIndexes: [0] }),
      expect.objectContaining({ firstNote: expect.anything(), lastNote: null, firstIndexes: [0], lastIndexes: [0] }),
    ]));
    setNotes.mockClear();
    renderStaffBuilderSystem(document.createElement("div"), current, layout(current, [2], 340));
    expect(setNotes).toHaveBeenCalledWith(expect.objectContaining({ firstNote: null, lastNote: expect.anything(), firstIndexes: [0], lastIndexes: [0] }));
  });

  it("does not turn a missing endpoint into a partial tie", () => {
    const current = score([measure("m1", [note("source")])], {
      ties: [{ id: "invalid", fromEventId: "source", fromPitchId: "source-pitch", toEventId: "missing", toPitchId: "missing-pitch" }],
    });
    const ties = vi.spyOn(StaveTie.prototype, "draw");
    renderStaffBuilderSystem(document.createElement("div"), current, layout(current));
    expect(ties).not.toHaveBeenCalled();
  });

  it("returns system-local measure, event, and timeline geometry from the supplied layout", () => {
    const current = score([measure("m1"), measure("m2")]);
    const currentLayout = layout(current);
    const result = renderStaffBuilderSystem(document.createElement("div"), current, currentLayout);
    expect(result.coordinateSpace).toEqual({ width: 680, height: 240 });
    expect(result.system).toEqual({ systemIndex: 2, bounds: { x: 0, y: 0, width: 680, height: 240 } });
    expect(result.measures.map(({ bounds }) => bounds)).toEqual(currentLayout.measures.map(({ x, y, width, height }) => ({ x, y, width, height })));
    for (const renderedMeasure of result.measures) {
      expect(renderedMeasure.timeline.rhythmicStartX).toBeGreaterThanOrEqual(renderedMeasure.bounds.x);
      expect(renderedMeasure.timeline.rhythmicEndX).toBeLessThanOrEqual(renderedMeasure.bounds.x + renderedMeasure.bounds.width);
      expect(renderedMeasure.positions.size).toBeGreaterThan(0);
      for (const anchor of renderedMeasure.events.values()) {
        expect(anchor.x).toBeGreaterThanOrEqual(renderedMeasure.bounds.x);
        expect(anchor.x + anchor.width).toBeLessThanOrEqual(renderedMeasure.bounds.x + renderedMeasure.bounds.width);
      }
    }
  });

  it("rejects a placement that leaves no rhythmic formatting width without repacking", () => {
    const current = score([measure("m1")]);
    expect(() => renderStaffBuilderSystem(document.createElement("div"), current, layout(current, [0], 20)))
      .toThrow(/measure m1.*index 0.*allocated width 20/i);
  });
});
