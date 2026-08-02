import { useState } from "react";

import FlashcardSession from "./features/flashcards/components/flashcard-session";
import SequenceSession from "./features/sequences/components/sequence-session";
import FreeplaySession from "./features/freeplay/freeplay-session";
import { useFocusMode } from "./hooks/use-focus-mode";

type PracticeSection = "flashcards" | "sequence" | "freeplay";

export default function App() {
  const { isFocusMode, toggleFocusMode } = useFocusMode();

  const [practiceSection, setPracticeSection] =
    useState<PracticeSection>("freeplay");

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

    default:
      content = null;
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-2 sm:p-5 lg:p-10">
      <div
        className="mx-auto mb-4 flex w-full max-w-7xl gap-2"
        hidden={isFocusMode}
      >
        <button
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
          className={`rounded px-4 py-2 transition ${
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
      </div>

      {content}
    </main>
  );
}
