import { useMidi } from "@/hooks/use-midi";

export function useStaffBuilderInput(onMidiNote: (midiNumber: number) => void) {
  return useMidi({ onNotePlayed: onMidiNote });
}
