import { useEffect, useMemo, useRef, useState } from "react";
import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import { StaffBuilderScoreView, type StaffBuilderEventHighlight } from "@/features/staff-builder/components/staff-builder-score-view";
import { useMobilePlay } from "@/hooks/use-mobile-play";
import { playIncorrectFeedback, playSuccessChirp } from "@/lib/audio/feedback";
import { usePiecePracticeInput } from "../hooks/use-piece-practice-input";
import { createPiecePracticeDisplayScore } from "../piece-practice-display-score";
import {
  advancePiecePracticeNoAttackMeasure,
  createPiecePracticeSession,
  getCurrentPiecePracticeTarget,
  getPiecePracticeProgress,
  pausePiecePracticeClock,
  restartCurrentPiecePracticeMeasure,
  restartPiecePractice,
  resumePiecePracticeClock,
  type PiecePracticeSessionState,
} from "../piece-practice-session";
import type { PiecePracticeAttackedPitch, PiecePracticePiece } from "../piece-practice-types";
import { PiecePracticeResults } from "./piece-practice-results";
import { PiecePracticeTargetedPractice, PiecePracticeTargetedPracticeComparisonView } from "./piece-practice-targeted-practice";
import { comparePiecePracticeTargetedPractice, selectPiecePracticeTargetedPractice } from "../piece-practice-targeted-practice";
import { formatPiecePracticeMidiPitch } from "../piece-practice-evidence";
import { piecePracticeAssessmentLabel, type PiecePracticeAssessmentFocus } from "../piece-practice-assessment";
import { focusPiecePracticeProjection } from "../piece-practice-projection";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { createPiecePracticeRun, hydratePiecePracticeRun, parsePiecePracticeRun, piecePracticeRunStore, revisePiecePracticeRun, type PiecePracticeRunRecordV1, type PiecePracticeRunStore } from "../persistence/piece-practice-runs";

function writtenPitchName(pitch: PiecePracticeAttackedPitch): string {
  return formatPiecePracticeMidiPitch(pitch.midiNumber, { expectedPitches: [pitch] });
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.floor(elapsedMs / 1000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

const monotonicNow = () => performance.now();

type RunSaveProgress = Readonly<{ runId: string | null; requestedRevision: number; persistedRevision: number; failedRevision: number | null }>;
type LatestRunSave = Readonly<{ runId: string; revision: number; promise: Promise<void> }>;
type TargetedPracticeResult = Readonly<{ state: PiecePracticeSessionState; runId: string; revision: number; saved: boolean }>;
/** PROVISIONAL in-tab navigation only; persisted attempts keep the existing V1 contract. */
type TargetedPracticeReview = Readonly<{
  originalState: PiecePracticeSessionState;
  originalRun: PiecePracticeRunRecordV1;
  originalSaveProgress: RunSaveProgress;
  originalLatestSave: LatestRunSave | null;
  activeMeasureIndex: number | null;
  returnMeasureIndex: number | null;
}>;
function isRunDurable(record: PiecePracticeRunRecordV1 | null, progress: RunSaveProgress): boolean {
  return Boolean(record && progress.runId === record.runId && progress.persistedRevision >= record.revision);
}

export function PiecePracticeSession({ piece, sourceScore, recoveredRun, runStore = piecePracticeRunStore, onExit, now = monotonicNow }: Readonly<{
  piece: PiecePracticePiece;
  sourceScore?: StaffBuilderScore;
  recoveredRun?: PiecePracticeRunRecordV1;
  runStore?: PiecePracticeRunStore;
  onExit: () => void;
  now?: () => number;
}>) {
  const [selectedStartMeasure, setSelectedStartMeasure] = useState(0);
  const [selectedEndMeasure, setSelectedEndMeasure] = useState<number | null>(null);
  const [selectedAssessmentFocus, setSelectedAssessmentFocus] = useState<PiecePracticeAssessmentFocus>("both");
  const [sessionState, setSessionState] = useState<PiecePracticeSessionState | null>(() => recoveredRun ? hydratePiecePracticeRun(recoveredRun, now()) : null);
  const sessionRef = useRef(sessionState);
  const runRef = useRef<PiecePracticeRunRecordV1 | null>(recoveredRun ?? null);
  const [saveProgress, setSaveProgress] = useState<RunSaveProgress>(() => ({
    runId: recoveredRun?.runId ?? null,
    requestedRevision: (recoveredRun?.revision ?? 0) + (recoveredRun?.status === "active" && sessionState?.status === "piece-complete" ? 1 : 0),
    persistedRevision: recoveredRun?.revision ?? 0, failedRevision: null,
  }));
  const progressRef = useRef(saveProgress);
  const latestSaveRef = useRef<LatestRunSave | null>(null);
  const exitAwaitingRef = useRef(false);
  const [exitAwaitingSave, setExitAwaitingSave] = useState(false);
  const [secondaryStorageWarning, setSecondaryStorageWarning] = useState(false);
  const [recoveredNotice, setRecoveredNotice] = useState(Boolean(recoveredRun && recoveredRun.status === "active"));
  const [targetedPracticeReview, setTargetedPracticeReview] = useState<TargetedPracticeReview | null>(null);
  const [targetedPracticeError, setTargetedPracticeError] = useState<string | null>(null);
  const [targetedPracticeResults, setTargetedPracticeResults] = useState<readonly TargetedPracticeResult[]>([]);
  const [targetedPracticeNotice, setTargetedPracticeNotice] = useState<string | null>(null);
  const displayScore = useMemo(() => createPiecePracticeDisplayScore(piece), [piece]);
  const assessedPiece = useMemo(() => focusPiecePracticeProjection(piece, sessionState?.assessmentFocus ?? selectedAssessmentFocus), [piece, selectedAssessmentFocus, sessionState?.assessmentFocus]);

  const updateProgress = (next: RunSaveProgress) => { progressRef.current = next; setSaveProgress(next); };
  const persist = (record: PiecePracticeRunRecordV1) => {
    const previous = progressRef.current;
    updateProgress({ runId: record.runId, requestedRevision: record.revision,
      persistedRevision: previous.runId === record.runId ? previous.persistedRevision : 0, failedRevision: null });
    const saved = runStore.save(record);
    latestSaveRef.current = { runId: record.runId, revision: record.revision, promise: saved };
    void saved.then(() => {
      setTargetedPracticeResults((results) => results.map((result) => result.runId === record.runId && result.revision <= record.revision
        ? { ...result, saved: true } : result));
      const current = progressRef.current;
      if (current.runId !== record.runId) return;
      const persistedRevision = Math.max(current.persistedRevision, record.revision);
      updateProgress({ ...current, persistedRevision,
        failedRevision: current.requestedRevision <= persistedRevision ? null : current.failedRevision });
    }).catch(() => {
      const current = progressRef.current;
      if (current.runId === record.runId && current.requestedRevision === record.revision) {
        updateProgress({ ...current, failedRevision: record.revision });
      }
    });
    return saved;
  };
  const commitState = (next: PiecePracticeSessionState) => {
    if (sessionRef.current === next) return;
    sessionRef.current = next;
    setSessionState(next);
    if (runRef.current?.status === "active" || runRef.current?.status === "completed") {
      runRef.current = revisePiecePracticeRun(runRef.current, next, now(), runRef.current.status === "completed" ? "completed" : undefined);
      if (next.status === "piece-complete" && targetedPracticeReview && targetedPracticeReview.activeMeasureIndex !== null) {
        const record = runRef.current;
        setTargetedPracticeResults((results) => [...results.filter((result) => result.state.startMeasureIndex !== next.startMeasureIndex),
          { state: next, runId: record.runId, revision: record.revision, saved: false }]);
      }
      persist(runRef.current);
    }
  };
  useEffect(() => {
    const record = runRef.current;
    const state = sessionRef.current;
    // Hydration can finish a legacy run blocked solely by an empty tied roll.
    if (recoveredRun?.status === "active" && record?.status === "active" && state?.status === "piece-complete") {
      runRef.current = revisePiecePracticeRun(record, state, now());
      persist(runRef.current);
    }
  });
  const startRun = (state: PiecePracticeSessionState, score = sourceScore ?? displayScore) => {
    const record = createPiecePracticeRun(score, state, now());
    runRef.current = record;
    sessionRef.current = state;
    setSessionState(state);
    setRecoveredNotice(false);
    void persist(record).then(async () => {
      if (runRef.current?.runId !== record.runId) return;
      const records = await runStore.list();
      if (runRef.current?.runId !== record.runId) return;
      for (const value of records) {
        const parsed = parsePiecePracticeRun(value);
        if (!parsed.ok || parsed.record.status !== "active" || parsed.record.runId === record.runId) continue;
        const paused = hydratePiecePracticeRun(parsed.record, now());
        await runStore.save(revisePiecePracticeRun(parsed.record, paused, now(), "ended-incomplete"));
      }
    }, () => undefined).catch(() => setSecondaryStorageWarning(true));
  };
  const restartNow = () => {
    const current = sessionRef.current;
    if (!current) return;
    if (runRef.current?.status === "active") {
      runRef.current = revisePiecePracticeRun(runRef.current, current, now(), "ended-incomplete");
      void persist(runRef.current).catch(() => setSecondaryStorageWarning(true));
    }
    if (targetedPracticeReview?.activeMeasureIndex === null) { setTargetedPracticeReview(null); setTargetedPracticeResults([]); }
    setTargetedPracticeError(null);
    setTargetedPracticeNotice(null);
    startRun(restartPiecePractice(assessedPiece, current, now()), targetedPracticeReview && targetedPracticeReview.activeMeasureIndex !== null ? targetedPracticeReview.originalRun.sourceScore : undefined);
  };
  const afterCompletedSave = async (action: () => void, actionLabel: string) => {
    if (exitAwaitingRef.current) return;
    exitAwaitingRef.current = true;
    setExitAwaitingSave(true);
    try {
      while (!isRunDurable(runRef.current, progressRef.current)) {
        const current = runRef.current;
        const latest = latestSaveRef.current;
        if (!current || current.status !== "completed" || !latest || latest.runId !== current.runId || latest.revision < current.revision) break;
        await latest.promise.catch(() => undefined);
        if (latestSaveRef.current === latest) break;
      }
      if (!isRunDurable(runRef.current, progressRef.current)
        && !window.confirm(`The completed practice result is not safely stored. ${actionLabel} anyway?`)) return;
      action();
    } finally {
      exitAwaitingRef.current = false;
      setExitAwaitingSave(false);
    }
  };
  const restartWholePiece = () => {
    if (runRef.current?.status === "completed" && !isRunDurable(runRef.current, progressRef.current)) {
      void afterCompletedSave(restartNow, "Start a new run");
      return;
    }
    restartNow();
  };
  const leavePractice = (action: () => void, actionLabel: string) => {
    if (exitAwaitingRef.current) return;
    const current = sessionRef.current;
    if (runRef.current?.status === "completed" && !isRunDurable(runRef.current, progressRef.current)) {
      void afterCompletedSave(action, actionLabel);
      return;
    }
    if (current && runRef.current?.status === "active") {
      if (!window.confirm("End this Piece Practice run? Saved evidence will remain available, but this run will no longer be resumable.")) return;
      runRef.current = revisePiecePracticeRun(runRef.current, current, now(), "ended-incomplete");
      void persist(runRef.current).catch(() => setSecondaryStorageWarning(true));
    }
    action();
  };
  const exitPractice = () => leavePractice(onExit, "Leave Piece Practice");
  const startTargetedPractice = (measureIndex: number) => {
    if (exitAwaitingRef.current || (targetedPracticeReview && targetedPracticeReview.activeMeasureIndex !== null)) return;
    const current = sessionRef.current;
    const recommendation = current && selectPiecePracticeTargetedPractice(current).find((item) => item.measureIndex === measureIndex);
    if (!current || !recommendation || recommendation.sourceMeasureId !== piece.measures[measureIndex]?.sourceMeasureId) {
      setTargetedPracticeError("This measure is not available in the completed run. Review the original results and choose another measure.");
      return;
    }
    const launch = () => {
      const originalRun = runRef.current;
      if (!originalRun || originalRun.status !== "completed") return;
      const created = createPiecePracticeSession(assessedPiece, { startMeasureIndex: measureIndex, endMeasureIndex: measureIndex, startedAtMs: now() });
      if (!created.ok) { setTargetedPracticeError("This practice range is unavailable. The original results are still available."); return; }
      setTargetedPracticeReview({ originalState: current, originalRun, originalSaveProgress: progressRef.current, originalLatestSave: latestSaveRef.current,
        activeMeasureIndex: measureIndex, returnMeasureIndex: null });
      setTargetedPracticeError(null);
      setTargetedPracticeNotice(null);
      startRun(created.state, originalRun.sourceScore);
    };
    if (!isRunDurable(runRef.current, progressRef.current)) void afterCompletedSave(launch, "Start focused practice");
    else launch();
  };
  const returnToTargetedPractice = (resetInput: () => void) => {
    if (!targetedPracticeReview || targetedPracticeReview.activeMeasureIndex === null) return;
    leavePractice(() => {
      resetInput();
      setTargetedPracticeNotice(sessionRef.current?.status === "piece-complete"
        ? "Original results restored. The latest completed focused run is shown beside the original evidence."
        : "Original results restored. Focused practice ended before completion; no completed comparison was added.");
      runRef.current = targetedPracticeReview.originalRun;
      sessionRef.current = targetedPracticeReview.originalState;
      latestSaveRef.current = targetedPracticeReview.originalLatestSave;
      updateProgress(targetedPracticeReview.originalSaveProgress);
      setSessionState(targetedPracticeReview.originalState);
      setTargetedPracticeReview({ ...targetedPracticeReview, activeMeasureIndex: null, returnMeasureIndex: targetedPracticeReview.activeMeasureIndex });
      setTargetedPracticeError(null);
    }, "Return to Targeted Practice");
  };

  useEffect(() => {
    const handleVisibilityChange = () => {
      const current = sessionRef.current;
      if (!current || recoveredNotice) return;
      commitState(document.visibilityState === "hidden"
        ? pausePiecePracticeClock(current, now())
        : resumePiecePracticeClock(current, now()));
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  useEffect(() => {
    if (!sessionState || (sessionState.status === "piece-complete" && isRunDurable(runRef.current, saveProgress))) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [sessionState, saveProgress]);

  if (!sessionState) {
    return <section aria-labelledby="piece-practice-setup-title" className="mx-auto grid w-full max-w-3xl gap-5 rounded-xl border border-zinc-700 bg-zinc-900 p-5 text-zinc-100">
      <header><h1 className="text-2xl font-bold" id="piece-practice-setup-title">Practice {piece.title}</h1><p className="mt-1 text-sm text-zinc-300">{selectedAssessmentFocus === "both" ? "Practice one measure at a time. Incorrect notes never move you forward." : "Practice one measure at a time. Supply every assessed-staff pitch to move forward."}</p></header>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid max-w-xs gap-2 font-medium" htmlFor="piece-practice-start-measure">Start Measure
          <select className="rounded-md border border-zinc-600 bg-zinc-950 px-3 py-2" id="piece-practice-start-measure" onChange={(event) => {
            const nextStart = Number(event.target.value);
            setSelectedStartMeasure(nextStart);
            setSelectedEndMeasure((current) => current !== null && current < nextStart ? nextStart : current);
          }} value={selectedStartMeasure}>
            {piece.measures.map((_measure, index) => <option key={index} value={index}>Measure {index + 1}</option>)}
          </select>
        </label>
        <label className="grid max-w-xs gap-2 font-medium" htmlFor="piece-practice-end-measure">End Measure <span className="text-sm font-normal text-zinc-400">Optional, inclusive</span>
          <select className="rounded-md border border-zinc-600 bg-zinc-950 px-3 py-2" id="piece-practice-end-measure" onChange={(event) => setSelectedEndMeasure(event.target.value === "" ? null : Number(event.target.value))} value={selectedEndMeasure ?? ""}>
            <option value="">Through end</option>
            {piece.measures.slice(selectedStartMeasure).map((_measure, offset) => {
              const index = selectedStartMeasure + offset;
              return <option key={index} value={index}>Measure {index + 1}</option>;
            })}
          </select>
        </label>
      </div>
      <fieldset className="grid gap-2"><legend className="font-medium">Assess</legend><div className="flex flex-wrap gap-3">
        {(["both", "upper", "lower"] as const).map((focus) => <label className="flex min-h-11 items-center gap-2 rounded-md border border-zinc-600 px-3" key={focus}><input checked={selectedAssessmentFocus === focus} name="piece-practice-assessment" onChange={() => setSelectedAssessmentFocus(focus)} type="radio" value={focus} />{piecePracticeAssessmentLabel(focus)}</label>)}
      </div></fieldset>
      <div className="flex flex-wrap gap-3">
        <button className="rounded-lg bg-sky-600 px-4 py-2 font-semibold hover:bg-sky-500" onClick={() => {
          const result = createPiecePracticeSession(assessedPiece, { startMeasureIndex: selectedStartMeasure, endMeasureIndex: selectedEndMeasure, startedAtMs: now() });
          if (result.ok) startRun(result.state);
        }} type="button">Start Practice</button>
        <button className="rounded-lg border border-zinc-600 px-4 py-2 font-semibold hover:bg-zinc-800" onClick={exitPractice} type="button">Exit Piece Practice</button>
      </div>
    </section>;
  }

  return <>
    {secondaryStorageWarning && <p role="alert">An earlier active run could not be updated in storage. Its last saved evidence remains available.</p>}
    {saveProgress.runId !== null && saveProgress.failedRevision === saveProgress.requestedRevision && sessionState.status !== "piece-complete"
      && <p role="alert">Practice is continuing, but crash or reload recovery is currently unavailable for this run.</p>}
    {recoveredNotice && <div role="status"><strong>Recovered practice session</strong><p>Restored from the last saved checkpoint. MIDI key state and any in-progress chord or roll were reset.</p><button onClick={() => { commitState(resumePiecePracticeClock(sessionRef.current!, now())); setRecoveredNotice(false); }} type="button">Resume Practice</button></div>}
    <ActivePiecePracticeSession targetedPractice={{ review: targetedPracticeReview, latestResults: targetedPracticeResults.map((result) => result.state), unsavedMeasureIndices: targetedPracticeResults.filter((result) => !result.saved).map((result) => result.state.startMeasureIndex), notice: targetedPracticeNotice, error: targetedPracticeError, onPractice: startTargetedPractice, onReturn: returnToTargetedPractice }} completionSaveState={sessionState.status === "piece-complete"
      ? saveProgress.runId !== null && saveProgress.persistedRevision >= saveProgress.requestedRevision ? "saved" : saveProgress.failedRevision === saveProgress.requestedRevision ? "failed" : "saving"
      : null} displayScore={displayScore} exitAwaitingSave={exitAwaitingSave} now={now} onExit={exitPractice} onRestartPiece={restartWholePiece} onSessionStateChange={commitState} piece={assessedPiece} resetHeldOnMount={Boolean(recoveredRun && recoveredRun.status === "active")} sessionState={sessionState} />
  </>;
}

function ActivePiecePracticeSession({ completionSaveState, displayScore, exitAwaitingSave, targetedPractice, now, onExit, onRestartPiece, onSessionStateChange, piece, resetHeldOnMount, sessionState }: Readonly<{
  completionSaveState: "saved" | "saving" | "failed" | null;
  displayScore: ReturnType<typeof createPiecePracticeDisplayScore>;
  exitAwaitingSave: boolean;
  targetedPractice: Readonly<{
    review: TargetedPracticeReview | null;
    latestResults: readonly PiecePracticeSessionState[];
    unsavedMeasureIndices: readonly number[];
    notice: string | null;
    error: string | null;
    onPractice: (measureIndex: number) => void;
    onReturn: (resetInput: () => void) => void;
  }>;
  now: () => number;
  onExit: () => void;
  onRestartPiece: () => void;
  onSessionStateChange: (state: PiecePracticeSessionState) => void;
  piece: PiecePracticePiece;
  resetHeldOnMount: boolean;
  sessionState: PiecePracticeSessionState;
}>) {
  const input = usePiecePracticeInput({ piece, sessionState, onSessionStateChange, resetHeldOnMount, now });
  const { enterMobilePlay, exitMobilePlay, isMobilePlayMode } = useMobilePlay();
  const completionHeadingRef = useRef<HTMLHeadingElement>(null);
  const practiceHeadingRef = useRef<HTMLHeadingElement>(null);
  const targetedPracticeMeasureIndex = targetedPractice.review?.activeMeasureIndex ?? null;
  const targetedPracticeReturnMeasure = targetedPractice.review?.returnMeasureIndex ?? null;
  const targetedPracticeComparison = targetedPractice.review && targetedPracticeMeasureIndex !== null
    ? comparePiecePracticeTargetedPractice(targetedPractice.review.originalState, sessionState, targetedPracticeMeasureIndex) : null;
  const mobilePlayEntryRef = useRef<HTMLButtonElement>(null);
  const target = getCurrentPiecePracticeTarget(piece, sessionState);
  const measure = piece.measures[sessionState.currentMeasureIndex];
  const progress = getPiecePracticeProgress(piece, sessionState, now());
  const rangeText = sessionState.endMeasureIndex === null
    ? `Measure ${sessionState.startMeasureIndex + 1} through end`
    : sessionState.startMeasureIndex === sessionState.endMeasureIndex
      ? `Measure ${sessionState.startMeasureIndex + 1}`
      : `Measures ${sessionState.startMeasureIndex + 1}–${sessionState.endMeasureIndex + 1}`;
  const expectedNames = target?.attackedPitches.map(writtenPitchName) ?? [];
  const checkProgress = target?.checks.map((check) => ({
    check,
    progress: sessionState.currentCheckProgress.find(({ checkId }) => checkId === check.id),
  })) ?? [];
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
    if (sessionState.status === "piece-complete" && targetedPracticeReturnMeasure === null) completionHeadingRef.current?.focus();
    else if (sessionState.status !== "piece-complete" && targetedPracticeMeasureIndex !== null) practiceHeadingRef.current?.focus();
  }, [sessionState.status, targetedPracticeMeasureIndex, targetedPracticeReturnMeasure]);

  const restartMeasure = () => {
    const restarted = restartCurrentPiecePracticeMeasure(piece, sessionState, now());
    input.resetInput();
    onSessionStateChange(restarted);
  };
  const restartWholePiece = () => {
    input.resetInput();
    onRestartPiece();
  };
  const handleExitMobilePlay = () => {
    exitMobilePlay();
    window.setTimeout(() => mobilePlayEntryRef.current?.focus(), 0);
  };
  const mobilePlayEntry = <button className="practice-mobile-play-entry rounded-lg border border-sky-400/50 px-3 py-2 font-semibold text-sky-100" onClick={enterMobilePlay} ref={mobilePlayEntryRef} type="button">Mobile Play</button>;
  const mobilePlayExit = isMobilePlayMode ? <button className="mobile-play-exit rounded-lg border border-sky-400/60 bg-zinc-950/95 px-3 py-2 text-sm font-semibold text-sky-100 shadow-lg" onClick={handleExitMobilePlay} type="button">Exit Mobile Play</button> : null;
  const returnToTargetedPractice = targetedPracticeMeasureIndex !== null ? <button className="min-h-11 rounded-lg border border-sky-400/60 px-3 py-2 font-semibold disabled:opacity-50" disabled={exitAwaitingSave} onClick={() => targetedPractice.onReturn(input.resetInput)} type="button">Return to Targeted Practice</button> : null;

  const statusText = sessionState.status === "piece-complete" ? "Piece complete."
    : sessionState.status === "awaiting-explicit-measure-advance" ? `Measure ${sessionState.currentMeasureIndex + 1}. No notes to play in this measure.`
      : feedback.status === "incorrect" ? `Incorrect. Try target ${(sessionState.currentTargetIndex ?? 0) + 1} again.`
        : feedback.status === "correct" ? `Correct. Measure ${sessionState.currentMeasureIndex + 1}, target ${(sessionState.currentTargetIndex ?? 0) + 1}.`
          : `Measure ${sessionState.currentMeasureIndex + 1}, target ${(sessionState.currentTargetIndex ?? 0) + 1}.`;

  if (sessionState.status === "piece-complete") {
    return <section className={isMobilePlayMode ? "piece-practice-session piece-practice-complete mobile-play-mode fixed inset-0 z-50 grid w-full overflow-y-auto border border-green-700 bg-zinc-900 text-zinc-100" : "piece-practice-session piece-practice-complete mx-auto grid w-full max-w-3xl gap-5 rounded-xl border border-green-700 bg-zinc-900 p-6 text-zinc-100"}>
      {mobilePlayExit}
      <div aria-live="polite" className="sr-only" role="status">Piece complete.</div>
      <h1 className="text-3xl font-bold text-green-300" ref={completionHeadingRef} tabIndex={-1}>Piece complete</h1>
      {targetedPractice.error && <p role="alert">{targetedPractice.error}</p>}
      {targetedPractice.notice && <p role="status">{targetedPractice.notice}</p>}
      {completionSaveState === "saving" && <p role="status">Saving the completed practice result. Browser close protection remains active until it is saved.</p>}
      {completionSaveState === "saved" && <p role="status">Completed practice saved.</p>}
      {completionSaveState === "failed" && <p role="alert">The completed result is available here, but it is not safely stored for crash or reload recovery.</p>}
      {exitAwaitingSave && <p role="status">Waiting for the completed result to finish saving.</p>}
      <p>You completed {rangeText} for <strong>{piece.title}</strong>.</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><dt className="text-sm text-zinc-400">Measures practiced</dt><dd className="text-xl font-bold">{progress.practicedMeasureCount}</dd></div>
        <div><dt className="text-sm text-zinc-400">Completed targets</dt><dd className="text-xl font-bold">{progress.completedTargetCount}</dd></div>
        {progress.skippedTargetCount > 0 ? <div><dt className="text-sm text-zinc-400">Skipped targets</dt><dd className="text-xl font-bold">{progress.skippedTargetCount}</dd></div> : null}
        <div><dt className="text-sm text-zinc-400">Mistakes</dt><dd className="text-xl font-bold">{progress.incorrectAttemptCount}</dd></div>
        <div><dt className="text-sm text-zinc-400">Elapsed</dt><dd className="text-xl font-bold">{formatElapsed(progress.elapsedMs)}</dd></div>
      </dl>
      <PiecePracticeResults displayScore={displayScore} piece={piece} rangeText={rangeText} state={sessionState} title={piece.title} />
      {targetedPracticeMeasureIndex === null
        ? <PiecePracticeTargetedPractice disabled={exitAwaitingSave} focusMeasureIndex={targetedPracticeReturnMeasure} latestResults={targetedPractice.latestResults} unsavedMeasureIndices={targetedPractice.unsavedMeasureIndices} onPractice={(measureIndex) => { input.resetInput(); targetedPractice.onPractice(measureIndex); }} score={displayScore} state={sessionState} />
        : <div className="grid gap-3"><p>Focused practice for Targeted Practice: Measure {targetedPracticeMeasureIndex + 1}. Return to the original run to review another passage.</p>{targetedPracticeComparison && <PiecePracticeTargetedPracticeComparisonView comparison={targetedPracticeComparison} focusedResultUnsaved={completionSaveState !== "saved"} />}{returnToTargetedPractice}</div>}
      <div className="flex flex-wrap gap-3"><button className="rounded-lg bg-sky-600 px-4 py-2 font-semibold" disabled={exitAwaitingSave} onClick={restartWholePiece} type="button">Practice Again</button>{!isMobilePlayMode ? mobilePlayEntry : null}<button className="rounded-lg border border-zinc-600 px-4 py-2 font-semibold" disabled={exitAwaitingSave} onClick={onExit} type="button">Exit Piece Practice</button></div>
    </section>;
  }

  const feedbackPitchName = (midiNumber: number) => formatPiecePracticeMidiPitch(midiNumber, {
    expectedPitches: grade?.expectedWrittenPitches ?? target?.attackedPitches,
    predecessorPitches: feedback.predecessorPitches,
    keySignatureId: measure?.keySignatureId,
  });
  const received = grade?.receivedMidiNumbers.map(feedbackPitchName) ?? [];
  const missing = grade?.missingMidiNumbers.map(feedbackPitchName) ?? [];
  const extra = grade?.extraMidiNumbers.map(feedbackPitchName) ?? [];
  const failedNotes = feedback.status === "incorrect" ? new Set(grade?.receivedMidiNumbers ?? []) : new Set<number>();
  const lastAnswer = feedback.status === "idle" || !grade ? null : { midiNumbers: new Set(grade.receivedMidiNumbers), result: feedback.status };
  const activeNotes = new Set([...input.virtualSelectedMidiNumbers, ...input.midiChordAttemptMidiNumbers]);

  return <section className={isMobilePlayMode ? "piece-practice-session piece-practice-mobile-play mobile-play-mode fixed inset-0 z-50 grid w-full overflow-y-auto bg-zinc-950 text-zinc-100" : "piece-practice-session mx-auto grid w-full max-w-6xl gap-4 text-zinc-100"}>
    {mobilePlayExit}
    <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg bg-zinc-900 p-4">
      <div><h1 className="text-2xl font-bold" ref={practiceHeadingRef} tabIndex={-1}>{piece.title}</h1>{targetedPracticeMeasureIndex !== null && <p className="font-semibold text-sky-200">Targeted Practice · focused practice</p>}<p>Measure {sessionState.currentMeasureIndex + 1} of {piece.measures.length} · Practicing {rangeText}</p><p>Assessing: {piecePracticeAssessmentLabel(sessionState.assessmentFocus)}</p>{target ? <p>Target {(sessionState.currentTargetIndex ?? 0) + 1} of {measure?.targets.length ?? 0}</p> : null}</div>
      <div className="piece-practice-actions flex flex-wrap items-center gap-2"><MidiStatus deviceName={input.deviceName} error={input.error} onConnect={input.connectMidi} status={input.status} />{!isMobilePlayMode ? mobilePlayEntry : null}<button className="rounded-lg border border-zinc-600 px-3 py-2" onClick={restartMeasure} type="button">Restart Measure</button><button className="rounded-lg border border-zinc-600 px-3 py-2" onClick={restartWholePiece} type="button">Restart Piece</button><button className="rounded-lg border border-zinc-600 px-3 py-2" onClick={onExit} type="button">Exit Piece Practice</button></div>
      {returnToTargetedPractice}
    </header>
    <div aria-atomic="true" aria-live="polite" className="sr-only" role="status">{statusText}</div>
    <div className={isMobilePlayMode ? "piece-practice-stage grid min-h-0 gap-2" : "piece-practice-stage grid gap-4"}>
      <section aria-labelledby="piece-practice-current-target" className="grid min-h-0 gap-3 rounded-lg bg-zinc-900 p-3">
        <div><h2 className="font-bold" id="piece-practice-current-target">{target ? "Current target" : "Current measure"}</h2>{target ? <p>Expected: {expectedNames.join(", ")}</p> : <p>No notes to play in this measure.</p>}</div>
        {checkProgress.length > 1 || checkProgress.some(({ check }) => check.kind === "rolled-chord") ? <div aria-label="Current target checks" className="grid gap-1 text-sm text-zinc-300">
          {checkProgress.map(({ check, progress }) => check.kind === "normal"
            ? <p key={check.id}>Normal {check.attackedPitches.map(writtenPitchName).join(", ")} — {progress?.completed ? "complete" : "pending"}</p>
            : <div key={check.id}><p>Rolled upward:</p><ul className="flex flex-wrap gap-x-3">{check.attackedPitches.map((pitch) => <li key={pitch.sourcePitchId}>{writtenPitchName(pitch)} {progress?.accumulatedMidiNumbers.includes(pitch.midiNumber) ? "✓" : "pending"}</li>)}</ul></div>)}
        </div> : null}
        <StaffBuilderScoreView eventHighlights={eventHighlights} measureIndex={sessionState.currentMeasureIndex} score={displayScore} ghostedStaff={sessionState.assessmentFocus === "upper" ? "bass" : sessionState.assessmentFocus === "lower" ? "treble" : undefined} />
        {feedback.status === "correct" ? <p className="rounded-md border border-green-600 bg-green-950 p-3 font-semibold text-green-200">✓ Correct</p> : null}
        {feedback.status === "incorrect" ? <div className="grid gap-1 rounded-md border border-red-600 bg-red-950 p-3 text-red-100"><p className="font-semibold">Incorrect — try the same target again.</p><p>Expected: {expectedNames.join(", ")}</p><p>Played: {received.join(", ") || "No new notes"}</p>{missing.length ? <p>Missing: {missing.join(", ")}</p> : null}{extra.length ? <p>Extra: {extra.join(", ")}</p> : null}{grade?.unexpectedHeldMidiNumbers.length ? <p>Other notes still held: {grade.unexpectedHeldMidiNumbers.map(feedbackPitchName).join(", ")}</p> : null}</div> : null}
        {target && sessionState.currentTargetIndex !== null && sessionState.currentTargetIndex >= 0 ? <button className="justify-self-start rounded-lg border border-amber-500/70 px-4 py-2 font-semibold text-amber-100 hover:bg-amber-950" disabled={sessionState.clockPaused} onClick={input.skipCurrentTarget} type="button">Skip Target</button> : null}
        {sessionState.status === "awaiting-explicit-measure-advance" ? <button className="justify-self-start rounded-lg bg-sky-600 px-4 py-2 font-semibold" disabled={sessionState.clockPaused} onClick={() => {
          const result = advancePiecePracticeNoAttackMeasure(piece, sessionState, now());
          if (result.advanced) { input.resetInput(); onSessionStateChange(result.state); }
        }} type="button">Next Measure</button> : null}
      </section>
      <div aria-label="Practice keyboard" className={isMobilePlayMode ? "mobile-play-keyboard-region min-h-0" : "min-h-52"} data-presentation={isMobilePlayMode ? "mobile-play" : "standard"}>
        <PianoKeyboard activeMidiNumbers={activeNotes} failedMidiNumbers={failedNotes} lastAnswer={lastAnswer} onNoteToggle={input.onVirtualNoteToggle} targetMidiNumbers={new Set(target?.expectedMidiNumbers ?? [])} />
      </div>
    </div>
  </section>;
}
