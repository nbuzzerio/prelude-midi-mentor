import { describe, expect, it } from "vitest";
import type { StaffBuilderRenderAnchors } from "@/features/staff-builder/notation/render-staff-builder-measure";
import { continuousReadingEnvelope, continuousReadingSlots, continuousReadingScrollLeft, resolveContinuousReadingPosition } from "./continuous-reading";
import { measure, note, testScore } from "./continuous-test-fixtures";

const events = [note("upper", 0), note("lower", 0, 48, "quarter", "bass"), note("late", 480, 62)];
function anchors() {
  return { authoritativeEvents: new Map(events.map(e => [e.id, { eventId: e.id, staff: e.staff, startTick: e.startTick, onsetX: e.startTick ? 310 : 140 }])),
    timeline: { rhythmicStartX: 120, rhythmicEndX: 600, capacityTicks: 1920, y: 30, height: 200 } } as unknown as StaffBuilderRenderAnchors;
}
describe("A1 bounded grand-staff reading geometry", () => {
  it("holds the opening window on narrow screens and then follows at readable scale", () => {
    expect(continuousReadingScrollLeft(195, 260, 700, 195)).toBe(0);
    expect(continuousReadingScrollLeft(0, 260, 700, 195)).toBe(0);
    expect(continuousReadingScrollLeft(400, 260, 700, 195)).toBe(205);
    expect(continuousReadingScrollLeft(700, 260, 700, 195)).toBe(440);
  });
  it("keeps the upcoming and prepared measures in their original physical slots", () => {
    const opening = continuousReadingSlots(3, 18, 3), next = continuousReadingSlots(3, 18, 4);
    expect(opening).toHaveLength(3); expect(opening.filter(s => !s.prepared)).toHaveLength(2);
    for (const index of [4, 5]) expect(next.find(s => s.measureIndex === index)?.slot).toBe(opening.find(s => s.measureIndex === index)?.slot);
    expect(continuousReadingSlots(3, 18, 18)).toEqual([{ measureIndex: 18, slot: 1, prepared: false }]);
    expect(continuousReadingSlots(3, 18, 9, true)).toHaveLength(1);
  });
  it("uses actual aligned onset X positions across both staves and interpolates only between them", () => {
    expect(resolveContinuousReadingPosition(anchors(), events, 0)?.x).toBe(140);
    expect(resolveContinuousReadingPosition(anchors(), events, 480)?.x).toBe(310);
    expect(resolveContinuousReadingPosition(anchors(), events, 240)?.x).toBe(225);
    expect(resolveContinuousReadingPosition(anchors(), events, 1920)?.x).toBe(600);
    expect(resolveContinuousReadingPosition(anchors(), events, undefined)).toBeNull();
  });
  it("hides rather than guesses when anchors are stale, missing or disagree across staves", () => {
    for (const mutation of ["missing", "misaligned", "stale"] as const) {
      const a = anchors(), map = new Map(a.authoritativeEvents);
      if (mutation === "missing") map.delete("lower");
      else map.set("lower", { ...map.get("lower")!, ...(mutation === "misaligned" ? { onsetX: 200 } : { startTick: 120 }) });
      expect(resolveContinuousReadingPosition({ ...a, authoritativeEvents: map }, events, 0)).toBeNull();
    }
  });
  it("derives a stable whole-range pitch envelope including extreme ledger notes and inherited clefs", () => {
    const source = { ...testScore(), measures: [measure("a", [note("low", 0, 24, "quarter", "bass")]),
      { ...measure("b", [note("high", 0, 108)]), clefChanges: { treble: "bass" as const } }] };
    const envelope = continuousReadingEnvelope(source, 0, 1);
    expect(envelope.pitchSources.flatMap(s => s.pitches).map(p => p.octave)).toEqual([1, 8]);
    expect(envelope.pitchSources[1]?.clef).toBe("bass");
  });
});
