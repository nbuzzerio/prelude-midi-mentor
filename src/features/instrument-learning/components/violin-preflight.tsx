import type { createCalibrationContinuity } from "../calibration-continuity";
import { VIOLIN_REFERENCES, type CalibrationSession, type CalibrationMeasurement } from "../calibration-types";
import { PitchReadout } from "./pitch-readout";

export function ViolinPreflight({ calibration, frequencyHz, listening, feedback, accepted, onAction, onEnterPractice, onSkipCalibration }: {
  calibration: CalibrationSession; frequencyHz: number | null; listening: boolean;
  accepted?: { referenceIndex: number; measurement: CalibrationMeasurement } | null;
  feedback?: ReturnType<ReturnType<typeof createCalibrationContinuity>["feedback"]>;
  onAction: (choice: "automatic" | "continue" | "retry" | "skip") => void; onEnterPractice: () => void; onSkipCalibration?: () => void;
}) {
  const { phase } = calibration;
  const measurement = accepted?.measurement ?? feedback?.assessment ?? (calibration.measurement.status === "valid" ? calibration.measurement : null);
  const button = "min-h-11 rounded border border-zinc-500 px-3 py-2";
  if (phase === "summary" && !accepted) return <section aria-label="Violin preflight summary" className="grid gap-3 rounded border border-sky-400/40 p-4">
    <h2 className="text-xl font-semibold">Violin preflight summary</h2>
    <ul>{calibration.attempts.filter(({ disposition }) => disposition !== null).map((attempt) => <li key={attempt.revision}>
      {attempt.reference.note}: {attempt.disposition === "skipped" ? "Skipped — tuning not verified"
        : attempt.disposition === "continued-with-warning" ? "Continued with warning - tuning not verified"
        : attempt.measurement.tuning === "within-band" ? "Accepted within tuning band"
          : `${attempt.measurement.cents!.toFixed(1)} cents — still needs tuning`}
    </li>)}</ul>
    <p>Tune strings outside the recommended band. Practice acceptance still uses concert pitch and your selected tolerance.</p>
    <button className={`${button} bg-sky-800 font-semibold`} type="button" onClick={onEnterPractice}>Enter Piece Practice</button>
    <p>Leave a brief quiet gap, then re-articulate the first target. Calibration tones cannot answer it.</p>
  </section>;
  const reference = VIOLIN_REFERENCES[accepted?.referenceIndex ?? calibration.referenceIndex];
  const ambiguity = feedback ? feedback.ambiguity : calibration.measurement.ambiguity;
  const progress = feedback?.progress;
  const assessment = accepted ? "Accepted" : ambiguity || feedback?.status === "Uncertain" ? "Uncertain"
    : feedback?.failureReason && progress?.blocker && !["samples", "span", "settling"].includes(progress.blocker)
      || calibration.measurement.status === "valid" && calibration.measurement.tuning !== "within-band" ? "Insufficient evidence" : "Collecting";
  const progressSummary = accepted ? "Ready for practice - confirmed from agreeing pitch estimates."
    : progress?.blocker === "samples" || progress?.blocker === "span" ? "A little more pitch evidence is needed. Pluck again when ready."
      : progress?.blocker === "settling" ? "Let the note ring briefly after the pluck."
        : "Pluck, read the pitch, adjust, then pluck again.";
  const guidance = accepted ? listening ? "Accepted. Next string shortly." : "Accepted. Listening stopped; Start Listening to continue."
    : ambiguity ? `This may be a harmonic or different pitch. Pluck open ${reference.stringId} again.`
      : !listening || feedback?.status === "Last heard" ? "Waiting for another pluck."
        : phase === "assessed" && measurement && measurement.tuning !== "within-band" ? measurement.cents! < 0 ? "Raise the string's pitch; pluck again to check." : "Lower the string's pitch; pluck again to check."
          : "Pluck the open string and let it ring. Bowing also works.";
  return <section aria-label="Violin preflight" className="grid gap-2 rounded border border-sky-400/40 p-4">
    <h2 className="min-h-8 text-xl font-semibold">Check open {reference.note}</h2>
    <PitchReadout reference={reference} frequencyHz={accepted?.measurement.medianHz ?? (feedback ? feedback.frequencyHz : frequencyHz)}
      readingStatus={accepted ? "Last stable assessment" : feedback?.status ?? (listening && frequencyHz !== null ? "Live" : "Last heard")} />
    <div className="grid h-20 content-center overflow-auto rounded border border-zinc-600 px-3"><p className="text-xs">Calibration</p><p className="text-lg font-semibold">{assessment}</p></div>
    <div className="grid h-28 content-center overflow-auto text-sm tabular-nums"><p className="text-xs text-zinc-400">Tuning preparation</p><p>{progressSummary}</p><p className="text-zinc-400">Calibration is optional. You can start practice whenever you are ready.</p></div>
    <div className="h-32 overflow-auto"><p className="text-xs text-zinc-400">Guidance</p><p>{accepted ? guidance : feedback?.activity ?? guidance}</p><p className="text-sm text-zinc-300">{accepted ? "" : feedback?.failureReason && feedback.failureReason !== feedback.activity ? <><span className="text-zinc-400">Recent blocker: </span>{feedback.failureReason}</> : (progress?.blocker === "samples" ? "Pluck again to refine the estimate." : progress?.blocker === "span" ? "Let the string ring briefly, or pluck it again." : feedback ? guidance : "")}</p></div>
    <div className="grid h-24 content-center overflow-auto text-sm text-zinc-400 tabular-nums"><p className="text-xs">Last stable assessment</p><p>{measurement
      ? `${measurement.medianHz!.toFixed(2)} Hz; ${measurement.cents! >= 0 ? "+" : ""}${measurement.cents!.toFixed(1)} cents; spread ${(measurement.p90Cents! - measurement.p10Cents!).toFixed(1)} cents`
      : "No confirmed tuning estimate yet."}</p></div>
    <div className="grid h-24 content-center overflow-auto text-sm" role="status" aria-live="polite" aria-atomic="true"><p className="text-xs text-zinc-400">Accepted confirmation</p><p>{accepted
      ? `${reference.note} accepted - ${accepted.measurement.medianHz!.toFixed(2)} Hz. ${listening ? "Moving to the next string shortly." : "Transition paused until listening resumes."}`
      : "Waiting for enough agreeing pitch estimates."}</p></div>
    <button className={`${button} bg-sky-800 font-semibold`} type="button" disabled={!onSkipCalibration} onClick={onSkipCalibration}>Skip Calibration and Start Practice</button>
    <div className="flex min-h-12 flex-wrap gap-2">
      <button className={button} type="button" disabled={!!accepted} onClick={() => onAction("skip")}>Skip String</button>
      <button className={button} type="button" disabled={!!accepted || phase !== "assessed"} onClick={() => onAction("continue")}>Continue</button>
    </div>
    <p className="h-16 overflow-auto text-sm text-zinc-300">Measurements repeat automatically while listening. Practice timing and grading are paused. A4 = 440 Hz. Ideal within ±5 cents; ready within ±10 cents; adjust tuning through ±25 cents; significantly off beyond ±25 cents. Colors describe estimated deviation, not calibration certainty. Equal-tempered targets, separate from practice tolerance.</p>
  </section>;
}
