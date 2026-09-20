import { selectEarTrainingPracticeReportPhases, type EarTrainingPracticeReport } from "@/features/ear-training/ear-training-practice-result";
import { selectFlashcardPracticeReportPhases, type FlashcardPracticeReport } from "@/features/flashcards/flashcard-practice-result";
import { MelodyResultDetail, MelodyResultMetrics } from "@/features/melody/components/melody-result-detail";
import { getMelodyContinuousTrialLatestResult, getMelodyContinuousTrialRetryCount, isMelodyContinuousTrialMastered } from "@/features/melody/melody-continuous-practice";
import { selectMelodyPracticeReportPhases, type MelodyPracticeReport } from "@/features/melody/melody-practice-result";
import { selectSequencePracticeReportPhases, type SequencePracticeReport } from "@/features/sequences/sequence-practice-result";
import { derivePracticeSessionReport, type PracticeSessionExerciseReport, type PracticeSessionReportExerciseOutcome } from "../practice-session-report";
import type { CompletedPracticeSessionRun } from "../practice-session-runtime";

function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds.toString().padStart(2, "0")}s`;
}

function outcomeText(outcome: PracticeSessionReportExerciseOutcome): string {
  if (outcome === "completed") return "Target reached";
  if (outcome === "skipped") return "Skipped for today";
  if (outcome === "ended-before-target") return "Session ended before target";
  if (outcome === "never-entered") return "Not reached in this session";
  return "In progress";
}

function Metric({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return <div className="rounded-lg bg-black/20 p-3"><dt className="text-xs text-zinc-400">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>;
}

function DiagnosticPhase({ title, children }: Readonly<{ title: string; children: ReactNode }>) {
  return <section className="space-y-3"><h4 className="font-semibold text-sky-200">{title}</h4>{children}</section>;
}

function FlashcardReportView({ report }: Readonly<{ report: FlashcardPracticeReport }>) {
  return <div className="space-y-3">
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label="Targets answered" value={report.completedTargetCount} /><Metric label="First try" value={report.firstTryTargetCount} />
      <Metric label="Answered after retry" value={report.retriedTargetCount} /><Metric label="Incorrect attempts" value={report.incorrectAttemptCount} />
      <Metric label="Average response" value={report.averageResponseDurationMs === null ? "No completed targets" : formatDuration(report.averageResponseDurationMs)} />
    </dl>
    {report.completedTargets.length > 0 && <ol className="space-y-2">{report.completedTargets.map((item) => <li className="rounded bg-black/20 p-2" key={item.target.id}><strong>{item.target.name.primary}</strong><span className="block text-sm text-zinc-300">{item.priorIncorrectAttemptCount === 0 ? "Answered on the first try" : `Answered after ${item.priorIncorrectAttemptCount} incorrect ${item.priorIncorrectAttemptCount === 1 ? "attempt" : "attempts"}`} · {formatDuration(item.responseDurationMs)}</span></li>)}</ol>}
    {report.unresolvedIncorrectAttempts.length > 0 && <p>{report.unresolvedIncorrectAttempts.length} incorrect {report.unresolvedIncorrectAttempts.length === 1 ? "attempt was" : "attempts were"} recorded on a target not completed before the exercise ended.</p>}
  </div>;
}

function FlashcardDiagnostics({ exercise }: Readonly<{ exercise: PracticeSessionExerciseReport }>) {
  const boundary = exercise.targetBoundaryEngineResult?.engine === "flashcards" ? exercise.targetBoundaryEngineResult : null;
  const final = exercise.finalEngineResult?.engine === "flashcards" ? exercise.finalEngineResult : null;
  const phases = selectFlashcardPracticeReportPhases(boundary, final);
  if (phases.recorded) return <DiagnosticPhase title="Recorded evidence"><FlashcardReportView report={phases.recorded} /></DiagnosticPhase>;
  if (!phases.prescribed) return <p>No Flashcard answer evidence was recorded.</p>;
  return <div className="space-y-5"><DiagnosticPhase title="Prescribed"><FlashcardReportView report={phases.prescribed} /></DiagnosticPhase>{phases.bonus && <DiagnosticPhase title="Bonus"><FlashcardReportView report={phases.bonus} /></DiagnosticPhase>}</div>;
}

function SequenceReportView({ report }: Readonly<{ report: SequencePracticeReport }>) {
  return <div className="space-y-3">
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label="Sequences completed" value={report.completedSequenceCount} /><Metric label="First try" value={report.firstTrySequenceCount} />
      <Metric label="Completed after retry" value={report.retriedSequenceCount} /><Metric label="Incorrect sequence attempts" value={report.incorrectSequenceAttemptCount} />
      <Metric label="Average completion" value={report.averageCompletionDurationMs === null ? "No completed sequences" : formatDuration(report.averageCompletionDurationMs)} />
      {report.configuredRepertoireCount > 0 && <Metric label="Repertoire scales completed" value={`${report.completedRepertoireCount} of ${report.configuredRepertoireCount}`} />}
    </dl>
    {report.completedSequences.length > 0 && <ol className="space-y-2">{report.completedSequences.map((item) => <li className="rounded bg-black/20 p-2" key={`${item.sequence}:${item.target.id}`}><strong>{item.target.name.primary}</strong><span className="block text-sm text-zinc-300">{item.priorIncorrectAttemptCount === 0 ? "Completed on the first try" : `Completed after ${item.priorIncorrectAttemptCount} incorrect sequence ${item.priorIncorrectAttemptCount === 1 ? "attempt" : "attempts"}`} · {formatDuration(item.completionDurationMs)}</span></li>)}</ol>}
    {report.unresolvedIncorrectAttempts.length > 0 && <p>{report.unresolvedIncorrectAttempts.length} incorrect sequence {report.unresolvedIncorrectAttempts.length === 1 ? "attempt was" : "attempts were"} recorded on a sequence not completed before the exercise ended.</p>}
  </div>;
}

function SequenceDiagnostics({ exercise }: Readonly<{ exercise: PracticeSessionExerciseReport }>) {
  const boundary = exercise.targetBoundaryEngineResult?.engine === "sequences" ? exercise.targetBoundaryEngineResult : null;
  const final = exercise.finalEngineResult?.engine === "sequences" ? exercise.finalEngineResult : null;
  const phases = selectSequencePracticeReportPhases(boundary, final);
  if (phases.recorded) return <DiagnosticPhase title="Recorded evidence"><SequenceReportView report={phases.recorded} /></DiagnosticPhase>;
  if (!phases.prescribed) return <p>No Sequence attempt evidence was recorded.</p>;
  return <div className="space-y-5"><DiagnosticPhase title="Prescribed"><SequenceReportView report={phases.prescribed} /></DiagnosticPhase>{phases.bonus && <DiagnosticPhase title="Bonus"><SequenceReportView report={phases.bonus} /></DiagnosticPhase>}</div>;
}

function EarTrainingReportView({ report }: Readonly<{ report: EarTrainingPracticeReport }>) {
  return <div className="space-y-3">
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label="Intervals identified" value={report.completedIdentificationCount} /><Metric label="First guess" value={report.firstGuessIdentificationCount} />
      <Metric label="Identified after another guess" value={report.retriedIdentificationCount} /><Metric label="Incorrect guesses" value={report.incorrectGuessCount} />
      <Metric label="Average response" value={report.averageResponseDurationMs === null ? "No completed identifications" : formatDuration(report.averageResponseDurationMs)} />
    </dl>
    {report.completedTargets.length > 0 && <ol className="space-y-2">{report.completedTargets.map((item) => <li className="rounded bg-black/20 p-2" key={item.target.id}><strong>{item.target.interval.replaceAll("-", " ")} · {item.target.direction}</strong><span className="block text-sm text-zinc-300">{item.priorIncorrectGuesses.length === 0 ? "Identified on the first guess" : `Identified after ${item.priorIncorrectGuesses.length} earlier ${item.priorIncorrectGuesses.length === 1 ? "guess" : "guesses"}`} · {formatDuration(item.responseDurationMs)}</span></li>)}</ol>}
    {report.unresolvedIncorrectGuesses.length > 0 && <p>{report.unresolvedIncorrectGuesses.length} incorrect {report.unresolvedIncorrectGuesses.length === 1 ? "guess was" : "guesses were"} recorded for an interval not identified before the exercise ended.</p>}
  </div>;
}

function EarTrainingDiagnostics({ exercise }: Readonly<{ exercise: PracticeSessionExerciseReport }>) {
  const boundary = exercise.targetBoundaryEngineResult?.engine === "ear-training" ? exercise.targetBoundaryEngineResult : null;
  const final = exercise.finalEngineResult?.engine === "ear-training" ? exercise.finalEngineResult : null;
  const phases = selectEarTrainingPracticeReportPhases(boundary, final);
  if (phases.recorded) return <DiagnosticPhase title="Recorded evidence"><EarTrainingReportView report={phases.recorded} /></DiagnosticPhase>;
  if (!phases.prescribed) return <p>No Ear Training guess evidence was recorded.</p>;
  return <div className="space-y-5"><DiagnosticPhase title="Prescribed"><EarTrainingReportView report={phases.prescribed} /></DiagnosticPhase>{phases.bonus && <DiagnosticPhase title="Bonus"><EarTrainingReportView report={phases.bonus} /></DiagnosticPhase>}</div>;
}

function MelodyReportView({ report }: Readonly<{ report: MelodyPracticeReport }>) {
  if (report.orderedTrials.length === 0) return <p>No completed Melody diagnostic trials were recorded.</p>;
  return <div className="space-y-4">
    {report.interrupted && <p>The timed Melody exercise was interrupted; completed trials were preserved.</p>}
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Metric label="Diagnostic trials" value={report.summary.trialsCompleted} /><Metric label="Initially pitch-perfect" value={report.summary.initiallyPitchPerfectTrials} />
      <Metric label="Currently mastered" value={report.summary.currentlyMasteredTrials} /><Metric label="Review retries" value={report.summary.totalReviewRetries} />
      <Metric label="Original Pitch average" value={report.summary.averagePitch === null ? "No completed trials" : `${report.summary.averagePitch}%`} />
      <Metric label="Original Movement average" value={report.summary.averageMovement === null ? "Not enough notes" : `${report.summary.averageMovement}%`} />
      <Metric label="Original Timing average" value={report.summary.averageTiming === null ? "No completed trials" : `${report.summary.averageTiming}%`} />
    </dl>
    <p className="text-sm text-zinc-300">Interval Trouble uses the same Sight Read and Repair evidence as Melody Review: {report.sightReadIntervals.needsAttention.length} Sight Read and {report.hasRepairEvidence ? report.repairIntervals.needsAttention.length : 0} Repair intervals need attention.</p>
    <div className="space-y-2">{report.orderedTrials.map((trial) => {
      const latest = getMelodyContinuousTrialLatestResult(trial);
      const retries = getMelodyContinuousTrialRetryCount(trial);
      return <details className="rounded-lg border border-white/10 bg-black/20 p-3" key={trial.id}>
        <summary className="cursor-pointer font-semibold">Trial {trial.originalOrder} · {isMelodyContinuousTrialMastered(trial) ? "Mastered" : "Needs review"} · {retries} {retries === 1 ? "retry" : "retries"}</summary>
        <div className="mt-4 space-y-4"><MelodyResultMetrics result={latest} /><MelodyResultDetail exercise={trial.exercise} result={latest} /></div>
      </details>;
    })}</div>
  </div>;
}

function MelodyDiagnostics({ exercise }: Readonly<{ exercise: PracticeSessionExerciseReport }>) {
  const boundary = exercise.targetBoundaryEngineResult?.engine === "melody" ? exercise.targetBoundaryEngineResult : null;
  const final = exercise.finalEngineResult?.engine === "melody" ? exercise.finalEngineResult : null;
  const phases = selectMelodyPracticeReportPhases(boundary, final);
  if (phases.recorded) return <DiagnosticPhase title="Recorded evidence"><MelodyReportView report={phases.recorded} /></DiagnosticPhase>;
  if (!phases.prescribed) return <p>No completed Melody diagnostic trials were recorded.</p>;
  return <div className="space-y-5">
    <DiagnosticPhase title="Prescribed"><MelodyReportView report={phases.prescribed} /></DiagnosticPhase>
    {phases.bonus && <DiagnosticPhase title="Bonus">
      {phases.bonus.newDiagnosticEvidence && <MelodyReportView report={phases.bonus.newDiagnosticEvidence} />}
      {phases.bonus.additionalRepairRetries > 0 && <p>{phases.bonus.additionalRepairRetries} additional Repair {phases.bonus.additionalRepairRetries === 1 ? "retry was" : "retries were"} recorded during Bonus practice.</p>}
    </DiagnosticPhase>}
  </div>;
}

function ExerciseDiagnostics({ exercise }: Readonly<{ exercise: PracticeSessionExerciseReport }>) {
  if (exercise.engine === "flashcards") return <FlashcardDiagnostics exercise={exercise} />;
  if (exercise.engine === "sequences") return <SequenceDiagnostics exercise={exercise} />;
  if (exercise.engine === "ear-training") return <EarTrainingDiagnostics exercise={exercise} />;
  return <MelodyDiagnostics exercise={exercise} />;
}

export function PracticeSessionCompletedReport({ run, onBack }: Readonly<{ run: CompletedPracticeSessionRun; onBack: () => void }>) {
  const report = derivePracticeSessionReport(run);
  return <main aria-labelledby="practice-session-summary-title" className="mx-auto w-full max-w-5xl space-y-5 px-3 py-4 text-white sm:px-5">
    <header className="space-y-2">
      <p className="text-sm text-zinc-400">{report.presetName}</p>
      <h1 className="text-2xl font-bold focus:outline-none" id="practice-session-summary-title" tabIndex={-1}>Practice session complete</h1>
      <p>Review what happened in this session. This report is temporary and is not saved.</p>
    </header>
    <section aria-labelledby="session-overview-title" className="rounded-xl border border-white/10 bg-white/5 p-4">
      <h2 className="text-lg font-semibold" id="session-overview-title">Session overview</h2>
      <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric label="Active practice" value={formatDuration(report.totalActiveDurationMs)} /><Metric label="Exercises entered" value={`${report.enteredExerciseCount} of ${report.exercises.length}`} />
        <Metric label="Targets reached" value={report.targetReachedCount} /><Metric label="Skipped for today" value={report.skippedCount} />
        <Metric label="Ended before target" value={report.endedBeforeTargetCount} /><Metric label="Bonus used" value={report.bonusExerciseCount} />
      </dl>
    </section>
    <section aria-labelledby="exercise-report-title" className="space-y-3">
      <h2 className="text-lg font-semibold" id="exercise-report-title">Exercises in prescribed order</h2>
      <ol className="space-y-3">{report.exercises.map((exercise) => <li className="rounded-xl border border-white/10 bg-white/5 p-4" key={exercise.exerciseId}>
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs text-zinc-400">Exercise {exercise.exerciseIndex + 1} of {report.exercises.length} · {exercise.engine}</p><h3 className="font-semibold">{exercise.label}</h3></div><p className="rounded-full bg-zinc-800 px-3 py-1 text-sm">{outcomeText(exercise.outcome)}</p></div>
        <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Prescribed work" value={`${exercise.prescribedUnitsCompleted} ${exercise.prescribedUnitsCompleted === 1 ? "unit" : "units"}`} />
          <Metric label="Prescribed active time" value={formatDuration(exercise.prescribedActiveDurationMs)} />
          <Metric label="Bonus work" value={`${exercise.bonusUnitsCompleted} ${exercise.bonusUnitsCompleted === 1 ? "unit" : "units"}`} />
          <Metric label="Bonus active time" value={formatDuration(exercise.bonusActiveDurationMs)} />
        </dl>
        {exercise.entered && <details className="mt-3 rounded-lg border border-white/10 p-3"><summary className="cursor-pointer font-semibold">Detailed diagnostics</summary><div className="mt-4"><ExerciseDiagnostics exercise={exercise} /></div></details>}
      </li>)}</ol>
    </section>
    <button className="min-h-11 rounded bg-sky-500 px-4 font-semibold" onClick={onBack} type="button">Back to Practice Sessions</button>
  </main>;
}
import type { ReactNode } from "react";
