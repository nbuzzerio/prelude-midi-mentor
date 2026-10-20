import { parseStaffBuilderScore } from "@/features/staff-builder/persistence/staff-builder-schema";
import { STAFF_BUILDER_TICKS_PER_QUARTER } from "@/features/staff-builder/staff-builder-time";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import type { ContinuousPassage, ContinuousPolicy } from "./continuous-types";

export const CONTINUOUS_POLICY: ContinuousPolicy = Object.freeze({ version: 1,
  associationCapMs: 400, associationPulse: 0.5, associationGap: 0.45,
  onTimeCapMs: 150, onTimePulse: 0.2, onTimeGap: 0.4 });
export const CONTINUOUS_MAX_SCORE_BYTES = 256 * 1024;

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

/** Canonical detached full source retains inherited contexts and boundary ties. */
export function projectContinuousPassage(source: unknown, start: number, end: number, bpm: number,
  policy: ContinuousPolicy = CONTINUOUS_POLICY): ContinuousPassage {
  if (!Number.isInteger(bpm) || bpm < 40 || bpm > 120) throw Error("Choose 40–120 quarter-note BPM.");
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end < start || end - start > 3) {
    throw Error("Choose one to four complete measures.");
  }
  const parsed = parseStaffBuilderScore(source);
  if (!parsed.ok) throw Error("The source score is invalid. Correct it in Staff Builder before practicing.");
  const score = parsed.value;
  if (new TextEncoder().encode(JSON.stringify(score)).length > CONTINUOUS_MAX_SCORE_BYTES) {
    throw Error("This source exceeds the A1 frozen-score limit (256 KiB). Use pitch-first practice.");
  }
  const projected = projectStaffBuilderPieceForPractice(score);
  if (!projected.ok) throw Error("Resolve the score’s rhythmic or notation validation issues in Staff Builder first.");
  const measures = projected.piece.measures.slice(start, end + 1);
  if (measures.length !== end - start + 1) throw Error("The selected measures are unavailable.");
  const meter = measures[0]!.timeSignature;
  if (meter !== "3/4" && meter !== "4/4" && meter !== "6/8") throw Error("A1 supports 3/4, 4/4 and 6/8. Use pitch-first for this meter.");
  if (measures.some((m) => m.timeSignature !== meter)) throw Error("Select a range with constant meter, or use pitch-first.");
  if (measures.some((m) => m.sourceEvents.some((e) => e.kind === "notes" && e.arpeggiation))) {
    throw Error("Rolled chords are not assessed in A1. Select ordinary block chords or use pitch-first.");
  }
  const selectedEvents = new Set(measures.flatMap((m) => m.sourceEvents.map((e) => e.sourceEventId)));
  if (score.ties.some((t) => selectedEvents.has(t.toEventId) && !selectedEvents.has(t.fromEventId))) {
    throw Error("This range begins inside an incoming tie. Expand the selection to include its attack, or use pitch-first.");
  }
  if (policy.version !== 1 || [policy.associationCapMs, policy.associationPulse, policy.associationGap,
    policy.onTimeCapMs, policy.onTimePulse, policy.onTimeGap].some((v) => !Number.isFinite(v) || v <= 0)
    || policy.associationGap >= 0.5 || policy.onTimeGap > policy.associationGap
    || policy.onTimeCapMs > policy.associationCapMs || policy.onTimePulse > policy.associationPulse) throw Error("Invalid assessment policy.");
  const ticksToMs = (ticks: number) => (ticks / STAFF_BUILDER_TICKS_PER_QUARTER) * (60000 / bpm);
  const pulseMs = 60000 / bpm * (meter === "6/8" ? 1.5 : 1);
  const pulsesPerBar = meter === "6/8" ? 2 : meter === "3/4" ? 3 : 4;
  const measureMs = ticksToMs(measures[0]!.capacityTicks);
  const origin = measures[0]!.absoluteStartTick;
  const targets = measures.flatMap((m) => m.targets);
  const expected = targets.map((target, i) => {
    // Endpoints use the sole adjacent distinct onset; an isolated onset uses infinity.
    // Range edges/rests are not fabricated onsets. Pulse/cap still bound every window.
    const prev = targets[i - 1]; const next = targets[i + 1];
    const gap = ticksToMs(Math.min(prev ? target.absoluteStartTick - prev.absoluteStartTick : Infinity,
      next ? next.absoluteStartTick - target.absoluteStartTick : Infinity));
    return { target, timeMs: ticksToMs(target.absoluteStartTick - origin),
      associationMs: Math.min(policy.associationCapMs, policy.associationPulse * pulseMs, policy.associationGap * gap),
      onTimeMs: Math.min(policy.onTimeCapMs, policy.onTimePulse * pulseMs, policy.onTimeGap * gap) };
  });
  return freeze({ version: 1, score, start, end, bpm, meter, pulseMs, pulsesPerBar, measureMs,
    durationMs: measureMs * measures.length, tailMs: Math.min(400, pulseMs * 0.5), policy: { ...policy }, expected });
}
