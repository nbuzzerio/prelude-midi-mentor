import { useEffect, useMemo, useRef, useState } from "react";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import { StaffBuilderScoreView, type StaffBuilderEventHighlight } from "@/features/staff-builder/components/staff-builder-score-view";
import { useStaffBuilderMobilePresentation } from "@/features/staff-builder/hooks/use-staff-builder-mobile-presentation";
import { playIncorrectFeedback, playSuccessChirp } from "@/lib/audio/feedback";
import { usePiecePracticeInput } from "../hooks/use-piece-practice-input";
import { createPiecePracticeDisplayScore } from "../piece-practice-display-score";
import {
  advancePiecePracticeNoAttackMeasure,
  createPiecePracticeSession,
  getCurrentPiecePracticeTarget,
  getPiecePracticeProgress,
  restartCurrentPiecePracticeMeasure,
  restartPiecePractice,
  type PiecePracticeSessionState,
} from "../piece-practice-session";
import type { PiecePracticeAttackedPitch, PiecePracticePiece } from "../piece-practice-types";

function writtenPitchName(pitch: PiecePracticeAttackedPitch): string {
  const accidental = pitch.accidental === "sharp" ? "♯" : pitch.accidental === "flat" ? "♭" : "";
  return `${pitch.letter}${accidental}${pitch.octave}`;
}

function midiFeedbackName(midiNumber: number, targetPitches: readonly PiecePracticeAttackedPitch[]): string {
  const source = targetPitches.find((pitch) => pitch.midiNumber === midiNumber);
  return source ? writtenPitchName(source) : `MIDI ${midiNumber}`;
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

export function PiecePracticeSession({ piece, onExit, now = Date.now }: Readonly<{
  piece: PiecePracticePiece;
  onExit: () => void;
  now?: () => number;
}>) {
  const [selectedStartMeasure, setSelectedStartMeasure] = useState(0);
  const [sessionState, setSessionState] = useState<PiecePracticeSessionState | null>(null);
  const displayScore = useMemo(() => createPiecePracticeDisplayScore(piece), [piece]);

  if (!sessionState) {
    return <section aria-labelledby="piece-practice-setup-title" className="mx-auto grid w-full max-w-3xl gap-5 rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-zinc-100">
      <header><h1 className="text-2xl font-bold" id="piece-practice-setup-title">Practice {piece.title}</h1><p className="mt-1 text-sm text-zinc-300">Practice one measure at a time. Incorrect notes never move you forward.</p></header>
      <label className="grid max-w-xs gap-2 font-medium" htmlFor="piece-practice-start-measure">Start at Measure
        <select className="rounded-md border border-zinc-600 bg-zinc-950 px-3 py-2" id="piece-practice-start-measure" onChange={(event) => setSelectedStartMeasure(Number(event.target.value))} value={selectedStartMeasure}>
          {piece.measures.map((_measure, index) => <option key={index} value={index}>Measure {index + 1}</option>)}
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <button className="rounded-lg bg-sky-600 px-4 py-2 font-semibold hover:bg-sky-500" onClick={() => {
          const result = createPiecePracticeSession(piece, { startMeasureIndex: selectedStartMeasure, startedAtMs: now() });
          if (result.ok) setSessionState(result.state);
        }} type="button">Start Practice</button>
        <button className="rounded-lg border border-zinc-600 px-4 py-2 font-semibold hover:bg-zinc-800" onClick={onExit} type="button">Exit Piece Practice</button>
      </div>
    </section>;
  }

  return <ActivePiecePracticeSession displayScore={displayScore} now={now} onExit={onExit} onSessionStateChange={setSessionState} piece={piece} sessionState={sessionState} />;
}

function ActivePiecePracticeSession({ displayScore, now, onExit, onSessionStateChange, piece, sessionState }: Readonly<{
  displayScore: ReturnType<typeof createPiecePracticeDisplayScore>;
  now: () => number;
  onExit: () => void;
  onSessionStateChange: (state: PiecePracticeSessionState) => void;
  piece: PiecePracticePiece;
  sessionState: PiecePracticeSessionState;
}>) {
  const input = usePiecePracticeInput({ piece, sessionState, onSessionStateChange });
  const mobilePresentation = useStaffBuilderMobilePresentation();
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  const target = getCurrentPiecePracticeTarget(piece, sessionState);
  const measure = piece.measures[sessionState.currentMeasureIndex];
  const progress = getPiecePracticeProgress(piece, sessionState, now());
  const expectedNames = target?.attackedPitches.map(writtenPitchName) ?? [];
  const feedback = input.feedback;
  const grade = feedback.grade;
  const eventHighlights: readonly StaffBuilderEventHighlight[] = target?.sourceEventIds.map((eventId) => ({
    eventId,
    status: feedback.status === "incorrect" ? "incorrect" : "current",
  })) ?? [];

  useEffect(() => {
    try {
      if (feedback.status === "correct") playSuccessChirp();
      else if (feedback.status === "incorrect") playIncorrectFeedback();
    } catch {
      // Feedback audio is optional and must never interrupt practice progression.
    }
  }, [feedback]);

  useEffect(() => {
    if (sessionState.status === "piece-complete") completionHeadingRef.current?.focus();
  }, [sessionState.status]);

  const restartMeasure = () => {
    const restarted = restartCurrentPiecePracticeMeasure(piece, sessionState);
    input.resetInput();
    onSessionStateChange(restarted);
  };
  const restartWholePiece = () => {
    const restarted = restartPiecePractice(piece, sessionState, now());
    input.resetInput();
    onSessionStateChange(restarted);
  };

  const statusText = sessionState.status === "piece-complete" ? "Piece complete."
    : sessionState.status === "awaiting-explicit-measure-advance" ? `Measure ${sessionState.currentMeasureIndex + 1}. No notes to play in this measure.`
      : feedback.status === "incorrect" ? `Incorrect. Try target ${(sessionState.currentTargetIndex ?? 0) + 1} again.`
        : feedback.status === "correct" ? `Correct. Measure ${sessionState.currentMeasureIndex + 1}, target ${(sessionState.currentTargetIndex ?? 0) + 1}.`
          : `Measure ${sessionState.currentMeasureIndex + 1}, target ${(sessionState.currentTargetIndex ?? 0) + 1}.`;

  if (sessionState.status === "piece-complete") {
    return <section className="mx-auto grid w-full max-w-3xl gap-5 rounded-xl border border-green-700 bg-zinc-900 p-6 text-zinc-100">
      <div aria-live="polite" className="sr-only" role="status">Piece complete.</div>
      <h1 className="text-3xl font-bold text-green-300" ref={completionHeadingRef} tabIndex={-1}>Piece complete</h1>
      <p>You completed the selected practice range for <strong>{piece.title}</strong>.</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><dt className="text-sm text-zinc-400">Measures practiced</dt><dd className="text-xl font-bold">{progress.practicedMeasureCount}</dd></div>
        <div><dt className="text-sm text-zinc-400">Completed targets</dt><dd className="text-xl font-bold">{progress.completedTargetCount}</dd></div>
        <div><dt className="text-sm text-zinc-400">Mistakes</dt><dd className="text-xl font-bold">{progress.incorrectAttemptCount}</dd></div>
        <div><dt className="text-sm text-zinc-400">Elapsed</dt><dd className="text-xl font-bold">{formatElapsed(progress.elapsedMs)}</dd></div>
      </dl>
      <div className="flex flex-wrap gap-3"><button className="rounded-lg bg-sky-600 px-4 py-2 font-semibold" onClick={restartWholePiece} type="button">Practice Again</button><button className="rounded-lg border border-zinc-600 px-4 py-2 font-semibold" onClick={onExit} type="button">Exit Piece Practice</button></div>
    </section>;
  }

  const received = grade?.receivedMidiNumbers.map((midi) => midiFeedbackName(midi, target?.attackedPitches ?? [])) ?? [];
  const missing = grade?.missingMidiNumbers.map((midi) => midiFeedbackName(midi, target?.attackedPitches ?? [])) ?? [];
  const extra = grade?.extraMidiNumbers.map((midi) => midiFeedbackName(midi, target?.attackedPitches ?? [])) ?? [];
  const failedNotes = feedback.status === "incorrect" ? new Set(grade?.receivedMidiNumbers ?? []) : new Set<number>();
  const lastAnswer = feedback.status === "idle" || !grade ? null : { midiNumbers: new Set(grade.receivedMidiNumbers), result: feedback.status };
  const activeNotes = new Set([...input.virtualSelectedMidiNumbers, ...input.midiChordAttemptMidiNumbers]);

  return <section className={mobilePresentation ? "piece-practice-session mobile-play-mode fixed inset-0 z-50 grid overflow-auto bg-zinc-950 text-zinc-100" : "piece-practice-session mx-auto grid w-full max-w-6xl gap-4 text-zinc-100"}>
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-zinc-900 p-4">
      <div><h1 className="text-2xl font-bold">{piece.title}</h1><p>Measure {sessionState.currentMeasureIndex + 1} of {piece.measures.length}{sessionState.startMeasureIndex > 0 ? ` · Practicing from Measure ${sessionState.startMeasureIndex + 1}` : ""}</p>{target ? <p>Target {(sessionState.currentTargetIndex ?? 0) + 1} of {measure?.targets.length ?? 0}</p> : null}</div>
      <div className="flex flex-wrap items-center gap-2"><MidiStatus deviceName={input.deviceName} error={input.error} onConnect={input.connectMidi} status={input.status} /><button className="rounded-lg border border-zinc-600 px-3 py-2" onClick={restartMeasure} type="button">Restart Measure</button><button className="rounded-lg border border-zinc-600 px-3 py-2" onClick={restartWholePiece} type="button">Restart Piece</button><button className="rounded-lg border border-zinc-600 px-3 py-2" onClick={onExit} type="button">Exit Piece Practice</button></div>
    </header>
    <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">{statusText}</div>
    <div className={mobilePresentation ? "practice-stage grid min-h-0 gap-2" : "grid gap-4"}>
      <section aria-labelledby="piece-practice-current-target" className="grid min-h-0 gap-3 rounded-lg bg-zinc-900 p-3">
        <div><h2 className="font-bold" id="piece-practice-current-target">{target ? "Current target" : "Current measure"}</h2>{target ? <p>Expected: {expectedNames.join(", ")}</p> : <p>No notes to play in this measure.</p>}</div>
        <StaffBuilderScoreView eventHighlights={eventHighlights} measureIndex={sessionState.currentMeasureIndex} score={displayScore} />
        {feedback.status === "correct" ? <p className="rounded-md border border-green-600 bg-green-950 p-3 font-semibold text-green-200">✓ Correct</p> : null}
        {feedback.status === "incorrect" ? <div className="grid gap-1 rounded-md border border-red-600 bg-red-950 p-3 text-red-100"><p className="font-semibold">Incorrect — try the same target again.</p><p>Expected: {expectedNames.join(", ")}</p><p>Played: {received.join(", ") || "No new notes"}</p>{missing.length ? <p>Missing: {missing.join(", ")}</p> : null}{extra.length ? <p>Extra: {extra.join(", ")}</p> : null}{grade?.unexpectedHeldMidiNumbers.length ? <p>Other notes still held: {grade.unexpectedHeldMidiNumbers.map((midi) => `MIDI ${midi}`).join(", ")}</p> : null}</div> : null}
        {sessionState.status === "awaiting-explicit-measure-advance" ? <button className="justify-self-start rounded-lg bg-sky-600 px-4 py-2 font-semibold" onClick={() => {
          const result = advancePiecePracticeNoAttackMeasure(piece, sessionState);
          if (result.advanced) { input.resetInput(); onSessionStateChange(result.state); }
        }} type="button">Next Measure</button> : null}
      </section>
      <div aria-label="Practice keyboard" className={mobilePresentation ? "mobile-play-keyboard-region min-h-0" : "min-h-52"} data-presentation={mobilePresentation ? "mobile" : "desktop"}>
        <PianoKeyboard activeMidiNumbers={activeNotes} failedMidiNumbers={failedNotes} lastAnswer={lastAnswer} onNoteToggle={input.onVirtualNoteToggle} targetMidiNumbers={new Set(target?.expectedMidiNumbers ?? [])} />
      </div>
    </div>
  </section>;
}
