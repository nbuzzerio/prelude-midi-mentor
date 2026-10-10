/** Browser-local metadata only; null means the browser supplied no usable identity/name. */
export type MidiInputInfo = Readonly<{ id: string | null; name: string | null }>;

/** Delivered transport evidence, before any musical normalization. No physical latency is inferred. */
export type RawMidiMessage = Readonly<{
  provenance: "browser-midi-message";
  sequence: number;
  input: MidiInputInfo;
  bytes: readonly number[] | null;
  dataStatus: "available" | "unavailable" | "unreadable";
  sourceTimeStampMs: number | null;
  receivedAtMs: number;
}>;

/** Availability observation, not a fabricated MIDI message or key/pedal release. */
export type MidiInputConnectionChange = Readonly<{
  provenance: "input-availability";
  input: MidiInputInfo;
  state: "connected" | "disconnected";
  receivedAtMs: number;
}>;

export function describeMidiInput(input: Pick<MIDIInput, "id" | "name">): MidiInputInfo {
  return Object.freeze({
    id: typeof input.id === "string" && input.id.length > 0 ? input.id : null,
    name: typeof input.name === "string" && input.name.length > 0 ? input.name : null,
  });
}

export function copyRawMidiMessage(event: Pick<MIDIMessageEvent, "data" | "timeStamp">,
  input: MidiInputInfo, sequence: number, receivedAtMs: number): RawMidiMessage {
  let bytes: readonly number[] | null = null;
  let dataStatus: RawMidiMessage["dataStatus"] = "unavailable";
  try {
    const data = event.data;
    if (data != null) {
      bytes = Object.freeze(Array.from(data));
      dataStatus = "available";
    }
  } catch {
    dataStatus = "unreadable";
  }
  return Object.freeze({ provenance: "browser-midi-message", sequence,
    input: Object.freeze({ ...input }), bytes, dataStatus,
    // Keep anomalous numeric timestamps too; consumers must not mistake them for valid timing.
    sourceTimeStampMs: typeof event.timeStamp === "number" ? event.timeStamp : null, receivedAtMs });
}
