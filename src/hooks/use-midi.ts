import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { copyRawMidiMessage, describeMidiInput, type MidiInputConnectionChange, type MidiInputInfo, type RawMidiMessage } from "@/lib/midi/midi-transport";

export type MidiConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "unsupported"
  | "error";

export type MidiReleaseObservation = Readonly<{
  midiNumber: number;
  encoding: "note-off" | "note-on-zero";
  releaseVelocity?: number;
  sourceTimeStampMs?: number;
}>;

type UseMidiOptions = Readonly<{
  onHeldNotesChanged?: (heldNotes: ReadonlySet<number>) => void;
  onNotePlayed: (midiNumber: number, attackVelocity?: number, sourceTimeStampMs?: number) => void;
  onNoteReleased?: (release: MidiReleaseObservation) => void;
  onSustainPedalChanged?: (isDown: boolean) => void;
  onRawMessage?: (message: RawMidiMessage) => void;
  onInputConnectionChange?: (change: MidiInputConnectionChange) => void;
}>;

type UseMidiResult = Readonly<{
  connectMidi: () => Promise<void>;
  deviceName: string | null;
  error: string | null;
  status: MidiConnectionStatus;
  connectedInputs: readonly MidiInputInfo[];
}>;

export function useMidi({
  onHeldNotesChanged,
  onNotePlayed,
  onNoteReleased,
  onSustainPedalChanged,
  onRawMessage,
  onInputConnectionChange,
}: UseMidiOptions): UseMidiResult {
  const [status, setStatus] = useState<MidiConnectionStatus>("disconnected");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const connectPromiseRef = useRef<Promise<void> | null>(null);
  const [connectedInputs, setConnectedInputs] = useState<readonly MidiInputInfo[]>(Object.freeze([]));
  const deliverySequenceRef = useRef(0);
  const mountedRef = useRef(false);
  const lifecycleGenerationRef = useRef(0);

  const heldNotesRef = useRef<Set<number>>(new Set());
  const sustainPedalDownRef = useRef(false);
  const onHeldNotesChangedRef = useRef(onHeldNotesChanged);
  const onNotePlayedRef = useRef(onNotePlayed);
  const onNoteReleasedRef = useRef(onNoteReleased);
  const onSustainPedalChangedRef = useRef(onSustainPedalChanged);
  const transportCallbacksRef = useRef({ onRawMessage, onInputConnectionChange });

  useLayoutEffect(() => { transportCallbacksRef.current = { onRawMessage, onInputConnectionChange }; }, [onRawMessage, onInputConnectionChange]);
  useEffect(() => {
    mountedRef.current = true;
    const generation = ++lifecycleGenerationRef.current;
    return () => { mountedRef.current = false; lifecycleGenerationRef.current = generation + 1; };
  }, []);

  useEffect(() => {
    onHeldNotesChangedRef.current = onHeldNotesChanged;
  }, [onHeldNotesChanged]);

  useEffect(() => {
    onNotePlayedRef.current = onNotePlayed;
  }, [onNotePlayed]);

  useEffect(() => {
    onNoteReleasedRef.current = onNoteReleased;
  }, [onNoteReleased]);

  useEffect(() => {
    onSustainPedalChangedRef.current = onSustainPedalChanged;
  }, [onSustainPedalChanged]);

  useEffect(() => {
    if (!midiAccess) {
      return;
    }

    const heldNotes = heldNotesRef.current;
    let live = true;
    const attachedInputs = new Map<MIDIInput, { listener: EventListener; info: MidiInputInfo }>();
    const notifyInput = (input: MidiInputInfo, state: MidiInputConnectionChange["state"]) => {
      transportCallbacksRef.current.onInputConnectionChange?.(Object.freeze({ provenance: "input-availability", input,
        state, receivedAtMs: performance.now() }));
    };

    const publishHeldNotes = () => {
      onHeldNotesChangedRef.current?.(new Set(heldNotes));
    };

    const resetSustainPedal = () => {
      if (!sustainPedalDownRef.current) return;
      sustainPedalDownRef.current = false;
      onSustainPedalChangedRef.current?.(false);
    };

    // Keep queued deliveries until the availability notification retires this attachment.
    const currentInput = (input: MIDIInput, info: MidiInputInfo) => live && attachedInputs.get(input)?.info === info;
    const handleMidiMessage = (input: MIDIInput, info: MidiInputInfo, event: MIDIMessageEvent) => {
      const receivedAtMs = performance.now();
      if (!currentInput(input, info)) return;
      const sequence = ++deliverySequenceRef.current;
      const message = copyRawMidiMessage(event, info, sequence, receivedAtMs);
      transportCallbacksRef.current.onRawMessage?.(message);
      // A consumer can synchronously cause teardown while receiving raw evidence.
      if (!currentInput(input, info) || message.dataStatus !== "available") return;
      const data = message.bytes;

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
      if (command === 0xb0 && noteNumber === 64) {
        const isDown = velocity >= 64;
        if (isDown !== sustainPedalDownRef.current) {
          sustainPedalDownRef.current = isDown;
          onSustainPedalChangedRef.current?.(isDown);
        }
        return;
      }
      const isNoteOn = command === 0x90 && velocity > 0;
      const isNoteOff =
        command === 0x80 || (command === 0x90 && velocity === 0);
      const sourceTimeStampMs = Number.isFinite(event.timeStamp) && event.timeStamp >= 0 ? event.timeStamp : undefined;

      if (isNoteOn) {
        heldNotes.add(noteNumber);
        publishHeldNotes();
        // Preserve note handling even for malformed data; only valid MIDI velocities are evidence.
        const attackVelocity = velocity <= 127 ? velocity : undefined;
        if (sourceTimeStampMs === undefined) onNotePlayedRef.current(noteNumber, attackVelocity);
        else onNotePlayedRef.current(noteNumber, attackVelocity, sourceTimeStampMs);
        return;
      }

      if (isNoteOff) {
        heldNotes.delete(noteNumber);
        publishHeldNotes();
        onNoteReleasedRef.current?.({
          midiNumber: noteNumber,
          encoding: command === 0x80 ? "note-off" : "note-on-zero",
          ...(command === 0x80 && velocity <= 127 ? { releaseVelocity: velocity } : {}),
          ...(sourceTimeStampMs === undefined ? {} : { sourceTimeStampMs }),
        });
      }
    };

    const attachInputListeners = () => {
      if (!live) return;
      const availableInputs = new Set(
        Array.from(midiAccess.inputs.values()).filter((input) => input.state !== "disconnected"),
      );
      let detachedInput = false;
      for (const [input, { listener, info }] of attachedInputs) {
        if (!availableInputs.has(input)) {
          input.removeEventListener("midimessage", listener);
          attachedInputs.delete(input);
          detachedInput = true;
          notifyInput(info, "disconnected");
        }
      }
      if (detachedInput && heldNotes.size > 0) {
        heldNotes.clear();
        publishHeldNotes();
      }
      if (detachedInput) resetSustainPedal();
      for (const input of availableInputs) {
        if (!attachedInputs.has(input)) {
          const info = describeMidiInput(input);
          const listener: EventListener = (event) => handleMidiMessage(input, info, event as MIDIMessageEvent);
          attachedInputs.set(input, { listener, info });
          input.addEventListener("midimessage", listener);
          notifyInput(info, "connected");
        }
      }
      const nextInputs = Object.freeze([...attachedInputs.values()].map(({ info }) => info));
      setConnectedInputs((previous) => previous.length === nextInputs.length
        && previous.every((info, index) => info.id === nextInputs[index].id && info.name === nextInputs[index].name)
        ? previous : nextInputs);

      const firstInput = Array.from(availableInputs)[0];

      if (firstInput) {
        setDeviceName(firstInput.name ?? "Unknown MIDI device");
        setStatus("connected");
        setError(null);
      } else {
        heldNotes.clear();
        publishHeldNotes();
        resetSustainPedal();

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
      live = false;
      midiAccess.removeEventListener("statechange", handleStateChange);

      for (const [input, { listener }] of attachedInputs) {
        input.removeEventListener("midimessage", listener);
      }
      attachedInputs.clear();

      heldNotes.clear();
      resetSustainPedal();
    };
  }, [midiAccess]);

  const connectMidi = useCallback(() => {
    if (!mountedRef.current) return Promise.resolve();
    if (midiAccessRef.current) return Promise.resolve();
    if (connectPromiseRef.current) return connectPromiseRef.current;

    const operation = (async () => {
      const generation = lifecycleGenerationRef.current;
      setError(null);
      setStatus("connecting");

      if (!("requestMIDIAccess" in navigator)) {
        setStatus("unsupported");
        setError("This browser does not support the Web MIDI API.");
        return;
      }

      try {
        const access = await navigator.requestMIDIAccess();
        if (!mountedRef.current || lifecycleGenerationRef.current !== generation) return;
        const inputs = Array.from(access.inputs.values()).filter((input) => input.state !== "disconnected");

        midiAccessRef.current = access;
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
        if (!mountedRef.current || lifecycleGenerationRef.current !== generation) return;
        setStatus("error");
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "MIDI access could not be granted.",
        );
      }
    })();
    connectPromiseRef.current = operation;
    void operation.finally(() => {
      if (connectPromiseRef.current === operation) connectPromiseRef.current = null;
    });
    return operation;
  }, []);

  return {
    connectMidi,
    deviceName,
    error,
    status,
    connectedInputs,
  };
}
