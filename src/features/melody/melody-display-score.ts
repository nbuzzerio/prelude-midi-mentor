import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { MELODY_PHASE_ONE_METER } from "./melody-meter";
import { getMelodyPreparatoryLeadIn } from "./melody-preparatory-lead-in";
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

export function projectMelodyExerciseToPracticeDisplayScore(
  exercise: MelodyExercise,
): StaffBuilderScore {
  const target = projectMelodyExerciseToDisplayScore(exercise);
  const leadIn = getMelodyPreparatoryLeadIn(MELODY_PHASE_ONE_METER.timeSignature);
  return {
    ...target,
    id: `${exercise.id}-practice-display-score`,
    title: "Melody exercise with preparatory lead-in",
    initialTimeSignature: "2/4",
    measures: [
      {
        id: `${exercise.id}-preparatory-lead-in`,
        events: [{
          id: `${exercise.id}-preparatory-rest`,
          kind: "rest",
          staff: exercise.settings.staff,
          startTick: 0,
          rhythm: { status: "final", duration: leadIn.restDuration },
        }],
      },
      ...target.measures.map((measure, index) => index === 0
        ? { ...measure, timeSignatureChange: MELODY_PHASE_ONE_METER.timeSignature }
        : measure),
    ],
  };
}
