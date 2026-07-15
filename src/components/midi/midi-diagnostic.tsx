"use client";

import { useEffect, useState } from "react";

type PlayedNote = Readonly<{
  midiNumber: number;
  name: string;
  velocity: number;
}>;

const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "D♯",
  "E",
  "F",
  "F♯",
  "G",
  "G♯",
  "A",
  "A♯",
  "B",
] as const;

function getNoteName(midiNumber: number): string {
  const noteName = NOTE_NAMES[midiNumber % 12];
  const octave = Math.floor(midiNumber / 12) - 1;

  return `${noteName}${octave}`;
}

export default function MidiDiagnostic() {
  const [status, setStatus] = useState("Not connected");
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [playedNote, setPlayedNote] = useState<PlayedNote | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);

  useEffect(() => {
    if (!midiAccess) {
      return;
    }

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

      if (!isNoteOn) {
        return;
      }

      setPlayedNote({
        midiNumber: noteNumber,
        name: getNoteName(noteNumber),
        velocity,
      });
    };

    const inputs = Array.from(midiAccess.inputs.values());

    for (const input of inputs) {
      input.addEventListener("midimessage", handleMidiMessage);
    }

    return () => {
      for (const input of inputs) {
        input.removeEventListener("midimessage", handleMidiMessage);
      }
    };
  }, [midiAccess]);

  const connectMidi = async () => {
    setError(null);
    setStatus("Connecting…");

    if (!("requestMIDIAccess" in navigator)) {
      setStatus("Unsupported");
      setError("This browser does not support the Web MIDI API.");
      return;
    }

    try {
      const access = await navigator.requestMIDIAccess();
      const inputs = Array.from(access.inputs.values());

      if (inputs.length === 0) {
        setStatus("No MIDI input found");
        setDeviceName(null);
        setError(
          "Connect the keyboard, verify it is powered on, and try again.",
        );
        return;
      }

      setMidiAccess(access);
      setDeviceName(inputs[0]?.name ?? "Unknown MIDI device");
      setStatus("Connected");
    } catch (caughtError: unknown) {
      setStatus("Connection failed");
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "MIDI access could not be granted.",
      );
    }
  };

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6 rounded-2xl border border-black/10 p-6 shadow-sm">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-white/60">
          MIDI diagnostic
        </p>
        <h1 className="mt-1 text-3xl font-semibold">Prelude: MIDI Mentor</h1>
      </div>

      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
        <dt className="font-medium">Status</dt>
        <dd>{status}</dd>

        <dt className="font-medium">Device</dt>
        <dd>{deviceName ?? "None"}</dd>
      </dl>

      <button
        className="rounded-lg bg-black px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={status === "Connecting…"}
        onClick={connectMidi}
        type="button"
      >
        {status === "Connected" ? "Reconnect MIDI" : "Connect MIDI"}
      </button>

      {error ? (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
      ) : null}

      <div className="min-h-36 rounded-xl bg-black/5 p-6 text-center">
        {playedNote ? (
          <>
            <p className="text-5xl font-semibold">{playedNote.name}</p>
            <p className="mt-3 text-sm text-white/60">
              MIDI {playedNote.midiNumber} · Velocity {playedNote.velocity}
            </p>
          </>
        ) : (
          <p className="text-white/60">
            Connect your keyboard, then press a key.
          </p>
        )}
      </div>
    </section>
  );
}
