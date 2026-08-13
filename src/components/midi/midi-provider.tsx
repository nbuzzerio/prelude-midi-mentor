import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { useMidi } from "@/hooks/use-midi";
import { AppMidiContext, type AppMidiConsumer, type AppMidiContextValue } from "./midi-context";

export function MidiProvider({ children }: Readonly<{ children: ReactNode }>) {
  const activeConsumerRef = useRef<Readonly<{ token: symbol; consumer: AppMidiConsumer }> | null>(null);
  const heldNotesRef = useRef<ReadonlySet<number>>(new Set());

  const handleHeldNotesChanged = useCallback((heldNotes: ReadonlySet<number>) => {
    const snapshot = new Set(heldNotes);
    heldNotesRef.current = snapshot;
    activeConsumerRef.current?.consumer.onHeldNotesChanged?.(new Set(snapshot));
  }, []);

  const handleNotePlayed = useCallback((midiNumber: number) => {
    activeConsumerRef.current?.consumer.onNotePlayed?.(midiNumber);
  }, []);

  const handleSustainPedalChanged = useCallback((isDown: boolean) => {
    activeConsumerRef.current?.consumer.onSustainPedalChanged?.(isDown);
  }, []);

  const midi = useMidi({ onHeldNotesChanged: handleHeldNotesChanged, onNotePlayed: handleNotePlayed, onSustainPedalChanged: handleSustainPedalChanged });

  const registerConsumer = useCallback((consumer: AppMidiConsumer) => {
    const token = Symbol("app-midi-consumer");
    activeConsumerRef.current = { token, consumer };
    consumer.onHeldNotesChanged?.(new Set(heldNotesRef.current));
    return () => {
      if (activeConsumerRef.current?.token === token) activeConsumerRef.current = null;
    };
  }, []);

  const value = useMemo<AppMidiContextValue>(() => ({ ...midi, registerConsumer }), [midi, registerConsumer]);
  return <AppMidiContext.Provider value={value}>{children}</AppMidiContext.Provider>;
}
