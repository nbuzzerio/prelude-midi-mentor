import { useState } from "react";

import FlashcardSession from "@/components/flashcards/flashcard-session";
import SequenceSession from "@/components/sequence/sequence-session";

type PracticeSection = "flashcards" | "sequence";

export default function App() {
  const [practiceSection, setPracticeSection] =
    useState<PracticeSection>("flashcards");

  return (
    <main className="min-h-screen bg-zinc-950 p-2 sm:p-5 lg:p-10">
      <div className="mx-auto mb-4 flex w-full max-w-7xl gap-2">
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
          Sequence
        </button>
      </div>

      {practiceSection === "flashcards" ? (
        <FlashcardSession />
      ) : (
        <SequenceSession />
      )}
    </main>
  );
}
