import { describe, expect, it } from "vitest";
import { advanceMidiDiagnosticContinuity, appendMidiDiagnosticEvent, EMPTY_MIDI_DIAGNOSTIC_CAPTURE, MIDI_DIAGNOSTIC_CAPTURE_LIMIT, type MidiDiagnosticCapture } from "./midi-diagnostic-capture";
import { decodeMidiDiagnosticMessage } from "./midi-diagnostic-message";
import { formatMidiDiagnosticReport } from "./midi-diagnostic-report";
function append(capture: MidiDiagnosticCapture, bytes: number[], time: number, id = "keys") {
  const { decoded, rawBytes } = decodeMidiDiagnosticMessage(bytes);
  return appendMidiDiagnosticEvent(capture, { decoded, rawBytes, source: { id, name: "Yamaha Keys" }, messageLength: rawBytes.length, eventTimeStampMs: time });
}
const report = (capture: MidiDiagnosticCapture) => formatMidiDiagnosticReport({ capture, version: "test-version" });

describe("MIDI Diagnostic Copy Report", () => {
  it("formats a deterministic compact report from raw-origin timing without mutating evidence", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0xf8], 100);
    capture = append(capture, [0xfe], 101);
    capture = append(capture, [0x90, 60, 60], 731.1);
    capture = append(capture, [0x90, 60, 0], 4251.2);
    capture = append(capture, [0x90, 60, 107], 5041.7);
    capture = append(capture, [0x80, 60, 27], 8440.3);
    const before = structuredClone(capture);
    const text = report(capture);
    expect(text).toBe(report(capture)); expect(capture).toEqual(before);
    expect(text).toContain("Prelude MIDI Diagnostic Report\nPrelude version: test-version");
    expect(text).toContain("Yamaha Keys (id=keys)");
    expect(text).toContain("Observed capture span: 8.340300s");
    expect(text).toContain("Note attacks represented: 2; paired releases: 2");
    expect(text).toContain("Attack: 0.631100s; release: 4.151200s; duration: 3.520100s");
    expect(text).toContain("Attack velocity: 107; release velocity: 27; release encoding: note-off");
    expect(text).toContain("release encoding: note-on-zero");
    expect(text).toContain("Raw sequences: attack=3; release=4");
    expect(text).toContain("OTHER MIDI EVENTS — retained evidence, capture sequence order\nNone");
    expect(text).toContain("including evicted messages, excluding paused messages");
  });

  it("summarizes hundreds of background events without individual event rows", () => {
    let capture = EMPTY_MIDI_DIAGNOSTIC_CAPTURE;
    for (let index = 0; index < 400; index++) capture = append(capture, [index % 2 ? 0xfe : 0xf8], index);
    const text = report(capture);
    expect(text).toContain("Timing Clock: detected; count=200"); expect(text).toContain("Active Sensing: detected; count=200");
    expect(text).not.toContain("raw #"); expect(text.split("\n").length).toBeLessThan(35);
  });

  it("reports controllers, repeated pedal values, unmatched release and SysEx compactly", () => {
    let capture = EMPTY_MIDI_DIAGNOSTIC_CAPTURE;
    for (const [index, bytes] of [[0xb0, 64, 63], [0xb0, 64, 64], [0xb0, 64, 80], [0xb0, 64, 80], [0xb0, 67, 123], [0x80, 60, 22], [0xf0, 0x43, 1, 0xf7]].entries()) capture = append(capture, bytes, index, "two");
    const text = report(capture);
    expect(text).toContain("Sustain Up — CC64 63"); expect(text).toContain("Sustain Down — CC64 64");
    expect(text.match(/Sustain Down — CC64 80/g)).toHaveLength(2);
    expect(text).toContain("controller=67;value=123"); expect(text).toContain("Unmatched Note Release");
    expect(text).toContain("unmatched releases: 1"); expect(text).toContain("System Exclusive; 4 bytes; full payload in Copy Capture");
  });

  it("labels truncation clearly and session background counts survive eviction", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0xfe], 0);
    for (let index = 0; index < MIDI_DIAGNOSTIC_CAPTURE_LIMIT; index++) capture = append(capture, [0xf8], index + 1);
    capture = append(capture, [0x80, 60, 0], 2000);
    const text = report(capture);
    expect(text).toContain("Partial evidence: older raw messages were dropped"); expect(text).toContain("older messages dropped: 2");
    expect(text).toContain("SUMMARY — retained evidence only"); expect(text).toContain("Note attacks represented: 0; paired releases: 0");
    expect(text).toContain("Active Sensing: detected; count=1"); expect(text).toContain("Timing Clock: detected; count=1000");
  });

  it("reports ambiguity and gaps without inferred pedal duration or synthetic releases", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 60], 0);
    capture = append(capture, [0x90, 60, 70], 10);
    capture = append(capture, [0x80, 60, 2], 20);
    capture = advanceMidiDiagnosticContinuity(capture);
    capture = append(capture, [0x80, 60, 2], 30);
    const text = report(capture);
    expect(text).toContain("ambiguous note instances: 2"); expect(text).toContain("FIFO pairing is an interpretation");
    expect(text).toContain("release: Release not observed; duration: unavailable/anomalous");
    expect(text).toContain("Continuity boundaries observed during this capture: 1");
    expect(text).toContain("unmatched releases: 1");
  });

  it("does not fabricate duration for backward/nonfinite times and safely handles empty captures", () => {
    const capture = append(append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, [0x90, 60, 1], 20), [0x80, 60, 0], 10);
    expect(report(capture)).toContain("duration: unavailable/anomalous"); expect(report(capture)).toContain("Release timing unavailable/anomalous");
    expect(report(EMPTY_MIDI_DIAGNOSTIC_CAPTURE)).toContain("Captured inputs:\n- none");
    expect(report(EMPTY_MIDI_DIAGNOSTIC_CAPTURE)).toContain("Note attacks represented: 0; paired releases: 0");
  });
});
