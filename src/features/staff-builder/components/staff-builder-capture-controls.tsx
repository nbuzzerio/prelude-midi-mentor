import MidiStatus from "@/components/midi/midi-status";
import type { StaffBuilderCaptureInputMode, StaffBuilderCaptureState, StaffBuilderPendingCapture } from "../staff-builder-capture";
import { useState } from "react";
import { StaffBuilderVirtualKeyboard } from "./staff-builder-virtual-keyboard";

const INPUT_MODE_LABELS: Readonly<Record<StaffBuilderCaptureInputMode, string>> = { grand: "Grand Staff", treble: "Treble Only", bass: "Bass Only" };

export function StaffBuilderCaptureControls({ captureState, positionLabel, pending, onInputModeChange, onVirtualPitchToggle, midi, showVirtualKeyboard = true }: Readonly<{
  captureState: StaffBuilderCaptureState;
  positionLabel: string;
  pending: StaffBuilderPendingCapture;
  onInputModeChange: (mode: StaffBuilderCaptureInputMode) => void;
  onVirtualPitchToggle: (midiNumber: number) => void;
  showVirtualKeyboard?: boolean;
  midi: Readonly<{ connectMidi: () => Promise<void>; deviceName: string | null; error: string | null; status: "disconnected" | "connecting" | "connected" | "unsupported" | "error" }>;
}>) {
  const [inputOptionsOpen, setInputOptionsOpen] = useState(false);
  const pendingLabel = (values: readonly number[]) => values.length ? values.join(", ") : "none";

  return (
    <section aria-labelledby="staff-builder-capture-title" className="staff-builder-capture">
      <div className="staff-builder-capture-heading">
        <div><h3 className="font-semibold" id="staff-builder-capture-title">Capture Notes</h3><p className="text-sm text-zinc-300">Add pitches that begin at the current position, then lock them.</p></div>
        <MidiStatus deviceName={midi.deviceName} error={midi.error} onConnect={midi.connectMidi} status={midi.status} />
      </div>
      <div className="staff-builder-capture-options">
        <div><button aria-controls="staff-builder-input-options" aria-expanded={inputOptionsOpen} className="staff-builder-toolbar-trigger" onClick={() => setInputOptionsOpen((open) => !open)} type="button">Input Options: {INPUT_MODE_LABELS[captureState.inputMode]} <span aria-hidden="true">▾</span></button>
        {inputOptionsOpen && <fieldset id="staff-builder-input-options"><legend>Staff routing</legend><div className="flex flex-wrap gap-2">
          {(["treble", "grand", "bass"] as const).map((mode) => <button aria-pressed={captureState.inputMode === mode} className="staff-builder-secondary-button" key={mode} onClick={() => onInputModeChange(mode)} type="button">{INPUT_MODE_LABELS[mode]}</button>)}
        </div><p className="text-sm text-zinc-300">Grand Staff automatically routes B3 and lower to bass and C4 and higher to treble.</p></fieldset>}</div>
      </div>
      <p aria-live="polite" className="staff-builder-capture-status">
        Measure {captureState.cursor.measureIndex + 1}, {positionLabel}; Input Mode {INPUT_MODE_LABELS[captureState.inputMode]}; Step Duration {captureState.stepDuration}; pending treble MIDI pitches {pendingLabel(pending.treble)}; pending bass MIDI pitches {pendingLabel(pending.bass)}.
      </p>
      {showVirtualKeyboard && <div className="staff-builder-capture-keyboard"><StaffBuilderVirtualKeyboard onVirtualPitchToggle={onVirtualPitchToggle} pending={pending} /></div>}
    </section>
  );
}
