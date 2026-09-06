import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { StrictMode, type ComponentProps } from "react";
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
import SequenceSession from "./sequence-session";
import type SequenceCard from "./sequence-card";
import { DEFAULT_SEQUENCE_CONFIG, sequenceConfigToSettings, type SequenceConfig } from "../sequence-config";
import { generateSequenceTarget } from "@/lib/music/generators/sequences";
vi.mock("./sequence-card", () => ({ default: (props: unknown) => { observed.card(props); return null; } }));
vi.mock("@/lib/music/generators/sequences", async (original) => {
  const actual = await original<typeof import("@/lib/music/generators/sequences")>();
  return { ...actual, generateSequenceTarget: vi.fn(actual.generateSequenceTarget) };
});
function target() { return (observed.card.mock.lastCall![0] as ComponentProps<typeof SequenceCard>).sequenceTarget; }
const configs: SequenceConfig[] = [
  { ...DEFAULT_SEQUENCE_CONFIG, mode: "bass", enabledIntervals: ["octave"], enabledDirections: ["descending"] },
  { ...DEFAULT_SEQUENCE_CONFIG, exerciseType: "scales", enabledScales: ["melodic-minor"], enabledScaleDirections: ["ascending-descending"] },
  { ...DEFAULT_SEQUENCE_CONFIG, exerciseType: "arpeggios", enabledArpeggios: ["minor-seventh"], enabledArpeggioDirections: ["ascending-descending"] },
  { ...DEFAULT_SEQUENCE_CONFIG, exerciseType: "chord-progressions", enabledChordProgressionKeyIds: ["d-major"] },
];
function complete() { const current = target(); for (const step of current.steps) for (const note of step.notes) play(note.midiNumber); }

describe("Sequence engine contract", () => {
  it.each(configs)("initializes $exerciseType before presenting any target and ignores new initial props", (config) => {
    const view = render(<SequenceSession {...focusProps} initialConfig={config} />);
    const first = target();
    const runtime = sequenceConfigToSettings(config);
    const { showTargetName, mode, ...settings } = runtime;
    expect(showTargetName).toBe(false);
    expect(generateSequenceTarget).toHaveBeenCalledExactlyOnceWith({ ...settings, clef: mode });
    expect(observed.card.mock.calls.every(([props]) => props.sequenceTarget === first)).toBe(true);
    if (config.exerciseType === "intervals") {
      expect(first.clef).toBe("bass");
      expect(first.steps[1].notes[0].midiNumber - first.steps[0].notes[0].midiNumber).toBe(-12);
    } else if (config.exerciseType === "scales") {
      expect(first.name.primary).toBe("Melodic minor scale");
      expect(first.steps).toHaveLength(15);
    } else if (config.exerciseType === "arpeggios") {
      expect(first.name.primary).toMatch(/Minor seventh/i);
      expect(first.steps.length).toBeGreaterThan(4);
    } else {
      expect(first.name.secondary).toBe("D major");
      expect(first.steps.every((step) => step.notes.length === 3)).toBe(true);
    }
    view.rerender(<SequenceSession {...focusProps} initialConfig={{ ...config }} />);
    view.rerender(<SequenceSession {...focusProps} initialConfig={DEFAULT_SEQUENCE_CONFIG} />);
    expect(target()).toBe(first);
    expect(generateSequenceTarget).toHaveBeenCalledTimes(1);
  });
  it.each(configs)("emits one unit for a whole $exerciseType after retry, never for partial input", (config) => {
    const completed = vi.fn();
    const view = render(<SequenceSession {...focusProps} initialConfig={config} onPracticeUnitCompleted={completed} />);
    const first = target();
    play(first.steps[0].notes[0].midiNumber);
    expect(completed).not.toHaveBeenCalled();
    // Reset the partial selection/sequence, then grade a definite wrong MIDI attempt.
    fireEvent.click(screen.getByRole("button", { name: /reset session/i }));
    midi(1); act(() => vi.advanceTimersByTime(1000));
    expect(completed).not.toHaveBeenCalled();
    complete();
    expect(completed).toHaveBeenCalledExactlyOnceWith();
    play(target().steps.at(-1)!.notes[0].midiNumber);
    expect(completed).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(1300));
    expect(completed).toHaveBeenCalledTimes(1);
    view.unmount(); act(() => vi.runAllTimers());
    expect(completed).toHaveBeenCalledTimes(1);
  });
  it("uses the latest callback in Strict Mode and settings changes do not notify", () => {
    const oldCallback = vi.fn(); const currentCallback = vi.fn();
    const view = render(<StrictMode><SequenceSession {...focusProps} initialConfig={configs[0]} onPracticeUnitCompleted={oldCallback} /></StrictMode>);
    const first = target();
    view.rerender(<StrictMode><SequenceSession {...focusProps} initialConfig={{ ...configs[0] }} onPracticeUnitCompleted={currentCallback} /></StrictMode>);
    expect(target()).toBe(first);
    fireEvent.click(screen.getByRole("button", { name: "Treble" }));
    expect(currentCallback).not.toHaveBeenCalled();
    complete();
    expect(currentCallback).toHaveBeenCalledTimes(1);
    expect(oldCallback).not.toHaveBeenCalled();
  });
  it("preserves the fixed standalone interval starter", () => {
    render(<SequenceSession {...focusProps} />);
    expect(target().steps.map((step) => step.notes[0].midiNumber)).toEqual([60, 64]);
    expect(generateSequenceTarget).not.toHaveBeenCalled();
  });
});
