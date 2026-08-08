import MidiStatus from "@/components/midi/midi-status";
import PianoKeyboard from "@/components/notation/piano-keyboard";
import type { StaffBuilderCaptureInputMode, StaffBuilderCaptureState, StaffBuilderPendingCapture } from "../staff-builder-capture";
import type { StaffBuilderStepDuration } from "../staff-builder-time";

const EMPTY_MIDI_SET = new Set<number>();
const STEP_LABELS: Readonly<Record<StaffBuilderStepDuration, string>> = {
  quarter: "Quarter",
  eighth: "Eighth",
  sixteenth: "Sixteenth",
};

const INPUT_MODE_LABELS: Readonly<Record<StaffBuilderCaptureInputMode, string>> = { grand: "Grand Staff", treble: "Treble Only", bass: "Bass Only" };

export function StaffBuilderCaptureControls({ captureState, positionLabel, pending, onInputModeChange, onStepDurationChange, onPrevious, onLock, onNext, onClear, onVirtualPitchToggle, midi }: Readonly<{
  captureState: StaffBuilderCaptureState;
  positionLabel: string;
  pending: StaffBuilderPendingCapture;
  onInputModeChange: (mode: StaffBuilderCaptureInputMode) => void;
  onStepDurationChange: (duration: StaffBuilderStepDuration) => void;
  onPrevious: () => void;
  onLock: () => void;
  onNext: () => void;
  onClear: () => void;
  onVirtualPitchToggle: (midiNumber: number) => void;
  midi: Readonly<{ connectMidi: () => Promise<void>; deviceName: string | null; error: string | null; status: "disconnected" | "connecting" | "connected" | "unsupported" | "error" }>;
}>) {
  const activePitches = [...new Set([...pending.treble, ...pending.bass])];
  const tick = captureState.cursor.offsetTicks;
  const pendingLabel = (values: readonly number[]) => values.length ? values.join(", ") : "none";

  return (
    <section aria-labelledby="staff-builder-capture-title" className="staff-builder-capture">
      <div className="staff-builder-capture-heading">
        <div><h3 className="font-semibold" id="staff-builder-capture-title">Capture Notes</h3><p className="text-sm text-zinc-300">Add pitches that begin at the current position, then lock them.</p></div>
        <MidiStatus deviceName={midi.deviceName} error={midi.error} onConnect={midi.connectMidi} status={midi.status} />
      </div>
      <div className="staff-builder-capture-options">
        <fieldset><legend>Input Mode</legend><div className="flex flex-wrap gap-2">
          {(["grand", "treble", "bass"] as const).map((mode) => <button aria-pressed={captureState.inputMode === mode} className="staff-builder-secondary-button" key={mode} onClick={() => onInputModeChange(mode)} type="button">{INPUT_MODE_LABELS[mode]}</button>)}
        </div><p className="text-sm text-zinc-300">Grand Staff automatically sends B3 and lower to bass, and C4 and higher to treble.</p></fieldset>
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
        Measure {captureState.cursor.measureIndex + 1}, {positionLabel}; Input Mode {INPUT_MODE_LABELS[captureState.inputMode]}; Step Duration {STEP_LABELS[captureState.stepDuration]}; pending treble MIDI pitches {pendingLabel(pending.treble)}; pending bass MIDI pitches {pendingLabel(pending.bass)}.
      </p>
      <div className="staff-builder-capture-keyboard">
        <PianoKeyboard activeMidiNumbers={new Set(activePitches)} failedMidiNumbers={EMPTY_MIDI_SET} lastAnswer={null} onNoteToggle={onVirtualPitchToggle} targetMidiNumbers={EMPTY_MIDI_SET} visualMode="freeplay" />
      </div>
    </section>
  );
}
