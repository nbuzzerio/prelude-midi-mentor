import { ChevronLeft, ChevronRight, CornerDownRight, Eraser, Keyboard } from "lucide-react";
import type { Ref } from "react";
import type { StaffBuilderCaptureState } from "../staff-builder-capture";
import { STAFF_BUILDER_STEP_DURATIONS, type StaffBuilderStepDuration } from "../staff-builder-time";
import { StaffBuilderMusicGlyph } from "./staff-builder-music-glyph";

const STEP_NAMES: Readonly<Record<StaffBuilderStepDuration, string>> = { quarter: "Quarter-note step", eighth: "Eighth-note step", sixteenth: "Sixteenth-note step" };

export function StaffBuilderCaptureStrip({ captureState, hasPending, onStepDurationChange, onPrevious, onLock, onRest, onNext, onClear, showKeyboardLauncher = false, onOpenKeyboard, keyboardLauncherRef }: Readonly<{
  captureState: StaffBuilderCaptureState;
  hasPending: boolean;
  onStepDurationChange: (duration: StaffBuilderStepDuration) => void;
  onPrevious: () => void;
  onLock: () => void;
  onRest: () => void;
  onNext: () => void;
  onClear: () => void;
  showKeyboardLauncher?: boolean;
  onOpenKeyboard?: () => void;
  keyboardLauncherRef?: Ref<HTMLButtonElement>;
}>) {
  return <div className="staff-builder-capture-strip">
    <div aria-label="Step Duration" className="staff-builder-step-buttons" role="group">
      {STAFF_BUILDER_STEP_DURATIONS.map((duration) => <button aria-label={STEP_NAMES[duration]} aria-pressed={captureState.stepDuration === duration} key={duration} onClick={() => onStepDurationChange(duration)} title={STEP_NAMES[duration]} type="button"><StaffBuilderMusicGlyph kind={duration} /></button>)}
    </div>
    <div className="staff-builder-capture-strip-actions">
      <button aria-label="Previous Position" disabled={captureState.cursor.measureIndex === 0 && captureState.cursor.offsetTicks === 0} onClick={onPrevious} title="Previous Position" type="button"><ChevronLeft aria-hidden="true" /></button>
      <button aria-label="Lock pitches and continue" className="staff-builder-lock-action" onClick={onLock} title="Lock pitches and continue" type="button"><CornerDownRight aria-hidden="true" /><span>Lock</span></button>
      <button aria-label="Add rest at current position" onClick={onRest} title="Rest" type="button"><StaffBuilderMusicGlyph family="rest" kind={captureState.stepDuration} /></button>
      <button aria-label="Next Position" onClick={onNext} title="Next Position" type="button"><ChevronRight aria-hidden="true" /></button>
      {hasPending && <button aria-label="Clear Current Entry" onClick={onClear} title="Clear Current Entry" type="button"><Eraser aria-hidden="true" /></button>}
      {showKeyboardLauncher && <button aria-label="Open virtual keyboard" onClick={onOpenKeyboard} ref={keyboardLauncherRef} title="Open virtual keyboard" type="button"><Keyboard aria-hidden="true" /></button>}
    </div>
  </div>;
}
