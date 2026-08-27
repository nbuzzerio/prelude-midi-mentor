import { describe, expect, it } from "vitest";
import { parseStaffBuilderScore } from "@/features/staff-builder/persistence/staff-builder-schema";
import { DEFAULT_MELODY_SETTINGS } from "./melody-types";
import { generateMelodyExercise } from "./melody-generator";
import {
  projectMelodyExerciseToDisplayScore,
  projectMelodyExerciseToPracticeDisplayScore,
} from "./melody-display-score";

describe("Melody display-score projection", () => {
  it("creates a deterministic schema-valid rendering transport with exact musical metadata", () => {
    const exercise = generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, staff: "bass", keyId: "d-minor", tempoBpm: 70, measureCount: 2 }, "display");
    const score = projectMelodyExerciseToDisplayScore(exercise);
    expect(parseStaffBuilderScore(score).ok).toBe(true);
    expect(score).toMatchObject({ id: `${exercise.id}-display-score`, tempoBpm: 70, initialKeySignatureId: "d-minor", initialTimeSignature: "4/4", ties: [] });
    expect(score.measures).toHaveLength(2);
    expect(score.measures.flatMap(({ events }) => events).map((event) => ({ id: event.id, staff: event.staff, startTick: event.startTick, duration: event.rhythm.status === "final" ? event.rhythm.duration : null, pitch: event.kind === "notes" ? event.pitches[0] : null }))).toEqual(
      exercise.measures.flatMap(({ events }) => events).map((event) => ({ id: event.id, staff: event.staff, startTick: event.startTick, duration: event.duration, pitch: { id: `${event.id}-pitch`, ...event.pitch } })),
    );
    expect(projectMelodyExerciseToDisplayScore(exercise)).toEqual(score);
  });

  it("does not add fake opposite-staff events, rests, ties, or mutate its source exercise", () => {
    const exercise = generateMelodyExercise(DEFAULT_MELODY_SETTINGS, "transport-only");
    const before = structuredClone(exercise);
    const score = projectMelodyExerciseToDisplayScore(exercise);
    expect(score.measures.flatMap(({ events }) => events).every((event) => event.kind === "notes" && event.staff === "treble")).toBe(true);
    expect(score.ties).toEqual([]);
    expect(exercise).toEqual(before);
  });

  it.each([1, 2] as const)("adds one ungraded rest region beside a %i-measure target without changing authored attacks", (measureCount) => {
    const exercise = generateMelodyExercise({ ...DEFAULT_MELODY_SETTINGS, measureCount }, `practice-display-${measureCount}`);
    const before = structuredClone(exercise);
    const score = projectMelodyExerciseToPracticeDisplayScore(exercise);
    expect(parseStaffBuilderScore(score).ok).toBe(true);
    expect(score.measures).toHaveLength(measureCount + 1);
    expect(score.measures[0]).toMatchObject({
      id: `${exercise.id}-preparatory-lead-in`,
      events: [{ kind: "rest", rhythm: { status: "final", duration: "half" } }],
    });
    expect(score.measures.slice(1).flatMap(({ events }) => events).map(({ id }) => id)).toEqual(
      exercise.measures.flatMap(({ events }) => events).map(({ id }) => id),
    );
    expect(exercise.expectedAttacks.map(({ id }) => id)).toEqual(before.expectedAttacks.map(({ id }) => id));
    expect(exercise).toEqual(before);
  });
});
