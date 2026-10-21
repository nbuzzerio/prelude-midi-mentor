import type { ContinuousPolicy } from "../continuous/continuous-types";
import type { ProgramCalendarAttribution } from "../../practice-session/practice-program-calendar";

/** Local owner acceptance is never exported or inferred from synthetic evidence. */
export type RolodexAcceptance = Readonly<{
  version: 1; generation: string; enabled: boolean; acceptedAt: string;
  inputId: string; policy: ContinuousPolicy;
}>;
export type RolodexRunSummary = Readonly<{
  version: 1; cycle: string | null; attemptId: string; passageId: string; prescriptionRevision: number;
  target: string; instrument: "piano"; mode: "continuous"; inputSource: "physical-midi";
  inputId: string; bpm: number; policy: ContinuousPolicy;
  startedAt: string; endedAt: string; acknowledgedAt: string;
  calendar: ProgramCalendarAttribution | null; endLocalDate: string | null;
  outcome: "completed" | "stopped" | "failed" | "interrupted";
  expected: number; matched: number; onTime: number; early: number; late: number;
  unreliableAttacks: number; wrong: number; missing: number; extras: number; uncertain: number; unobserved: number;
  determination: "clean" | "non-clean" | "inconclusive";
  reasons: readonly string[]; acceptance: RolodexAcceptance | null; restored: boolean;
}>;
export type RolodexProgress = Readonly<{
  version: 1; cycle: string | null; recent: readonly RolodexRunSummary[]; pinned: readonly RolodexRunSummary[];
  /** Older delivery can never be counted again after bounded history compaction. */
  cutoff: string | null; resetAt: string | null;
}>;
export type RolodexProgressState = Readonly<{
  stage: "needs-practice" | "improving" | "retention" | "mastered";
  clean: readonly RolodexRunSummary[]; retained: RolodexRunSummary | null;
  dueAfter: string | null; restored: boolean;
}>;
export const EMPTY_PROGRESS: RolodexProgress = Object.freeze({ version: 1, cycle: null, recent: [], pinned: [], cutoff: null, resetAt: null });
