import { ChevronLeft, ChevronRight, CornerDownRight, Eraser } from "lucide-react";
import type { StaffBuilderCaptureState } from "../staff-builder-capture";
import { STAFF_BUILDER_STEP_DURATIONS, type StaffBuilderStepDuration } from "../staff-builder-time";
import { StaffBuilderMusicGlyph } from "./staff-builder-music-glyph";

const STEP_NAMES: Readonly<Record<StaffBuilderStepDuration, string>> = { quarter: "Quarter-note step", eighth: "Eighth-note step", sixteenth: "Sixteenth-note step" };

export function StaffBuilderCaptureStrip({ captureState, hasPending, onStepDurationChange, onPrevious, onLock, onNext, onClear }: Readonly<{
  captureState: StaffBuilderCaptureState;
  hasPending: boolean;
  onStepDurationChange: (duration: StaffBuilderStepDuration) => void;
  onPrevious: () => void;
  onLock: () => void;
  onNext: () => void;
  onClear: () => void;
}>) {
  return <div className="staff-builder-capture-strip">
    <div aria-label="Step Duration" className="staff-builder-step-buttons" role="group">
      {STAFF_BUILDER_STEP_DURATIONS.map((duration) => <button aria-label={STEP_NAMES[duration]} aria-pressed={captureState.stepDuration === duration} key={duration} onClick={() => onStepDurationChange(duration)} title={STEP_NAMES[duration]} type="button"><StaffBuilderMusicGlyph kind={duration} /></button>)}
    </div>
    <div className="staff-builder-capture-strip-actions">
      <button aria-label="Previous Position" disabled={captureState.cursor.measureIndex === 0 && captureState.cursor.offsetTicks === 0} onClick={onPrevious} title="Previous Position" type="button"><ChevronLeft aria-hidden="true" /></button>
      <button aria-label="Lock pitches and continue" className="staff-builder-lock-action" onClick={onLock} title="Lock pitches and continue" type="button"><CornerDownRight aria-hidden="true" /><span>Lock</span></button>
      <button aria-label="Next Position" onClick={onNext} title="Next Position" type="button"><ChevronRight aria-hidden="true" /></button>
      {hasPending && <button aria-label="Clear Current Entry" onClick={onClear} title="Clear Current Entry" type="button"><Eraser aria-hidden="true" /></button>}
    </div>
  </div>;
}
