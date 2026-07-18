import { useCallback, useEffect, useRef, useState } from "react";

type MidiConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "unsupported"
  | "error";

type UseMidiOptions = Readonly<{
  onHeldNotesChanged?: (heldNotes: ReadonlySet<number>) => void;
  onNotePlayed: (midiNumber: number) => void;
}>;

type UseMidiResult = Readonly<{
  connectMidi: () => Promise<void>;
  deviceName: string | null;
  error: string | null;
  status: MidiConnectionStatus;
}>;

export function useMidi({
  onHeldNotesChanged,
  onNotePlayed,
}: UseMidiOptions): UseMidiResult {
  const [status, setStatus] = useState<MidiConnectionStatus>("disconnected");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);

  const heldNotesRef = useRef<Set<number>>(new Set());
  const onHeldNotesChangedRef = useRef(onHeldNotesChanged);
  const onNotePlayedRef = useRef(onNotePlayed);

  useEffect(() => {
    onHeldNotesChangedRef.current = onHeldNotesChanged;
  }, [onHeldNotesChanged]);

  useEffect(() => {
    onNotePlayedRef.current = onNotePlayed;
  }, [onNotePlayed]);

  useEffect(() => {
    if (!midiAccess) {
      return;
    }

    const heldNotes = heldNotesRef.current;

    const publishHeldNotes = () => {
      onHeldNotesChangedRef.current?.(new Set(heldNotes));
    };

    const handleMidiMessage = (event: MIDIMessageEvent) => {
      const data = event.data;

      if (!data || data.length < 3) {
        return;
      }

      const statusByte = data[0];
      const noteNumber = data[1];
      const velocity = data[2];

      if (
        statusByte === undefined ||
        noteNumber === undefined ||
        velocity === undefined
      ) {
        return;
      }

      const command = statusByte & 0xf0;
      const isNoteOn = command === 0x90 && velocity > 0;
      const isNoteOff =
        command === 0x80 || (command === 0x90 && velocity === 0);

      if (isNoteOn) {
        heldNotes.add(noteNumber);
        publishHeldNotes();
        onNotePlayedRef.current(noteNumber);
        return;
      }

      if (isNoteOff) {
        heldNotes.delete(noteNumber);
        publishHeldNotes();
      }
    };

    const attachInputListeners = () => {
      for (const input of midiAccess.inputs.values()) {
        input.removeEventListener("midimessage", handleMidiMessage);
        input.addEventListener("midimessage", handleMidiMessage);
      }

      const firstInput = Array.from(midiAccess.inputs.values())[0];

      if (firstInput) {
        setDeviceName(firstInput.name ?? "Unknown MIDI device");
        setStatus("connected");
        setError(null);
      } else {
        heldNotes.clear();
        publishHeldNotes();

        setDeviceName(null);
        setStatus("disconnected");
      }
    };

    const handleStateChange = () => {
      attachInputListeners();
    };

    attachInputListeners();
    midiAccess.addEventListener("statechange", handleStateChange);

    return () => {
      midiAccess.removeEventListener("statechange", handleStateChange);

      for (const input of midiAccess.inputs.values()) {
        input.removeEventListener("midimessage", handleMidiMessage);
      }

      heldNotes.clear();
    };
  }, [midiAccess]);

  const connectMidi = useCallback(async () => {
    setError(null);
    setStatus("connecting");

    if (!("requestMIDIAccess" in navigator)) {
      setStatus("unsupported");
      setError("This browser does not support the Web MIDI API.");
      return;
    }

    try {
      const access = await navigator.requestMIDIAccess();
      const inputs = Array.from(access.inputs.values());

      setMidiAccess(access);

      if (inputs.length === 0) {
        setDeviceName(null);
        setStatus("disconnected");
        setError(
          "No MIDI input was found. Check the keyboard connection and try again.",
        );
        return;
      }

      setDeviceName(inputs[0]?.name ?? "Unknown MIDI device");
      setStatus("connected");
    } catch (caughtError: unknown) {
      setStatus("error");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "MIDI access could not be granted.",
      );
    }
  }, []);

  return {
    connectMidi,
    deviceName,
    error,
    status,
  };
}
