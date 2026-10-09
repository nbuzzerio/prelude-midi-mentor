import { describeFrequency, centsBetween } from "@/lib/audio/monophonic/pitch-math";
import { getFullNoteName } from "@/lib/music/note-utils";
import { CALIBRATION_POLICY, type ViolinReference } from "../calibration-types";

/** Continuous visual feedback deliberately has no live announcement region. */
export function PitchReadout({ reference, frequencyHz, readingStatus = "Live" }: { reference: ViolinReference; frequencyHz: number | null; readingStatus?: "Live" | "Last heard" | "Uncertain" | "Last stable assessment" }) {
  const pitch = frequencyHz === null ? null : describeFrequency(frequencyHz);
  const cents = pitch ? centsBetween(pitch.frequencyHz, reference.frequencyHz) : null;
  const direction = cents === null ? null : Math.abs(cents) < 0.05 ? "CENTERED" : cents < 0 ? "FLAT" : "SHARP";
  const band = cents === null ? null : Math.abs(cents) <= CALIBRATION_POLICY.greenCents + 1e-9 ? "GREEN"
    : Math.abs(cents) <= CALIBRATION_POLICY.yellowCents + 1e-9 ? "YELLOW" : "RED";
  const deviationColor = band === "GREEN" ? "border-green-400/40 bg-green-950/30 text-green-200"
    : band === "YELLOW" ? "border-yellow-400/40 bg-yellow-950/30 text-yellow-200"
      : band === "RED" ? "border-red-400/40 bg-red-950/30 text-red-200" : "border-zinc-600 text-zinc-300";
  const row = "grid h-16 overflow-auto grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-2 [&>dt]:text-sm [&>dt]:text-zinc-400 [&>dd]:break-words";
  return <dl className="grid min-w-0 gap-2 tabular-nums">
    <div className="grid h-20 content-center gap-1"><dt className="text-sm text-zinc-400">Detected note</dt><dd className="text-[50px] font-bold leading-none">{pitch ? getFullNoteName(pitch.semitone) : "—"}</dd></div>
    <div className="grid h-20 content-center gap-1"><dt className="text-sm text-zinc-400">Expected note</dt><dd className="text-[50px] font-bold leading-none">{reference.note}</dd></div>
    <div className={row}><dt>Detected frequency</dt><dd className="text-xl">{pitch ? `${pitch.frequencyHz.toFixed(2)} Hz · ${direction}` : "—"}</dd></div>
    <div className={row}><dt>Expected frequency</dt><dd>{reference.frequencyHz.toFixed(3)} Hz</dd></div>
    <div className={`${row} rounded border px-2 ${deviationColor}`}><dt>Concert-pitch deviation</dt><dd className="text-xl">{cents === null ? "—" : `${cents >= 0 ? "+" : ""}${cents.toFixed(1)} cents · ${direction}`}</dd></div>
    <div className={row}><dt>Estimated deviation band</dt><dd>{band ? `${band} · ${Math.abs(cents!) <= CALIBRATION_POLICY.idealCents + 1e-9 ? "Excellent / centered" : band === "GREEN" ? "Ready for practice" : band === "YELLOW" ? "Adjust tuning" : "Significantly off"}` : "No pitch estimate"}</dd></div>
    <div className={row.replace("h-16", "h-28")}><dt>Reading status</dt><dd>{pitch ? readingStatus === "Live" ? "Live estimate · Not yet verified"
      : readingStatus === "Last stable assessment" ? "Confirmed baseline"
        : readingStatus === "Uncertain" ? "Last heard · Uncertain · Estimate not verified" : "Last heard · Estimate not verified" : "Waiting for usable pitch"}</dd></div>
  </dl>;
}
