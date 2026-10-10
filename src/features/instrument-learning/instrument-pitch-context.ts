import type { CaptureStatus } from "@/lib/audio/monophonic/microphone-capture";
import { MONOPHONIC_CONFIG, type PitchSnapshot } from "@/lib/audio/monophonic/pitch-analysis-types";
import { describeFrequency } from "@/lib/audio/monophonic/pitch-math";

/** Same live-reading provenance as Piece Practice's large pitch panels. No retained history. */
export function getLiveInstrumentPitch(status: CaptureStatus["state"], reading: PitchSnapshot) {
  return status === "listening" && reading.state === "stable" && reading.fresh
    && reading.ageMs !== null && reading.ageMs >= 0 && reading.ageMs <= MONOPHONIC_CONFIG.staleMs && reading.pitch
    ? describeFrequency(reading.pitch.frequencyHz) : null;
}

export type InstrumentLivePitch = Readonly<{
  state: "live" | "uncertain" | "stale" | "absent";
  pitch: ReturnType<typeof describeFrequency>;
}>;
export type InstrumentPitchContext = Readonly<{
  expected: Readonly<{ semitone: number; label: string }> | null;
  live: InstrumentLivePitch;
  /** Authored target spelling takes priority, then the current score's key context. */
  pitchLabels: Readonly<Record<number, string>>;
}>;

export function getInstrumentLiveContext(status: CaptureStatus["state"], reading: PitchSnapshot): InstrumentLivePitch {
  const pitch = getLiveInstrumentPitch(status, reading);
  if (pitch) return { state: "live", pitch };
  if (status !== "listening") return { state: "absent", pitch: null };
  if (reading.pitch && reading.ageMs !== null && reading.ageMs > MONOPHONIC_CONFIG.staleMs) return { state: "stale", pitch: null };
  return { state: reading.pitch || reading.state === "acquiring" || reading.state === "uncertain" ? "uncertain" : "absent", pitch: null };
}
