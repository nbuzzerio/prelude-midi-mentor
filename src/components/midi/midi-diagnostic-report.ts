import type { MidiDiagnosticCapture } from "./midi-diagnostic-capture";
import { formatMidiDiagnosticMusicalEvent, formatMidiDiagnosticSeconds, MIDI_DIAGNOSTIC_OVERLAP_WARNING, MIDI_DIAGNOSTIC_PARTIAL_WARNING, projectMidiDiagnosticMusicalEvents } from "./midi-diagnostic-musical";

const text = (value: string) => value.replaceAll("\\", "\\\\").replaceAll("\r", "\\r").replaceAll("\n", "\\n").replaceAll("\t", "\\t");
export function formatMidiDiagnosticReport({ capture, version }: Readonly<{ capture: MidiDiagnosticCapture; version: string }>): string {
  const musical = projectMidiDiagnosticMusicalEvents(capture);
  const anomalousSequences = new Set(musical.rows.flatMap((row) => row.kind === "event" && row.timingAnomalous ? [row.event.sequence] : []));
  const seconds = (ms: number | null) => formatMidiDiagnosticSeconds(ms, 6);
  const last = capture.events.at(-1);
  const span = last && capture.originTimeStampMs !== null ? last.eventTimeStampMs - capture.originTimeStampMs : null;
  const backgrounds = [
    `Timing Clock: ${capture.backgroundCounts.timingClock ? "detected" : "not observed"}; count=${capture.backgroundCounts.timingClock}`,
    `Active Sensing: ${capture.backgroundCounts.activeSensing ? "detected" : "not observed"}; count=${capture.backgroundCounts.activeSensing}`,
  ];
  return [
    "Prelude MIDI Diagnostic Report", `Prelude version: ${version}`,
    "Captured inputs:", ...(capture.observedInputs.length ? capture.observedInputs.map(({ id, name }) => `- ${text(name)} (id=${text(id)})`) : ["- none"]),
    `Observed capture span: ${seconds(span)} (first captured finite timestamp to last message; not a recording timer)`,
    `Retained raw messages: ${capture.events.length}; older messages dropped: ${capture.droppedCount}`,
    ...(musical.partialEvidence ? [MIDI_DIAGNOSTIC_PARTIAL_WARNING] : []),
    `Continuity boundaries observed during this capture: ${capture.continuityBreakCount}; notes are never paired across a pause/resume or source reconnection gap. Paused messages are excluded.`,
    "Times use the raw capture origin. Durations are attack-to-key-release messages, not acoustic/sustain duration.",
    "", "SUMMARY — retained evidence only",
    `Note attacks represented: ${musical.notes.length}; paired releases: ${musical.pairedCount}`,
    `Unmatched attacks: ${musical.unmatchedAttackCount}; unmatched releases: ${musical.unmatchedReleaseCount}; ambiguous note instances: ${musical.ambiguousCount}`,
    "Background counts observed during this capture (including evicted messages, excluding paused messages):", ...backgrounds,
    "", "NOTES — retained evidence only",
    ...(musical.notes.length ? musical.notes.flatMap((note, index) => {
      const attack = note.attack.decoded;
      if (attack.kind !== "note-on") return [];
      const release = note.release?.decoded;
      return [
        `${index + 1}. ${attack.noteName} / MIDI ${attack.noteNumber} / channel ${attack.channel} / ${text(note.attack.source.name)} (id=${text(note.attack.source.id)})`,
        `   Attack: ${seconds(note.attack.relativeTimeMs)}; release: ${note.release ? seconds(note.release.relativeTimeMs) : "Release not observed"}; duration: ${seconds(note.durationMs)}`,
        `   Attack velocity: ${attack.attackVelocity}; release velocity: ${release?.kind === "note-release" ? release.releaseVelocity : "not observed"}; release encoding: ${release?.kind === "note-release" ? release.encoding : "not observed"}`,
        `   Raw sequences: attack=${note.attack.sequence}; release=${note.release?.sequence ?? "not observed"}; continuity segment=${note.attack.continuitySegment}`,
        ...(note.ambiguous ? [`   ${MIDI_DIAGNOSTIC_OVERLAP_WARNING}`] : []),
        ...note.anomalies.map((anomaly) => `   ${anomaly}`),
      ];
    }) : ["None"]),
    "", "OTHER MIDI EVENTS — retained evidence, capture sequence order",
    ...(musical.otherEvents.length ? musical.otherEvents.map((event) => {
      const description = event.decoded.kind === "system" && event.rawBytes[0] === 0xf0
        ? `System Exclusive; ${event.messageLength} bytes; full payload in Copy Capture`
        : formatMidiDiagnosticMusicalEvent(event);
      return `${seconds(event.relativeTimeMs)}${anomalousSequences.has(event.sequence) ? " (timing unavailable/anomalous)" : ""}  ${text(description)} / channel ${event.decoded.channel ?? "n/a"} / ${text(event.source.name)} (id=${text(event.source.id)}) / raw #${event.sequence} / segment ${event.continuitySegment}`;
    }) : ["None"]),
    "", "BACKGROUND MIDI — observed during this capture", ...backgrounds,
    "Only ordinary valid F8/FE rows are summarized. Unexpected/malformed variants remain above. Copy Capture includes every retained raw message and byte.",
  ].join("\n");
}
