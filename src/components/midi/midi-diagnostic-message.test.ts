import { describe, expect, it } from "vitest";
import { decodeMidiDiagnosticMessage, formatMidiDiagnosticData, formatMidiDiagnosticRawBytes } from "./midi-diagnostic-message";

const decode = (bytes: number[]) => decodeMidiDiagnosticMessage(Uint8Array.from(bytes));

describe("MIDI diagnostic message decoder", () => {
  it("decodes Note On on channels 1 and 16 with attack velocity", () => {
    expect(decode([0x90, 60, 34]).decoded).toMatchObject({ kind: "note-on", channel: 1, noteNumber: 60, noteName: "C4", attackVelocity: 34 });
    expect(decode([0x9f, 72, 127]).decoded).toMatchObject({ kind: "note-on", channel: 16, noteNumber: 72, noteName: "C5", attackVelocity: 127 });
  });

  it("distinguishes velocity-zero Note On release encoding from explicit Note Off and preserves release velocity", () => {
    expect(decode([0x91, 60, 0]).decoded).toMatchObject({ kind: "note-release", channel: 2, encoding: "note-on-zero", releaseVelocity: 0 });
    expect(decode([0x82, 61, 45]).decoded).toMatchObject({ kind: "note-release", channel: 3, encoding: "note-off", noteNumber: 61, releaseVelocity: 45 });
  });

  it("decodes polyphonic pressure, CC64 values, arbitrary CC, program, and channel pressure", () => {
    expect(decode([0xa0, 60, 71]).decoded).toMatchObject({ kind: "polyphonic-key-pressure", noteNumber: 60, pressure: 71 });
    for (const value of [0, 47, 127]) expect(decode([0xb0, 64, value]).decoded).toMatchObject({ kind: "control-change", controllerNumber: 64, controllerValue: value });
    expect(decode([0xb4, 67, 99]).decoded).toMatchObject({ kind: "control-change", channel: 5, controllerNumber: 67, controllerValue: 99 });
    expect(decode([0xc0, 12]).decoded).toMatchObject({ kind: "program-change", programNumber: 12 });
    expect(decode([0xdf, 88]).decoded).toMatchObject({ kind: "channel-pressure", channel: 16, pressure: 88 });
  });

  it("decodes minimum, center, and maximum pitch bend", () => {
    expect(decode([0xe0, 0, 0]).decoded).toMatchObject({ kind: "pitch-bend", value: 0, centeredValue: -8192 });
    expect(decode([0xe0, 0, 64]).decoded).toMatchObject({ kind: "pitch-bend", value: 8192, centeredValue: 0 });
    expect(decode([0xe0, 127, 127]).decoded).toMatchObject({ kind: "pitch-bend", value: 16383, centeredValue: 8191 });
  });

  it.each([
    [[0xf8], "Timing Clock"], [[0xfa], "Start"], [[0xfb], "Continue"], [[0xfc], "Stop"], [[0xfe], "Active Sensing"], [[0xff], "System Reset"],
    [[0xf1, 7], "MIDI Time Code Quarter Frame"], [[0xf3, 2], "Song Select"], [[0xf2, 1, 2], "Song Position Pointer"], [[0xf6], "Tune Request"],
  ] as const)("decodes system message %j", (bytes, type) => {
    expect(decode([...bytes]).decoded).toMatchObject({ kind: "system", type, channel: null });
  });

  it("retains synthetic SysEx and reserved system messages without enabling access", () => {
    expect(decode([0xf0, 0x43, 1, 0xf7]).decoded).toMatchObject({ kind: "system", type: "System Exclusive", lengthCondition: "variable" });
    expect(decode([0xf4]).decoded).toMatchObject({ kind: "unknown", type: "Reserved or unknown system message" });
  });

  it("marks empty, data-only, and truncated messages malformed without unsafe fields", () => {
    expect(decode([]).decoded).toMatchObject({ kind: "malformed", type: "Empty message" });
    expect(decode([60, 100]).decoded).toMatchObject({ kind: "malformed", type: "Data without status" });
    expect(decode([0x90, 60]).decoded).toMatchObject({ kind: "malformed", type: "Note On", expectedLength: 3, lengthCondition: "truncated" });
  });

  it("decodes present fields from extra-length messages while preserving and surfacing every byte", () => {
    const result = decode([0x90, 60, 100, 77]);
    expect(result.rawBytes).toEqual([0x90, 60, 100, 77]);
    expect(result.decoded).toMatchObject({ kind: "note-on", noteNumber: 60, attackVelocity: 100, lengthCondition: "extra" });
    expect(formatMidiDiagnosticData(result.decoded)).toContain("unexpectedLength=3->extra");
    expect(formatMidiDiagnosticRawBytes(result.rawBytes)).toBe("90 3C 64 4D");
  });

  it("uses standard MIDI octave names at boundaries", () => {
    expect(decode([0x90, 0, 1]).decoded).toMatchObject({ noteName: "C-1" });
    expect(decode([0x90, 127, 1]).decoded).toMatchObject({ noteName: "G9" });
  });
});
