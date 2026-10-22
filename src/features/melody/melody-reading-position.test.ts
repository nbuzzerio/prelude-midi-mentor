import { afterEach, describe, expect, it, vi } from "vitest";
import { renderStaffBuilderMeasure, type StaffBuilderEventAnchor } from "@/features/staff-builder/notation/render-staff-builder-measure";
import { durationToTicks } from "@/features/staff-builder/staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderScore, StaffBuilderStaff } from "@/features/staff-builder/staff-builder-types";
import { MELODY_RHYTHM_TEMPLATES } from "./melody-generator";
import { resolveMelodyReadingPosition } from "./melody-reading-position";

function fixture(staff: StaffBuilderStaff = "treble") {
  const events: StaffBuilderEvent[] = [
    { id: "opening", staff, startTick: 0, kind: "notes", rhythm: { status: "final", duration: "eighth" }, pitches: [] },
    { id: "second", staff, startTick: 240, kind: "notes", rhythm: { status: "final", duration: "eighth" }, pitches: [] },
    { id: "rest", staff, startTick: 480, kind: "rest", rhythm: { status: "final", duration: "half" } },
    { id: "last", staff, startTick: 1440, kind: "notes", rhythm: { status: "final", duration: "quarter" }, pitches: [] },
  ];
  const authoritativeEvents = new Map<string, StaffBuilderEventAnchor>(events.map((event, index) => [event.id, {
    eventId: event.id, staff, startTick: event.startTick, onsetX: [120, 215, 285, 410][index]!,
    x: 90, y: index * 30, width: 30, height: 50,
  }]));
  const anchors = { authoritativeEvents, timeline: { rhythmicStartX: 100, rhythmicEndX: 500, capacityTicks: 1920, y: 35, height: 105 } };
  return { anchors, events, staff };
}

afterEach(() => vi.restoreAllMocks());

describe("Melody engraved reading position", () => {
  it("meets each irregularly engraved onset, including rests, instead of the uniform tick grid or glyph bounds", () => {
    const input = fixture();
    for (const event of input.events) {
      expect(resolveMelodyReadingPosition({ ...input, tick: event.startTick })).toEqual({
        x: input.anchors.authoritativeEvents.get(event.id)!.onsetX, y: 35, height: 105,
      });
    }
    expect(resolveMelodyReadingPosition({ ...input, tick: 120 })?.x).toBe(167.5);
    expect(resolveMelodyReadingPosition({ ...input, tick: 360 })?.x).toBe(250);
    expect(resolveMelodyReadingPosition({ ...input, tick: 960 })?.x).toBe(347.5);
  });

  it("moves monotonically through the final note to the measure end and clamps finite out-of-range ticks", () => {
    const input = fixture();
    const xs = Array.from({ length: 193 }, (_, index) => resolveMelodyReadingPosition({ ...input, tick: index * 10 })!.x);
    expect(xs.every((x, index) => index === 0 || x >= xs[index - 1]!)).toBe(true);
    expect(resolveMelodyReadingPosition({ ...input, tick: -240 })?.x).toBe(120);
    expect(resolveMelodyReadingPosition({ ...input, tick: 1680 })?.x).toBe(455);
    expect(resolveMelodyReadingPosition({ ...input, tick: 1920 })?.x).toBe(500);
    expect(resolveMelodyReadingPosition({ ...input, tick: 2400 })?.x).toBe(500);
  });

  it("uses only the selected measure and staff's canonical events without mutating their order", () => {
    const input = fixture("bass");
    input.events.reverse();
    input.events.push({ ...input.events[0]!, id: "other-staff", staff: "treble", startTick: 120 });
    input.anchors.authoritativeEvents.set("unselected-preview", { ...input.anchors.authoritativeEvents.get("opening")!, eventId: "unselected-preview", startTick: 120, onsetX: 450 });
    const eventOrder = input.events.map(event => event.id), anchorOrder = [...input.anchors.authoritativeEvents.keys()];
    expect(resolveMelodyReadingPosition({ ...input, tick: 240 })?.x).toBe(215);
    expect(input.events.map(event => event.id)).toEqual(eventOrder);
    expect([...input.anchors.authoritativeEvents.keys()]).toEqual(anchorOrder);
  });

  it("does not display a cursor without an active tick or selected staff events", () => {
    const input = fixture();
    for (const tick of [undefined, NaN, Infinity, -Infinity]) expect(resolveMelodyReadingPosition({ ...input, tick })).toBeNull();
    expect(resolveMelodyReadingPosition({ ...input, events: [], tick: 0 })).toBeNull();
    expect(resolveMelodyReadingPosition({ ...input, staff: "bass", tick: 0 })).toBeNull();
  });

  it("does not invent onsets from incomplete, stale or backwards render geometry", () => {
    const input = fixture();
    input.anchors.authoritativeEvents.delete("second");
    expect(resolveMelodyReadingPosition({ ...input, tick: 240 })).toBeNull();
    const stale = fixture();
    stale.anchors.authoritativeEvents.set("second", { ...stale.anchors.authoritativeEvents.get("second")!, startTick: 480 });
    expect(resolveMelodyReadingPosition({ ...stale, tick: 240 })).toBeNull();
    const backwards = fixture();
    backwards.anchors.authoritativeEvents.set("second", { ...backwards.anchors.authoritativeEvents.get("second")!, onsetX: 110 });
    expect(resolveMelodyReadingPosition({ ...backwards, tick: 240 })).toBeNull();
  });

  it("handles leading silence and a single engraved rest through its complete measure", () => {
    const input = fixture();
    const events = [input.events[2]!];
    expect(resolveMelodyReadingPosition({ ...input, events, tick: 0 })?.x).toBe(100);
    expect(resolveMelodyReadingPosition({ ...input, events, tick: 240 })?.x).toBe(192.5);
    expect(resolveMelodyReadingPosition({ ...input, events, tick: 480 })?.x).toBe(285);
    expect(resolveMelodyReadingPosition({ ...input, events, tick: 1920 })?.x).toBe(500);
  });

  it.each(MELODY_RHYTHM_TEMPLATES.map((rhythm, index) => [index + 1, rhythm] as const))(
    "meets real rendered onsets for rhythm template %i in both clefs and selected measures",
    (_index, rhythm) => {
      vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({ measureText: (text: string) => ({
        width: text.length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2,
        actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 8, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2,
      }) } as CanvasRenderingContext2D);
      for (const staff of ["treble", "bass"] as const) {
        const score: StaffBuilderScore = {
          schemaVersion: 4, id: "reading", title: "Reading", createdAt: "2026-01-01", updatedAt: "2026-01-01",
          tempoBpm: 60, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", annotations: [], ties: [],
          measures: Array.from({ length: 2 }, (_, measureIndex) => {
            let startTick = 0;
            return { id: `measure-${measureIndex}`, events: rhythm.map((duration, index): StaffBuilderEvent => {
              const octave = (staff === "treble" ? 4 : 3) + index % 2;
              const event: StaffBuilderEvent = {
                id: `measure-${measureIndex}-event-${index}`, staff, startTick, kind: "notes", rhythm: { status: "final", duration },
                pitches: [{ id: `pitch-${measureIndex}-${index}`, midiNumber: (octave + 1) * 12, letter: "C", accidental: "natural", octave }],
              };
              startTick += durationToTicks(duration);
              return event;
            }) };
          }),
        };
        for (let measureIndex = 0; measureIndex < score.measures.length; measureIndex++) {
          const { anchors } = renderStaffBuilderMeasure(document.createElement("div"), score, measureIndex, { visibleStaff: staff });
          const events = score.measures[measureIndex]!.events;
          for (const event of events) expect(resolveMelodyReadingPosition({ anchors, events, staff, tick: event.startTick })?.x)
            .toBe(anchors.authoritativeEvents.get(event.id)!.onsetX);
          expect(resolveMelodyReadingPosition({ anchors, events, staff, tick: 1920 })?.x).toBe(anchors.timeline.rhythmicEndX);
        }
      }
    },
  );
});
