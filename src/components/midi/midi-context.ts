import { createContext } from "react";
import type { MidiConnectionStatus, MidiReleaseObservation } from "@/hooks/use-midi";
import type { MidiInputConnectionChange, MidiInputInfo, RawMidiMessage } from "@/lib/midi/midi-transport";

export type AppMidiConsumer = Readonly<{
  onHeldNotesChanged?: (heldNotes: ReadonlySet<number>) => void;
  onNotePlayed?: (midiNumber: number, attackVelocity?: number, sourceTimeStampMs?: number) => void;
  onNoteReleased?: (release: MidiReleaseObservation) => void;
  onSustainPedalChanged?: (isDown: boolean) => void;
  /** Filters raw transport only. Omitted means all inputs; legacy normalized input stays unchanged. */
  rawInputId?: string;
  onRawMessage?: (message: RawMidiMessage) => void;
  onInputConnectionChange?: (change: MidiInputConnectionChange) => void;
}>;

export type AppMidiContextValue = Readonly<{
  connectMidi: () => Promise<void>;
  deviceName: string | null;
  error: string | null;
  status: MidiConnectionStatus;
  connectedInputs: readonly MidiInputInfo[];
  registerConsumer: (consumer: AppMidiConsumer) => () => void;
}>;

export const AppMidiContext = createContext<AppMidiContextValue | null>(null);
