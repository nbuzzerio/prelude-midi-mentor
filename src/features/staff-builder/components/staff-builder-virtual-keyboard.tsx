import PianoKeyboard from "@/components/notation/piano-keyboard";
import type { StaffBuilderPendingCapture } from "../staff-builder-capture";

const EMPTY_MIDI_SET = new Set<number>();

export function StaffBuilderVirtualKeyboard({ pending, onVirtualPitchToggle }: Readonly<{
  pending: StaffBuilderPendingCapture;
  onVirtualPitchToggle: (midiNumber: number) => void;
}>) {
  const activePitches = new Set([...pending.treble, ...pending.bass]);
  return <div className="staff-builder-virtual-keyboard" data-testid="staff-builder-virtual-keyboard"><PianoKeyboard activeMidiNumbers={activePitches} failedMidiNumbers={EMPTY_MIDI_SET} lastAnswer={null} onNoteToggle={onVirtualPitchToggle} targetMidiNumbers={EMPTY_MIDI_SET} visualMode="freeplay" /></div>;
}
