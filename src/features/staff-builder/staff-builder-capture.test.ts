import { describe, expect, it } from "vitest";
import { appendStaffBuilderMeasure, createStaffBuilderScore, insertUnresolvedStaffBuilderNotes, setStaffBuilderMeasureKeySignature, type StaffBuilderFactories } from "./staff-builder-score";
import { commitStaffBuilderCaptureRest, commitStaffBuilderPendingCapture, DEFAULT_STAFF_BUILDER_CAPTURE_STATE, formatStaffBuilderCapturePosition, moveStaffBuilderCaptureBackward, moveStaffBuilderCaptureForward, routeStaffBuilderCapturePitch } from "./staff-builder-capture";
import type { StaffBuilderEvent, StaffBuilderScore } from "./staff-builder-types";
import { deriveStaffBuilderVoices } from "./staff-builder-voices";

function factories(): StaffBuilderFactories {
  let id = 0;
  let time = 0;
  return { createId: () => `id-${++id}`, now: () => `2026-01-01T00:00:${String(time++).padStart(2, "0")}.000Z` };
}

function score(factory = factories()) {
  return createStaffBuilderScore({ title: "Capture", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: factory });
}

describe("Staff Builder capture operations", () => {
  it.each([
    { midiNumbers: [60], label: "later note" },
    { midiNumbers: [60, 64, 67], label: "later chord" },
  ] as const)("keeps a sustained same-staff event when capturing a $label", ({ midiNumbers }) => {
    const factory = factories();
    const sustain: StaffBuilderEvent = { id: "sustain", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "dotted-quarter" }, pitches: [{ id: "e", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 }] };
    const current: StaffBuilderScore = { ...score(factory), measures: [{ id: "m", events: [sustain] }] };
    const committed = commitStaffBuilderPendingCapture(current, { measureIndex: 0, offsetTicks: 480 }, { treble: midiNumbers, bass: [] }, factory);
    expect(committed.measures[0]?.events).toContain(sustain);
    expect(committed.measures[0]?.events.find(({ startTick }) => startTick === 480)).toMatchObject({ kind: "notes", pitches: midiNumbers.map((midiNumber) => ({ midiNumber })) });
    expect(deriveStaffBuilderVoices(committed.measures[0]!.events, "treble", 1920)).toHaveLength(2);
  });

  it("keeps a sustaining chord when a later note is captured", () => {
    const factory = factories();
    const chord: StaffBuilderEvent = { id: "chord", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "half" }, pitches: [
      { id: "c", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }, { id: "e", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 },
    ] };
    const current: StaffBuilderScore = { ...score(factory), measures: [{ id: "m", events: [chord] }] };
    const committed = commitStaffBuilderPendingCapture(current, { measureIndex: 0, offsetTicks: 480 }, { treble: [67], bass: [] }, factory);
    expect(committed.measures[0]?.events[0]).toBe(chord);
    expect(committed.measures[0]?.events).toHaveLength(2);
  });

  it("allows a later authored rest beside a sustaining note and replaces only at an exact onset", () => {
    const factory = factories();
    const sustain: StaffBuilderEvent = { id: "sustain", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "half" }, pitches: [{ id: "p", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }] };
    const current: StaffBuilderScore = { ...score(factory), measures: [{ id: "m", events: [sustain] }] };
    const later = commitStaffBuilderCaptureRest(current, { ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, cursor: { measureIndex: 0, offsetTicks: 480 }, inputMode: "treble", stepDuration: "eighth" }, factory);
    expect(later.ok && later.score.measures[0]?.events).toHaveLength(2);
    const replaced = commitStaffBuilderCaptureRest(current, { ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, inputMode: "treble" }, factory);
    expect(replaced.ok && replaced.score.measures[0]?.events).toHaveLength(1);
    expect(replaced.ok && replaced.score.measures[0]?.events[0]).toMatchObject({ kind: "rest", startTick: 0 });
  });

  it("preserves every source event through a 6/8 Hallelujah-style grand-staff capture sequence", () => {
    const factory = factories();
    const sustain: StaffBuilderEvent = { id: "e", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "dotted-quarter" }, pitches: [{ id: "ep", midiNumber: 64, letter: "E", accidental: "natural", octave: 4 }] };
    const bass: StaffBuilderEvent = { id: "bass", kind: "notes", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "dotted-half" }, pitches: [{ id: "bp", midiNumber: 48, letter: "C", accidental: "natural", octave: 3 }] };
    let current: StaffBuilderScore = { ...score(factory), initialTimeSignature: "6/8", measures: [{ id: "m", events: [sustain, bass] }] };
    current = commitStaffBuilderPendingCapture(current, { measureIndex: 0, offsetTicks: 480 }, { treble: [60], bass: [] }, factory);
    current = commitStaffBuilderPendingCapture(current, { measureIndex: 0, offsetTicks: 720 }, { treble: [62], bass: [50] }, factory);
    expect(current.measures[0]?.events.map(({ id, staff, startTick }) => ({ id, staff, startTick }))).toEqual(expect.arrayContaining([
      { id: "e", staff: "treble", startTick: 0 }, { id: "bass", staff: "bass", startTick: 0 },
      expect.objectContaining({ staff: "treble", startTick: 480 }), expect.objectContaining({ staff: "treble", startTick: 720 }), expect.objectContaining({ staff: "bass", startTick: 720 }),
    ]));
    expect(deriveStaffBuilderVoices(current.measures[0]!.events, "treble", 1440).length).toBeGreaterThanOrEqual(2);
    expect(deriveStaffBuilderVoices(current.measures[0]!.events, "bass", 1440)).toHaveLength(2);
  });
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

  it("commits sorted final-quarter treble and bass groups with effective-key spelling", () => {
    const factory = factories();
    const current = setStaffBuilderMeasureKeySignature(score(factory), 0, "g-major", factory);
    const committed = commitStaffBuilderPendingCapture(current, { measureIndex: 0, offsetTicks: 240 }, { treble: [69, 66, 66], bass: [54] }, factory);
    const events = committed.measures[0]?.events ?? [];
    expect(events).toHaveLength(2);
    expect(events.every(({ startTick, rhythm }) => startTick === 240 && rhythm.status === "final" && rhythm.duration === "quarter")).toBe(true);
    const treble = events.find(({ staff }) => staff === "treble");
    expect(treble?.kind === "notes" ? treble.pitches.map(({ midiNumber, letter, accidental }) => ({ midiNumber, letter, accidental })) : []).toEqual([
      { midiNumber: 66, letter: "F", accidental: "sharp" },
      { midiNumber: 69, letter: "A", accidental: "natural" },
    ]);
  });

  it.each([
    ["quarter", 480],
    ["eighth", 240],
    ["sixteenth", 120],
  ] as const)("captures a final quarter while %s Step Duration advances by %i ticks", (stepDuration, expectedOffset) => {
    const factory = factories();
    const current = score(factory);
    const committed = commitStaffBuilderPendingCapture(current, { measureIndex: 0, offsetTicks: 0 }, { treble: [60, 64], bass: [] }, factory);
    const moved = moveStaffBuilderCaptureForward(committed, { measureIndex: 0, offsetTicks: 0 }, stepDuration, factory);
    expect(committed.measures[0]?.events[0]).toMatchObject({ kind: "notes", rhythm: { status: "final", duration: "quarter" }, pitches: [{ midiNumber: 60 }, { midiNumber: 64 }] });
    expect(moved.cursor).toEqual({ measureIndex: 0, offsetTicks: expectedOffset });
  });

  it("replaces an existing same-staff position as a unit and leaves empty commits unchanged", () => {
    const factory = factories();
    let original = insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60, 64], factories: factory });
    original = insertUnresolvedStaffBuilderNotes(original, { measureIndex: 0, staff: "bass", startTick: 0, midiNumbers: [48], factories: factory });
    const replacedEvent = original.measures[0]?.events.find(({ staff }) => staff === "treble");
    original = { ...original, ties: [{ id: "existing-tie", fromEventId: replacedEvent?.id ?? "", fromPitchId: replacedEvent?.kind === "notes" ? replacedEvent.pitches[0]?.id ?? "" : "", toEventId: "missing-event", toPitchId: "missing-pitch" }] };
    expect(commitStaffBuilderPendingCapture(original, { measureIndex: 0, offsetTicks: 0 }, { treble: [], bass: [] }, factory)).toBe(original);
    const replaced = commitStaffBuilderPendingCapture(original, { measureIndex: 0, offsetTicks: 0 }, { treble: [67], bass: [] }, factory);
    const event = replaced.measures[0]?.events.find(({ staff }) => staff === "treble");
    expect(event?.kind === "notes" ? event.pitches.map(({ midiNumber }) => midiNumber) : []).toEqual([67]);
    expect(event?.rhythm).toEqual({ status: "final", duration: "quarter" });
    expect(replaced.measures[0]?.events.find(({ staff }) => staff === "bass")).toBe(original.measures[0]?.events.find(({ staff }) => staff === "bass"));
    expect(replaced.ties).toEqual(original.ties);
  });

  it("preserves a late-measure final quarter capture for structural validation", () => {
    const factory = factories();
    const committed = commitStaffBuilderPendingCapture(score(factory), { measureIndex: 0, offsetTicks: 1800 }, { treble: [60], bass: [] }, factory);
    expect(committed.measures[0]?.events[0]).toMatchObject({ startTick: 1800, rhythm: { status: "final", duration: "quarter" } });
  });

  it.each([
    ["treble", ["treble"]],
    ["bass", ["bass"]],
    ["grand", ["bass", "treble"]],
  ] as const)("adds capture rests atomically for %s routing and replaces only targeted staves", (inputMode, expectedStaves) => {
    const factory = factories();
    let current = insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60], factories: factory });
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "bass", startTick: 0, midiNumbers: [48], factories: factory });
    const result = commitStaffBuilderCaptureRest(current, { cursor: { measureIndex: 0, offsetTicks: 0 }, inputMode, stepDuration: "eighth" }, factory);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const atPosition = result.score.measures[0]!.events.filter(({ startTick }) => startTick === 0);
    expect(atPosition).toHaveLength(2);
    for (const staff of ["treble", "bass"] as const) {
      const event = atPosition.find((item) => item.staff === staff)!;
      if ((expectedStaves as readonly string[]).includes(staff)) expect(event).toMatchObject({ kind: "rest", rhythm: { status: "final", duration: "eighth" } });
      else expect(event).toBe(current.measures[0]!.events.find((item) => item.staff === staff));
    }
  });

  it.each(["quarter", "eighth", "sixteenth"] as const)("uses the exact %s Step Duration for capture rests", (stepDuration) => {
    const result = commitStaffBuilderCaptureRest(score(), { ...DEFAULT_STAFF_BUILDER_CAPTURE_STATE, inputMode: "treble", stepDuration });
    expect(result.ok && result.score.measures[0]!.events[0]).toMatchObject({ kind: "rest", rhythm: { status: "final", duration: stepDuration } });
  });

  it("rejects the entire Grand Staff rest operation when a targeted event participates in a tie", () => {
    const factory = factories();
    let current = insertUnresolvedStaffBuilderNotes(score(factory), { measureIndex: 0, staff: "treble", startTick: 0, midiNumbers: [60], factories: factory });
    current = insertUnresolvedStaffBuilderNotes(current, { measureIndex: 0, staff: "bass", startTick: 0, midiNumbers: [48], factories: factory });
    const treble = current.measures[0]!.events.find(({ staff }) => staff === "treble")!;
    const tied = { ...current, ties: [{ id: "tie", fromEventId: treble.id, fromPitchId: treble.kind === "notes" ? treble.pitches[0]!.id : "", toEventId: "later", toPitchId: "later-pitch" }] };
    expect(commitStaffBuilderCaptureRest(tied, DEFAULT_STAFF_BUILDER_CAPTURE_STATE, factory)).toEqual({ ok: false, error: "tied-event", score: tied });
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
