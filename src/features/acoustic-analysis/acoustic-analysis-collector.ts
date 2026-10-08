import type { PitchObservationEnvelope } from "@/lib/audio/monophonic/pitch-analysis-types";
import { centsBetween, describeFrequency } from "@/lib/audio/monophonic/pitch-math";
import type { CalibrationSession } from "@/features/instrument-learning/calibration-types";
import type { AcousticAttack } from "@/features/piece-practice/piece-practice-acoustic-types";
import type { PiecePracticeAcousticEvidence } from "@/features/piece-practice/piece-practice-evidence";
import { ANALYSIS_POLICY as P, type AnalysisContext, type AnalysisData, type AnalysisObservation, type AnalysisTarget, type TraceBin } from "./acoustic-analysis-types";

/** Bounded scalar-only observer. It owns no capture, React state, or durable storage. */
export function createAcousticAnalysisCollector(session: AnalysisData["session"], originMs: number,
  limits: Partial<Record<"durationMs" | "eventLimit" | "estimatedBudgetBytes" | "highResolutionMs", number>> = {}) {
  const policy = { ...P, ...limits };
  const data: AnalysisData = { session, captureSegments: [], lifecycleEvents: [], calibrations: [], targets: [], targetVisits: [],
    attacks: [], attempts: [], trace: [], highResolutionWindows: [], coverage: { stopped: false, reason: null, endedAtMs: null,
      sourceObservations: 0, gaps: [], omittedWindows: 0, estimatedBytes: 0 } };
  let enabled = true, generation: number | null = null, audioOrigin = 0;
  let segment = "", context: AnalysisContext = { phase: "preflight", targetVisitId: null, calibrationRevision: null, referenceHz: null, paused: true };
  let ring: AnalysisObservation[] = [], pending: TraceBin | null = null, bin = -1, visitKey: string | null = null, currentVisit: string | null = null;
  let lastAt: number | null = null, lastHz: number | null = null, events = 0, lastReason = "", disabledAt: number | null = null;
  const relative = (at: number) => Math.max(0, at - originMs);
  const flush = () => { if (pending) data.trace.push(pending); pending = null; bin = -1; };
  function stop(reason: string, at: number) {
    if (data.coverage.stopped) return;
    flush(); data.coverage.stopped = true; data.coverage.reason = reason; data.coverage.endedAtMs = relative(at); ring = [];
  }
  function reserve(bytes: number, at: number, event = false) {
    if (!enabled || data.coverage.stopped) return false;
    if (!Number.isFinite(at) || at < originMs) { stop("invalid-clock", Number.isFinite(at) ? at : originMs); return false; }
    if (relative(at) >= policy.durationMs) { stop("duration-limit", at); return false; }
    if (event && events >= policy.eventLimit) { stop("event-limit", at); return false; }
    if (data.coverage.estimatedBytes + bytes > policy.estimatedBudgetBytes) { stop("memory-budget", at); return false; }
    data.coverage.estimatedBytes += bytes; if (event) events++;
    return true;
  }
  function event(kind: string, at: number, detail: string | null = null) {
    if (!reserve(P.eventAllowanceBytes, at, true)) return null;
    const id = `${session.id}:event-${data.lifecycleEvents.length}`;
    data.lifecycleEvents.push({ id, atMs: relative(at), kind, targetVisitId: context.targetVisitId, detail }); return id;
  }
  function boundary() { flush(); ring = []; lastAt = lastHz = null; }
  function setEnabled(value: boolean, at: number) {
    if (value === enabled) return;
    if (!value) { event("collection-disabled", at); disabledAt = relative(at); }
    boundary(); enabled = value;
    if (value) {
      generation = null; event("collection-enabled", at);
      if (disabledAt !== null && reserve(P.eventAllowanceBytes, at, true)) data.coverage.gaps.push({ startMs: disabledAt, endMs: relative(at), reason: "collection-disabled" });
      disabledAt = null;
    }
  }
  function setContext(next: AnalysisContext) {
    if (Object.keys(next).some((key) => next[key as keyof AnalysisContext] !== context[key as keyof AnalysisContext])) boundary();
    context = { ...next };
  }
  function setTarget(target: AnalysisTarget | null, key: string | null, at: number) {
    if (!enabled || data.coverage.stopped) return null;
    if (key === visitKey) return currentVisit;
    boundary(); visitKey = key;
    if (!target) { currentVisit = null; context = { ...context, targetVisitId: null }; return null; }
    if (!reserve(P.eventAllowanceBytes, at, true)) return null;
    if (!data.targets.some(({ id }) => id === target.id)) data.targets.push({ ...target });
    const id = `${session.id}:visit-${data.targetVisits.length}`;
    currentVisit = id;
    data.targetVisits.push({ id, targetId: target.id, activatedAtMs: relative(at) });
    context = { ...context, targetVisitId: id }; event("target-activation", at); return id;
  }
  function trigger(at: number, triggerId: string, kind: "diagnostic" | "calibration" = "diagnostic", interval?: { startMs: number; endMs: number }) {
    if (!enabled || data.coverage.stopped) return;
    const startMs = interval?.startMs ?? Math.max(0, relative(at) - P.preMs);
    const endMs = interval?.endMs ?? Math.min(policy.durationMs, relative(at) + P.postMs);
    const overlapping = data.highResolutionWindows.filter((window) => window.kind === kind && window.startMs <= endMs && window.endMs >= startMs);
    const start = Math.min(startMs, ...overlapping.map((window) => window.startMs));
    const end = Math.max(endMs, ...overlapping.map((window) => window.endMs));
    const others = data.highResolutionWindows.filter((window) => !overlapping.includes(window));
    const used = others.reduce((sum, window) => sum + window.endMs - window.startMs, 0) + end - start;
    const diagnosticUsed = others.filter((window) => window.kind === "diagnostic").reduce((sum, window) => sum + window.endMs - window.startMs, 0)
      + (kind === "diagnostic" ? end - start : 0);
    if (used > policy.highResolutionMs || diagnosticUsed > Math.max(0, policy.highResolutionMs - P.calibrationReserveMs)) {
      data.coverage.omittedWindows++; return;
    }
    const rows = [...overlapping.flatMap((window) => window.observations), ...ring.filter((row) => row.atMs >= start && row.atMs <= end)];
    const unique = [...new Map(rows.map((row) => [row.id, row])).values()].sort((a, b) => a.atMs - b.atMs);
    if (!reserve(128 + P.rowAllowanceBytes * Math.max(0, unique.length - overlapping.reduce((sum, window) => sum + window.observations.length, 0)), at)) return;
    data.highResolutionWindows = [...others, { startMs: start, endMs: end, kind,
      triggerIds: [...new Set([...overlapping.flatMap((window) => window.triggerIds), triggerId])], observations: unique }].sort((a, b) => a.startMs - b.startMs);
  }
  function observe(envelope: PitchObservationEnvelope, id: string) {
    const at = envelope.observedAtMs;
    if (!reserve(0, at)) return;
    if (generation !== envelope.captureGeneration) {
      boundary(); generation = envelope.captureGeneration; audioOrigin = envelope.audioSeconds;
      if (!reserve(P.eventAllowanceBytes, at, true)) return;
      segment = `${session.id}:capture-${data.captureSegments.length}`;
      data.captureSegments.push({ id: segment, startedAtMs: relative(at), generation });
    }
    const { observation: raw, snapshot } = envelope;
    if (![raw.quality, raw.levelDbfs, envelope.audioSeconds].every(Number.isFinite)
      || raw.frequencyHz !== null && (!Number.isFinite(raw.frequencyHz) || raw.frequencyHz <= 0)) { stop("invalid-scalar", at); return; }
    if (lastAt !== null && at - lastAt > 100) {
      if (!reserve(P.eventAllowanceBytes, at, true)) return;
      data.coverage.gaps.push({ startMs: relative(lastAt), endMs: relative(at), reason: "observation-gap" });
      flush();
    }
    const row: AnalysisObservation = { id, atMs: relative(at), captureSegmentId: segment,
      audioMs: Math.max(0, (envelope.audioSeconds - audioOrigin) * 1000), context: { ...context },
      frequencyHz: raw.frequencyHz, nearestSemitone: raw.frequencyHz === null ? null : describeFrequency(raw.frequencyHz)?.semitone ?? null,
      quality: raw.quality, levelDbfs: raw.levelDbfs, reason: raw.reason, state: snapshot.state, fresh: snapshot.fresh,
      ageMs: snapshot.ageMs, trackedHz: snapshot.pitch?.frequencyHz ?? null };
    data.coverage.sourceObservations++; lastAt = at;
    ring.push(row); while (ring.length && (row.atMs - ring[0].atMs > P.ringMs || ring.length > 160)) ring.shift();
    const nextBin = Math.floor(row.atMs / P.binMs);
    if (nextBin !== bin) {
      flush(); if (!reserve(P.rowAllowanceBytes, at)) return;
      bin = nextBin; pending = { observation: row, sourceCount: 0, usableCount: 0, minimumCents: null, maximumCents: null, reasons: {} };
    }
    if (pending) {
      pending.sourceCount++; pending.usableCount += raw.reason === "usable" ? 1 : 0;
      pending.reasons[raw.reason] = (pending.reasons[raw.reason] ?? 0) + 1;
      if (raw.frequencyHz !== null && context.referenceHz !== null) {
        const cents = centsBetween(raw.frequencyHz, context.referenceHz);
        pending.minimumCents = Math.min(pending.minimumCents ?? cents, cents);
        pending.maximumCents = Math.max(pending.maximumCents ?? cents, cents);
      }
    }
    for (const window of data.highResolutionWindows) if (row.atMs >= window.startMs && row.atMs <= window.endMs) {
      if (!reserve(P.rowAllowanceBytes, at)) return;
      window.observations.push(row);
    }
    const octave = raw.frequencyHz !== null && lastHz !== null && Math.abs(Math.abs(centsBetween(raw.frequencyHz, lastHz)) - 1200) <= 35;
    if (octave || raw.reason === "usable" && lastReason && lastReason !== "usable") trigger(at, id);
    lastHz = raw.frequencyHz; lastReason = raw.reason;
  }
  function attempt(attack: AcousticAttack, evidence: PiecePracticeAcousticEvidence | null) {
    if (!context.targetVisitId || !segment || !reserve(P.eventAllowanceBytes, attack.confirmedAtMs, true)) return;
    const id = `${session.id}:attack-${data.attacks.length}`;
    data.attacks.push({ id, source: "microphone", captureGeneration: attack.captureGeneration, sequence: attack.sequence,
      frequencyHz: attack.frequencyHz, nearestSemitone: attack.nearestSemitone, articulation: attack.articulation,
      onsetAtMs: relative(attack.onsetObservedAtMs), confirmedAtMs: relative(attack.confirmedAtMs), captureSegmentId: segment, targetVisitId: context.targetVisitId });
    if (evidence) data.attempts.push({ attackId: id, targetVisitId: context.targetVisitId, evidence: structuredClone(evidence) });
    event(evidence?.accepted ? "acceptance" : evidence ? "rejection" : "unsubmitted-attack", attack.confirmedAtMs);
    if (evidence && !evidence.accepted) trigger(attack.confirmedAtMs, id);
  }
  function calibration(state: CalibrationSession, at: number) {
    const selectedCount = state.measurement.samples.length;
    if (!reserve(P.eventAllowanceBytes + selectedCount * P.rowAllowanceBytes, at, true)) return;
    const selected = state.measurement.status === "valid" ? state.measurement : state.attempts.at(-1)?.measurement;
    if (selected?.startMs !== null && selected?.endMs !== null && selected?.samples.length) {
      trigger(at, `${state.id}:revision-${state.revision}`, "calibration", { startMs: relative(selected.startMs), endMs: relative(selected.endMs) });
    }
    // Raw supporting samples share the explicit high-resolution coverage budget.
    // Older summaries remain, even when their raw window could not be retained.
    const retained = new Set(data.highResolutionWindows.filter((window) => window.kind === "calibration").flatMap((window) => window.observations.map((row) => row.id)));
    const retainedMeasurement = (value: CalibrationSession["measurement"]) => ({ ...value, samples: value.samples.filter(({ id }) => retained.has(id)) });
    data.calibrations = [{ ...state, measurement: retainedMeasurement(state.measurement),
      attempts: state.attempts.map((attempt) => ({ ...attempt, measurement: retainedMeasurement(attempt.measurement) })) }];
  }
  return { observe, setContext, setTarget, event, attempt, calibration, trigger, setEnabled, stop,
    resetCapture: () => { boundary(); generation = null; },
    status: () => ({ ...data.coverage, enabled }),
    ringSize: () => ring.length,
    snapshot: () => structuredClone({ ...data, trace: pending ? [...data.trace, pending] : data.trace }),
    originMs, policy };
}
