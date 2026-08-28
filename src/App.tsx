import { useState } from "react";

import FlashcardSession from "./features/flashcards/components/flashcard-session";
import SequenceSession from "./features/sequences/components/sequence-session";
import FreeplaySession from "./features/freeplay/freeplay-session";
import EarTrainingSession from "./features/ear-training/components/ear-training-session";
import StaffBuilderSession from "./features/staff-builder/components/staff-builder-session";
import { useFocusMode } from "./hooks/use-focus-mode";
import { MidiProvider } from "./components/midi/midi-provider";
import MelodySession from "./features/melody/components/melody-session";
import { version } from "../package.json";

type PracticeSection = "flashcards" | "sequence" | "freeplay" | "ear-training" | "staff-builder" | "melody";

export default function App() {
  const [practiceSection, setPracticeSection] =
    useState<PracticeSection>("freeplay");
  const { exitFocusMode, isFocusMode, toggleFocusMode } = useFocusMode(
    practiceSection !== "ear-training" && practiceSection !== "staff-builder" && practiceSection !== "melody",
  );

  let content;

  switch (practiceSection) {
    case "flashcards":
      content = (
        <FlashcardSession
          isFocusMode={isFocusMode}
          onToggleFocusMode={toggleFocusMode}
        />
      );
      break;

    case "sequence":
      content = (
        <SequenceSession
          isFocusMode={isFocusMode}
          onToggleFocusMode={toggleFocusMode}
        />
      );
      break;

    case "freeplay":
      content = (
        <FreeplaySession
          isFocusMode={isFocusMode}
          onToggleFocusMode={toggleFocusMode}
        />
      );
      break;

    case "ear-training":
      content = <EarTrainingSession />;
      break;

    case "staff-builder":
      content = <StaffBuilderSession />;
      break;

    case "melody":
      content = <MelodySession />;
      break;

    default:
      content = null;
  }

  return (
    <MidiProvider><main className="min-h-screen bg-zinc-950 p-2 sm:p-5 lg:p-10">
      <nav
        aria-label="Prelude modes"
        className="prelude-mode-nav mx-auto mb-4 flex w-full max-w-7xl flex-nowrap gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible"
        hidden={isFocusMode}
        onFocus={(event) => {
          const focusedButton = (event.target as HTMLElement).closest("button");
          focusedButton?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
        }}
      >
        <button
          aria-pressed={practiceSection === "freeplay"}
          className={`prelude-mode-button shrink-0 rounded border px-3 py-2 transition sm:px-4 ${
            practiceSection === "freeplay"
              ? "border-white bg-sky-500 font-bold text-white"
              : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => setPracticeSection("freeplay")}
          type="button"
        >
          Free Play
        </button>

        <button
          aria-pressed={practiceSection === "staff-builder"}
          aria-label="Staff Builder"
          className={`prelude-mode-button shrink-0 rounded border px-3 py-2 transition sm:px-4 ${
            practiceSection === "staff-builder"
              ? "border-white bg-sky-500 font-bold text-white"
              : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => {
            exitFocusMode();
            setPracticeSection("staff-builder");
          }}
          type="button"
        >
          <span className="sm:hidden">Staff</span>
          <span className="hidden sm:inline">Staff Builder</span>
        </button>

        <button
          aria-pressed={practiceSection === "flashcards"}
          className={`prelude-mode-button prelude-mode-group-start shrink-0 rounded border px-3 py-2 transition sm:px-4 ${
            practiceSection === "flashcards"
              ? "border-white bg-sky-500 font-bold text-white"
              : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => setPracticeSection("flashcards")}
          type="button"
        >
          Flashcards
        </button>

        <button
          aria-pressed={practiceSection === "sequence"}
          className={`prelude-mode-button shrink-0 rounded border px-3 py-2 transition sm:px-4 ${
            practiceSection === "sequence"
              ? "border-white bg-sky-500 font-bold text-white"
              : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => setPracticeSection("sequence")}
          type="button"
        >
          Sequences
        </button>

        <button
          aria-pressed={practiceSection === "ear-training"}
          aria-label="Ear Training"
          className={`prelude-mode-button shrink-0 rounded border px-3 py-2 transition sm:px-4 ${
            practiceSection === "ear-training"
              ? "border-white bg-sky-500 font-bold text-white"
              : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => {
            exitFocusMode();
            setPracticeSection("ear-training");
          }}
          type="button"
        >
          <span className="sm:hidden">Ear</span>
          <span className="hidden sm:inline">Ear Training</span>
        </button>

        <button
          aria-pressed={practiceSection === "melody"}
          className={`prelude-mode-button shrink-0 rounded border px-3 py-2 transition sm:px-4 ${practiceSection === "melody" ? "border-white bg-sky-500 font-bold text-white" : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          onClick={() => { exitFocusMode(); setPracticeSection("melody"); }}
          type="button"
        >
          Melody
        </button>

        <span
          aria-label={`Prelude v${version}`}
          className="shrink-0 self-center px-1 text-xs text-zinc-500"
          title={`Prelude v${version}`}
        >
          v{version}
        </span>
      </nav>

      {content}
    </main></MidiProvider>
  );
}
