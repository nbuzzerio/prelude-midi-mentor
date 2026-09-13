import { addStaffBuilderAnnotation, deleteStaffBuilderAnnotation, updateStaffBuilderAnnotation } from "./staff-builder-annotations";
import type { StaffBuilderAnnotation, StaffBuilderNoteEvent, StaffBuilderScore } from "./staff-builder-types";

export type StaffBuilderLyricTargetResolution = Readonly<{
  candidates: readonly StaffBuilderNoteEvent[];
  target: StaffBuilderNoteEvent | null;
  ambiguous: boolean;
}>;

export function resolveStaffBuilderLyricTarget(score: StaffBuilderScore, measureIndex: number, offsetTicks: number, selectedEventId: string | null): StaffBuilderLyricTargetResolution {
  const candidates = (score.measures[measureIndex]?.events ?? []).filter((event): event is StaffBuilderNoteEvent => event.kind === "notes" && event.staff === "treble" && event.startTick === offsetTicks);
  const selected = candidates.find(({ id }) => id === selectedEventId) ?? null;
  return { candidates, target: selected ?? (candidates.length === 1 ? candidates[0]! : null), ambiguous: candidates.length > 1 && !selected };
}

export function commitStaffBuilderLyricCue(score: StaffBuilderScore, eventId: string, text: string, createId: () => string = () => crypto.randomUUID()): StaffBuilderScore {
  const existing = score.annotations.find((annotation): annotation is Extract<StaffBuilderAnnotation, { kind: "lyric-cue" }> => annotation.kind === "lyric-cue" && annotation.anchor.kind === "event" && annotation.anchor.eventId === eventId);
  const trimmed = text.trim();
  if (!trimmed) return existing ? deleteStaffBuilderAnnotation(score, existing.id) : score;
  if (existing) return updateStaffBuilderAnnotation(score, { ...existing, text: trimmed });
  return addStaffBuilderAnnotation(score, { id: createId(), kind: "lyric-cue", anchor: { kind: "event", eventId }, text: trimmed });
}
