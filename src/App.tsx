import { useState } from "react";

import FlashcardSession from "./features/flashcards/components/flashcard-session";
import SequenceSession from "./features/sequences/components/sequence-session";
import FreeplaySession from "./features/freeplay/freeplay-session";
import EarTrainingSession from "./features/ear-training/components/ear-training-session";
import StaffBuilderSession from "./features/staff-builder/components/staff-builder-session";
import { useFocusMode } from "./hooks/use-focus-mode";
import { MidiProvider } from "./components/midi/midi-provider";

type PracticeSection = "flashcards" | "sequence" | "freeplay" | "ear-training" | "staff-builder";

export default function App() {
  const [practiceSection, setPracticeSection] =
    useState<PracticeSection>("freeplay");
  const { exitFocusMode, isFocusMode, toggleFocusMode } = useFocusMode(
    practiceSection !== "ear-training" && practiceSection !== "staff-builder",
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

    default:
      content = null;
  }

  return (
    <MidiProvider><main className="min-h-screen bg-zinc-950 p-2 sm:p-5 lg:p-10">
      <nav
        aria-label="Prelude modes"
        className="mx-auto mb-4 flex w-full max-w-7xl flex-wrap gap-2"
        hidden={isFocusMode}
      >
        <button
          aria-pressed={practiceSection === "freeplay"}
          className={`rounded px-4 py-2 transition ${
            practiceSection === "freeplay"
              ? "bg-sky-500 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => setPracticeSection("freeplay")}
          type="button"
        >
          Free Play
        </button>

        <button
          aria-pressed={practiceSection === "staff-builder"}
          className={`rounded px-4 py-2 transition ${
            practiceSection === "staff-builder"
              ? "bg-sky-500 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => {
            exitFocusMode();
            setPracticeSection("staff-builder");
          }}
          type="button"
        >
          Staff Builder
        </button>

        <button
          aria-pressed={practiceSection === "flashcards"}
          className={`prelude-mode-group-start rounded px-4 py-2 transition ${
            practiceSection === "flashcards"
              ? "bg-sky-500 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => setPracticeSection("flashcards")}
          type="button"
        >
          Flashcards
        </button>

        <button
          aria-pressed={practiceSection === "sequence"}
          className={`rounded px-4 py-2 transition ${
            practiceSection === "sequence"
              ? "bg-sky-500 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => setPracticeSection("sequence")}
          type="button"
        >
          Sequences
        </button>

        <button
          aria-pressed={practiceSection === "ear-training"}
          className={`rounded px-4 py-2 transition ${
            practiceSection === "ear-training"
              ? "bg-sky-500 text-white"
              : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => {
            exitFocusMode();
            setPracticeSection("ear-training");
          }}
          type="button"
        >
          Ear Training
        </button>
      </nav>

      {content}
    </main></MidiProvider>
  );
}
