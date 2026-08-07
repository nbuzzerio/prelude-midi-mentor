import { describe, expect, it } from "vitest";
import { durationToTicks, STAFF_BUILDER_DURATIONS, type StaffBuilderDuration } from "./staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderPitch, StaffBuilderScoreV1, StaffBuilderStaff } from "./staff-builder-types";
import { projectStaffBuilderEventAudition, projectStaffBuilderPlayback } from "./staff-builder-playback";

let nextId = 0;
const pitch = (midiNumber: number, id = `p-${++nextId}`): StaffBuilderPitch => ({ id, midiNumber, letter: midiNumber === 64 ? "E" : midiNumber === 67 ? "G" : "C", accidental: "natural", octave: 4 });
const note = (id: string, staff: StaffBuilderStaff, startTick: number, duration: StaffBuilderDuration, pitches = [pitch(60)]): StaffBuilderEvent => ({ id, kind: "notes", staff, startTick, rhythm: { status: "final", duration }, pitches });
const rest = (id: string, staff: StaffBuilderStaff, startTick: number, duration: StaffBuilderDuration): StaffBuilderEvent => ({ id, kind: "rest", staff, startTick, rhythm: { status: "final", duration } });
const baseScore = (measures: StaffBuilderScoreV1["measures"], options: Partial<Pick<StaffBuilderScoreV1, "initialTimeSignature" | "initialKeySignatureId" | "tempoBpm" | "ties">> = {}): StaffBuilderScoreV1 => ({ schemaVersion: 1, id: "score", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: options.tempoBpm ?? 120, initialKeySignatureId: options.initialKeySignatureId ?? "c-major", initialTimeSignature: options.initialTimeSignature ?? "4/4", measures, ties: options.ties ?? [] });
const fullRest = (id: string, staff: StaffBuilderStaff, duration: StaffBuilderDuration = "whole") => rest(id, staff, 0, duration);

function remainderRests(staff: StaffBuilderStaff, startTick: number, remainingTicks: number): StaffBuilderEvent[] {
  const ordered = [...STAFF_BUILDER_DURATIONS].sort((a, b) => durationToTicks(b) - durationToTicks(a));
  const events: StaffBuilderEvent[] = [];
  let tick = startTick;
  let remaining = remainingTicks;
  while (remaining > 0) {
    const duration = ordered.find((candidate) => durationToTicks(candidate) <= remaining)!;
    events.push(rest(`rest-${staff}-${tick}`, staff, tick, duration));
    tick += durationToTicks(duration);
    remaining -= durationToTicks(duration);
  }
  return events;
}

function tiedScore(chain = false, partial = false): StaffBuilderScoreV1 {
  const sourcePitches = partial ? [pitch(60, "from-c"), pitch(67, "from-g")] : [pitch(60, "from-c")];
  const destinationPitches = partial ? [pitch(60, "mid-c"), pitch(64, "mid-e")] : [pitch(60, "mid-c")];
  const measures: StaffBuilderScoreV1["measures"][number][] = [
    { id: "m1", events: [rest("lead", "treble", 0, "dotted-half"), note("from", "treble", 1440, "quarter", sourcePitches), fullRest("b1", "bass")] },
    { id: "m2", events: chain ? [note("mid", "treble", 0, "whole", destinationPitches), fullRest("b2", "bass")] : [note("mid", "treble", 0, "quarter", destinationPitches), rest("m2-tail", "treble", 480, "dotted-half"), fullRest("b2", "bass")] },
  ];
  const ties: StaffBuilderScoreV1["ties"][number][] = [{ id: "tie-1", fromEventId: "from", fromPitchId: "from-c", toEventId: "mid", toPitchId: "mid-c" }];
  if (chain) {
    measures.push({ id: "m3", events: [note("to", "treble", 0, "quarter", [pitch(60, "to-c")]), rest("m3-tail", "treble", 480, "dotted-half"), fullRest("b3", "bass")] });
    ties.push({ id: "tie-2", fromEventId: "mid", fromPitchId: "mid-c", toEventId: "to", toPitchId: "to-c" });
  }
  return baseScore(measures, { ties });
}

describe("Staff Builder playback projection", () => {
  it("projects a note, chord, rests omission, and treble/bass simultaneity deterministically", () => {
    const score = baseScore([{ id: "m", events: [note("chord", "treble", 0, "whole", [pitch(60), pitch(64), pitch(67)]), fullRest("bass", "bass")] }]);
    expect(projectStaffBuilderPlayback(score, { kind: "entire-piece" })).toMatchObject({ events: [{ notes: [60, 64, 67], startTimeMs: 0, durationMs: 2000 }], durationMs: 2000 });
  });

  it("preserves simultaneous events with different durations", () => {
    const score = baseScore([{ id: "m", events: [note("treble", "treble", 0, "whole", [pitch(60)]), note("bass-a", "bass", 0, "half", [pitch(48)]), note("bass-b", "bass", 960, "half", [pitch(50)])] }]);
    expect(projectStaffBuilderPlayback(score, { kind: "entire-piece" }).events).toEqual([
      { notes: [48], startTimeMs: 0, durationMs: 1000 },
      { notes: [60], startTimeMs: 0, durationMs: 2000 },
      { notes: [50], startTimeMs: 1000, durationMs: 1000 },
    ]);
  });

  it.each(STAFF_BUILDER_DURATIONS)("converts %s through absolute tick boundaries", (duration) => {
    const ticks = durationToTicks(duration);
    const score = baseScore([{ id: "m", events: [note("n", "treble", 0, duration), ...remainderRests("treble", ticks, 1920 - ticks), fullRest("bass", "bass")] }], { tempoBpm: 120 });
    expect(projectStaffBuilderPlayback(score, { kind: "entire-piece" }).events[0]).toEqual({ notes: [60], startTimeMs: 0, durationMs: Math.round(ticks * 60_000 / (120 * 480)) });
  });

  it("uses variable inherited measure capacities and ignores key changes for MIDI", () => {
    const score = baseScore([
      { id: "m1", events: [fullRest("t1", "treble"), fullRest("b1", "bass")] },
      { id: "m2", keySignatureChange: "g-major", timeSignatureChange: "3/4", events: [fullRest("t2", "treble", "dotted-half"), fullRest("b2", "bass", "dotted-half")] },
      { id: "m3", timeSignatureChange: "6/8", events: [note("n", "treble", 0, "dotted-half", [pitch(66)]), fullRest("b3", "bass", "dotted-half")] },
    ]);
    const projection = projectStaffBuilderPlayback(score, { kind: "entire-piece" });
    expect(projection.scopeEndTick).toBe(4800);
    expect(projection.events).toEqual([{ notes: [66], startTimeMs: 3500, durationMs: 1500 }]);
  });

  it("projects current measure, from-position, and entire-piece boundaries", () => {
    const score = baseScore([{ id: "m1", events: [fullRest("t1", "treble"), fullRest("b1", "bass")] }, { id: "m2", events: [note("n", "treble", 0, "whole"), fullRest("b2", "bass")] }]);
    expect(projectStaffBuilderPlayback(score, { kind: "measure", measureIndex: 0 })).toMatchObject({ events: [], scopeStartTick: 0, scopeEndTick: 1920, durationMs: 2000 });
    expect(projectStaffBuilderPlayback(score, { kind: "measure", measureIndex: 1 })).toMatchObject({ events: [{ startTimeMs: 0, durationMs: 2000 }], scopeStartTick: 1920, scopeEndTick: 3840 });
    expect(projectStaffBuilderPlayback(score, { kind: "from-position", position: { measureIndex: 1, offsetTicks: 480 } })).toMatchObject({ events: [{ startTimeMs: 0, durationMs: 1500 }], durationMs: 1500 });
    expect(projectStaffBuilderPlayback(score, { kind: "entire-piece" }).durationMs).toBe(4000);
  });

  it("rejects structurally invalid scores and invalid scope positions", () => {
    const invalid = baseScore([{ id: "m", events: [] }]);
    expect(() => projectStaffBuilderPlayback(invalid, { kind: "entire-piece" })).toThrow(/structurally valid/);
    const valid = baseScore([{ id: "m", events: [fullRest("t", "treble"), fullRest("b", "bass")] }]);
    expect(() => projectStaffBuilderPlayback(valid, { kind: "from-position", position: { measureIndex: 0, offsetTicks: 1920 } })).toThrow(/outside/);
  });

  it("flattens a cross-measure tie without retriggering and clips it for Current Measure", () => {
    const score = tiedScore();
    expect(projectStaffBuilderPlayback(score, { kind: "entire-piece" }).events).toEqual([{ notes: [60], startTimeMs: 1500, durationMs: 1000 }]);
    expect(projectStaffBuilderPlayback(score, { kind: "measure", measureIndex: 1 }).events).toEqual([{ notes: [60], startTimeMs: 0, durationMs: 500 }]);
  });

  it("flattens manual multi-measure chains and clips incoming continuations from position", () => {
    const score = tiedScore(true);
    expect(projectStaffBuilderPlayback(score, { kind: "entire-piece" }).events).toEqual([{ notes: [60], startTimeMs: 1500, durationMs: 3000 }]);
    expect(projectStaffBuilderPlayback(score, { kind: "from-position", position: { measureIndex: 1, offsetTicks: 480 } }).events).toEqual([{ notes: [60], startTimeMs: 0, durationMs: 2000 }]);
  });

  it("preserves partial chord ties and attacks untied destination pitches", () => {
    const score = tiedScore(false, true);
    expect(projectStaffBuilderPlayback(score, { kind: "entire-piece" }).events).toEqual([
      { notes: [67], startTimeMs: 1500, durationMs: 500 },
      { notes: [60], startTimeMs: 1500, durationMs: 1000 },
      { notes: [64], startTimeMs: 2000, durationMs: 500 },
    ]);
  });

  it("restores destination attacks after tie removal and retriggers repeated untied pitches", () => {
    const tied = tiedScore();
    const untied = { ...tied, ties: [] };
    expect(projectStaffBuilderPlayback(untied, { kind: "entire-piece" }).events).toEqual([
      { notes: [60], startTimeMs: 1500, durationMs: 500 },
      { notes: [60], startTimeMs: 2000, durationMs: 500 },
    ]);
  });

  it("re-attacks an already-sounding untied opposite-staff note at From Here", () => {
    const score = baseScore([{ id: "m", events: [rest("lead", "treble", 0, "quarter"), note("selected", "treble", 480, "quarter", [pitch(64)]), rest("tail", "treble", 960, "half"), note("bass", "bass", 0, "whole", [pitch(48)])] }]);
    expect(projectStaffBuilderPlayback(score, { kind: "from-position", position: { measureIndex: 0, offsetTicks: 480 } }).events).toEqual([
      { notes: [64], startTimeMs: 0, durationMs: 500 },
      { notes: [48], startTimeMs: 0, durationMs: 1500 },
    ]);
  });

  it("deduplicates identical MIDI pitches only when boundaries match", () => {
    const score = baseScore([{ id: "m", events: [note("t", "treble", 0, "whole", [pitch(60)]), note("b", "bass", 0, "whole", [pitch(60)])] }]);
    expect(projectStaffBuilderPlayback(score, { kind: "entire-piece" }).events).toEqual([{ notes: [60], startTimeMs: 0, durationMs: 2000 }]);
  });

  it("projects selected-event audition as a fixed standalone chord and rejects rests or unresolved rhythm", () => {
    expect(projectStaffBuilderEventAudition(note("n", "treble", 0, "sixteenth", [pitch(67), pitch(60)]))).toEqual({ notes: [60, 67], startTimeMs: 0, durationMs: 600 });
    expect(projectStaffBuilderEventAudition(rest("r", "treble", 0, "quarter"))).toBeNull();
    const unresolved: StaffBuilderEvent = { id: "u", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "unresolved" }, pitches: [pitch(60)] };
    expect(projectStaffBuilderEventAudition(unresolved)).toBeNull();
  });
});
