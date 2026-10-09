import { MONOPHONIC_CONFIG, type PitchObservation } from "@/lib/audio/monophonic/pitch-analysis-types";
import { CALIBRATION_POLICY, emptyCalibrationMeasurement, type CalibrationMeasurement, type CalibrationSample, type ViolinReference, type CalibrationPolicy } from "./calibration-types";
import { calibrationAmbiguity } from "./instrument-interpretation";
import { CALIBRATION_CONTINUITY, createCalibrationStability, reliableCalibrationFrequency } from "./pitch-stability";

export function createCalibrationContinuity(reference: ViolinReference, policy: CalibrationPolicy = CALIBRATION_POLICY) {
  const tracker = createCalibrationStability(reference, policy);
  let lastHeardHz: number | null = null, lastHeardAt: number | null = null;
  let lastAssessment: CalibrationMeasurement | null = null;
  let liveHz: number | null = null, observedAt: number | null = null;
  let observation: PitchObservation | null = null;
  let currentMeasurement = emptyCalibrationMeasurement();
  let previousAt: number | null = null, previousAudio: number | null = null, generation: number | null = null;
  let awaitingSound = false, boundaryQuiet = false, boundaryLevel: number | null = null;
  let currentAmbiguity: CalibrationMeasurement["ambiguity"] = null;
  let wasAudible = false, episodeUsable = false, episodeRejected = 0;
  let recentRejection: { reason: PitchObservation["reason"]; at: number } | null = null;
  let audibleSince: number | null = null, lastSoundAt: number | null = null;
  let activity = "Listening - Waiting for microphone observations";
  let pendingActivity = activity, pendingSince = 0, activitySince = 0;
  let failureReason: string | null = null, reasonSince = 0;
  function update(sample: CalibrationSample) {
    const at = sample.envelope.observedAtMs;
    const discontinuity = previousAt !== null && at <= previousAt
      || previousAudio !== null && sample.envelope.audioSeconds <= previousAudio
      || generation !== null && generation !== sample.envelope.captureGeneration;
    previousAt = at; previousAudio = sample.envelope.audioSeconds; generation = sample.envelope.captureGeneration;
    const hz = discontinuity ? null : reliableCalibrationFrequency(sample);
    // Raw detector usability is enough for display, including an actual detected octave.
    // Fundamental/harmonic checks remain exclusively authoritative for acceptance.
    liveHz = hz; observedAt = at; observation = sample.envelope.observation;
    currentAmbiguity = hz === null ? null : calibrationAmbiguity(hz, reference, policy);
    if (hz !== null) { lastHeardHz = hz; lastHeardAt = at; }
    const audible = Number.isFinite(observation.levelDbfs) && observation.levelDbfs >= MONOPHONIC_CONFIG.minDbfs
      && observation.reason !== "clock-stalled" && observation.reason !== "invalid";
    if (audible && !wasAudible) { episodeUsable = false; episodeRejected = 0; }
    if (audible) {
      if (hz !== null) { episodeUsable = true; recentRejection = null; }
      else if (observation.reason !== "usable" && ++episodeRejected >= 2 && !episodeUsable) recentRejection = { reason: observation.reason, at };
      if (lastSoundAt === null || at - lastSoundAt > MONOPHONIC_CONFIG.clearMs) audibleSince = at;
      lastSoundAt = at;
    }
    wasAudible = audible;
    if (awaitingSound) {
      if (observation.reason === "quiet" && observation.levelDbfs < MONOPHONIC_CONFIG.minDbfs) boundaryQuiet = true;
      const rise = boundaryLevel !== null && observation.levelDbfs - boundaryLevel >= CALIBRATION_POLICY.attackRiseDb;
      boundaryLevel = Number.isFinite(observation.levelDbfs) ? observation.levelDbfs : null;
      if (audible && (boundaryQuiet || rise)) awaitingSound = false;
    }
    const measurement = awaitingSound ? emptyCalibrationMeasurement() : tracker.update(sample);
    if (measurement.status === "valid") lastAssessment = measurement;
    currentMeasurement = measurement;
    return measurement;
  }
  function confirmed(now: number) {
    return currentMeasurement.status === "valid" && currentMeasurement.stable && currentMeasurement.tuning === "within-band"
      && currentMeasurement.endMs !== null && now - currentMeasurement.endMs >= 0
      && now - currentMeasurement.endMs <= MONOPHONIC_CONFIG.staleMs;
  }
  function feedback(now: number, listening: boolean) {
    const age = observedAt === null ? Infinity : now - observedAt;
    const freshAnalysis = age >= 0 && age <= MONOPHONIC_CONFIG.clearMs;
    const live = listening && liveHz !== null && age >= 0 && age <= MONOPHONIC_CONFIG.staleMs;
    const audible = freshAnalysis && observation !== null && Number.isFinite(observation.levelDbfs)
      && observation.levelDbfs >= MONOPHONIC_CONFIG.minDbfs;
    const rejected: Record<PitchObservation["reason"], string> = {
      usable: "Sound detected - Pitch estimate uncertain", quiet: "Signal too quiet for reliable pitch",
      clipped: "Sound detected - Signal clipped", invalid: "Audio analysis rejected an invalid observation",
      aperiodic: "Sound detected - Pitch estimate uncertain (aperiodic signal)",
      "low-periodicity": "Sound detected - Pitch estimate uncertain (low periodicity)",
      "out-of-range": "Sound detected - Pitch estimate outside supported range",
      "clock-stalled": "Microphone audio clock is not progressing",
    };
    const rejectedShortSound = policy.version !== 1 && !audible && recentRejection !== null && now - recentRejection.at <= 1200 ? recentRejection.reason : null;
    const wantedActivity = !listening ? "Listening stopped"
      : !freshAnalysis ? "No new microphone observations"
        : observation?.reason === "clock-stalled" ? rejected["clock-stalled"]
          : currentAmbiguity ? currentAmbiguity === "possible-harmonic-or-different-pitch"
            ? "Sound detected - Possible harmonic" : "Sound detected - Pitch outside expected fundamental region"
            : live ? "Listening - Sound detected - Measuring pitch"
              : observation?.reason === "invalid" ? rejected.invalid
                : !audible ? rejectedShortSound ? rejected[rejectedShortSound] : "Signal too quiet for reliable pitch"
                  : rejected[observation?.reason ?? "invalid"];
    if (wantedActivity !== pendingActivity) { pendingActivity = wantedActivity; pendingSince = now; }
    // Explain sustained failures without flashing a one-frame warning. Numeric freshness
    // is independent of this readable-message debounce and minimum hold.
    if (!listening || now - pendingSince >= 300 && now - activitySince >= 600) {
      if (activity !== wantedActivity) { activity = wantedActivity; activitySince = now; }
    }
    const status = live ? "Live" as const : listening && freshAnalysis && audible
      && now - pendingSince >= 300 ? "Uncertain" as const : "Last heard" as const;
    const progress = listening ? { ...tracker.progress(now), ...(awaitingSound ? { blocker: "boundary" as const } : {}) } : null;
    const explanations: Record<NonNullable<NonNullable<typeof progress>["blocker"]>, string> = {
      boundary: "Let the previous sound fade, then pluck the next open string",
      "no-observations": "No new microphone observations",
      quiet: "Signal too quiet for reliable pitch", clipped: "Signal is clipped; reduce the input level",
      invalid: "No current analyzable pitch", aperiodic: "Microphone cannot find a reliable repeating pitch (aperiodic signal)",
      "low-periodicity": "Microphone cannot find a reliable repeating pitch (low periodicity)",
      "out-of-range": "Pitch estimate is outside the supported range", "clock-stalled": "Microphone audio clock is not progressing",
      harmonic: "Possible octave/harmonic ambiguity", "outside-fundamental": "Pitch is outside the expected fundamental region",
      gap: `Pitch gap exceeded ${CALIBRATION_CONTINUITY.gapMs} ms; gathering fresh evidence`, interruption: "Capture changed; gathering fresh evidence",
      capacity: "Candidate restarted; gathering fresh evidence", settling: `Initial ${policy.settlingMs} ms settling; samples are not counted yet`,
      samples: policy.version !== 1 ? "Pluck again to refine the pitch estimate" : "Too few usable pitch estimates", span: policy.version !== 1 ? "Let the string ring briefly, or pluck again" : "Insufficient qualifying time span",
      spread: policy.version !== 1 ? "Pitch estimates do not agree yet; pluck again" : `Pitch is fluctuating too much for calibration (spread exceeds ${policy.spreadCents} cents)`,
      drift: `Pitch is drifting over the window (drift exceeds ${policy.driftCents} cents)`,
      "out-of-band": `Pitch is stable but outside the green tuning band. ${currentMeasurement.cents! < 0 ? "Raise" : "Lower"} its pitch slightly and pluck again.`,
    };
    const blockerText = rejectedShortSound && rejectedShortSound !== "usable" ? explanations[rejectedShortSound] : progress?.blocker ? explanations[progress.blocker] : null;
    const reason = listening && audibleSince !== null && now - audibleSince >= (policy.version !== 1 ? 250 : 1500) ? blockerText : null;
    if (reason !== failureReason && (failureReason === null || now - reasonSince >= 1200)) {
      failureReason = reason; reasonSince = now;
    }
    return { frequencyHz: live ? liveHz : lastHeardHz, status, assessment: lastAssessment,
      confirming: false, lastHeardAt, ambiguity: live && activity === wantedActivity ? currentAmbiguity : null,
      activity, failureReason, liveFrequencyHz: live ? liveHz : null, lastHeardHz, progress };
  }
  function reset() {
    tracker.reset(); currentMeasurement = emptyCalibrationMeasurement(); liveHz = null; observedAt = null; observation = null;
    previousAt = previousAudio = generation = null; currentAmbiguity = null;
    wasAudible = episodeUsable = false; episodeRejected = 0; recentRejection = null;
    audibleSince = lastSoundAt = null; failureReason = null; reasonSince = 0;
    activity = pendingActivity = "Listening - Waiting for microphone observations";
    pendingSince = activitySince = 0; awaitingSound = boundaryQuiet = false; boundaryLevel = null;
  }
  function waitForNewSound(level: number | null, quietObserved: boolean) {
    tracker.reset(); currentMeasurement = emptyCalibrationMeasurement(); awaitingSound = true;
    boundaryLevel = level; boundaryQuiet = quietObserved;
  }
  return { update, confirmed, feedback, reset, waitForNewSound };
}
