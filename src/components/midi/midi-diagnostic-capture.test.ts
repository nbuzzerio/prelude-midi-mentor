import { describe, expect, it } from "vitest";
import { appendMidiDiagnosticEvent, EMPTY_MIDI_DIAGNOSTIC_CAPTURE, formatMidiDiagnosticCapture, MIDI_DIAGNOSTIC_CAPTURE_LIMIT, type MidiDiagnosticCapture } from "./midi-diagnostic-capture";
import { decodeMidiDiagnosticMessage } from "./midi-diagnostic-message";

const source: Readonly<{ id: string; name: string }> = { id: "keys-1", name: "Yamaha Keys" };
function append(capture: MidiDiagnosticCapture, eventTimeStampMs: number, eventSource = source) {
  const { decoded, rawBytes } = decodeMidiDiagnosticMessage([0x90, 60, 42]);
  return appendMidiDiagnosticEvent(capture, { decoded, eventTimeStampMs, messageLength: rawBytes.length, rawBytes, source: eventSource });
}

describe("MIDI diagnostic capture", () => {
  it("uses the first event as a precise relative origin and preserves ordering", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, 10.125);
    capture = append(capture, 71.557);
    expect(capture.events.map(({ sequence, relativeTimeMs }) => [sequence, relativeTimeMs])).toEqual([[1, 0], [2, 61.432]]);
  });

  it("waits for the first finite timestamp before establishing the relative origin", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, Number.NaN);
    expect(capture.events).toHaveLength(1);
    expect(capture.events[0]?.eventTimeStampMs).toBeNaN();
    expect(capture.events[0]?.relativeTimeMs).toBeNaN();
    expect(capture.originTimeStampMs).toBeNull();

    capture = append(capture, 125.5);
    expect(capture.events[1]).toMatchObject({ eventTimeStampMs: 125.5, relativeTimeMs: 0, sequence: 2 });
    expect(capture.originTimeStampMs).toBe(125.5);
  });

  it("keeps a finite origin across later invalid timestamps and resumes relative timing", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, 100);
    capture = append(capture, Number.NaN);
    expect(capture.events).toHaveLength(2);
    expect(capture.events[1]?.eventTimeStampMs).toBeNaN();
    expect(capture.events[1]?.relativeTimeMs).toBeNaN();
    expect(capture.originTimeStampMs).toBe(100);

    capture = append(capture, 175.25);
    expect(capture.events[2]).toMatchObject({ eventTimeStampMs: 175.25, relativeTimeMs: 75.25, sequence: 3 });
    expect(capture.originTimeStampMs).toBe(100);
  });

  it("retains exactly the newest 1,000 events without renumbering", () => {
    let capture = EMPTY_MIDI_DIAGNOSTIC_CAPTURE;
    for (let index = 0; index < MIDI_DIAGNOSTIC_CAPTURE_LIMIT + 2; index += 1) capture = append(capture, index);
    expect(capture.events).toHaveLength(1_000);
    expect(capture.events[0]?.sequence).toBe(3);
    expect(capture.events.at(-1)?.sequence).toBe(1_002);
    expect(capture).toMatchObject({ totalCaptured: 1_002, droppedCount: 2, nextSequence: 1_003, originTimeStampMs: 0 });
  });

  it("formats deterministic TSV with counts, multiple sources, timestamps, and escaped identities", () => {
    let capture = append(EMPTY_MIDI_DIAGNOSTIC_CAPTURE, 100, { id: "id\t1", name: "Keys\nOne" });
    capture = append(capture, 161.432, { id: "id-2", name: "Pedals" });
    const text = formatMidiDiagnosticCapture({ capture, inputs: [{ id: "id\t1", name: "Keys\nOne" }, { id: "id-2", name: "Pedals" }], version: "2.8.5" });
    expect(text).toContain("Prelude version: 2.8.5\nRetained events: 2\nTotal captured events: 2\nOlder events dropped: 0");
    expect(text).toContain("- id=id\\t1\tname=Keys\\nOne");
    expect(text).toContain("sequence\trelative_ms\tevent_timestamp_ms\tsource_id\tsource_name\tmessage_length\ttype\tchannel\tdata\traw_hex");
    expect(text).toContain("2\t61.432\t161.432\tid-2\tPedals\t3\tNote On\t1\tnote=60;name=C4;attackVelocity=42\t90 3C 2A");
  });

  it("the exported empty capture does not fabricate inputs or events", () => {
    const text = formatMidiDiagnosticCapture({ capture: EMPTY_MIDI_DIAGNOSTIC_CAPTURE, inputs: [], version: "2.8.5" });
    expect(text).toContain("Inputs:\n- none");
    expect(text.split("\n").at(-1)).toBe("sequence\trelative_ms\tevent_timestamp_ms\tsource_id\tsource_name\tmessage_length\ttype\tchannel\tdata\traw_hex");
  });
});
