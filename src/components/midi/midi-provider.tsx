import { useCallback, useMemo, useRef, type ReactNode } from "react";
import { useMidi, type MidiReleaseObservation } from "@/hooks/use-midi";
import { AppMidiContext, type AppMidiConsumer, type AppMidiContextValue } from "./midi-context";
import type { MidiInputConnectionChange, RawMidiMessage } from "@/lib/midi/midi-transport";

export function MidiProvider({ children }: Readonly<{ children: ReactNode }>) {
  const activeConsumerRef = useRef<Readonly<{ token: symbol; consumer: AppMidiConsumer }> | null>(null);
  const heldNotesRef = useRef<ReadonlySet<number>>(new Set());
  // Pin derived callbacks to the registration that received this message. A reentrant
  // replacement must not receive the remainder of the previous consumer's delivery.
  const deliveryConsumerRef = useRef<typeof activeConsumerRef.current | undefined>(undefined);
  const currentDeliveryConsumer = useCallback(() => {
    const active = activeConsumerRef.current;
    return deliveryConsumerRef.current === undefined || deliveryConsumerRef.current === active ? active?.consumer : undefined;
  }, []);

  const handleHeldNotesChanged = useCallback((heldNotes: ReadonlySet<number>) => {
    const snapshot = new Set(heldNotes);
    heldNotesRef.current = snapshot;
    currentDeliveryConsumer()?.onHeldNotesChanged?.(new Set(snapshot));
  }, [currentDeliveryConsumer]);

  const handleNotePlayed = useCallback((midiNumber: number, attackVelocity?: number, sourceTimeStampMs?: number) => {
    const callback = currentDeliveryConsumer()?.onNotePlayed;
    if (sourceTimeStampMs === undefined) callback?.(midiNumber, attackVelocity);
    else callback?.(midiNumber, attackVelocity, sourceTimeStampMs);
  }, [currentDeliveryConsumer]);

  const handleNoteReleased = useCallback((release: MidiReleaseObservation) => {
    currentDeliveryConsumer()?.onNoteReleased?.(release);
  }, [currentDeliveryConsumer]);

  const handleSustainPedalChanged = useCallback((isDown: boolean) => {
    currentDeliveryConsumer()?.onSustainPedalChanged?.(isDown);
  }, [currentDeliveryConsumer]);

  const handleRawMessage = useCallback((message: RawMidiMessage) => {
    const active = activeConsumerRef.current;
    deliveryConsumerRef.current = active;
    const consumer = active?.consumer;
    if (consumer && (consumer.rawInputId === undefined || consumer.rawInputId === message.input.id)) consumer.onRawMessage?.(message);
  }, []);
  const handleInputConnectionChange = useCallback((change: MidiInputConnectionChange) => {
    const active = activeConsumerRef.current;
    deliveryConsumerRef.current = active;
    const consumer = active?.consumer;
    if (consumer && (consumer.rawInputId === undefined || consumer.rawInputId === change.input.id)) consumer.onInputConnectionChange?.(change);
  }, []);

  const midi = useMidi({ onHeldNotesChanged: handleHeldNotesChanged, onNotePlayed: handleNotePlayed, onNoteReleased: handleNoteReleased,
    onSustainPedalChanged: handleSustainPedalChanged, onRawMessage: handleRawMessage, onInputConnectionChange: handleInputConnectionChange });

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
