import type { RepertoireEvidence } from "../practice-lesson-repertoire";

export function PracticeLessonRepertoireSummary({ evidence }: Readonly<{ evidence: RepertoireEvidence }>) {
  const { entry, id } = evidence.occurrence;
  return <article aria-label="Lesson repertoire evidence" className="practice-session-print-exercise space-y-2">
    <h3 className="font-semibold">Optional Piano repertoire · {entry.nickname || entry.sourceTitle}</h3>
    <p>{entry.sourceTitle} · Measures {entry.start + 1}–{entry.end + 1} · {entry.bpm} quarter BPM · {evidence.occurrence.passage.meter}</p>
    {!evidence.attempts.length && <p>{evidence.pending ? "Repertoire evidence pending — no acknowledged terminal result yet." : evidence.skipped ? "Deliberately skipped — no performance." : "Not performed."}</p>}
    {evidence.attempts.map((attempt, index) => <section className="practice-session-print-block" key={attempt.id}>
      <h4 className="font-semibold">Performance {index + 1} · {attempt.status} · A1 result saved locally</h4>
      {!attempt.performanceStartedAt && <p>Performance did not begin; no played phrase is inferred.</p>}
      {attempt.assessment && <>
        <p>Expected attacks: {attempt.assessment.expected} · Correct pitch: {attempt.assessment.matched} · Missing: {attempt.assessment.missing} · Wrong: {attempt.assessment.wrong} · Extra: {attempt.assessment.extras.length}</p>
        <p>Correct pitches: {attempt.assessment.onTime} on time · {attempt.assessment.early} early · {attempt.assessment.late} late · {attempt.assessment.uncertain} timing uncertain · {attempt.assessment.unobserved} not fully observed.</p>
      </>}
      <p className="break-words text-xs">Physical MIDI · {attempt.input.name ?? attempt.input.id} · Attempt {attempt.id} · {attempt.endedAt}</p>
    </section>)}
    {evidence.pending && evidence.attempts.length > 0 && <p>A further performance remains unresolved; its result is not shown as saved.</p>}
    {evidence.datePending > 0 && <p>Separate Rolodex practice-date update pending.</p>}
    {evidence.dateFailed > 0 && <p>Separate Rolodex practice-date update failed. Acknowledged A1 evidence remains saved; Retry is available in this tab.</p>}
    <p className="break-words text-xs">Occurrence {id} · Passage {entry.id} · Prescription {entry.prescriptionRevision} · Policy {entry.policy.version} · Source instrument: {entry.sourceInstrument} · Selected profile: Piano Continuous Tempo.</p>
    <p className="text-xs">Timing thresholds are provisional. These measurements do not establish fingering, hand coordination or mastery.</p>
  </article>;
}
