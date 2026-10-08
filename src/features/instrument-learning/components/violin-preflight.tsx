import { useEffect } from "react";
import { CALIBRATION_POLICY, VIOLIN_REFERENCES, type CalibrationSession } from "../calibration-types";
import { PitchReadout } from "./pitch-readout";

export function ViolinPreflight({ calibration, frequencyHz, listening, onAction, onEnterPractice }: {
  calibration: CalibrationSession; frequencyHz: number | null; listening: boolean;
  onAction: (choice: "automatic" | "continue" | "retry" | "skip") => void; onEnterPractice: () => void;
}) {
  const { measurement, phase } = calibration;
  useEffect(() => {
    if (phase !== "assessed" || measurement.tuning !== "within-band" || !listening) return;
    const timer = window.setTimeout(() => onAction("automatic"), CALIBRATION_POLICY.acknowledgmentMs);
    return () => window.clearTimeout(timer);
  }, [calibration.revision, phase, measurement.tuning, listening, onAction]);
  const button = "min-h-11 rounded border border-zinc-500 px-3 py-2";
  if (phase === "summary") return <section aria-label="Violin preflight summary" className="grid gap-3 rounded border border-sky-400/40 p-4">
    <h2 className="text-xl font-semibold">Violin preflight summary</h2>
    <ul>{calibration.attempts.filter(({ disposition }) => disposition !== null).map((attempt) => <li key={attempt.revision}>
      {attempt.reference.note}: {attempt.disposition === "skipped" ? "Skipped — tuning not verified"
        : attempt.measurement.tuning === "within-band" ? "Within tuning band"
          : `${attempt.measurement.cents!.toFixed(1)} cents — still needs tuning`}
    </li>)}</ul>
    <p>Tune strings outside the recommended band. Practice acceptance still uses concert pitch and your selected tolerance.</p>
    <button className={button} type="button" onClick={onEnterPractice}>Enter Piece Practice</button>
    <p>Leave a brief quiet gap, then re-articulate the first target. Calibration tones cannot answer it.</p>
  </section>;
  const reference = VIOLIN_REFERENCES[calibration.referenceIndex];
  const assessment = measurement.status === "ambiguous" ? "Pitch identity uncertain"
    : phase === "collecting" ? "Collecting steady pitch" : measurement.tuning === "within-band" ? "Within tuning band"
      : measurement.tuning === "near-target" ? "Slightly flat or sharp — tuning recommended" : "Needs tuning";
  return <section aria-label="Violin preflight" className="grid gap-3 rounded border border-sky-400/40 p-4">
    <h2 className="text-xl font-semibold">Check open {reference.note}</h2>
    <p>Bow the open {reference.stringId} string steadily, without vibrato. Practice timing and grading are paused.</p>
    <PitchReadout reference={reference} frequencyHz={phase === "assessed" ? measurement.medianHz : frequencyHz} />
    <p role="status">{reference.note}: {assessment}</p>
    {measurement.ambiguity && <p>{measurement.ambiguity === "possible-harmonic-or-different-pitch"
      ? `This may be a harmonic or a different played pitch. Bow the open ${reference.stringId} string again.`
      : `The pitch is outside the expected open-string region. Check the string and tuning, then retry.`}</p>}
    {phase === "assessed" && measurement.tuning !== "within-band" && <p>{measurement.cents! < 0 ? "Raise the string's pitch." : "Lower the string's pitch."}</p>}
    {phase === "assessed" && <p>Measured stable center: {measurement.medianHz!.toFixed(2)} Hz. Central spread: {(measurement.p90Cents! - measurement.p10Cents!).toFixed(1)} cents.</p>}
    {measurement.tuning === "within-band" && <p>Ready for the next string…</p>}
    <div className="flex flex-wrap gap-2">
      <button className={button} type="button" disabled={calibration.attempts.length >= 128} onClick={() => onAction("retry")}>Retry</button>
      <button className={button} type="button" onClick={() => onAction("skip")}>Skip String</button>
      {phase === "assessed" && <button className={button} type="button" onClick={() => onAction("continue")}>Continue{measurement.tuning === "within-band" ? "" : " with warning"}</button>}
    </div>
    {calibration.attempts.length >= 128 && <p>Retry limit reached. Continue or skip the remaining strings.</p>}
    <p className="text-sm text-zinc-300">A4 = 440 Hz · equal-tempered targets. Provisional tuning bands: within ±5 cents; near target through ±15 cents. These are separate from practice tolerance.</p>
  </section>;
}
