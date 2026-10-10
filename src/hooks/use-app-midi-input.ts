import { useContext, useLayoutEffect, useRef } from "react";
import { AppMidiContext, type AppMidiConsumer, type AppMidiContextValue } from "@/components/midi/midi-context";

export function useAppMidiInput(consumer: AppMidiConsumer): Omit<AppMidiContextValue, "registerConsumer"> {
  const context = useContext(AppMidiContext);
  if (!context) throw new Error("useAppMidiInput must be used within MidiProvider.");

  const consumerRef = useRef(consumer);
  useLayoutEffect(() => {
    consumerRef.current = consumer;
  }, [consumer]);

  const { registerConsumer } = context;
  useLayoutEffect(() => registerConsumer({
    get rawInputId() { return consumerRef.current.rawInputId; },
    onRawMessage: (message) => consumerRef.current.onRawMessage?.(message),
    onInputConnectionChange: (change) => consumerRef.current.onInputConnectionChange?.(change),
    onOwnershipChange: (active) => consumerRef.current.onOwnershipChange?.(active),
    onHeldNotesChanged: (notes) => consumerRef.current.onHeldNotesChanged?.(notes),
    onNotePlayed: (midiNumber, attackVelocity, sourceTimeStampMs) => {
      if (sourceTimeStampMs === undefined) consumerRef.current.onNotePlayed?.(midiNumber, attackVelocity);
      else consumerRef.current.onNotePlayed?.(midiNumber, attackVelocity, sourceTimeStampMs);
    },
    onNoteReleased: (release) => consumerRef.current.onNoteReleased?.(release),
    onSustainPedalChanged: (isDown) =>
      consumerRef.current.onSustainPedalChanged?.(isDown),
  }), [registerConsumer]);

  return {
    connectMidi: context.connectMidi,
    deviceName: context.deviceName,
    error: context.error,
    status: context.status,
    connectedInputs: context.connectedInputs,
  };
}
