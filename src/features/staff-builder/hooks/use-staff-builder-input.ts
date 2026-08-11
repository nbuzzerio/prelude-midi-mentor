import { useAppMidiInput } from "@/hooks/use-app-midi-input";

export function useStaffBuilderInput(onMidiNote: (midiNumber: number) => void) {
  return useAppMidiInput({ onNotePlayed: onMidiNote });
}
