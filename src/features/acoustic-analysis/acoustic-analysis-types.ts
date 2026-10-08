import type { PitchObservation, PitchSnapshot } from "@/lib/audio/monophonic/pitch-analysis-types";
import type { CalibrationSession } from "@/features/instrument-learning/calibration-types";
import type { AcousticAttack } from "@/features/piece-practice/piece-practice-acoustic-types";
import type { PiecePracticeAcousticEvidence } from "@/features/piece-practice/piece-practice-evidence";

export const ANALYSIS_POLICY = Object.freeze({ version: 1, binMs: 100, ringMs: 4000, preMs: 1000, postMs: 2000,
  highResolutionMs: 60000, calibrationReserveMs: 10000, durationMs: 3600000, eventLimit: 10000,
  estimatedBudgetBytes: 16 * 1024 * 1024, rowAllowanceBytes: 640, eventAllowanceBytes: 2048 });
export type AnalysisContext = Readonly<{ phase: "preflight" | "practice"; targetVisitId: string | null;
  calibrationRevision: number | null; referenceHz: number | null; paused: boolean }>;
export type AnalysisObservation = Readonly<{
  id: string; atMs: number; captureSegmentId: string; audioMs: number; context: AnalysisContext;
  frequencyHz: number | null; nearestSemitone: number | null; quality: number; levelDbfs: number; reason: PitchObservation["reason"];
  state: PitchSnapshot["state"]; fresh: boolean; ageMs: number | null; trackedHz: number | null;
}>;
export type TraceBin = { observation: AnalysisObservation; sourceCount: number; usableCount: number;
  minimumCents: number | null; maximumCents: number | null; reasons: Partial<Record<PitchObservation["reason"], number>> };
export type AnalysisEvent = Readonly<{ id: string; atMs: number; kind: string; targetVisitId: string | null; detail: string | null }>;
export type AnalysisTarget = Readonly<{ id: string; measureIndex: number; sourceMeasureId: string;
  expectedSemitone: number; expectedHz: number; spelling: string }>;
export type AnalysisAttack = Omit<AcousticAttack, "onsetObservedAtMs" | "confirmedAtMs"> & Readonly<{
  id: string; captureSegmentId: string; targetVisitId: string; onsetAtMs: number; confirmedAtMs: number;
}>;
export type AnalysisWindow = { startMs: number; endMs: number; kind: "diagnostic" | "calibration";
  triggerIds: string[]; observations: AnalysisObservation[] };
export type AnalysisData = {
  session: { id: string; runId: string | null; startedAt: string; instrument: "violin" | "ocarina";
    startMeasureIndex: number; endMeasureIndex: number | null; focus: string; pitchToleranceCents: number };
  captureSegments: { id: string; startedAtMs: number; generation: number }[];
  lifecycleEvents: AnalysisEvent[]; calibrations: CalibrationSession[]; targets: AnalysisTarget[];
  targetVisits: { id: string; targetId: string; activatedAtMs: number }[];
  attacks: AnalysisAttack[];
  attempts: { attackId: string; targetVisitId: string; evidence: PiecePracticeAcousticEvidence }[];
  trace: TraceBin[]; highResolutionWindows: AnalysisWindow[];
  coverage: { stopped: boolean; reason: string | null; endedAtMs: number | null; sourceObservations: number;
    gaps: { startMs: number; endMs: number; reason: string }[]; omittedWindows: number; estimatedBytes: number };
};
