import { useCallback, useEffect, useRef, useState } from "react";

import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import MidiStatus from "@/components/midi/midi-status";
import FocusStaffControl from "@/components/notation/focus-staff-control";
import MusicStaff from "@/components/notation/music-staff";
import PianoKeyboard from "@/components/notation/piano-keyboard";

import { PIANO_NOTE_DURATION_MS } from "@/features/flashcards/flashcard-timing";
import FreeplayControls from "@/features/freeplay/components/freeplay-controls";
import {
  DEFAULT_FREEPLAY_NOTATION_CONTEXT,
  spellFreeplayMidiNumbers,
  type FreeplayChromaticPreference,
  type FreeplayNotationContext,
} from "@/features/freeplay/freeplay-notation";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import { useMobilePlay } from "@/hooks/use-mobile-play";
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
  const [notationContext, setNotationContext] =
    useState<FreeplayNotationContext>(DEFAULT_FREEPLAY_NOTATION_CONTEXT);
  const [chromaticPreference, setChromaticPreference] =
    useState<FreeplayChromaticPreference>("automatic");
  const [pointerKeyboardEpoch, setPointerKeyboardEpoch] = useState(0);
  const [virtualHeldNotes, setVirtualHeldNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const [momentaryPointerNotes, setMomentaryPointerNotes] = useState<
    ReadonlySet<number>
  >(new Set());

  const [midiHeldNotes, setMidiHeldNotes] = useState<ReadonlySet<number>>(
    new Set(),
  );
  const momentaryPointerNotesRef = useRef(new Set<number>());
  const { enterMobilePlay, exitMobilePlay, isMobilePlayMode } = useMobilePlay();

  const clearMomentaryPointerNotes = useCallback(() => {
    momentaryPointerNotesRef.current = new Set();
    setMomentaryPointerNotes(new Set());
    setPointerKeyboardEpoch((currentEpoch) => currentEpoch + 1);
  }, []);

  const deactivateMobilePlay = useCallback(() => {
    clearMomentaryPointerNotes();
    exitMobilePlay();
  }, [clearMomentaryPointerNotes, exitMobilePlay]);

  const handleEnterMobilePlay = useCallback(() => {
    if (isFocusMode) {
      onToggleFocusMode();
    }

    enterMobilePlay();
  }, [enterMobilePlay, isFocusMode, onToggleFocusMode]);

  const handleFocusModeToggle = useCallback(() => {
    if (isMobilePlayMode) {
      deactivateMobilePlay();
    }

    onToggleFocusMode();
  }, [deactivateMobilePlay, isMobilePlayMode, onToggleFocusMode]);

  const handleMomentaryNotePress = useCallback((midiNumber: number) => {
    setMomentaryPointerNotes((currentNotes) => {
      if (currentNotes.has(midiNumber)) {
        return currentNotes;
      }

      const nextNotes = new Set(currentNotes);
      nextNotes.add(midiNumber);
      momentaryPointerNotesRef.current = nextNotes;
      playGrandPianoNote(midiNumber, PIANO_NOTE_DURATION_MS);
      return nextNotes;
    });
  }, []);

  const handleMomentaryNoteRelease = useCallback((midiNumber: number) => {
    setMomentaryPointerNotes((currentNotes) => {
      if (!currentNotes.has(midiNumber)) {
        return currentNotes;
      }

      const nextNotes = new Set(currentNotes);
      nextNotes.delete(midiNumber);
      momentaryPointerNotesRef.current = nextNotes;
      return nextNotes;
    });
  }, []);

  useEffect(() => {
    if (!isFocusMode || !isMobilePlayMode) {
      return;
    }

    const cleanupTimer = window.setTimeout(deactivateMobilePlay, 0);

    return () => {
      window.clearTimeout(cleanupTimer);
    };
  }, [deactivateMobilePlay, isFocusMode, isMobilePlayMode]);

  useEffect(
    () => () => {
      momentaryPointerNotesRef.current.clear();
    },
    [],
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

  const { connectMidi, deviceName, error, status } = useAppMidiInput({
    onHeldNotesChanged: handleMidiHeldNotesChanged,
    onNotePlayed: () => {
      // MIDI note state is handled through onHeldNotesChanged.
    },
  });

  const isMobilePlayActive = isMobilePlayMode && !isFocusMode;
  const activeMidiNumbers = new Set([
    ...virtualHeldNotes,
    ...momentaryPointerNotes,
    ...midiHeldNotes,
  ]);
  const spelledNotes =
    spellFreeplayMidiNumbers({
      context: notationContext,
      midiNumbers: activeMidiNumbers,
      preference: chromaticPreference,
    }) ?? [];

  return (
    <div
      className={
        isMobilePlayActive
          ? "mobile-play-mode fixed inset-0 z-50 grid w-full overflow-hidden bg-zinc-950"
          : isFocusMode
            ? "focus-staff-mode fixed inset-0 z-50 flex w-full flex-col gap-4 overflow-auto bg-zinc-950 p-2 sm:p-5"
            : "mx-auto flex w-full max-w-7xl flex-col gap-6"
      }
    >
      <header
        className="flex items-center justify-between gap-4"
        hidden={isMobilePlayActive}
      >
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

      {isMobilePlayActive ? (
        <>
          <button
            className="mobile-play-exit rounded-lg border border-sky-400/60 bg-zinc-950/95 px-3 py-2 text-sm font-semibold text-sky-100 shadow-lg"
            onClick={deactivateMobilePlay}
            type="button"
          >
            Exit Mobile Play
          </button>

        </>
      ) : null}

      <div className="practice-stage">
        <section className="relative flex min-h-0 flex-col justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:gap-4 sm:p-5">
          <div
            className="freeplay-task-actions flex flex-wrap justify-end gap-2"
            hidden={isMobilePlayActive}
          >
            <FocusStaffControl
              isFocusMode={isFocusMode}
              onToggle={handleFocusModeToggle}
            />

            {!isFocusMode ? (
              <button
                className="practice-mobile-play-entry rounded-lg border border-sky-400/50 bg-zinc-950/90 px-3 py-2 text-sm font-semibold text-sky-100 shadow-sm hover:bg-sky-400/15"
                onClick={handleEnterMobilePlay}
                type="button"
              >
                Mobile Play
              </button>
            ) : null}
          </div>

          <div
            className="px-4 text-center sm:px-20 pointer-events-none"
            hidden={isMobilePlayActive}
          >
            <p className="text-sm font-semibold text-white/60">
              Play your MIDI keyboard or select notes on the virtual piano.
            </p>

            <p className="mt-1 text-sm text-white/40">
              Currently held notes appear on the staff.
            </p>
          </div>

          <MusicStaff
            heldNotes={spelledNotes}
            isFocusMode={isFocusMode}
            isMobilePlayMode={isMobilePlayActive}
            keySignatureId={
              notationContext.type === "key" ? notationContext.keyId : undefined
            }
            mode="freeplay"
          />
        </section>

        <div className="mobile-play-keyboard-region" hidden={isFocusMode}>
          <PianoKeyboard
            activeMidiNumbers={activeMidiNumbers}
            failedMidiNumbers={EMPTY_MIDI_NUMBERS}
            key={pointerKeyboardEpoch}
            lastAnswer={null}
            onNotePress={handleMomentaryNotePress}
            onNoteRelease={handleMomentaryNoteRelease}
            onNoteToggle={handleVirtualNoteToggle}
            targetMidiNumbers={EMPTY_MIDI_NUMBERS}
            visualMode="freeplay"
          />
        </div>
      </div>

      <div
        className="grid w-full gap-4 md:grid-cols-2"
        hidden={isFocusMode || isMobilePlayActive}
      >
        <FreeplayControls
          chromaticPreference={chromaticPreference}
          onChromaticPreferenceChange={setChromaticPreference}
          notationContext={notationContext}
          onNotationContextChange={setNotationContext}
        />

        <div className="w-full">
          <InstrumentVolumeControl
            onReplayCorrectVirtualChordsChange={() => {
              // Free Play does not use automatic chord replay.
            }}
            replayCorrectVirtualChords={false}
          />
        </div>
      </div>
    </div>
  );
}
