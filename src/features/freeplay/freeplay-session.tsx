import { useCallback, useState } from "react";

import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import MidiStatus from "@/components/midi/midi-status";
import FocusStaffControl from "@/components/notation/focus-staff-control";
import MusicStaff from "@/components/notation/music-staff";
import PianoKeyboard from "@/components/notation/piano-keyboard";

import { PIANO_NOTE_DURATION_MS } from "@/features/flashcards/flashcard-timing";
import { useMidi } from "@/hooks/use-midi";
import { playGrandPianoNote } from "@/lib/audio/grand-piano";

const EMPTY_MIDI_NUMBERS: ReadonlySet<number> = new Set();

type FreeplaySessionProps = Readonly<{
  isFocusMode: boolean;
  onToggleFocusMode: () => void;
}>;

export default function FreeplaySession({
  isFocusMode,
  onToggleFocusMode,
}: FreeplaySessionProps) {
  const [virtualHeldNotes, setVirtualHeldNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const [midiHeldNotes, setMidiHeldNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );

  const handleMidiHeldNotesChanged = useCallback(
    (heldNotes: ReadonlySet<number>) => {
      setMidiHeldNotes(new Set(heldNotes));
    },
    [],
  );

  const handleVirtualNoteToggle = useCallback((midiNumber: number) => {
    setVirtualHeldNotes((currentNotes) => {
      const nextNotes = new Set(currentNotes);

      if (nextNotes.has(midiNumber)) {
        nextNotes.delete(midiNumber);
      } else {
        nextNotes.add(midiNumber);
        playGrandPianoNote(midiNumber, PIANO_NOTE_DURATION_MS);
      }

      return nextNotes;
    });
  }, []);

  const { connectMidi, deviceName, error, status } = useMidi({
    onHeldNotesChanged: handleMidiHeldNotesChanged,
    onNotePlayed: () => {
      // MIDI note state is handled through onHeldNotesChanged.
    },
  });

  const activeMidiNumbers = new Set([...virtualHeldNotes, ...midiHeldNotes]);

  return (
    <div
      className={
        isFocusMode
          ? "focus-staff-mode fixed inset-0 z-50 flex w-full flex-col gap-4 overflow-auto bg-zinc-950 p-2 sm:p-5"
          : "mx-auto flex w-full max-w-7xl flex-col gap-6"
      }
    >
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="hidden text-sm font-semibold uppercase tracking-wider text-white/60 sm:block">
            Free Play
          </p>

          <h1 className="text-xl font-bold text-white sm:mt-1 sm:text-3xl">
            Prelude: MIDI Mentor
          </h1>
        </div>

        <MidiStatus
          deviceName={deviceName}
          error={error}
          onConnect={() => {
            void connectMidi();
          }}
          status={status}
        />
      </header>

      <div className="practice-stage">
        <section className="relative flex min-h-0 flex-col justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:gap-4 sm:p-5">
          <div className="absolute bottom-3 right-3 z-20">
            <FocusStaffControl
              isFocusMode={isFocusMode}
              onToggle={onToggleFocusMode}
            />
          </div>

          <div className="px-4 text-center sm:px-20 pointer-events-none">
            <p className="text-sm font-semibold text-white/60">
              Play your MIDI keyboard or select notes on the virtual piano.
            </p>

            <p className="mt-1 text-sm text-white/40">
              Currently held notes appear on the staff.
            </p>
          </div>

          <MusicStaff
            heldMidiNumbers={activeMidiNumbers}
            isFocusMode={isFocusMode}
          />
        </section>

        <div hidden={isFocusMode}>
          <PianoKeyboard
            activeMidiNumbers={activeMidiNumbers}
            failedMidiNumbers={EMPTY_MIDI_NUMBERS}
            lastAnswer={null}
            onNoteToggle={handleVirtualNoteToggle}
            targetMidiNumbers={EMPTY_MIDI_NUMBERS}
            visualMode="freeplay"
          />
        </div>
      </div>

      <div
        className="w-full md:max-w-[calc(50%-0.5rem)] xl:max-w-[29.5%]"
        hidden={isFocusMode}
      >
        <InstrumentVolumeControl
          onReplayCorrectVirtualChordsChange={() => {
            // Free Play does not use automatic chord replay.
          }}
          replayCorrectVirtualChords={false}
        />
      </div>
    </div>
  );
}
