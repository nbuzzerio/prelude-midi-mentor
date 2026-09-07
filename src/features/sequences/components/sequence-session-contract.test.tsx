import { useSequenceTarget } from "../hooks/use-sequence-target";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
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
vi.mock("./sequence-card", () => ({ default: (props: ComponentProps<typeof SequenceCard>) => { observed.card(props); return props.repertoireStatus ? <p role="status">{props.repertoireStatus}</p> : null; } }));
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
    const { showTargetName, mode, scalePracticeMode, scaleRepertoire, ...settings } = runtime;
    expect(scalePracticeMode).toBe("random");
    expect(scaleRepertoire).toEqual([]);
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
  it("suppresses prescription controls only when hosted", () => {
    const view = render(<SequenceSession {...focusProps} initialConfig={configs[0]} />);
    expect(screen.getByRole("button", { name: "Treble" })).toBeTruthy();
    view.rerender(<SequenceSession {...focusProps} initialConfig={configs[0]} practiceSessionMode />);
    expect(screen.queryByRole("button", { name: "Treble" })).toBeNull();
  });
  it("keeps standalone viewport ownership and embeds hosted Mobile Play", () => {
    const standalone = render(<SequenceSession {...focusProps} initialConfig={configs[0]} />);
    act(() => (observed.card.mock.lastCall![0] as ComponentProps<typeof SequenceCard>).onEnterMobilePlay?.());
    expect(standalone.container.firstElementChild?.classList.contains("mobile-play-mode")).toBe(true);
    expect(standalone.container.firstElementChild?.classList.contains("fixed")).toBe(true);
    cleanup();
    const hosted = render(<SequenceSession {...focusProps} hostedMobilePlay={{ active: true }} initialConfig={configs[0]} practiceSessionMode />);
    expect(hosted.container.firstElementChild?.classList.contains("mobile-play-mode")).toBe(false);
    expect(hosted.container.firstElementChild?.classList.contains("fixed")).toBe(false);
    expect((observed.card.mock.lastCall![0] as ComponentProps<typeof SequenceCard>).isMobilePlayMode).toBe(true);
    expect((observed.card.mock.lastCall![0] as ComponentProps<typeof SequenceCard>).onEnterMobilePlay).toBeUndefined();
    expect(screen.queryByRole("button", { name: "Exit Mobile Play" })).toBeNull();
  });
});

const repertoireConfig: SequenceConfig = { ...DEFAULT_SEQUENCE_CONFIG, exerciseType: "scales", scalePracticeMode: "repertoire-in-order", scaleRepertoire: ["c-major", "a-natural-minor", "g-major"] };

describe("Scale repertoire session contract", () => {
  it("launches the first written scale immediately, completes each once, and reports traversal only at the end", () => {
    const unit = vi.fn(); const traversal = vi.fn();
    const view = render(<SequenceSession {...focusProps} initialConfig={repertoireConfig} onPracticeUnitCompleted={unit} onScaleRepertoireCompleted={traversal} />);
    const first = target();
    expect(first.name.primary).toBe("C Major");
    expect(first.steps).toHaveLength(15);
    expect(observed.card.mock.calls.every(([props]) => props.sequenceTarget === first)).toBe(true);
    expect(generateSequenceTarget).not.toHaveBeenCalled();
    view.rerender(<SequenceSession {...focusProps} initialConfig={{ ...repertoireConfig }} onPracticeUnitCompleted={unit} onScaleRepertoireCompleted={traversal} />);
    view.rerender(<SequenceSession {...focusProps} initialConfig={DEFAULT_SEQUENCE_CONFIG} onPracticeUnitCompleted={unit} onScaleRepertoireCompleted={traversal} />);
    expect(target()).toBe(first);
    for (const [index, name] of ["C Major", "A Natural Minor", "G Major"].entries()) {
      expect(target().name.primary).toBe(name);
      complete();
      expect(unit).toHaveBeenCalledTimes(index + 1);
      expect(traversal).toHaveBeenCalledTimes(index === 2 ? 1 : 0);
      if (index < 2) act(() => vi.advanceTimersByTime(1300));
    }
    expect(screen.getByRole("status").textContent).toBe("Repertoire complete");
    act(() => vi.advanceTimersByTime(1300));
    expect(target().name.primary).toBe("C Major");
    expect(traversal).toHaveBeenCalledTimes(1);
  });
  it("does not advance for partial/wrong attempts, reset, reorder, or mode changes", () => {
    const unit = vi.fn(); const traversal = vi.fn();
    render(<SequenceSession {...focusProps} initialConfig={repertoireConfig} onPracticeUnitCompleted={unit} onScaleRepertoireCompleted={traversal} />);
    play(target().steps[0].notes[0].midiNumber);
    midi(1); act(() => vi.advanceTimersByTime(1000));
    expect(target().name.primary).toBe("C Major");
    expect(unit).not.toHaveBeenCalled();
    complete(); act(() => vi.advanceTimersByTime(1300));
    expect(target().name.primary).toBe("A Natural Minor");
    fireEvent.click(screen.getByRole("button", { name: /reset session/i }));
    expect(target().name.primary).toBe("C Major");
    fireEvent.click(screen.getByRole("button", { name: "Move G Major up" }));
    fireEvent.click(screen.getByRole("button", { name: "Move G Major up" }));
    expect(target().name.primary).toBe("G Major");
    expect(unit).toHaveBeenCalledTimes(1);
    expect(traversal).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Scale Practice Mode"), { target: { value: "random" } });
    expect(generateSequenceTarget).toHaveBeenCalled();
    expect(unit).toHaveBeenCalledTimes(1);
    expect(traversal).not.toHaveBeenCalled();
  });
  it("shuffles a whole cycle without replacement and reset starts a fresh shuffle", () => {
    const traversal = vi.fn();
    render(<SequenceSession {...focusProps} initialConfig={{ ...repertoireConfig, scalePracticeMode: "repertoire-shuffle" }} onScaleRepertoireCompleted={traversal} />);
    const visited: string[] = [];
    for (let index = 0; index < 3; index += 1) {
      visited.push(target().name.primary);
      complete();
      expect(traversal).toHaveBeenCalledTimes(index === 2 ? 1 : 0);
      act(() => vi.advanceTimersByTime(1300));
    }
    expect(visited).toEqual(["A Natural Minor", "G Major", "C Major"]);
    expect(target().name.primary).toBe("A Natural Minor");
    vi.mocked(Math.random).mockReturnValue(0.99);
    fireEvent.click(screen.getByRole("button", { name: /reset session/i }));
    expect(target().name.primary).toBe("C Major");
    expect(traversal).toHaveBeenCalledTimes(1);
  });
  it("switches from Random into empty setup safely, hides random-only settings, and starts after selection", () => {
    const unit = vi.fn(); const traversal = vi.fn();
    render(<SequenceSession {...focusProps} onPracticeUnitCompleted={unit} onScaleRepertoireCompleted={traversal} />);
    fireEvent.click(screen.getByRole("button", { name: "Scales" }));
    expect((screen.getByLabelText("Scale Practice Mode") as HTMLSelectElement).value).toBe("random");
    expect(screen.getByRole("group", { name: "Direction" })).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Scale Practice Mode"), { target: { value: "repertoire-in-order" } });
    const calls = observed.card.mock.calls.length;
    expect(screen.getByRole("status").textContent).toMatch(/Select at least one scale/);
    expect(screen.queryByRole("group", { name: "Direction" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Starting notes" })).toBeNull();
    midi(60); play(60); act(() => vi.runAllTimers());
    expect(observed.card.mock.calls.length).toBe(calls);
    expect(unit).not.toHaveBeenCalled(); expect(traversal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("checkbox", { name: "C Major" }));
    expect(target().name.primary).toBe("C Major");
    complete();
    expect(unit).toHaveBeenCalledTimes(1); expect(traversal).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove C Major" }));
    act(() => vi.advanceTimersByTime(1300));
    expect(screen.getByRole("status").textContent).toMatch(/Select at least one scale/);
    expect(unit).toHaveBeenCalledTimes(1); expect(traversal).toHaveBeenCalledTimes(1);
  });
  it("mounts an empty repertoire without a random or default target", () => {
    render(<SequenceSession {...focusProps} initialConfig={{ ...repertoireConfig, scaleRepertoire: [] }} />);
    expect(observed.card).not.toHaveBeenCalled();
    expect(observed.keyboard).not.toHaveBeenCalled();
    expect(generateSequenceTarget).not.toHaveBeenCalled();
  });
  it("emits once in Strict Mode and permits immediate unmount at traversal completion", () => {
    const traversal = vi.fn();
    const view = render(<StrictMode><SequenceSession {...focusProps} initialConfig={{ ...repertoireConfig, scaleRepertoire: ["c-major"] }} onScaleRepertoireCompleted={traversal} /></StrictMode>);
    complete(); play(60);
    expect(traversal).toHaveBeenCalledExactlyOnceWith();
    view.unmount(); act(() => vi.runAllTimers());
    expect(traversal).toHaveBeenCalledTimes(1);
  });
});

it("does not advance repertoire from regeneration and rejects duplicate completion of a locked target", () => {
  const settings = sequenceConfigToSettings(repertoireConfig);
  const { result } = renderHook(() => useSequenceTarget({ ...settings, generateOnMount: true }));
  expect(result.current.sequenceTarget.name.primary).toBe("C Major");
  act(() => { result.current.generateNextTarget(); result.current.generateNextTarget(); });
  expect(result.current.sequenceTarget.name.primary).toBe("C Major");
  expect(result.current.repertoireTraversal?.completed).toBe(0);
  act(() => {
    expect(result.current.completeRepertoireTarget()).toBe(false);
    result.current.lockSequenceTarget();
    result.current.completeRepertoireTarget();
    result.current.completeRepertoireTarget();
  });
  expect(result.current.repertoireTraversal?.completed).toBe(1);
  act(() => result.current.generateNextTarget());
  expect(result.current.sequenceTarget.name.primary).toBe("A Natural Minor");
  act(() => result.current.generateNextTarget());
  expect(result.current.sequenceTarget.name.primary).toBe("A Natural Minor");
  expect(result.current.repertoireTraversal?.completed).toBe(1);
});
