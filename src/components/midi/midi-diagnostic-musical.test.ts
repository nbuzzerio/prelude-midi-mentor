import { describe, expect, it } from "vitest";
import { advanceMidiDiagnosticContinuity, appendMidiDiagnosticEvent, EMPTY_MIDI_DIAGNOSTIC_CAPTURE, formatMidiDiagnosticCapture, MIDI_DIAGNOSTIC_CAPTURE_LIMIT, type MidiDiagnosticCapture } from "./midi-diagnostic-capture";
import { decodeMidiDiagnosticMessage } from "./midi-diagnostic-message";
import { formatMidiDiagnosticMusicalEvent, projectMidiDiagnosticMusicalEvents } from "./midi-diagnostic-musical";

function append(capture: MidiDiagnosticCapture, bytes: number[], time = 0, id = "keys"): MidiDiagnosticCapture {
  const { decoded, rawBytes } = decodeMidiDiagnosticMessage(bytes);
  return appendMidiDiagnosticEvent(capture, { decoded, rawBytes, messageLength: rawBytes.length, eventTimeStampMs: time, source: { id, name: id } });
}

describe("MIDI diagnostic retained musical projection", () => {
  it.each([{ release: [0x80, 60, 27] }, { release: [0x90, 60, 0] }])("pairs release encoding %j with precise timing and raw references", ({ release }) => {
    const capture = append(append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 72], 100.125), release, 3620.56789);
    const before = structuredClone(capture);
    const projection = projectMidiDiagnosticMusicalEvents(capture);
    expect(projection).toMatchObject({ pairedCount: 1, unmatchedAttackCount: 0, unmatchedReleaseCount: 0, ambiguousCount: 0 });
    expect(projection.notes[0]).toMatchObject({ ambiguous: false, anomalies: [] });
    expect(projection.notes[0]!.durationMs).toBeCloseTo(3520.44289, 9);
    expect(projection.notes[0]!.attack).toBe(capture.events[0]);
    expect(projection.notes[0]!.release).toBe(capture.events[1]);
    expect(projection.notes[0]!.release!.decoded).toMatchObject({ releaseVelocity: release[2], encoding: release[0] === 0x80 ? "note-off" : "note-on-zero" });
    expect(capture).toEqual(before);
  });

  it("keeps repeated pitch after release as independent ordinary instances", () => {
    let capture = EMPTY_MIDI_DIAGNOSTIC_CAPTURE;
    for (const [bytes, time] of [[[0x90, 60, 60], 631.1], [[0x90, 60, 0], 4151.2], [[0x90, 60, 107], 4941.7], [[0x90, 60, 0], 8340.3]] as const) capture = append(capture, [...bytes], time);
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result.pairedCount).toBe(2); expect(result.ambiguousCount).toBe(0);
    expect(result.notes.map(({ attack }) => attack.decoded)).toEqual(expect.arrayContaining([expect.objectContaining({ attackVelocity: 60 }), expect.objectContaining({ attackVelocity: 107 })]));
    expect(result.notes[0]!.durationMs).toBeCloseTo(3520.1, 9);
    expect(result.notes[1]!.durationMs).toBeCloseTo(3398.6, 9);
  });

  it("pairs overlapping identical keys FIFO and marks every affected instance ambiguous", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 60], 0);
    capture = append(capture, [0x90, 60, 107], 10);
    capture = append(capture, [0x80, 60, 1], 20);
    capture = append(capture, [0x90, 60, 0], 30);
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result).toMatchObject({ pairedCount: 2, ambiguousCount: 2 });
    expect(result.notes.map(({ attack, release, durationMs }) => [attack.sequence, release!.sequence, durationMs])).toEqual([[1, 3, 20], [2, 4, 20]]);
  });

  it("does not carry ambiguity into a later non-overlapping instance", () => {
    let capture = EMPTY_MIDI_DIAGNOSTIC_CAPTURE;
    for (const [bytes, time] of [[[0x90, 60, 1], 0], [[0x90, 60, 2], 1], [[0x80, 60, 0], 2], [[0x80, 60, 0], 3], [[0x90, 60, 3], 4], [[0x80, 60, 0], 5]] as const) capture = append(capture, [...bytes], time);
    expect(projectMidiDiagnosticMusicalEvents(capture).notes.map(({ ambiguous }) => ambiguous)).toEqual([true, true, false]);
  });

  it("keeps channels and simultaneous different pitches independent", () => {
    let capture = EMPTY_MIDI_DIAGNOSTIC_CAPTURE;
    for (const [bytes, time] of [[[0x90, 60, 60], 0], [[0x91, 60, 70], 0], [[0x90, 64, 80], 0], [[0x81, 60, 2], 10], [[0x80, 64, 3], 20], [[0x80, 60, 4], 30]] as const) capture = append(capture, [...bytes], time);
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result.notes.map(({ release }) => release!.sequence)).toEqual([6, 4, 5]); expect(result.ambiguousCount).toBe(0);
  });

  it("keeps input identities independent even when pitch/channel and names match", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 60], 0, "one");
    capture = append(capture, [0x90, 60, 70], 0, "two");
    capture = append(capture, [0x80, 60, 2], 10, "two");
    capture = append(capture, [0x80, 60, 3], 20, "one");
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result.notes.map(({ release }) => release!.source.id)).toEqual(["one", "two"]); expect(result.ambiguousCount).toBe(0);
  });

  it("retains unmatched attacks and chronological unmatched releases without invented duration", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x80, 61, 23], 0);
    capture = append(capture, [0x90, 60, 70], 20);
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result).toMatchObject({ unmatchedAttackCount: 1, unmatchedReleaseCount: 1, pairedCount: 0 });
    expect(result.notes[0]).toMatchObject({ release: null, durationMs: null });
    expect(result.rows.map(({ kind }) => kind)).toEqual(["event", "note"]);
  });

  it.each([undefined, "keys"])("prevents pairing across continuity boundary %s without inserting raw MIDI", (id) => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 70], 0);
    const attack = capture.events[0];
    capture = advanceMidiDiagnosticContinuity(capture, id);
    expect(capture.events).toEqual([attack]); expect(capture.totalCaptured).toBe(1);
    capture = append(capture, [0x80, 60, 23], 10);
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result).toMatchObject({ unmatchedAttackCount: 1, unmatchedReleaseCount: 1, pairedCount: 0 });
    expect(result.notes[0]!.release).toBeNull();
    expect(capture.events[1]!.continuitySegment).not.toBe(attack!.continuitySegment);
  });

  it("a source reconnect leaves another input's pending note independent", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 70], 0, "other");
    capture = advanceMidiDiagnosticContinuity(capture, "keys");
    capture = append(capture, [0x80, 60, 23], 10, "other");
    expect(projectMidiDiagnosticMusicalEvents(capture).pairedCount).toBe(1);
  });

  it.each([[Number.NaN, 30], [20, Number.POSITIVE_INFINITY], [20, 10]])("keeps pairing evidence with anomalous timestamps %j", (attackTime, releaseTime) => {
    const capture = append(append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 70], attackTime), [0x80, 60, 2], releaseTime);
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result.pairedCount).toBe(1); expect(result.notes[0]!.release!.sequence).toBe(2);
    expect(result.notes[0]!.durationMs).toBeNull(); expect(result.notes[0]!.anomalies.length).toBeGreaterThan(0);
  });

  it("preserves every sustain value and never extends key-release duration", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 70], 0);
    const values = [0, 63, 64, 127, 80, 80];
    for (const [index, value] of values.entries()) capture = append(capture, [0xb0, 64, value], index * 10);
    capture = append(capture, [0x80, 60, 20], 70);
    capture = append(capture, [0xb0, 64, 0], 200);
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result.notes[0]!.durationMs).toBe(70);
    expect(result.otherEvents).toHaveLength(7);
    expect(result.otherEvents.slice(0, 6).map(formatMidiDiagnosticMusicalEvent)).toEqual(values.map((value) => `Sustain ${value >= 64 ? "Down" : "Up"} — CC64 ${value}`));
  });

  it("flags a backward source timeline even when release is numerically later than attack", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 70], 100);
    capture = append(capture, [0xf8], 200);
    capture = append(capture, [0x80, 60, 2], 150);
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result.pairedCount).toBe(1); expect(result.notes[0]!.release!.sequence).toBe(3);
    expect(result.notes[0]!.durationMs).toBeNull(); expect(result.notes[0]!.anomalies).toContain("Release timing unavailable/anomalous; duration unavailable.");
  });

  it("does not confidently pair invalid 7-bit note payloads", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 128], 0);
    capture = append(capture, [0x80, 60, 0], 10);
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result.notes).toHaveLength(0); expect(result.otherEvents).toHaveLength(2);
    expect(capture.events[0]!.rawBytes).toEqual([0x90, 60, 128]);
  });

  it("preserves other controllers, pressure, program, pitch bend, transport, SysEx, and anomalies", () => {
    const messages = [[0xb0, 67, 99], [0xa0, 60, 50], [0xd0, 20], [0xc0, 4], [0xe0, 0, 64], [0xfa], [0xfc], [0xff], [0xf0, 0x43, 1, 0xf7], [0xf4], [], [0x90, 60], [0x90, 60, 70, 1]];
    let capture = EMPTY_MIDI_DIAGNOSTIC_CAPTURE;
    messages.forEach((bytes, index) => { capture = append(capture, bytes, index); });
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result.otherEvents.map(({ rawBytes }) => rawBytes)).toEqual(messages); expect(result.notes).toHaveLength(0);
  });

  it("suppresses only ordinary F8/FE while preserving every raw byte and unexpected variant", () => {
    let capture = EMPTY_MIDI_DIAGNOSTIC_CAPTURE;
    for (const bytes of [[0xf8], [0xfe], [0xf8, 1], [0xfe, 2]]) capture = append(capture, bytes);
    const before = structuredClone(capture);
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(result.otherEvents.map(({ rawBytes }) => rawBytes)).toEqual([[0xf8, 1], [0xfe, 2]]);
    expect(capture.backgroundCounts).toEqual({ timingClock: 1, activeSensing: 1 });
    const raw = formatMidiDiagnosticCapture({ capture, inputs: capture.observedInputs, version: "test" });
    expect(raw).toContain("Timing Clock"); expect(raw).toContain("Active Sensing"); expect(raw).toContain("F8 01"); expect(raw).toContain("FE 02");
    expect(capture.events).toHaveLength(4); expect(capture).toEqual(before);
  });

  it("marks overflow partial and does not reconstruct an evicted attack from a surviving release", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 70], 0);
    capture = append(capture, [0xfe], 1);
    for (let index = 0; index < MIDI_DIAGNOSTIC_CAPTURE_LIMIT; index++) capture = append(capture, [0xf8], index + 2);
    capture = append(capture, [0x80, 60, 2], 2000);
    const result = projectMidiDiagnosticMusicalEvents(capture);
    expect(capture.events).toHaveLength(1000); expect(capture.droppedCount).toBe(3);
    expect(capture.backgroundCounts).toEqual({ timingClock: 1000, activeSensing: 1 });
    expect(result).toMatchObject({ partialEvidence: true, pairedCount: 0, unmatchedReleaseCount: 1 }); expect(result.notes).toHaveLength(0);
  });

  it("Clear's empty state resets origin, counts, continuity, and sequences", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0xfe], 10, "constructor");
    capture = advanceMidiDiagnosticContinuity(capture, "constructor");
    expect(capture.continuityByInputId.constructor).toBe(1);
    const cleared = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 70], 100, "constructor");
    expect(cleared).toMatchObject({ continuityBreakCount: 0, backgroundCounts: { timingClock: 0, activeSensing: 0 }, originTimeStampMs: 100 });
    expect(cleared.events[0]).toMatchObject({ sequence: 1, relativeTimeMs: 0, continuitySegment: "0:0" });
  });
});
