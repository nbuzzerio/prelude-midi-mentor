import { getMidiDiagnosticBackgroundKind, type MidiDiagnosticCapture, type MidiDiagnosticCapturedEvent } from "./midi-diagnostic-capture";
import { formatMidiDiagnosticData } from "./midi-diagnostic-message";

export const MIDI_DIAGNOSTIC_PARTIAL_WARNING = "Partial evidence: older raw messages were dropped. Notes, pairs, and durations describe only retained messages; missing attacks or releases may have been evicted.";
export const MIDI_DIAGNOSTIC_OVERLAP_WARNING = "Ambiguous same-note overlap: FIFO pairing is an interpretation; MIDI does not identify the note instance.";
export type MidiDiagnosticNoteInstance = Readonly<{
  kind: "note";
  attack: MidiDiagnosticCapturedEvent;
  release: MidiDiagnosticCapturedEvent | null;
  durationMs: number | null;
  ambiguous: boolean;
  anomalies: readonly string[];
}>;
export type MidiDiagnosticOtherEvent = Readonly<{ kind: "event"; event: MidiDiagnosticCapturedEvent; timingAnomalous: boolean }>;
export type MidiDiagnosticMusicalRow = MidiDiagnosticNoteInstance | MidiDiagnosticOtherEvent;
export type MidiDiagnosticMusicalProjection = Readonly<{
  rows: readonly MidiDiagnosticMusicalRow[];
  notes: readonly MidiDiagnosticNoteInstance[];
  otherEvents: readonly MidiDiagnosticCapturedEvent[];
  pairedCount: number;
  unmatchedAttackCount: number;
  unmatchedReleaseCount: number;
  ambiguousCount: number;
  partialEvidence: boolean;
}>;

function hasValidNotePayload(event: MidiDiagnosticCapturedEvent): boolean {
  return event.decoded.lengthCondition === "expected" && event.rawBytes.length === 3
    && event.rawBytes.slice(1).every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 127);
}

/** Derive only from retained raw evidence; no quantization, pedal extension, or synthesized releases. */
export function projectMidiDiagnosticMusicalEvents(capture: MidiDiagnosticCapture): MidiDiagnosticMusicalProjection {
  type WorkingNote = { kind: "note"; attack: MidiDiagnosticCapturedEvent; release: MidiDiagnosticCapturedEvent | null; durationMs: number | null; ambiguous: boolean; anomalies: string[] };
  const rows: (WorkingNote | MidiDiagnosticOtherEvent)[] = [];
  const notes: WorkingNote[] = [];
  const otherEvents: MidiDiagnosticCapturedEvent[] = [];
  const pending = new Map<string, WorkingNote[]>();
  const lastFiniteTimeByStream = new Map<string, number>();
  let unmatchedReleaseCount = 0;
  for (const event of [...capture.events].sort((a, b) => a.sequence - b.sequence)) {
    const stream = JSON.stringify([event.source.id, event.continuitySegment]);
    const previousTime = lastFiniteTimeByStream.get(stream);
    const timingAnomalous = !Number.isFinite(event.eventTimeStampMs) || !Number.isFinite(event.relativeTimeMs) || event.relativeTimeMs < 0
      || (previousTime !== undefined && event.eventTimeStampMs < previousTime);
    if (Number.isFinite(event.eventTimeStampMs)) lastFiniteTimeByStream.set(stream, Math.max(previousTime ?? event.eventTimeStampMs, event.eventTimeStampMs));
    if (getMidiDiagnosticBackgroundKind(event)) continue;
    const decoded = event.decoded;
    if ((decoded.kind === "note-on" || decoded.kind === "note-release") && hasValidNotePayload(event)) {
      const key = JSON.stringify([event.source.id, event.continuitySegment, decoded.channel, decoded.noteNumber]);
      const queue = pending.get(key) ?? [];
      if (decoded.kind === "note-on") {
        const note: WorkingNote = { kind: "note", attack: event, release: null, durationMs: null, ambiguous: queue.length > 0, anomalies: [] };
        if (timingAnomalous) note.anomalies.push("Attack timing unavailable/anomalous.");
        if (queue.length) for (const outstanding of queue) outstanding.ambiguous = true;
        queue.push(note); pending.set(key, queue); notes.push(note); rows.push(note);
        continue;
      }
      const note = queue.shift();
      if (note) {
        note.release = event;
        const duration = event.eventTimeStampMs - note.attack.eventTimeStampMs;
        if (Number.isFinite(duration) && duration >= 0 && note.anomalies.length === 0 && !timingAnomalous) note.durationMs = duration;
        else note.anomalies.push("Release timing unavailable/anomalous; duration unavailable.");
        continue;
      }
      unmatchedReleaseCount += 1;
    }
    otherEvents.push(event); rows.push({ kind: "event", event, timingAnomalous });
  }
  const frozenNotes = new Map(notes.map((note) => [note, Object.freeze({ ...note, anomalies: Object.freeze(note.anomalies) })]));
  return Object.freeze({
    rows: Object.freeze(rows.map((row) => row.kind === "note" ? frozenNotes.get(row)! : Object.freeze(row))),
    notes: Object.freeze(notes.map((note) => frozenNotes.get(note)!)),
    otherEvents: Object.freeze(otherEvents),
    pairedCount: notes.filter(({ release }) => release !== null).length,
    unmatchedAttackCount: notes.filter(({ release }) => release === null).length,
    unmatchedReleaseCount,
    ambiguousCount: notes.filter(({ ambiguous }) => ambiguous).length,
    partialEvidence: capture.droppedCount > 0,
  });
}

export function formatMidiDiagnosticMusicalEvent(event: MidiDiagnosticCapturedEvent): string {
  const decoded = event.decoded;
  const anomaly = decoded.lengthCondition === "extra" || decoded.lengthCondition === "truncated" ? ` (${decoded.lengthCondition} bytes)` : "";
  if (decoded.kind === "control-change" && decoded.controllerNumber === 64) return `Sustain ${decoded.controllerValue >= 64 ? "Down" : "Up"} — CC64 ${decoded.controllerValue}${anomaly}`;
  if (decoded.kind === "note-release") return `Unmatched Note Release — ${formatMidiDiagnosticData(decoded)}${anomaly}`;
  return `${decoded.type} — ${formatMidiDiagnosticData(decoded)}${anomaly}`;
}

export function formatMidiDiagnosticSeconds(ms: number | null, digits = 3): string {
  return ms !== null && Number.isFinite(ms) && ms >= 0 ? `${(ms / 1000).toFixed(digits)}s` : "unavailable/anomalous";
}
