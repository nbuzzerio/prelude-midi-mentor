import { lazy, Suspense, useCallback, useRef, useState } from "react";

import FlashcardSession from "./features/flashcards/components/flashcard-session";
import SequenceSession from "./features/sequences/components/sequence-session";
import FreeplaySession from "./features/freeplay/freeplay-session";
import EarTrainingSession from "./features/ear-training/components/ear-training-session";
import StaffBuilderSession from "./features/staff-builder/components/staff-builder-session";
import { useFocusMode } from "./hooks/use-focus-mode";
import { MidiProvider } from "./components/midi/midi-provider";
import MelodySession from "./features/melody/components/melody-session";
import PracticeSessionBuilder from "./features/practice-session/components/practice-session-builder";
import MidiDiagnostic from "./components/midi/midi-diagnostic";
import TunerSession from "./features/tuner/components/tuner-session";
import type { ImprovDepartureGuard } from "./features/improv/components/improv-workspace";
import { version } from "../package.json";
import { RUNNING_BUILD } from "./lib/build-identity";
import type { PwaUpdateController } from "./lib/pwa/register-service-worker";
import { AppUpdateNotices } from "./features/app-update/components/app-update-notices";
import { ExportSettingsDialog } from "./components/export-settings-dialog";

type PracticeSection = "flashcards" | "sequence" | "freeplay" | "ear-training" | "staff-builder" | "melody" | "practice-session" | "midi-diagnostic" | "tuner" | "improv";
const ImprovWorkspace = lazy(() => import("./features/improv/components/improv-workspace"));

export default function App({ pwaUpdate }: Readonly<{ pwaUpdate?: PwaUpdateController }> = {}) {
  const [practiceSection, setPracticeSection] =
    useState<PracticeSection>("freeplay");
  const [practiceRunActive, setPracticeRunActive] = useState(false);
  const [exportsOpen, setExportsOpen] = useState(false);
  const audioDepartureGuard = useRef<(() => boolean) | null>(null);
  const registerAudioDepartureGuard = useCallback((guard: (() => boolean) | null) => { audioDepartureGuard.current = guard; }, []);
  const improvDepartureGuard = useRef<ImprovDepartureGuard | null>(null);
  const registerImprovGuard = useCallback((guard: ImprovDepartureGuard | null) => { improvDepartureGuard.current = guard; }, []);
  const changeSection = (next: PracticeSection) => {
    if (next === practiceSection) return;
    if (practiceSection === "staff-builder" && audioDepartureGuard.current && !audioDepartureGuard.current()) return;
    if (practiceSection === "improv" && improvDepartureGuard.current) {
      improvDepartureGuard.current(() => { exitFocusMode(); setPracticeSection(next); }); return;
    }
    exitFocusMode();
    setPracticeSection(next);
  };
  const { exitFocusMode, isFocusMode, toggleFocusMode } = useFocusMode(
    practiceSection !== "ear-training" && practiceSection !== "staff-builder" && practiceSection !== "melody" && practiceSection !== "practice-session" && practiceSection !== "tuner" && practiceSection !== "improv",
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
      content = <StaffBuilderSession microphoneAvailable={!practiceRunActive} onAudioGuardChange={registerAudioDepartureGuard} />;
      break;

    case "melody":
      content = <MelodySession />;
      break;

    case "practice-session":
      content = null;
      break;

    case "midi-diagnostic":
      content = <MidiDiagnostic />;
      break;

    case "tuner":
      content = <TunerSession available={!practiceRunActive} />;
      break;

    case "improv":
      content = <Suspense fallback={<p role="status" className="p-4 text-white">Opening Improv…</p>}><ImprovWorkspace available={!practiceRunActive} onGuardChange={registerImprovGuard} /></Suspense>;
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
          onClick={() => changeSection("freeplay")}
          type="button"
        >
          Free Play
        </button>

        <button aria-pressed={practiceSection === "improv"} className={`prelude-mode-button shrink-0 rounded border px-3 py-2 transition sm:px-4 ${practiceSection === "improv" ? "border-white bg-sky-700 font-bold text-white" : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`} onClick={() => changeSection("improv")} type="button">Improv</button>

        <button
          aria-pressed={practiceSection === "staff-builder"}
          aria-label="Staff Builder"
          className={`prelude-mode-button shrink-0 rounded border px-3 py-2 transition sm:px-4 ${
            practiceSection === "staff-builder"
              ? "border-white bg-sky-500 font-bold text-white"
              : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => changeSection("staff-builder")}
          type="button"
        >
          <span className="sm:hidden">Staff</span>
          <span className="hidden sm:inline">Staff Builder</span>
        </button>

        <button
          aria-pressed={practiceSection === "practice-session"}
          aria-label="Practice Sessions"
          className={`prelude-mode-button shrink-0 rounded border px-3 py-2 transition sm:px-4 ${practiceSection === "practice-session" ? "border-white bg-sky-500 font-bold text-white" : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          onClick={() => changeSection("practice-session")}
          type="button"
        >
          <span className="sm:hidden">Sessions</span>
          <span className="hidden sm:inline">Practice Sessions</span>
        </button>

        <button
          aria-pressed={practiceSection === "flashcards"}
          className={`prelude-mode-button prelude-mode-group-start shrink-0 rounded border px-3 py-2 transition sm:px-4 ${
            practiceSection === "flashcards"
              ? "border-white bg-sky-500 font-bold text-white"
              : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
          }`}
          onClick={() => changeSection("flashcards")}
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
          onClick={() => changeSection("sequence")}
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
          onClick={() => changeSection("ear-training")}
          type="button"
        >
          <span className="sm:hidden">Ear</span>
          <span className="hidden sm:inline">Ear Training</span>
        </button>

        <button
          aria-pressed={practiceSection === "melody"}
          className={`prelude-mode-button shrink-0 rounded border px-3 py-2 transition sm:px-4 ${practiceSection === "melody" ? "border-white bg-sky-500 font-bold text-white" : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          onClick={() => changeSection("melody")}
          type="button"
        >
          Melody
        </button>

        <button
          aria-label="Chromatic Tuner"
          aria-pressed={practiceSection === "tuner"}
          className={`prelude-mode-button shrink-0 rounded border px-3 py-2 transition sm:px-4 ${practiceSection === "tuner" ? "border-white bg-sky-500 font-bold text-white" : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          onClick={() => changeSection("tuner")}
          type="button"
        >
          Tuner
        </button>

        <button
          aria-label="MIDI Diagnostic"
          aria-pressed={practiceSection === "midi-diagnostic"}
          className={`prelude-mode-button shrink-0 rounded border px-3 py-2 transition sm:px-4 ${practiceSection === "midi-diagnostic" ? "border-white bg-sky-500 font-bold text-white" : "border-transparent bg-zinc-800 text-zinc-300 hover:bg-zinc-700"}`}
          onClick={() => changeSection("midi-diagnostic")}
          type="button"
        >
          <span className="sm:hidden">MIDI</span>
          <span className="hidden sm:inline">MIDI Diagnostic</span>
        </button>

        <button type="button" className="prelude-mode-button shrink-0 rounded border border-transparent bg-zinc-800 px-3 py-2 text-zinc-300 hover:bg-zinc-700" aria-haspopup="dialog" onClick={() => setExportsOpen(true)}>Settings</button>
        <span
          aria-label={`Prelude v${version}`}
          className="shrink-0 self-center px-1 text-xs text-zinc-500"
          title={`Prelude v${version}`}
        >
          Prelude v{version}
        </span>
        <details className="shrink-0 self-center text-xs text-zinc-400">
          <summary className="cursor-pointer rounded px-1 py-2 focus-visible:outline focus-visible:outline-sky-300">Build details</summary>
          <p aria-label="Running build" title={RUNNING_BUILD.detail} className="max-w-xs break-words p-2">{RUNNING_BUILD.label}. {RUNNING_BUILD.detail}</p>
        </details>
      </nav>

      <div hidden={practiceSection !== "practice-session"}>
        <PracticeSessionBuilder active={practiceSection === "practice-session"} onActiveRunChange={setPracticeRunActive} />
      </div>
      {content}
      <AppUpdateNotices controller={pwaUpdate} />
      {exportsOpen && <ExportSettingsDialog onClose={() => setExportsOpen(false)} />}
    </main></MidiProvider>
  );
}
