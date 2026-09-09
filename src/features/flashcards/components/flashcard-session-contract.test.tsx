import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, useState, type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type PianoKeyboard from "@/components/notation/piano-keyboard";
import type { AppMidiConsumer } from "@/components/midi/midi-context";
const observed = vi.hoisted(() => ({ card: vi.fn(), keyboard: vi.fn(), midi: vi.fn() }));
vi.mock("@/components/notation/piano-keyboard", () => ({ default: (props: unknown) => { observed.keyboard(props); return null; } }));
vi.mock("@/hooks/use-app-midi-input", () => ({ useAppMidiInput: (consumer: unknown) => { observed.midi(consumer); return { connectMidi: vi.fn(), status: "disconnected", deviceName: null, error: null }; } }));
vi.mock("@/components/audio/feedback-volume-control", () => ({ default: () => null }));
vi.mock("@/components/audio/instrument-volume-control", () => ({ default: () => null }));
vi.mock("@/components/midi/midi-status", () => ({ default: () => null }));
vi.mock("@/lib/audio/feedback", () => ({ playSuccessChirp: vi.fn(), playIncorrectFeedback: vi.fn() }));
vi.mock("@/lib/audio/grand-piano", () => ({ playGrandPianoNote: vi.fn(), playGrandPianoChord: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); vi.useFakeTimers(); vi.spyOn(Math, "random").mockReturnValue(0); });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
const focusProps = { isFocusMode: false, onToggleFocusMode: () => {} };
function play(note: number) { act(() => (observed.keyboard.mock.lastCall![0] as ComponentProps<typeof PianoKeyboard>).onNoteToggle(note)); }
function midi(note: number) { act(() => (observed.midi.mock.lastCall![0] as AppMidiConsumer).onNotePlayed?.(note)); }
import FlashcardSession from "./flashcard-session";
import type FlashcardCard from "./flashcard-card";
import { DEFAULT_FLASHCARD_CONFIG, flashcardConfigToSettings, type FlashcardConfig } from "../flashcard-config";
import { generatePracticeTarget } from "@/lib/music/notes";
vi.mock("./flashcard-card", () => ({ default: (props: unknown) => { observed.card(props); return null; } }));
vi.mock("@/lib/music/notes", async (original) => {
  const actual = await original<typeof import("@/lib/music/notes")>();
  return { ...actual, generatePracticeTarget: vi.fn(actual.generatePracticeTarget) };
});
function target() { return (observed.card.mock.lastCall![0] as ComponentProps<typeof FlashcardCard>).practiceTarget; }
const noteConfig: FlashcardConfig = { ...DEFAULT_FLASHCARD_CONFIG, mode: "mixed" };
const triadConfig: FlashcardConfig = { ...DEFAULT_FLASHCARD_CONFIG, mode: "treble", enabledExerciseTypes: ["triads"], enabledTriadQualities: ["major", "minor"] };

describe("Flashcard engine contract", () => {
  it.each([noteConfig, triadConfig])("presents only the configured first target and treats props as mount-time", (config) => {
    const view = render(<FlashcardSession {...focusProps} initialConfig={config} />);
    const first = target();
    const settings = flashcardConfigToSettings(config);
    expect(generatePracticeTarget).toHaveBeenCalledExactlyOnceWith(settings.mode, settings.enabledExerciseTypes, settings.enabledNoteCategories, settings.enabledTriadQualities, settings.enabledTriadPositions);
    expect(observed.card.mock.calls.every(([props]) => props.practiceTarget === first)).toBe(true);
    if (config === triadConfig) {
      expect(first.clef).toBe("treble");
      expect(first.notes).toHaveLength(3);
      expect(first.name.secondary).toBe("Root position");
      expect(first.name.primary).toMatch(/Major|Minor/);
    } else {
      expect(["bass", "treble"]).toContain(first.clef);
      expect(first.notes).toHaveLength(1);
      expect([0, 2, 4, 5, 7, 9, 11]).toContain(first.notes[0].midiNumber % 12);
    }
    view.rerender(<FlashcardSession {...focusProps} initialConfig={{ ...config }} />);
    view.rerender(<FlashcardSession {...focusProps} initialConfig={config === noteConfig ? triadConfig : noteConfig} />);
    expect(target()).toBe(first);
    expect(generatePracticeTarget).toHaveBeenCalledTimes(1);
  });
  it("keeps the standalone fixed starter without calling the generator", () => {
    render(<FlashcardSession {...focusProps} />);
    expect(target().notes.map(({ midiNumber }) => midiNumber)).toEqual([48]);
    expect(generatePracticeTarget).not.toHaveBeenCalled();
  });
  it("notifies the latest callback once after wrong then correct, including rapid MIDI repeats", () => {
    const oldCallback = vi.fn(); const currentCallback = vi.fn();
    const view = render(<FlashcardSession {...focusProps} initialConfig={noteConfig} onPracticeUnitCompleted={oldCallback} />);
    const first = target();
    midi(first.notes[0].midiNumber + 1);
    expect(oldCallback).not.toHaveBeenCalled();
    view.rerender(<FlashcardSession {...focusProps} initialConfig={{ ...noteConfig }} onPracticeUnitCompleted={currentCallback} />);
    midi(first.notes[0].midiNumber); midi(first.notes[0].midiNumber);
    expect(currentCallback).toHaveBeenCalledExactlyOnceWith();
    expect(oldCallback).not.toHaveBeenCalled();
    view.unmount(); act(() => vi.runAllTimers());
    expect(currentCallback).toHaveBeenCalledTimes(1);
  });
  it("does not count partial triads or duplicate success in Strict Mode", () => {
    const completed = vi.fn();
    const view = render(<StrictMode><FlashcardSession {...focusProps} initialConfig={triadConfig} onPracticeUnitCompleted={completed} /></StrictMode>);
    const notes = target().notes;
    play(notes[0].midiNumber); play(notes[1].midiNumber);
    expect(completed).not.toHaveBeenCalled();
    play(notes[2].midiNumber); play(notes[2].midiNumber);
    expect(completed).toHaveBeenCalledExactlyOnceWith();
    view.unmount(); act(() => vi.runAllTimers());
    expect(completed).toHaveBeenCalledTimes(1);
  });
  it("does not notify for settings, reset, or automatic advancement", () => {
    const completed = vi.fn();
    render(<FlashcardSession {...focusProps} initialConfig={noteConfig} onPracticeUnitCompleted={completed} />);
    fireEvent.click(screen.getByRole("button", { name: "Treble" }));
    fireEvent.click(screen.getByRole("button", { name: /reset session/i }));
    expect(completed).not.toHaveBeenCalled();
    play(target().notes[0].midiNumber);
    act(() => vi.advanceTimersByTime(3000));
    expect(completed).toHaveBeenCalledTimes(1);
  });
  it("suppresses prescription controls only when hosted", () => {
    const view = render(<FlashcardSession {...focusProps} initialConfig={noteConfig} />);
    expect(screen.getByText("Practice Settings")).toBeTruthy();
    view.rerender(<FlashcardSession {...focusProps} initialConfig={noteConfig} practiceSessionMode />);
    expect(screen.queryByText("Practice Settings")).toBeNull();
    expect(screen.queryByText("Replay completed chords")).toBeNull();
  });
  it("keeps standalone viewport ownership and embeds hosted Mobile Play", () => {
    const standalone = render(<FlashcardSession {...focusProps} initialConfig={noteConfig} />);
    act(() => (observed.card.mock.lastCall![0] as ComponentProps<typeof FlashcardCard>).onEnterMobilePlay?.());
    expect(standalone.container.firstElementChild?.classList.contains("mobile-play-mode")).toBe(true);
    expect(standalone.container.firstElementChild?.classList.contains("fixed")).toBe(true);
    cleanup();
    const hosted = render(<FlashcardSession {...focusProps} hostedPracticePresentation={{ isFocusMode: false, isMobilePlayMode: true, showVirtualKeyboard: true }} initialConfig={noteConfig} practiceSessionMode />);
    expect(hosted.container.firstElementChild?.classList.contains("mobile-play-mode")).toBe(false);
    expect(hosted.container.firstElementChild?.classList.contains("fixed")).toBe(false);
    expect((observed.card.mock.lastCall![0] as ComponentProps<typeof FlashcardCard>).isMobilePlayMode).toBe(true);
    expect((observed.card.mock.lastCall![0] as ComponentProps<typeof FlashcardCard>).onEnterMobilePlay).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Exit Mobile Play" })).toBeNull();
  });
  it("hides only the hosted virtual keyboard while physical MIDI grading remains active", () => {
    const completed = vi.fn();
    const presentation = { isFocusMode: false, isMobilePlayMode: false, showVirtualKeyboard: false } as const;
    const { container, rerender } = render(<FlashcardSession {...focusProps} hostedPracticePresentation={presentation} initialConfig={noteConfig} onPracticeUnitCompleted={completed} practiceSessionMode />);
    expect(container.querySelector(".mobile-play-keyboard-region")?.hasAttribute("hidden")).toBe(true);
    midi(target().notes[0].midiNumber);
    expect(completed).toHaveBeenCalledTimes(1);
    rerender(<FlashcardSession {...focusProps} hostedPracticePresentation={{ ...presentation, showVirtualKeyboard: true }} initialConfig={noteConfig} onPracticeUnitCompleted={completed} practiceSessionMode />);
    expect(container.querySelector(".mobile-play-keyboard-region")?.hasAttribute("hidden")).toBe(false);
  });
});

it("allows a host to replace consecutive Flashcard entries directly from triad completion", () => {
  const completed = vi.fn();
  function Host() {
    const [entry, setEntry] = useState(0);
    return <FlashcardSession key={entry} {...focusProps} initialConfig={entry === 0 ? triadConfig : noteConfig} onPracticeUnitCompleted={() => { completed(); setEntry((current) => current + 1); }} />;
  }
  render(<StrictMode><Host /></StrictMode>);
  const notes = target().notes;
  for (const note of notes) play(note.midiNumber);
  expect(completed).toHaveBeenCalledTimes(1);
  expect(target().notes).toHaveLength(1);
  act(() => vi.runAllTimers());
  expect(completed).toHaveBeenCalledTimes(1);
});
