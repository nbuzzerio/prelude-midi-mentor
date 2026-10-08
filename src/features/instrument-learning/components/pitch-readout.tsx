import { describeFrequency, centsBetween } from "@/lib/audio/monophonic/pitch-math";
import { getFullNoteName } from "@/lib/music/note-utils";
import type { ViolinReference } from "../calibration-types";

/** Continuous visual feedback deliberately has no live announcement region. */
export function PitchReadout({ reference, frequencyHz }: { reference: ViolinReference; frequencyHz: number | null }) {
  const pitch = frequencyHz === null ? null : describeFrequency(frequencyHz);
  const cents = pitch ? centsBetween(pitch.frequencyHz, reference.frequencyHz) : null;
  return <dl className="grid grid-cols-2 gap-2 tabular-nums">
    <dt>Expected note</dt><dd>{reference.note}</dd><dt>Expected frequency</dt><dd>{reference.frequencyHz.toFixed(3)} Hz</dd>
    <dt>Detected note</dt><dd>{pitch ? getFullNoteName(pitch.semitone) : "Waiting for a fresh pitch"}</dd>
    <dt>Detected frequency</dt><dd>{pitch ? `${pitch.frequencyHz.toFixed(2)} Hz` : "—"}</dd>
    <dt>Concert-pitch deviation</dt><dd>{cents === null ? "—" : `${cents >= 0 ? "+" : ""}${cents.toFixed(1)} cents · ${Math.abs(cents) < 0.05 ? "centered" : cents < 0 ? "flat" : "sharp"}`}</dd>
  </dl>;
}
