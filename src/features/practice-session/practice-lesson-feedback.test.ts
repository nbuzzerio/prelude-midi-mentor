import { describe, expect, it } from "vitest";
import { appendFlashcardCompletedTarget, appendFlashcardIncorrectAttempt, createFlashcardPracticeResult, snapshotFlashcardPracticeTarget } from "@/features/flashcards/flashcard-practice-result";
import { appendCompletedSequence, appendSequenceIncorrectAttempt, createSequencePracticeResult } from "@/features/sequences/sequence-practice-result";
import { appendEarTrainingCompletedTarget, appendEarTrainingIncorrectGuess, createEarTrainingPracticeResult, snapshotEarTrainingTarget } from "@/features/ear-training/ear-training-practice-result";
import { createMelodyPracticeResult } from "@/features/melody/melody-practice-result";
import { createMelodyContinuousDiagnosticTrial } from "@/features/melody/melody-continuous-practice";
import { generateMelodyExercise } from "@/features/melody/melody-generator";
import { DEFAULT_MELODY_SETTINGS } from "@/features/melody/melody-types";
import { evaluateMelodyAttempt } from "@/features/melody/melody-scoring";
import { testAttempt, testProgram, testSkip } from "./practice-program-test-fixtures";
import { summarizeProgramMetrics, type ProgramAttempt } from "./practice-program-attempt";
import { lessonExerciseFeedback, lessonMetricLines, lessonOutcome, lessonSummaryRows } from "./practice-lesson-feedback";

const pitch = { midiNumber: 60, name: "C", octave: 4 };
const target = snapshotFlashcardPracticeTarget({ clef: "bass", name: { primary: "C" }, notes: [pitch] }, 1);
const first = appendFlashcardCompletedTarget(createFlashcardPracticeResult(), { target, submittedMidiNumbers: [60], source: "midi", responseDurationMs: 1000 });
const other = { ...target, id: "other" };
const retried = appendFlashcardCompletedTarget(appendFlashcardIncorrectAttempt(first, { target: other, submittedMidiNumbers: [61], source: "virtual" }), { target: other, submittedMidiNumbers: [60], source: "virtual", responseDurationMs: 3200 });
const closed = (overrides: Partial<ProgramAttempt> = {}): ProgramAttempt => ({ ...testAttempt(), closed: true, outcome: "completed", prescribedUnits: 1, endedAt: testAttempt().updatedAt, ...overrides });

describe("evidence-grounded lesson feedback", () => {
  it("names completed-target denominators, incorrect attempts and response-time meaning", () => {
    const metrics = summarizeProgramMetrics(retried);
    const feedback = lessonExerciseFeedback(closed({ outcome: "stopped-early", metrics, prescribedUnits: 2, exercise: { ...testAttempt().exercise, target: { kind: "correct-answers", count: 20 } } as ProgramAttempt["exercise"] }));
    expect(feedback.lines).toEqual(["1 of 2 completed targets were correct on the first attempt.", "Incorrect attempts: 1.", "Average completed-target response: 2.1 seconds."]);
    expect(feedback.unfinished).toBe("18 prescribed units remain unfinished.");
    expect(feedback.sources).toBe("Recorded answer sources: MIDI, on-screen input.");
    expect(feedback.summaryObservation).toBe("1 of 2 completed targets were correct on the first attempt. Incorrect attempts: 1.");
  });
  it("uses sequence completion/retry counters separately from incorrect attempts", () => {
    const seqTarget = { id: "s", clef: "treble" as const, name: { primary: "C" }, steps: [{ expectedMidiNumbers: [60] }] };
    let result = createSequencePracticeResult();
    for (let i = 0; i < 2; i++) result = appendSequenceIncorrectAttempt(result, { target: seqTarget, failedStepIndex: 0, expectedMidiNumbers: [60], submittedMidiNumbers: [61], source: "simulation" });
    result = appendCompletedSequence(result, { target: seqTarget, completionDurationMs: 2400, source: "simulation", repertoireId: null });
    expect(lessonMetricLines(summarizeProgramMetrics(result))).toEqual(["Completed 1 sequence.", "1 of 1 completed sequences required another attempt.", "Incorrect sequence attempts: 2.", "Average completed-sequence duration: 2.4 seconds."]);
  });
  it("uses Ear Training first guesses and response, with unknown input provenance", () => {
    const earTarget = snapshotEarTrainingTarget({ direction: "ascending", exerciseType: "melodic-interval", interval: "major-third", notes: [pitch, { midiNumber: 64, name: "E", octave: 4 }] }, 1);
    const result = appendEarTrainingCompletedTarget(appendEarTrainingIncorrectGuess(createEarTrainingPracticeResult(), { target: earTarget, guessedInterval: "minor-third" }), { target: earTarget, responseDurationMs: 900 });
    const attempt = closed({ metrics: summarizeProgramMetrics(result), exercise: testProgram().nativeExercises.find(entry => entry.engine === "ear-training")! });
    const feedback = lessonExerciseFeedback(attempt);
    expect(feedback.lines).toEqual(["0 of 1 completed interval identifications were correct on the first guess.", "Incorrect guesses: 1.", "Average completed-identification response: 0.9 seconds."]);
    expect(feedback.sources).toContain("unknown");
  });
  it("uses original Melody native diagnostics without accuracy, mastery or invented time", () => {
    const exercise = generateMelodyExercise(DEFAULT_MELODY_SETTINGS, "lesson-feedback");
    const result = evaluateMelodyAttempt(exercise, []);
    const metrics = summarizeProgramMetrics(createMelodyPracticeResult([createMelodyContinuousDiagnosticTrial(1, exercise, result)]));
    expect(lessonMetricLines(metrics)).toEqual(["Completed 1 original reading trial.", "Native original-trial Pitch average: 0%.", "Native original-trial Timing average: 0%.", "Native original-trial Movement average: 0%."]);
    expect(lessonMetricLines({ ...metrics!, movementPercent: null }).join(" ")).not.toMatch(/Movement|accuracy|master|seconds|improv/i);
  });
  it("omits unavailable means and first-try values instead of fabricating zero", () => {
    expect(lessonMetricLines(null)).toEqual(["Native measurements are unavailable."]);
    expect(lessonMetricLines(summarizeProgramMetrics(createFlashcardPracticeResult()))[0]).toBe("No completed targets were recorded.");
    expect(lessonMetricLines(summarizeProgramMetrics(createFlashcardPracticeResult()))).not.toContain("Average completed-target response: 0.0 seconds.");
    expect(lessonMetricLines({ ...summarizeProgramMetrics(first)!, firstTryUnits: null, incorrectResponses: null, averageResponseDurationMs: null })).toEqual(["Completed 1 target."]);
  });
  it("keeps target metrics independent of Bonus and never reconstructs absent boundaries", () => {
    const feedback = lessonExerciseFeedback(closed({ targetMetrics: summarizeProgramMetrics(first), metrics: summarizeProgramMetrics(retried), bonusUnits: 1 }));
    expect(feedback.phase).toBe("Prescribed target evidence"); expect(feedback.lines[0]).toBe("1 of 1 completed targets were correct on the first attempt.");
    expect(feedback.bonus).toContain("separately");
    expect(lessonExerciseFeedback(closed({ metrics: summarizeProgramMetrics(retried) })).phase).toContain("all recorded work");
  });
  it.each([null, []] as const)("keeps unavailable source %s unknown", sources => {
    expect(lessonExerciseFeedback(closed({ metrics: { ...summarizeProgramMetrics(first)!, sources } })).sources).toContain("unknown");
  });
  it("labels simulation explicitly and derives advice from frozen config, never titles", () => {
    const attempt = closed({ exercise: { ...testAttempt().exercise, label: "Master of bass accidentals" }, metrics: { ...summarizeProgramMetrics(first)!, sources: ["simulation"] } });
    const feedback = lessonExerciseFeedback(attempt);
    expect(feedback.sources).toContain("simulation");
    expect(lessonExerciseFeedback({ ...attempt, exercise: { ...attempt.exercise, label: "Other title" } }).observation).toBe(feedback.observation);
    expect(JSON.stringify(feedback)).not.toMatch(/improved|mastery|slower|previous|yesterday|proficiency|accuracy/i);
  });
  it.each([['completed', true, 'Completed'], ['stopped-early', true, 'Stopped early'], ['interrupted', true, 'Interrupted'], ['completed', false, 'Target reached'], ['in-progress', false, 'In progress']] as const)("preserves %s / closed=%s", (outcome, closedFlag, label) => {
    expect(lessonOutcome(closed({ outcome, closed: closedFlag }))).toBe(label);
  });
  it("distinguishes interrupted attempts, explicit skips, pending skips and unperformed selections", () => {
    const attempt = closed({ outcome: "interrupted" }), skip = { ...testSkip(), occurrenceId: "skip-occurrence" };
    const queue = [attempt, skip, { occurrenceId: "unperformed", exerciseId: "exercise-8" }];
    expect(lessonSummaryRows(queue, [attempt, skip], testProgram().nativeExercises).map(row => row.outcome)).toEqual(["Interrupted", "Deliberately skipped", "Unperformed"]);
    expect(lessonSummaryRows([skip], [], testProgram().nativeExercises, null, skip.occurrenceId)[0]?.outcome).toBe("Skip save pending");
  });
  it("excludes manual/older/second same-day lessons and preserves repeated occurrence order", () => {
    const earlier = closed(), current = closed({ ...testAttempt(0, "current") }), repeat = closed({ ...testAttempt(0, "repeat") });
    const rows = lessonSummaryRows([repeat, current], [earlier, current, repeat], testProgram().nativeExercises);
    expect(rows.map(row => row.record?.recordId)).toEqual([repeat.recordId, current.recordId]);
    expect(lessonSummaryRows([], [earlier], testProgram().nativeExercises)).toEqual([]);
  });
  it("keeps unresolved terminal evidence pending until exact acknowledgement", () => {
    const durable = testAttempt(), pending = closed({ writeVersion: 1 });
    expect(lessonSummaryRows([durable], [durable], testProgram().nativeExercises, pending)[0]?.outcome).toBe("Results pending");
    expect(lessonSummaryRows([durable], [pending], testProgram().nativeExercises, pending)[0]?.outcome).toBe("Completed");
  });
});
