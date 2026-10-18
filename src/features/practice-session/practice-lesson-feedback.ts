import type { ProgramAttempt, ProgramHistoryRecord, ProgramMetricSummary, ProgramOccurrence } from "./practice-program-attempt";
import type { PracticeExerciseEntry } from "./practice-session-types";
import { getPracticeLessonCue } from "./practice-lesson-cues";
import { getPracticeExerciseConceptName } from "./practice-session-presenters";

export function lessonOutcome(attempt: ProgramAttempt): string {
  if (!attempt.closed) return attempt.outcome === "completed" ? "Target reached" : "In progress";
  return attempt.outcome === "completed" ? "Completed" : attempt.outcome === "interrupted" ? "Interrupted" : "Stopped early";
}

/** Native scalar labels only. Counts never combine incompatible engines. */
export function lessonMetricLines(metrics: ProgramMetricSummary | null): readonly string[] {
  if (!metrics) return ["Native measurements are unavailable."];
  const { engine, completedUnits: count, firstTryUnits: first, incorrectResponses: wrong, averageResponseDurationMs: mean } = metrics;
  if (engine === "melody") return [
    `Completed ${count} original reading ${count === 1 ? "trial" : "trials"}.`,
    ...([['Pitch', metrics.pitchPercent], ['Timing', metrics.timingPercent], ['Movement', metrics.movementPercent]] as const)
      .flatMap(([name, value]) => value === null ? [] : [`Native original-trial ${name} average: ${value}%.`]),
  ];
  const lines: string[] = [];
  if (engine === "sequences") {
    lines.push(`Completed ${count} ${count === 1 ? "sequence" : "sequences"}.`);
    if (first !== null) lines.push(`${count - first} of ${count} completed sequences required another attempt.`);
  } else if (count === 0) lines.push(engine === "flashcards" ? "No completed targets were recorded." : "No completed interval identifications were recorded.");
  else if (first !== null) lines.push(engine === "flashcards"
    ? `${first} of ${count} completed targets were correct on the first attempt.`
    : `${first} of ${count} completed interval identifications were correct on the first guess.`);
  else lines.push(`Completed ${count} ${engine === "flashcards" ? count === 1 ? "target" : "targets" : count === 1 ? "interval identification" : "interval identifications"}.`);
  if (wrong !== null) lines.push(engine === "sequences" ? `Incorrect sequence attempts: ${wrong}.` : engine === "ear-training" ? `Incorrect guesses: ${wrong}.` : `Incorrect attempts: ${wrong}.`);
  if (mean !== null) lines.push(`Average completed-${engine === "sequences" ? "sequence duration" : engine === "ear-training" ? "identification response" : "target response"}: ${(mean / 1000).toFixed(1)} seconds.`);
  return lines;
}

export function lessonExerciseFeedback(attempt: ProgramAttempt) {
  // Final metrics can include Bonus; absence of a boundary is not permission to
  // reconstruct it from final aggregates or the exercise target.
  const metrics = attempt.targetMetrics ?? attempt.metrics;
  const sourceNames = { midi: "MIDI", virtual: "on-screen input", simulation: "simulation" };
  const remaining = "count" in attempt.exercise.target && attempt.exercise.target.count !== null
    ? Math.max(0, attempt.exercise.target.count - attempt.prescribedUnits)
    : attempt.exercise.target.kind === "complete-scale-repertoire" && attempt.exercise.engine === "sequences"
      ? Math.max(0, attempt.exercise.config.scaleRepertoire.length - attempt.prescribedUnits) : null;
  const cue = getPracticeLessonCue(attempt.exercise);
  const lines = lessonMetricLines(metrics);
  const responseName = attempt.exercise.engine === "ear-training" ? "incorrect guesses" : attempt.exercise.engine === "sequences" ? "incorrect sequence attempts" : "incorrect attempts";
  return {
    outcome: lessonOutcome(attempt),
    phase: attempt.targetMetrics ? "Prescribed target evidence" : "Recorded evidence (all recorded work)",
    lines,
    sources: metrics?.sources?.length ? `Recorded answer sources: ${metrics.sources.map(source => sourceNames[source]).join(", ")}.` : "Input source: unknown in native evidence.",
    unfinished: remaining !== null && remaining > 0 ? `${remaining} prescribed ${remaining === 1 ? "unit remains" : "units remain"} unfinished.` : !attempt.closed || attempt.outcome === "completed" ? null : "The prescribed target was not reached.",
    bonus: attempt.bonusDurationMs > 0 || attempt.bonusUnits > 0 ? `Bonus was recorded separately (${attempt.bonusUnits} completed units); overall native results are available in details.` : null,
    observation: metrics?.incorrectResponses ? `This round included ${metrics.incorrectResponses} ${responseName}. ${cue}` : cue,
    summaryObservation: [lines[0], ...(metrics?.incorrectResponses ? lines.filter(line => line.startsWith("Incorrect")) : []),
      ...(metrics?.engine === "melody" && metrics.timingPercent !== null ? [`Native original-trial Timing average: ${metrics.timingPercent}%.`] : [])].join(" "),
    suggestion: `Continue with a short ${getPracticeExerciseConceptName(attempt.exercise).toLowerCase()} round. ${cue}`,
  };
}

/** Exact occurrence membership, never program/date membership. No persistence. */
export function lessonSummaryRows(queue: readonly ProgramOccurrence[], records: readonly ProgramHistoryRecord[], exercises: readonly PracticeExerciseEntry[], pending: ProgramAttempt | null = null, pendingSkipOccurrence?: string) {
  return queue.map(occurrence => {
    const record = records.find(row => row.occurrenceId === occurrence.occurrenceId && row.exerciseId === occurrence.exerciseId);
    const unresolved = pending?.occurrenceId === occurrence.occurrenceId && (!record || record.kind !== "attempt" || record.writeVersion < pending.writeVersion || record.closed !== pending.closed);
    return { ...occurrence, exercise: record?.exercise ?? exercises.find(entry => entry.id === occurrence.exerciseId), record,
      outcome: unresolved ? "Results pending" : occurrence.occurrenceId === pendingSkipOccurrence ? "Skip save pending" : record?.kind === "skip" ? "Deliberately skipped" : record ? lessonOutcome(record) : "Unperformed" };
  });
}
