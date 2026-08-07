import { getMusicKeyDefinition } from "@/lib/music/keys";
import type { StaffBuilderCaptureState } from "../staff-builder-capture";
import { useStaffBuilderEditor } from "../hooks/use-staff-builder-editor";
import { useStaffBuilderInput } from "../hooks/use-staff-builder-input";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { StaffBuilderCaptureControls } from "./staff-builder-capture-controls";
import { StaffBuilderScoreView } from "./staff-builder-score-view";

export function StaffBuilderWorkspacePlaceholder({ score, initialCaptureState, onDraftChange, onClose, savingAvailable }: Readonly<{
  score: StaffBuilderScoreV1;
  initialCaptureState: StaffBuilderCaptureState;
  onDraftChange: (score: StaffBuilderScoreV1, captureState: StaffBuilderCaptureState) => unknown;
  onClose: () => void;
  savingAvailable: boolean;
}>) {
  const editor = useStaffBuilderEditor({ score, initialCaptureState, onDraftChange });
  const midi = useStaffBuilderInput(editor.addMidiPitch);

  return (
    <section className="staff-builder-panel" aria-labelledby="staff-builder-workspace-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-semibold" id="staff-builder-workspace-title">{editor.score.title}</h2><p className={savingAvailable ? "text-sky-300" : "text-amber-300"}>{savingAvailable ? "Saved locally · Draft active" : "In memory · Local saving unavailable"}</p></div>
        <button className="staff-builder-secondary-button" onClick={() => {
          if (window.confirm("Close this piece and clear its active draft?")) onClose();
        }} type="button">Back to Library</button>
      </div>
      <dl className="staff-builder-metadata">
        <div><dt>Key</dt><dd>{getMusicKeyDefinition(editor.score.initialKeySignatureId).name}</dd></div>
        <div><dt>Time</dt><dd>{editor.score.initialTimeSignature}</dd></div>
        <div><dt>Tempo</dt><dd>{editor.score.tempoBpm} BPM</dd></div>
      </dl>
      <StaffBuilderScoreView cursor={{ offsetTicks: editor.captureState.cursor.offsetTicks, stepDuration: editor.captureState.stepDuration }} measureIndex={editor.captureState.cursor.measureIndex} score={editor.score} />
      <StaffBuilderCaptureControls captureState={editor.captureState} midi={midi} onActiveStaffChange={editor.setActiveStaff} onClear={editor.clearCurrentEntry} onLock={editor.lockAndContinue} onNext={editor.nextPosition} onPrevious={editor.previousPosition} onStepDurationChange={editor.setStepDuration} onVirtualPitchToggle={editor.toggleVirtualPitch} pending={editor.pending} positionLabel={editor.positionLabel} />
    </section>
  );
}
