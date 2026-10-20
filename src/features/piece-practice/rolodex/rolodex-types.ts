import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import type { ContinuousPolicy } from "../continuous/continuous-types";

export type RolodexInstrument = "piano" | "violin" | "ocarina";
export type RolodexSourceInstrument = RolodexInstrument | "unknown";
export type RolodexPractice = Readonly<{
  attemptId: string; prescriptionRevision: number; endedAt: string;
  outcome: "completed" | "stopped" | "failed" | "interrupted";
  instrument: "piano"; inputSource: "physical-midi"; inputId: string | null;
}>;
export type RolodexEntry = Readonly<{
  schemaVersion: 1; id: string; revision: number; prescriptionRevision: number;
  sourceId: string; sourceTitle: string; sourceUpdatedAt: string; score: StaffBuilderScore;
  start: number; end: number; measureIds: readonly string[]; measureNumbers: readonly number[];
  sourceInstrument: RolodexSourceInstrument; eligibleInstruments: readonly RolodexInstrument[];
  practiceInstrument: RolodexInstrument; mode: "continuous"; bpm: number; policy: ContinuousPolicy;
  nickname: string; origin: "manual" | "evidence-suggested";
  evidence: Readonly<{ runId: string; measureIndex: number; reasons: string }> | null;
  status: "needs-practice" | "improving" | "paused" | "archived"; priority: boolean;
  createdAt: string; updatedAt: string; lastPractice: RolodexPractice | null;
}>;
export type RolodexListing = Readonly<{ entries: readonly RolodexEntry[]; unavailableCount: number }>;
export type RolodexSaveResult = Readonly<{ entry: RolodexEntry; duplicate: boolean }>;
export interface RolodexStore {
  list(): Promise<RolodexListing>;
  save(entry: RolodexEntry, expectedRevision: number | null): Promise<RolodexSaveResult>;
  remove(id: string, expectedRevision: number): Promise<void>;
  importEntries(entries: readonly RolodexEntry[]): Promise<void>;
  acknowledge(id: string, practice: RolodexPractice): Promise<void>;
}
