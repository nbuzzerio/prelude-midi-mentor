import { useAppMidiInput } from "@/hooks/use-app-midi-input";

export function useStaffBuilderInput(onMidiNote: (midiNumber: number) => void, onSustainPedalChanged?: (isDown: boolean) => void) {
  return useAppMidiInput({ onNotePlayed: onMidiNote, onSustainPedalChanged });
}
