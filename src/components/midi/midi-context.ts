import { createContext } from "react";
import type { MidiConnectionStatus } from "@/hooks/use-midi";

export type AppMidiConsumer = Readonly<{
  onHeldNotesChanged?: (heldNotes: ReadonlySet<number>) => void;
  onNotePlayed?: (midiNumber: number) => void;
  onSustainPedalChanged?: (isDown: boolean) => void;
}>;

export type AppMidiContextValue = Readonly<{
  connectMidi: () => Promise<void>;
  deviceName: string | null;
  error: string | null;
  status: MidiConnectionStatus;
  registerConsumer: (consumer: AppMidiConsumer) => () => void;
}>;

export const AppMidiContext = createContext<AppMidiContextValue | null>(null);
