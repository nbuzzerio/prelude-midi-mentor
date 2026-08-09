import type { StaffBuilderCaptureState } from "../staff-builder-capture";
import { useEffect, useRef, useState } from "react";
import { useStaffBuilderEditor, type StaffBuilderEditorPass, type StaffBuilderPersistedEditorState } from "../hooks/use-staff-builder-editor";
import { useStaffBuilderInput } from "../hooks/use-staff-builder-input";
import { useStaffBuilderMobilePresentation } from "../hooks/use-staff-builder-mobile-presentation";
import { useStaffBuilderPlayback } from "../hooks/use-staff-builder-playback";
import { describeStaffBuilderSelectedEvent, type StaffBuilderRhythmState } from "../staff-builder-rhythm";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { StaffBuilderCaptureControls } from "./staff-builder-capture-controls";
import { StaffBuilderCaptureStrip } from "./staff-builder-capture-strip";
import { StaffBuilderMeasureContextControls } from "./staff-builder-measure-context-controls";
import { StaffBuilderMobileKeyboardSheet } from "./staff-builder-mobile-keyboard-sheet";
import { StaffBuilderPlaybackControls } from "./staff-builder-playback-controls";
import { StaffBuilderRhythmControls } from "./staff-builder-rhythm-controls";
import { StaffBuilderScoreDetails, StaffBuilderScoreView } from "./staff-builder-score-view";
import { StaffBuilderScoreToolbar } from "./staff-builder-score-toolbar";
import { StaffBuilderValidationPanel } from "./staff-builder-validation-panel";

export function StaffBuilderWorkspacePlaceholder({ score, initialCaptureState, initialEditorPass, initialRhythmState, onDraftChange, onValidatedSave, onClose, savingAvailable }: Readonly<{
  score: StaffBuilderScoreV1;
  initialCaptureState: StaffBuilderCaptureState;
  initialEditorPass: StaffBuilderEditorPass;
  initialRhythmState: StaffBuilderRhythmState;
  onDraftChange: (score: StaffBuilderScoreV1, editorState: StaffBuilderPersistedEditorState) => unknown;
  onValidatedSave: (score: StaffBuilderScoreV1, editorState: StaffBuilderPersistedEditorState) => Readonly<{ ok: boolean }>;
  onClose: () => void;
  savingAvailable: boolean;
}>) {
  const editor = useStaffBuilderEditor({ score, initialCaptureState, initialEditorPass, initialRhythmState, onDraftChange, onValidatedSave });
  const playback = useStaffBuilderPlayback(editor.score);
  const stopPlayback = playback.stop;
  const midi = useStaffBuilderInput(editor.addMidiPitch);
  const mobilePresentation = useStaffBuilderMobilePresentation();
  const mobileKeyboardOwnerAvailable = mobilePresentation && !editor.validation.active && editor.editorPass === "capture";
  const [mobileKeyboardState, setMobileKeyboardState] = useState({ ownerAvailable: mobileKeyboardOwnerAvailable, open: false });
  if (mobileKeyboardState.ownerAvailable !== mobileKeyboardOwnerAvailable) {
    setMobileKeyboardState({ ownerAvailable: mobileKeyboardOwnerAvailable, open: false });
  }
  const scoreRegionRef = useRef<HTMLDivElement>(null);
  const keyboardLauncherRef = useRef<HTMLButtonElement>(null);
  const rhythmMeasureIndex = editor.rhythm.measureIndex;
  const editorVisibleMeasureIndex = editor.validation.active
    ? editor.validation.activeIssue?.target.measureIndex ?? rhythmMeasureIndex
    : editor.editorPass === "capture" ? editor.captureState.cursor.measureIndex : rhythmMeasureIndex;
  const playbackPosition = playback.state.status === "playing" ? playback.position : null;
  const playbackOwnsMeasure = playbackPosition !== null;
  const visibleMeasureIndex = playbackPosition?.measureIndex ?? editorVisibleMeasureIndex;
  const fromHerePosition = editor.editorPass === "capture"
    ? editor.captureState.cursor
    : editor.rhythm.selection
      ? { measureIndex: editor.rhythm.selection.measureIndex, offsetTicks: editor.rhythm.selectedEvent?.startTick ?? 0 }
      : { measureIndex: visibleMeasureIndex, offsetTicks: 0 };
  const showMobileKeyboard = mobileKeyboardOwnerAvailable && mobileKeyboardState.ownerAvailable && mobileKeyboardState.open;

  const closeMobileKeyboard = () => {
    setMobileKeyboardState({ ownerAvailable: mobileKeyboardOwnerAvailable, open: false });
    requestAnimationFrame(() => keyboardLauncherRef.current?.focus({ preventScroll: true }));
  };
  const playbackLifecycle = `${editor.editorPass}:${editor.validation.active}`;
  const previousPlaybackLifecycle = useRef(playbackLifecycle);
  useEffect(() => {
    if (previousPlaybackLifecycle.current === playbackLifecycle) return;
    previousPlaybackLifecycle.current = playbackLifecycle;
    if (playback.state.status === "playing") stopPlayback();
  }, [playback.state.status, stopPlayback, playbackLifecycle]);

  return <section className={`staff-builder-panel${showMobileKeyboard ? " staff-builder-mobile-keyboard-open" : ""}`} aria-labelledby="staff-builder-workspace-title">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-semibold" id="staff-builder-workspace-title">{editor.score.title}</h2><p className={savingAvailable ? "text-sky-300" : "text-amber-300"}>{savingAvailable ? `${editor.validation.issues.length === 0 ? "Ready to save" : "Needs validation"} · Draft saved automatically.` : "In memory · Local saving unavailable"}</p></div><button className="staff-builder-secondary-button" onClick={() => { if (window.confirm("Return to Piece Library?")) onClose(); }} type="button">Piece Library</button></div>
    <dl className="staff-builder-metadata"><div><dt>Tempo</dt><dd>{editor.score.tempoBpm} BPM</dd></div></dl>
    <div className="staff-builder-pass-switcher" aria-label="Editor pass"><button aria-pressed={!editor.validation.active && editor.editorPass === "capture"} className="staff-builder-secondary-button" onClick={editor.switchToCapture} type="button">Capture Notes</button><button aria-pressed={!editor.validation.active && editor.editorPass === "rhythm"} className="staff-builder-secondary-button" disabled={!editor.canEnterRhythm} onClick={editor.switchToRhythm} type="button">Rhythm Correction</button></div>
    {!editor.canEnterRhythm && <p className="text-sm text-zinc-300">Capture at least one event before starting Rhythm Correction.</p>}
    <p aria-live="polite" role="status">{editor.validation.issues.length} structural {editor.validation.issues.length === 1 ? "issue" : "issues"}.</p>
    <div className="staff-builder-score-header">
      <StaffBuilderScoreToolbar measureIndex={visibleMeasureIndex} navigationDisabled={editor.validation.active || playbackOwnsMeasure} navigationDisabledReason={playbackOwnsMeasure ? "Measure navigation is unavailable while playback follows the score." : undefined} onNavigate={editor.goToMeasure} score={editor.score} />
    </div>
    <div className="staff-builder-immediate-workspace" ref={scoreRegionRef}>
      <StaffBuilderScoreView {...(!editor.validation.active && editor.editorPass === "capture" ? { cursor: { offsetTicks: editor.captureState.cursor.offsetTicks, stepDuration: editor.captureState.stepDuration }, onInputModeChange: editor.setInputMode, pendingPreview: editor.pending } : { selectedEventId: editor.validation.active ? editor.validation.activeIssue?.target.eventId : editor.rhythm.selection?.eventId })} inputMode={editor.captureState.inputMode} issue={editor.validation.active ? editor.validation.activeIssue : null} measureIndex={visibleMeasureIndex} onAssignDuration={editor.validation.active ? undefined : editor.rhythm.assignDuration} onCaptureRestAsNote={editor.validation.active ? undefined : editor.captureRestAsNote} onConvertToRest={editor.validation.active ? undefined : editor.rhythm.convertToRest} onEventSelect={editor.validation.active ? undefined : editor.selectRhythmEventFromScore} onKeyChange={editor.validation.active ? undefined : editor.setMeasureKey} onPositionSelect={!editor.validation.active && editor.editorPass === "capture" ? editor.setCapturePosition : undefined} onTimeChange={editor.validation.active ? undefined : editor.setMeasureTime} playbackPosition={playbackPosition ? { offsetTicks: playbackPosition.offsetTicks } : undefined} score={editor.score} />
      {!editor.validation.active && editor.editorPass === "capture" && <StaffBuilderCaptureStrip captureState={editor.captureState} hasPending={editor.hasPending} keyboardLauncherRef={keyboardLauncherRef} onClear={editor.clearCurrentEntry} onLock={editor.lockAndContinue} onNext={editor.nextPosition} onOpenKeyboard={() => setMobileKeyboardState({ ownerAvailable: mobileKeyboardOwnerAvailable, open: true })} onPrevious={editor.previousPosition} onRest={editor.addRestAndContinue} onStepDurationChange={editor.setStepDuration} showKeyboardLauncher={mobilePresentation} />}
    </div>
    {editor.captureStatus && <p aria-live="polite" className="staff-builder-capture-status" role="status">{editor.captureStatus}</p>}
    <StaffBuilderScoreDetails measureIndex={visibleMeasureIndex} score={editor.score} />
    <details className="staff-builder-measure-settings"><summary>Measure settings</summary><StaffBuilderMeasureContextControls control="both" measureIndex={visibleMeasureIndex} onKeyChange={editor.setMeasureKey} onTimeChange={editor.setMeasureTime} score={editor.score} /></details>
    <StaffBuilderPlaybackControls editorPass={editor.editorPass} issueCount={editor.validation.issues.length} onAuditionSelectedEvent={() => { playback.auditionSelectedEvent(editor.rhythm.selectedEvent, editor.rhythm.selection ? { measureIndex: editor.rhythm.selection.measureIndex, offsetTicks: editor.rhythm.selectedEvent?.startTick ?? 0 } : undefined); }} onPlayCurrentMeasure={() => playback.playCurrentMeasure(visibleMeasureIndex)} onPlayEntirePiece={playback.playEntirePiece} onPlayFromHere={() => playback.playFromHere(fromHerePosition)} onStop={playback.stop} selectedEvent={editor.rhythm.selectedEvent} state={playback.state} />
    {editor.validation.active
      ? <StaffBuilderValidationPanel activeIndex={editor.validation.activeIssueIndex} activeIssue={editor.validation.activeIssue} issues={editor.validation.issues} onActivate={editor.validation.activate} onClose={editor.validation.close} onCorrection={editor.validation.applyCorrection} onFillAllGaps={editor.validation.fillAllGaps} onNext={editor.validation.next} onPrevious={editor.validation.previous} status={editor.validation.status} />
      : editor.editorPass === "capture"
        ? <StaffBuilderCaptureControls captureState={editor.captureState} midi={midi} onInputModeChange={editor.setInputMode} onVirtualPitchToggle={editor.toggleVirtualPitch} pending={editor.pending} positionLabel={editor.positionLabel} showVirtualKeyboard={!mobilePresentation} />
        : <StaffBuilderRhythmControls canNext={editor.rhythm.canNext} canPrevious={editor.rhythm.canPrevious} canRedo={editor.canRedo} canUndo={editor.canUndo} eventCount={editor.rhythm.eventCount} onAssignDuration={editor.rhythm.assignDuration} onConvertToRest={editor.rhythm.convertToRest} onCreateTies={editor.createTies} onDelete={editor.rhythm.deleteEvent} onMoveToStaff={editor.rhythm.moveToStaff} onNext={editor.rhythm.nextEvent} onPrevious={editor.rhythm.previousEvent} onRedo={editor.redo} onRemoveTie={editor.removeTie} onRespellPitch={editor.rhythm.respellPitch} onSplitAndTie={editor.splitAndTie} onUndo={editor.undo} score={editor.score} selectedDescription={describeStaffBuilderSelectedEvent(editor.score, editor.rhythm.selection)} selectedEvent={editor.rhythm.selectedEvent} selectedIndex={editor.rhythm.selectedIndex} selectedMeasureIndex={rhythmMeasureIndex} status={editor.rhythm.status} />}
    {!editor.validation.active && <StaffBuilderValidationPanel activeIndex={-1} activeIssue={null} issues={editor.validation.issues} onActivate={editor.validation.activate} onClose={editor.validation.close} onCorrection={editor.validation.applyCorrection} onFillAllGaps={editor.validation.fillAllGaps} onNext={editor.validation.next} onPrevious={editor.validation.previous} status={editor.validation.status} />}
    {showMobileKeyboard && <StaffBuilderMobileKeyboardSheet onClose={closeMobileKeyboard} onLock={editor.lockAndContinue} onVirtualPitchToggle={editor.toggleVirtualPitch} pending={editor.pending} scoreRegionRef={scoreRegionRef} />}
  </section>;
}
