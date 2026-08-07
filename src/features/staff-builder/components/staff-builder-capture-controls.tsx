import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import type { StaffBuilderCaptureState, StaffBuilderPendingCapture } from "../staff-builder-capture";
import type { StaffBuilderStaff } from "../staff-builder-types";
import type { StaffBuilderStepDuration } from "../staff-builder-time";

const EMPTY_MIDI_SET = new Set<number>();
const STEP_LABELS: Readonly<Record<StaffBuilderStepDuration, string>> = {
  quarter: "Quarter",
  eighth: "Eighth",
  sixteenth: "Sixteenth",
};

export function StaffBuilderCaptureControls({ captureState, positionLabel, pending, onActiveStaffChange, onStepDurationChange, onPrevious, onLock, onNext, onClear, onVirtualPitchToggle, midi }: Readonly<{
  captureState: StaffBuilderCaptureState;
  positionLabel: string;
  pending: StaffBuilderPendingCapture;
  onActiveStaffChange: (staff: StaffBuilderStaff) => void;
  onStepDurationChange: (duration: StaffBuilderStepDuration) => void;
  onPrevious: () => void;
  onLock: () => void;
  onNext: () => void;
  onClear: () => void;
  onVirtualPitchToggle: (midiNumber: number) => void;
  midi: Readonly<{ connectMidi: () => Promise<void>; deviceName: string | null; error: string | null; status: "disconnected" | "connecting" | "connected" | "unsupported" | "error" }>;
}>) {
  const activePitches = pending[captureState.activeStaff];
  const tick = captureState.cursor.offsetTicks;
  const pendingLabel = (values: readonly number[]) => values.length ? values.join(", ") : "none";

  return (
    <section aria-labelledby="staff-builder-capture-title" className="staff-builder-capture">
      <div className="staff-builder-capture-heading">
        <div><h3 className="font-semibold" id="staff-builder-capture-title">Fast Capture</h3><p className="text-sm text-zinc-300">Add pitches that begin at the current position, then lock them.</p></div>
        <MidiStatus deviceName={midi.deviceName} error={midi.error} onConnect={midi.connectMidi} status={midi.status} />
      </div>
      <div className="staff-builder-capture-options">
        <fieldset><legend>Active staff</legend><div className="flex gap-2">
          {(["treble", "bass"] as const).map((staff) => <button aria-pressed={captureState.activeStaff === staff} className="staff-builder-secondary-button" key={staff} onClick={() => onActiveStaffChange(staff)} type="button">{staff === "treble" ? "Treble" : "Bass"}</button>)}
        </div></fieldset>
        <label>Step Duration<select onChange={(event) => onStepDurationChange(event.target.value as StaffBuilderStepDuration)} value={captureState.stepDuration}>
          {Object.entries(STEP_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      <div className="staff-builder-capture-actions">
        <button className="staff-builder-secondary-button" disabled={captureState.cursor.measureIndex === 0 && tick === 0} onClick={onPrevious} type="button">Previous Position</button>
        <button className="staff-builder-primary-button" onClick={onLock} type="button">Lock &amp; Continue</button>
        <button className="staff-builder-secondary-button" onClick={onNext} type="button">Next Position</button>
        <button className="staff-builder-secondary-button" disabled={pending.treble.length === 0 && pending.bass.length === 0} onClick={onClear} type="button">Clear Current Entry</button>
      </div>
      <p aria-live="polite" className="staff-builder-capture-status">
        Measure {captureState.cursor.measureIndex + 1}, {positionLabel}; active staff {captureState.activeStaff}; Step Duration {STEP_LABELS[captureState.stepDuration]}; pending treble MIDI pitches {pendingLabel(pending.treble)}; pending bass MIDI pitches {pendingLabel(pending.bass)}.
      </p>
      <div className="staff-builder-capture-keyboard">
        <PianoKeyboard activeMidiNumbers={new Set(activePitches)} failedMidiNumbers={EMPTY_MIDI_SET} lastAnswer={null} onNoteToggle={onVirtualPitchToggle} targetMidiNumbers={EMPTY_MIDI_SET} visualMode="freeplay" />
      </div>
    </section>
  );
}
