import { describe, expect, it } from "vitest";
import { appendStaffBuilderMeasure, createStaffBuilderScore, insertUnresolvedStaffBuilderNotes, setStaffBuilderMeasureKeySignature, type StaffBuilderFactories } from "./staff-builder-score";
import { commitStaffBuilderPendingCapture, DEFAULT_STAFF_BUILDER_CAPTURE_STATE, formatStaffBuilderCapturePosition, moveStaffBuilderCaptureBackward, moveStaffBuilderCaptureForward, routeStaffBuilderCapturePitch } from "./staff-builder-capture";

function factories(): StaffBuilderFactories {
  let id = 0;
  let time = 0;
  return { createId: () => `id-${++id}`, now: () => `2026-01-01T00:00:${String(time++).padStart(2, "0")}.000Z` };
}

function score(factory = factories()) {
  return createStaffBuilderScore({ title: "Capture", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: factory });
}

describe("Staff Builder capture operations", () => {
  it("defines the approved initial capture state", () => {
    expect(DEFAULT_STAFF_BUILDER_CAPTURE_STATE).toEqual({ cursor: { measureIndex: 0, offsetTicks: 0 }, stepDuration: "quarter", inputMode: "grand" });
  });

  it("routes Grand Staff around middle C while forced modes use one staff", () => {
    expect([59, 60].map((pitch) => routeStaffBuilderCapturePitch("grand", pitch))).toEqual(["bass", "treble"]);
    expect([48, 72].map((pitch) => routeStaffBuilderCapturePitch("treble", pitch))).toEqual(["treble", "treble"]);
    expect([48, 72].map((pitch) => routeStaffBuilderCapturePitch("bass", pitch))).toEqual(["bass", "bass"]);
  });

  it.each([
    ["quarter", 480],
    ["eighth", 240],
    ["sixteenth", 120],
  ] as const)("moves forward and backward by %s", (stepDuration, offsetTicks) => {
    const current = score();
    const forward = moveStaffBuilderCaptureForward(current, { measureIndex: 0, offsetTicks: 0 }, stepDuration);
    expect(forward).toMatchObject({ cursor: { measureIndex: 0, offsetTicks }, appendedMeasure: false });
    expect(moveStaffBuilderCaptureBackward(current, forward.cursor, stepDuration)).toEqual({ measureIndex: 0, offsetTicks: 0 });
  });

  it.each([
    ["quarter", 1440],
    ["eighth", 1680],
    ["sixteenth", 1800],
  ] as const)("appends exactly one inherited-context measure when %s crosses the final boundary", (stepDuration, offsetTicks) => {
    const factory = factories();
    const changed = setStaffBuilderMeasureKeySignature(score(factory), 0, "g-major", factory);
    const result = moveStaffBuilderCaptureForward(changed, { measureIndex: 0, offsetTicks }, stepDuration, factory);
    expect(result.cursor).toEqual({ measureIndex: 1, offsetTicks: 0 });
    expect(result.score.measures).toHaveLength(2);
    expect(result.score.measures[1]).toMatchObject({ events: [] });
    expect(result.score.measures[1]).not.toHaveProperty("keySignatureChange");
    expect(result.appendedMeasure).toBe(true);
  });

  it("moves to tick zero when a changed step would overshoot the final boundary", () => {
    const current = score();
    const result = moveStaffBuilderCaptureForward(current, { measureIndex: 0, offsetTicks: 1800 }, "quarter", factories());
    expect(result.cursor).toEqual({ measureIndex: 1, offsetTicks: 0 });
    expect(result.score.measures).toHaveLength(2);
  });

  it("normalizes an overshoot into an existing next measure to tick zero without appending", () => {
    const factory = factories();
    const current = appendStaffBuilderMeasure(score(factory), factory);
    const result = moveStaffBuilderCaptureForward(current, { measureIndex: 0, offsetTicks: 1800 }, "quarter", factory);
    expect(result.cursor).toEqual({ measureIndex: 1, offsetTicks: 0 });
    expect(result.score).toBe(current);
    expect(result.score.measures).toHaveLength(2);
    expect(result.appendedMeasure).toBe(false);
  });

  it("does not append before movement crosses and keeps previous at the first position as a no-op", () => {
    const current = score();
    expect(moveStaffBuilderCaptureForward(current, { measureIndex: 0, offsetTicks: 1320 }, "quarter")).toMatchObject({ cursor: { measureIndex: 0, offsetTicks: 1800 }, appendedMeasure: false });
    const first = { measureIndex: 0, offsetTicks: 0 } as const;
    expect(moveStaffBuilderCaptureBackward(current, first, "quarter")).toBe(first);
  });

  it("commits sorted unresolved treble and bass groups with effective-key spelling", () => {
    const factory = factories();
    const current = setStaffBuilderMeasureKeySignature(score(factory), 0, "g-major", factory);
    const committed = commitStaffBuilderPendingCapture(current, { measureIndex: 0, offsetTicks: 240 }, { treble: [69, 66, 66], bass: [54] }, factory);
    const events = committed.measures[0]?.events ?? [];
    expect(events).toHaveLength(2);
    expect(events.every(({ startTick, rhythm }) => startTick === 240 && rhythm.status === "unresolved")).toBe(true);
    const treble = events.find(({ staff }) => staff === "treble");
    expect(treble?.kind === "notes" ? treble.pitches.map(({ midiNumber, letter, accidental }) => ({ midiNumber, letter, accidental })) : []).toEqual([
      { midiNumber: 66, letter: "F", accidental: "sharp" },
      { midiNumber: 69, letter: "A", accidental: "natural" },
    ]);
  });

  it("replaces an existing same-staff position as a unit and leaves empty commits unchanged", () => {
    const factory = factories();
    const original = insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60, 64], factories: factory });
    expect(commitStaffBuilderPendingCapture(original, { measureIndex: 0, offsetTicks: 0 }, { treble: [], bass: [] }, factory)).toBe(original);
    const replaced = commitStaffBuilderPendingCapture(original, { measureIndex: 0, offsetTicks: 0 }, { treble: [67], bass: [] }, factory);
    const event = replaced.measures[0]?.events[0];
    expect(event?.kind === "notes" ? event.pitches.map(({ midiNumber }) => midiNumber) : []).toEqual([67]);
  });

  it.each([
    ["4/4", 0, "Beat 1 (quarter-note beat; tick 0)"],
    ["4/4", 240, "Beat 1, eighth-note subdivision (tick 240)"],
    ["4/4", 360, "Beat 1, fourth sixteenth-note position (tick 360)"],
    ["3/4", 1200, "Beat 3, eighth-note subdivision (tick 1200)"],
    ["6/8", 0, "Eighth-note position 1 (compound meter; tick 0)"],
    ["6/8", 120, "Eighth-note position 1, second sixteenth-note position (compound meter; tick 120)"],
    ["6/8", 480, "Eighth-note position 3 (compound meter; tick 480)"],
  ] as const)("formats %s tick %i using meter-aware terminology", (timeSignature, offsetTicks, expected) => {
    expect(formatStaffBuilderCapturePosition(timeSignature, offsetTicks)).toBe(expected);
  });
});
