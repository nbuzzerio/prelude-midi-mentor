import type { PracticeProgramRevision } from "../practice-program-types";
import { getPracticeExerciseConfigurationSummary, getPracticeExerciseConceptName, getPracticeExerciseTargetSummary } from "../practice-session-presenters";

export default function PracticeProgramPreview({ value }: Readonly<{ value: PracticeProgramRevision }>) {
  const program = value.program;
  return <section aria-label="Weekly program definition" className="space-y-3 break-words">
    <h3 className="text-lg font-semibold">{program.title}</h3>
    <p className="text-sm text-zinc-400">{program.programId} · Revision {program.revision} · Sunday–Saturday · Local dates</p>
    {program.instructions && <p className="whitespace-pre-wrap text-zinc-300">{program.instructions}</p>}
    <p className="text-sm text-zinc-400">Reusable exercise pool. Suggestions and weekly goals are optional; they do not require practice every day.</p>
    <ul className="space-y-2">{value.nativeExercises.map((exercise, index) => <li className="rounded border border-white/10 p-3" key={exercise.id}>
      <p className="font-semibold">{exercise.label}</p>
      <p className="text-sm text-zinc-300">{getPracticeExerciseConceptName(exercise)} · {getPracticeExerciseConfigurationSummary(exercise)} · {getPracticeExerciseTargetSummary(exercise)}</p>
      {program.exercises[index]!.weeklyTarget && <p className="text-sm text-zinc-400">Weekly goal: {program.exercises[index]!.weeklyTarget!.completedAttempts} completed attempts</p>}
      <details className="mt-1 text-sm"><summary className="cursor-pointer py-2">Exercise settings · {exercise.id}</summary><pre className="max-w-full overflow-x-auto rounded bg-zinc-900 p-2">{JSON.stringify(program.exercises[index], null, 2)}</pre></details>
    </li>)}</ul>
    {program.weeklyGoal && <p>Weekly coverage goal: {program.weeklyGoal.distinctExercisesPracticed} distinct exercises</p>}
    {!!program.suggestedRotation?.length && <div><h4 className="font-semibold">Suggested rotations</h4><ul className="mt-2 space-y-1">{program.suggestedRotation.map(rotation => <li key={rotation.day}><span className="capitalize">{rotation.day}</span>: {rotation.exerciseIds.map(id => program.exercises.find(exercise => exercise.id === id)!.label).join(", ")}</li>)}</ul></div>}
  </section>;
}
