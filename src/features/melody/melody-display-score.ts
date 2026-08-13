import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import type { MelodyExercise } from "./melody-types";

const DISPLAY_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export function projectMelodyExerciseToDisplayScore(exercise: MelodyExercise): StaffBuilderScore {
  return {
    schemaVersion: 2,
    id: `${exercise.id}-display-score`,
    title: "Melody exercise",
    createdAt: DISPLAY_TIMESTAMP,
    updatedAt: DISPLAY_TIMESTAMP,
    tempoBpm: exercise.settings.tempoBpm,
    initialKeySignatureId: exercise.settings.keyId,
    initialTimeSignature: "4/4",
    measures: exercise.measures.map((measure) => ({
      id: measure.id,
      events: measure.events.map((event) => ({
        id: event.id,
        kind: "notes" as const,
        staff: event.staff,
        startTick: event.startTick,
        rhythm: { status: "final" as const, duration: event.duration },
        pitches: [{ id: `${event.id}-pitch`, ...event.pitch }],
      })),
    })),
    ties: [],
    annotations: [],
  };
}
