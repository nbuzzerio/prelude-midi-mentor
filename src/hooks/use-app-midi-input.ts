import { useContext, useEffect, useRef } from "react";
import { AppMidiContext, type AppMidiConsumer, type AppMidiContextValue } from "@/components/midi/midi-context";

export function useAppMidiInput(consumer: AppMidiConsumer): Omit<AppMidiContextValue, "registerConsumer"> {
  const context = useContext(AppMidiContext);
  if (!context) throw new Error("useAppMidiInput must be used within MidiProvider.");

  const consumerRef = useRef(consumer);
  useEffect(() => {
    consumerRef.current = consumer;
  }, [consumer]);

  const { registerConsumer } = context;
  useEffect(() => registerConsumer({
    onHeldNotesChanged: (notes) => consumerRef.current.onHeldNotesChanged?.(notes),
    onNotePlayed: (midiNumber, attackVelocity) => consumerRef.current.onNotePlayed?.(midiNumber, attackVelocity),
    onSustainPedalChanged: (isDown) =>
      consumerRef.current.onSustainPedalChanged?.(isDown),
  }), [registerConsumer]);

  return {
    connectMidi: context.connectMidi,
    deviceName: context.deviceName,
    error: context.error,
    status: context.status,
  };
}
