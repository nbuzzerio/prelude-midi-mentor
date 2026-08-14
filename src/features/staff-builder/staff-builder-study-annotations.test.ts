import { describe, expect, it } from "vitest";
import type { StaffBuilderSystemRenderResult } from "./notation/render-staff-builder-system";
import type { StaffBuilderScoreDocumentLayout } from "./notation/staff-builder-system-layout";
import { projectStaffBuilderStudyAnnotations } from "./staff-builder-study-annotations";
import type { StaffBuilderScore } from "./staff-builder-types";

const score: StaffBuilderScore = { schemaVersion: 2, id: "s", title: "Study", createdAt: "x", updatedAt: "x", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [], measures: [
  { id: "m1", events: [{ id: "e1", kind: "notes", staff: "treble", startTick: 240, rhythm: { status: "final", duration: "quarter" }, pitches: [{ id: "p1", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] }] },
  { id: "m2", events: [{ id: "e2", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } }] },
], annotations: [
  { id: "n1", kind: "study-note", anchor: { kind: "event", eventId: "e1" }, text: "First" },
  { id: "n2", kind: "study-note", anchor: { kind: "event", eventId: "e1" }, text: "Second" },
  { id: "b", kind: "bookmark", anchor: { kind: "event", eventId: "e1" }, category: "question" },
  { id: "p", kind: "practice-mark", anchor: { kind: "measure", measureId: "m2" }, category: "rhythm" },
] };
const layout: StaffBuilderScoreDocumentLayout = { width: 500, height: 460, systems: [
  { systemIndex: 0, x: 10, y: 20, width: 400, height: 220, measures: [{ measureId: "m1", measureIndex: 0, x: 100, y: 0, width: 300, height: 220 }] },
  { systemIndex: 1, x: 15, y: 260, width: 400, height: 200, measures: [{ measureId: "m2", measureIndex: 1, x: 0, y: 0, width: 300, height: 200 }] },
] };
const result = (systemIndex: number, measureId: string, measureIndex: number, eventId: string): StaffBuilderSystemRenderResult => ({ coordinateSpace: { width: 400, height: 220 }, system: { systemIndex, bounds: { x: 0, y: 0, width: 400, height: 220 } }, measures: [{ measureId, measureIndex, bounds: { x: systemIndex ? 0 : 100, y: 0, width: 300, height: 200 }, events: new Map(), positions: new Map(), timeline: { rhythmicStartX: 0, rhythmicEndX: 300, y: 0, height: 200, capacityTicks: 1920 } }], events: new Map([[eventId, { eventId, staff: systemIndex ? "bass" : "treble", startTick: systemIndex ? 0 : 240, onsetX: 125, x: systemIndex ? 20 : 120, y: 60, width: 12, height: 20 }]]) });

describe("projectStaffBuilderStudyAnnotations", () => {
  it("orders, groups, and translates system-local geometry exactly once", () => {
    const projection = projectStaffBuilderStudyAnnotations(score, layout, [result(0, "m1", 0, "e1"), result(1, "m2", 1, "e2")], new Set(["study-notes", "practice-marks", "bookmarks"]));
    expect(projection.records.map(({ annotation }) => annotation.id)).toEqual(["n1", "n2", "b", "p"]);
    expect(projection.markers.map(({ label, count }) => [label, count])).toEqual([["N", 2], ["B", 1], ["P", 1]]);
    expect(projection.markers[0]?.bounds.x).toBe(124); // system x 10 + event x 120 + width 12 - 18; no extra measure x
    expect(projection.markers[2]?.bounds.y).toBeGreaterThanOrEqual(260);
  });

  it("filters hidden layers and retains list records when geometry is missing without mutating inputs", () => {
    const before = JSON.stringify(score);
    const projection = projectStaffBuilderStudyAnnotations(score, layout, [], new Set(["study-notes"]));
    expect(projection.records.map(({ annotation }) => annotation.id)).toEqual(["n1", "n2"]);
    expect(projection.markers).toEqual([]);
    expect(JSON.stringify(score)).toBe(before);
  });
});
