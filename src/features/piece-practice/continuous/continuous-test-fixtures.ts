import type { StaffBuilderDuration, StaffBuilderTimeSignature } from "@/features/staff-builder/staff-builder-time";
import { durationToTicks, getMeasureCapacityTicks } from "@/features/staff-builder/staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderNoteEvent, StaffBuilderScore, StaffBuilderStaff } from "@/features/staff-builder/staff-builder-types";
import type { RawMidiMessage } from "@/lib/midi/midi-transport";
import type { ContinuousAttack } from "./continuous-types";

export const TEST_INPUT = { id: "piano", name: "Test physical piano" };
export const TEST_DATE = "2026-10-20T12:00:00.000Z";
export function note(id: string, tick = 0, midi = 60, duration: StaffBuilderDuration = "quarter", staff: StaffBuilderStaff = "treble"): StaffBuilderNoteEvent {
  const names = ["C", "C", "D", "D", "E", "F", "F", "G", "G", "A", "A", "B"] as const;
  return { id, kind: "notes", staff, startTick: tick, rhythm: { status: "final", duration }, pitches: [{ id: `${id}-p`, midiNumber: midi,
    letter: names[midi % 12]!, accidental: [1, 3, 6, 8, 10].includes(midi % 12) ? "sharp" : "natural", octave: Math.floor(midi / 12) - 1 }] };
}
export function measure(id: string, authored: readonly StaffBuilderEvent[] = [], meter: StaffBuilderTimeSignature = "4/4") {
  const events = [...authored];
  for (const staff of ["treble", "bass"] as const) {
    let tick = 0;
    const fill = (end: number) => {
      while (tick < end) {
        const duration = (["whole", "dotted-half", "half", "dotted-quarter", "quarter", "eighth", "sixteenth"] as const).find((d) => durationToTicks(d) <= end - tick)!;
        events.push({ id: `${id}-${staff}-rest-${tick}`, kind: "rest", staff, startTick: tick, rhythm: { status: "final", duration } });
        tick += durationToTicks(duration);
      }
    };
    authored.filter((e) => e.staff === staff).sort((a, b) => a.startTick - b.startTick).forEach((e) => {
      fill(e.startTick); if (e.rhythm.status === "final") tick = e.startTick + durationToTicks(e.rhythm.duration);
    });
    fill(getMeasureCapacityTicks(meter));
  }
  return { id, events };
}
export function testScore(meter: StaffBuilderTimeSignature = "4/4", bars = 2): StaffBuilderScore {
  return { schemaVersion: 4, id: "synthetic-study", title: "Synthetic piano study", createdAt: TEST_DATE, updatedAt: TEST_DATE,
    tempoBpm: 60, initialKeySignatureId: "c-major", initialTimeSignature: meter, annotations: [], ties: [],
    measures: Array.from({ length: bars }, (_, i) => measure(`m${i}`, [note(`n${i}`, 0, 60 + i * 2)], meter)) };
}
export function attack(id: number, midi: number, timeMs: number, uncertaintyMs: number | null = 5): ContinuousAttack {
  return { id, midi, timeMs, uncertaintyMs, channel: 0, velocity: 80, source: "physical-midi", input: TEST_INPUT,
    sourceTimeStampMs: 1000 + timeMs, receivedAtMs: 1000 + timeMs, audioTimeSeconds: timeMs / 1000 };
}
/** Fully authored, repeated block chords on both staves, with bounded spelling. */
export function denseScore(bars = 16, chord = 3, meter: StaffBuilderTimeSignature = "4/4", step = 120): StaffBuilderScore {
  return { ...testScore(meter, 1), measures: Array.from({ length: bars }, (_, m) => ({ id: `m${m}`,
    events: (["treble", "bass"] as const).flatMap((staff, s) => Array.from({ length: getMeasureCapacityTicks(meter) / step }, (_, i) => {
      const e = note(`e${m}-${s}-${i}`, i * step, s ? 36 : 60, step === 120 ? "sixteenth" : step === 240 ? "eighth" : step === 1920 ? "whole" : step === 1440 ? "dotted-half" : "quarter", staff);
      return { ...e, pitches: Array.from({ length: chord }, (_, p) => ({ ...note(`p${m}-${s}-${i}-${p}`, 0, (s ? 36 : 60) + [0, 4, 7, 11, 14, 17][p]!).pitches[0]!, id: `p${m}-${s}-${i}-${p}` })) };
    })) })) };
}
export function raw(midi = 60, velocity = 80, source = 1000, received = source, input = TEST_INPUT): RawMidiMessage {
  return { provenance: "browser-midi-message", sequence: 1, input, bytes: [0x90, midi, velocity], dataStatus: "available", sourceTimeStampMs: source, receivedAtMs: received };
}
