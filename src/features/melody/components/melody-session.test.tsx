import { createRef, StrictMode, useState } from "react";
import * as melodyGenerator from "../melody-generator";
import { DEFAULT_MELODY_CONFIG, melodyConfigToSettings, type MelodyConfig } from "../melody-config";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateMelodyExercise } from "../melody-generator";
import { getMelodyTimedExpectedAttacks } from "../melody-timing";
import { DEFAULT_MELODY_SETTINGS } from "../melody-types";
import MelodySession, { type MelodySessionHandle } from "./melody-session";

vi.mock("@/hooks/use-mobile-play", async () => {
  const { useState } = await import("react");
  return {
    useMobilePlay: () => {
      const [isMobilePlayMode, setIsMobilePlayMode] = useState(false);
      return {
        enterMobilePlay: () => setIsMobilePlayMode(true),
        exitMobilePlay: () => setIsMobilePlayMode(false),
        isMobilePlayMode,
      };
    },
  };
});

const midi = vi.hoisted(() => ({ options: null as null | { onNotePlayed?: (midi: number) => void; onSustainPedalChanged?: (isDown: boolean) => void } }));
vi.mock("@/hooks/use-app-midi-input", () => ({ useAppMidiInput: (options: typeof midi.options) => {
  midi.options = options;
  return { status: "connected", deviceName: "Test Keys", error: null, connectMidi: vi.fn() };
} }));
vi.mock("@/features/staff-builder/components/staff-builder-score-view", () => ({ StaffBuilderScoreView: ({ measureIndex, visibleStaff, playbackPosition }: Record<string, unknown>) => <div data-offset={(playbackPosition as { offsetTicks?: number } | undefined)?.offsetTicks} data-staff={visibleStaff}>{Number(measureIndex) === 0 ? "Preparatory rest region" : `Score measure ${Number(measureIndex)}`}</div> }));
vi.mock("@/components/notation/piano-keyboard", () => ({ default: ({ minMidi, maxMidi, onNotePress, onNoteRelease }: { minMidi: number; maxMidi: number; onNotePress: (midi: number) => void; onNoteRelease: (midi: number) => void }) => <div><span>Keyboard {minMidi}-{maxMidi}</span><button onPointerDown={() => onNotePress(minMidi)} onPointerUp={() => onNoteRelease(minMidi)}>Virtual note</button></div> }));

function fakeAudio() {
  let now = 0;
  const nodes: Array<{ stop: ReturnType<typeof vi.fn> }> = [];
  const close = vi.fn(async () => undefined);
  const context = {
    get currentTime() { return now; }, state: "running" as AudioContextState, destination: {}, resume: vi.fn(async () => undefined),
    close,
    createOscillator: vi.fn(() => { const node = { frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: "sine" as OscillatorType }; nodes.push(node); return node; }),
    createGain: vi.fn(() => ({ gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() })),
  };
  return { context, nodes, close, setNow: (value: number) => { now = value; } };
}

describe("MelodySession", () => {
  afterEach(() => {
    cleanup();
    document.body.replaceChildren();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });
  beforeEach(() => {
    midi.options = null;
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false })));
    let frame: FrameRequestCallback | null = null;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    Object.assign(globalThis, { runMelodyFrame: () => frame?.(0) });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  });

  const timedConfig: MelodyConfig = { ...DEFAULT_MELODY_CONFIG, continuousPractice: true, continuousDurationMinutes: 1 };
  const frame = () => act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
  const startTimed = () => act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });

  it("suppresses setup controls but preserves the hosted Start action", () => {
    const view = render(<MelodySession initialConfig={timedConfig} seedFactory={() => "hosted"} />);
    expect(screen.getByRole("combobox", { name: "Tempo" })).toBeTruthy();
    view.rerender(<MelodySession initialConfig={timedConfig} practiceSessionMode seedFactory={() => "hosted"} />);
    expect(screen.queryByRole("combobox", { name: "Tempo" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start Session" })).toBeTruthy();
  });

  it("renders hosted Mobile Play inside its owner without local entry or exit controls", () => {
    const { container } = render(<MelodySession hostedPracticePresentation={{ isFocusMode: false, isMobilePlayMode: true, showVirtualKeyboard: true }} initialConfig={timedConfig} practiceSessionMode seedFactory={() => "hosted-mobile"} />);
    const session = container.querySelector("[data-testid='melody-session']")!;
    expect(session.classList.contains("melody-mobile-play")).toBe(true);
    expect(session.classList.contains("mobile-play-mode")).toBe(false);
    expect(session.classList.contains("fixed")).toBe(false);
    expect(screen.queryByRole("button", { name: "Mobile Play" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Exit Mobile Play" })).toBeNull();
    expect(screen.getByRole("button", { name: "Start Session" })).toBeTruthy();
  });

  it("hides and restores the hosted keyboard without remounting Melody", () => {
    const presentation = { isFocusMode: true, isMobilePlayMode: false, showVirtualKeyboard: false } as const;
    const seedFactory = vi.fn(() => "hosted-keyboard");
    const view = render(<MelodySession hostedPracticePresentation={presentation} initialConfig={timedConfig} practiceSessionMode seedFactory={seedFactory} />);
    const session = view.container.querySelector("[data-testid='melody-session']")!;
    expect(view.container.querySelector(".melody-keyboard")?.hasAttribute("hidden")).toBe(true);
    view.rerender(<MelodySession hostedPracticePresentation={{ ...presentation, showVirtualKeyboard: true }} initialConfig={timedConfig} practiceSessionMode seedFactory={seedFactory} />);
    expect(view.container.querySelector("[data-testid='melody-session']")).toBe(session);
    expect(view.container.querySelector(".melody-keyboard")?.hasAttribute("hidden")).toBe(false);
    expect(seedFactory).toHaveBeenCalledTimes(1);
  });

  it("generates only the configured first material and consumes configuration only at mount", () => {
    const config: MelodyConfig = { ...timedConfig, staff: "bass", keyId: "d-minor", tempoBpm: 50, measureCount: 2, continuousDurationMinutes: 3 };
    const generate = vi.spyOn(melodyGenerator, "generateMelodyExercise");
    const seedFactory = vi.fn(() => "configured");
    const view = render(<MelodySession initialConfig={config} seedFactory={seedFactory} />);
    expect(generate).toHaveBeenCalledExactlyOnceWith(melodyConfigToSettings(config), "configured");
    for (const [name, value] of [["Staff", "bass"], ["Key", "d-minor"], ["Tempo", "50"], ["Length", "2"], ["Session duration", "3"]]) {
      expect((screen.getByRole("combobox", { name }) as HTMLSelectElement).value).toBe(value);
    }
    expect((screen.getByRole("checkbox", { name: "Continuous Practice" }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByText(/Score measure/)).toHaveLength(2);
    expect(screen.getByText("Keyboard 48-60")).toBeTruthy();
    const score = screen.getByText("Score measure 1");
    view.rerender(<MelodySession initialConfig={{ ...config }} seedFactory={seedFactory} />);
    view.rerender(<MelodySession initialConfig={DEFAULT_MELODY_CONFIG} seedFactory={seedFactory} />);
    expect(screen.getByText("Score measure 1")).toBe(score);
    expect(generate).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByRole("combobox", { name: "Tempo" }), { target: { value: "70" } });
    view.rerender(<MelodySession initialConfig={config} seedFactory={seedFactory} />);
    expect((screen.getByRole("combobox", { name: "Tempo" }) as HTMLSelectElement).value).toBe("70");
    expect(generate).toHaveBeenCalledTimes(2);
  });

  it("does not start configured timing/audio until Start and the successful count-in", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const audio = fakeAudio();
    const createAudioContext = vi.fn(() => audio.context);
    const completed = vi.fn();
    let now = 0;
    render(<MelodySession initialConfig={timedConfig} createAudioContext={createAudioContext} nowMs={() => now} onPracticeTargetReached={completed} />);
    now = 600_000;
    act(() => vi.advanceTimersByTime(600_000));
    expect(createAudioContext).not.toHaveBeenCalled();
    expect(completed).not.toHaveBeenCalled();
    expect(screen.queryByText(/Time remaining:/)).toBeNull();
    await startTimed();
    expect(screen.getByText(/Time remaining: 1:00/)).toBeTruthy();
    expect(completed).not.toHaveBeenCalled();
  });

  it("commits final in-flight evidence before notifying the latest callback exactly once in Strict Mode", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const audio = fakeAudio();
    let now = 0;
    const oldCallback = vi.fn();
    const order: string[] = [];
    const resultChanged = vi.fn((practiceResult) => {
      if (practiceResult.diagnosticTrials.length > 0) order.push("result");
    });
    const latest = vi.fn(() => {
      order.push("target");
      expect(resultChanged.mock.calls.at(-1)?.[0]).toMatchObject({ diagnosticTrials: [{ originalOrder: 1, retryResults: [] }], interrupted: false });
      expect(screen.getByRole("heading", { name: "Timed Melody Session Review" })).toBeTruthy();
      expect(screen.getByText("Diagnostic trial 1 of 1")).toBeTruthy();
      expect(screen.getByRole("heading", { name: "Original Sight Read" })).toBeTruthy();
    });
    const props = { initialConfig: timedConfig, createAudioContext: () => audio.context, nowMs: () => now };
    const view = render(<StrictMode><MelodySession {...props} onPracticeResultChange={resultChanged} onPracticeTargetReached={oldCallback} /></StrictMode>);
    await startTimed();
    view.rerender(<StrictMode><MelodySession {...props} initialConfig={{ ...DEFAULT_MELODY_CONFIG }} onPracticeResultChange={resultChanged} onPracticeTargetReached={latest} /></StrictMode>);
    now = 60_000;
    act(() => vi.advanceTimersByTime(1000));
    expect(latest).not.toHaveBeenCalled();
    expect(screen.getByText("Lead-in")).toBeTruthy();
    audio.setNow(2.1);
    frame();
    expect(screen.getByText("Play")).toBeTruthy();
    expect(latest).not.toHaveBeenCalled();
    audio.setNow(20);
    frame();
    frame();
    act(() => vi.advanceTimersByTime(120_000));
    expect(oldCallback).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
    expect(order.slice(-2)).toEqual(["result", "target"]);
    view.rerender(<StrictMode><MelodySession {...props} onPracticeResultChange={resultChanged} onPracticeTargetReached={oldCallback} /></StrictMode>);
    expect(oldCallback).not.toHaveBeenCalled();
  });

  it("notifies once when the deadline expires between phrases without generating another", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const audio = fakeAudio();
    let now = 0;
    const completed = vi.fn();
    const seeds = vi.fn(() => "between");
    render(<MelodySession initialConfig={timedConfig} createAudioContext={() => audio.context} nowMs={() => now} seedFactory={seeds} onPracticeTargetReached={completed} />);
    await startTimed();
    audio.setNow(20);
    frame();
    expect(completed).not.toHaveBeenCalled();
    now = 60_000;
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByText("Diagnostic trial 1 of 1")).toBeTruthy();
    expect(completed).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(60_000));
    expect(completed).toHaveBeenCalledTimes(1);
    expect(seeds).toHaveBeenCalledTimes(1);
  });

  it("supports synchronous continuation from notification and retains original and repair evidence", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const audio = fakeAudio();
    let now = 0;
    const ref = createRef<MelodySessionHandle>();
    const resultChanged = vi.fn();
    const completed = vi.fn(() => {
      expect(screen.getByText("Diagnostic trial 1 of 1")).toBeTruthy();
      expect(ref.current?.continuePractice()).toBe(true);
      expect(ref.current?.continuePractice()).toBe(false);
    });
    render(<MelodySession ref={ref} initialConfig={timedConfig} createAudioContext={() => audio.context} nowMs={() => now} seedFactory={() => "continuation"} onPracticeResultChange={resultChanged} onPracticeTargetReached={completed} />);
    expect(ref.current?.continuePractice()).toBe(false);
    await startTimed();
    now = 60_000;
    audio.setNow(20);
    await act(async () => { frame(); });
    expect(screen.getByText("Lead-in")).toBeTruthy();
    expect(screen.queryByText(/Time remaining:/)).toBeNull();
    now = 600_000;
    act(() => vi.advanceTimersByTime(120_000));
    audio.setNow(40);
    frame();
    expect(screen.getByText("Diagnostic trial 2 complete")).toBeTruthy();
    expect(screen.queryByText(/Time remaining:/)).toBeNull();
    // Existing continuous-practice interaction advances without host intervention.
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try Another" })); });
    audio.setNow(60);
    frame();
    expect(screen.getByText("Diagnostic trial 3 complete")).toBeTruthy();
    expect(resultChanged.mock.calls.at(-1)?.[0].diagnosticTrials).toHaveLength(3);
    expect(completed).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try Another" })); });
    // Existing interruption returns to Review, preserving completed trials.
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    expect(screen.getByText("Diagnostic trial 1 of 3")).toBeTruthy();
    const original = screen.getByRole("heading", { name: "Original Sight Read" }).parentElement!.textContent;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry This Melody" })); });
    expect(ref.current?.continuePractice()).toBe(false);
    audio.setNow(80);
    frame();
    expect(screen.getByText("Diagnostic trial 1 of 3")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Original Sight Read" }).parentElement!.textContent).toBe(original);
    expect(screen.getByRole("heading", { name: "Repair" })).toBeTruthy();
    expect(resultChanged.mock.calls.at(-1)?.[0].diagnosticTrials[0].retryResults).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Original" }));
    fireEvent.click(screen.getByRole("button", { name: "Latest" }));
    await act(async () => { expect(ref.current?.continuePractice()).toBe(true); });
    audio.setNow(100);
    frame();
    expect(screen.getByText("Diagnostic trial 4 complete")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Try Another" })); });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByText("Diagnostic trial 1 of 4")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Repair" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Original Sight Read" }).parentElement!.textContent).toBe(original);
    expect(resultChanged.mock.calls.at(-1)?.[0].interrupted).toBe(true);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it("invalidates old timers on Settings and grants a genuinely new timed run one notification", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const audio = fakeAudio();
    let now = 0;
    const completed = vi.fn();
    render(<MelodySession initialConfig={timedConfig} createAudioContext={() => audio.context} nowMs={() => now} onPracticeTargetReached={completed} />);
    await startTimed();
    audio.setNow(20);
    frame();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    now = 60_000;
    act(() => vi.advanceTimersByTime(60_000));
    frame();
    expect(completed).not.toHaveBeenCalled();
    await startTimed();
    audio.setNow(40);
    frame();
    now = 119_999;
    act(() => vi.advanceTimersByTime(1000));
    expect(completed).not.toHaveBeenCalled();
    now = 120_000;
    act(() => vi.advanceTimersByTime(1000));
    expect(completed).toHaveBeenCalledTimes(1);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "New Timed Session" })); });
    expect(screen.getByText(/Time remaining: 1:00/)).toBeTruthy();
    now = 180_000;
    audio.setNow(60);
    frame();
    expect(completed).toHaveBeenCalledTimes(2);
  });

  it("safely lets notification unmount the engine after committed evidence", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const audio = fakeAudio();
    let now = 0;
    const ref = createRef<MelodySessionHandle>();
    const completed = vi.fn();
    function Host() {
      const [active, setActive] = useState(true);
      return active ? <MelodySession ref={ref} initialConfig={timedConfig} createAudioContext={() => audio.context} nowMs={() => now} onPracticeTargetReached={() => {
        expect(screen.getByText("Diagnostic trial 1 of 1")).toBeTruthy();
        completed();
        setActive(false);
      }} /> : <p>Host moved on</p>;
    }
    render(<Host />);
    const handle = ref.current!;
    await startTimed();
    now = 60_000;
    audio.setNow(20);
    frame();
    expect(screen.getByText("Host moved on")).toBeTruthy();
    expect(handle.continuePractice()).toBe(false);
    act(() => vi.advanceTimersByTime(120_000));
    frame();
    expect(completed).toHaveBeenCalledTimes(1);
    expect(audio.close).toHaveBeenCalledTimes(1);
  });

  it("does not notify after unmounting an unfinished run or from non-continuous results", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const audio = fakeAudio();
    let now = 0;
    const completed = vi.fn();
    const view = render(<MelodySession initialConfig={timedConfig} createAudioContext={() => audio.context} nowMs={() => now} onPracticeTargetReached={completed} />);
    await startTimed();
    view.unmount();
    now = 60_000;
    audio.setNow(20);
    act(() => vi.advanceTimersByTime(60_000));
    frame();
    expect(completed).not.toHaveBeenCalled();
    const singleAudio = fakeAudio();
    render(<MelodySession initialConfig={DEFAULT_MELODY_CONFIG} createAudioContext={() => singleAudio.context} nowMs={() => now} onPracticeTargetReached={completed} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    singleAudio.setNow(20);
    now = 600_000;
    frame();
    expect(screen.getByRole("heading", { name: "Melody results" })).toBeTruthy();
    expect(completed).not.toHaveBeenCalled();
  });

  it("does not start a deadline from an audio startup that resolves after unmount", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
    const audio = fakeAudio();
    audio.context.state = "suspended";
    let resume!: (value: undefined) => void;
    audio.context.resume.mockImplementation(() => new Promise<undefined>((resolve) => { resume = resolve; }));
    const completed = vi.fn();
    const view = render(<MelodySession initialConfig={timedConfig} createAudioContext={() => audio.context} onPracticeTargetReached={completed} />);
    await startTimed();
    expect(screen.queryByText(/Time remaining:/)).toBeNull();
    view.unmount();
    await act(async () => { resume(undefined); });
    act(() => vi.advanceTimersByTime(600_000));
    frame();
    expect(completed).not.toHaveBeenCalled();
    expect(audio.nodes.every((node) => node.stop.mock.calls.length > 0)).toBe(true);
  });

  it("shows defaults, generated notation, one keyboard, and changes settings", () => {
    const generate = vi.spyOn(melodyGenerator, "generateMelodyExercise");
    render(<MelodySession seedFactory={() => "seed"} />);
    expect(generate).toHaveBeenCalledExactlyOnceWith(DEFAULT_MELODY_SETTINGS, "seed");
    expect((screen.getByRole("combobox", { name: "Staff" }) as HTMLSelectElement).value).toBe("treble");
    expect((screen.getByRole("combobox", { name: "Tempo" }) as HTMLSelectElement).value).toBe("60");
    expect(screen.getAllByText(/Score measure/)).toHaveLength(1);
    expect(screen.getByText("Keyboard 60-72")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Staff" }), { target: { value: "bass" } });
    expect(screen.getByText("Keyboard 48-60")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Length" }), { target: { value: "2" } });
    expect(screen.getAllByText(/Score measure/)).toHaveLength(2);
  });

  it("keeps Continuous Practice optional with a five-minute default", () => {
    render(<MelodySession seedFactory={() => "seed"} />);
    const continuous = screen.getByRole("checkbox", {
      name: "Continuous Practice",
    });
    expect((continuous as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("button", { name: "Start Exercise" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Session duration" })).toBeNull();

    fireEvent.click(continuous);
    const duration = screen.getByRole("combobox", { name: "Session duration" });
    expect((duration as HTMLSelectElement).value).toBe("5");
    expect([...duration.querySelectorAll("option")].map(({ value }) => value)).toEqual(["1", "2", "3", "5"]);
    expect(screen.getByRole("button", { name: "Start Session" })).toBeTruthy();
  });

  it("shows target notes during the lead-in, ignores prep input, and accepts the first target downbeat", async () => {
    const audio = fakeAudio();
    const target = generateMelodyExercise(DEFAULT_MELODY_SETTINGS, "lead-in-boundary");
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "lead-in-boundary"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });

    expect(screen.getByText("Lead-in")).toBeTruthy();
    expect(screen.getByText("Preparatory rest region")).toBeTruthy();
    expect(screen.getByText("Score measure 1")).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Melody Results" })).toBeNull();
    act(() => midi.options?.onNotePlayed?.(target.expectedAttacks[0]!.midiNumber));
    expect(screen.queryByText(/Input:/)).toBeNull();

    audio.setNow(2.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.getByText("Play")).toBeTruthy();
    act(() => midi.options?.onNotePlayed?.(target.expectedAttacks[0]!.midiNumber));
    audio.setNow(10);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());

    const details = screen.getByLabelText("Pitch result details").querySelectorAll("li");
    expect(details[0]?.textContent).toMatch(/correct/);
    expect(screen.getByText(/Extra: 0/)).toBeTruthy();
  });

  it("retains a valid early first note before the target downbeat", async () => {
    const audio = fakeAudio();
    const target = generateMelodyExercise(DEFAULT_MELODY_SETTINGS, "early-first-note");
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "early-first-note"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });

    audio.setNow(1.6);
    act(() => midi.options?.onNotePlayed?.(target.expectedAttacks[0]!.midiNumber));
    expect(screen.getByText("Lead-in")).toBeTruthy();

    audio.setNow(2.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.getByText(/Input: MIDI/)).toBeTruthy();
    audio.setNow(10);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());

    const details = screen.getByLabelText("Pitch result details").querySelectorAll("li");
    expect(details[0]?.textContent).toMatch(/correct/);
    expect(screen.getByText(/Missed: \d+/).textContent).not.toContain(`Missed: ${target.expectedAttacks.length}`);
    expect(screen.getByText(/Extra: 0/)).toBeTruthy();
  });

  it("starts the timed diagnostic at the first count-in and advances without Retry Same", async () => {
    const audio = fakeAudio();
    const createAudioContext = vi.fn(() => audio.context);
    let nowMs = 10_000;
    render(<MelodySession createAudioContext={createAudioContext} nowMs={() => nowMs} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Session duration" }), {
      target: { value: "1" },
    });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    expect(screen.getByText(/Time remaining: 1:00/)).toBeTruthy();
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.getByText(/Diagnostic trial 1 complete/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry Same" })).toBeNull();
    nowMs = 20_000;
    fireEvent.click(screen.getByRole("button", { name: "Try Another" }));
    await waitFor(() => expect(screen.getByText("Lead-in")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
  });

  it("finishes an in-flight trial after the deadline and retains it", async () => {
    const audio = fakeAudio();
    let nowMs = 0;
    render(<MelodySession createAudioContext={() => audio.context} nowMs={() => nowMs} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Session duration" }), { target: { value: "1" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    nowMs = 60_001;
    expect(screen.getByText("Lead-in")).toBeTruthy();
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.getByRole("heading", { name: "Timed Melody Session Review" })).toBeTruthy();
    expect(screen.getByText("1", { selector: "strong" })).toBeTruthy();
  });

  it("prevents a new diagnostic trial when the deadline expires on results", async () => {
    const audio = fakeAudio();
    let nowMs = 0;
    const seedFactory = vi.fn(() => "seed");
    const completed = vi.fn();
    render(<MelodySession createAudioContext={() => audio.context} nowMs={() => nowMs} seedFactory={seedFactory} onPracticeTargetReached={completed} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Session duration" }), { target: { value: "1" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    nowMs = 60_000;
    fireEvent.click(screen.getByRole("button", { name: "Try Another" }));
    expect(screen.getByRole("heading", { name: "Timed Melody Session Review" })).toBeTruthy();
    expect(seedFactory).toHaveBeenCalledTimes(1);
    expect(completed).toHaveBeenCalledTimes(1);
  });

  it("gives a new timed session a fresh deadline based on its own first count-in", async () => {
    const audio = fakeAudio();
    let nowMs = 10_000;
    const seedFactory = vi.fn(() => `seed-${seedFactory.mock.calls.length + 1}`);
    render(<MelodySession createAudioContext={() => audio.context} nowMs={() => nowMs} seedFactory={seedFactory} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Session duration" }), { target: { value: "1" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    audio.setNow(20);
    nowMs = 70_000;
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.getByRole("heading", { name: "Timed Melody Session Review" })).toBeTruthy();

    nowMs = 100_000;
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "New Timed Session" })); });
    expect(screen.getByText(/Time remaining: 1:00/)).toBeTruthy();
    audio.setNow(40);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    nowMs = 159_999;
    fireEvent.click(screen.getByRole("button", { name: "Try Another" }));
    await waitFor(() => expect(screen.getByText("Lead-in")).toBeTruthy());
    expect(seedFactory).toHaveBeenCalledTimes(3);
  });

  it("moves to the next diagnostic trial needing review and exits Review through Settings", async () => {
    const audio = fakeAudio();
    let nowMs = 0;
    const seeds = ["first-review", "second-review"];
    render(<MelodySession createAudioContext={() => audio.context} nowMs={() => nowMs} seedFactory={() => seeds.shift() ?? "later"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Session duration" }), { target: { value: "1" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    nowMs = 1_000;
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.click(screen.getByRole("button", { name: "Try Another" }));
    await waitFor(() => expect(screen.getByText("Lead-in")).toBeTruthy());
    nowMs = 60_000;
    audio.setNow(40);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());

    expect(screen.getByText("Diagnostic trial 1 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next Needs Review" }));
    expect(screen.getByText("Diagnostic trial 2 of 2")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("button", { name: "Start Session" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Timed Melody Session Review" })).toBeNull();
  });

  it("starts Try Another directly with a fresh exercise and the same AudioContext", async () => {
    const seeds = ["first", "second"];
    const seedFactory = vi.fn(() => seeds.shift() ?? "later");
    const audio = fakeAudio();
    const createAudioContext = vi.fn(() => audio.context);
    render(<MelodySession createAudioContext={createAudioContext} seedFactory={seedFactory} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    const firstScore = screen.getByText("Score measure 1");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());

    fireEvent.click(screen.getByRole("button", { name: "Try Another" }));
    await waitFor(() => expect(screen.getByText("Lead-in")).toBeTruthy());
    expect(screen.getByText("Score measure 1")).not.toBe(firstScore);
    expect(seedFactory).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: /Start (Session|Exercise)/ })).toBeNull();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
  });

  it("routes an imperfect timed diagnostic pedal press into a fresh trial", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());

    act(() => midi.options?.onSustainPedalChanged?.(true));
    await waitFor(() => expect(screen.getByText("Lead-in")).toBeTruthy());
    expect(screen.getByText(/Trials completed: 1/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();
  });

  it("preserves completed diagnostic trials and enters an interrupted summary when hidden", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.click(screen.getByRole("button", { name: "Try Another" }));
    await waitFor(() => expect(screen.getByText(/Trials completed: 1/)).toBeTruthy());

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("heading", { name: "Session interrupted" })).toBeTruthy();
    expect(screen.getAllByText(/Completed trials were preserved/)).toHaveLength(2);
    expect(screen.getByText("1", { selector: "strong" })).toBeTruthy();
  });

  it("resets attempt source locking between Continuous Practice attempts", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    audio.setNow(2.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    act(() => midi.options?.onNotePlayed?.(60));
    expect(screen.getByText(/Input: MIDI/)).toBeTruthy();
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.click(screen.getByRole("button", { name: "Try Another" }));
    await waitFor(() => expect(screen.getByText("Lead-in")).toBeTruthy());
    expect(screen.queryByText(/Input:/)).toBeNull();
    audio.setNow(22.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.pointerDown(screen.getByRole("button", { name: "Virtual note" }));
    expect(screen.getByText(/Input: On-screen keyboard/)).toBeTruthy();
  });

  it("retries the exact retained trial without a timer or new seed and pins mastery in Review", async () => {
    const audio = fakeAudio();
    const createAudioContext = vi.fn(() => audio.context);
    const seedFactory = vi.fn(() => "review-retry-seed");
    let nowMs = 0;
    render(<MelodySession createAudioContext={createAudioContext} nowMs={() => nowMs} seedFactory={seedFactory} />);
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Session duration" }), { target: { value: "1" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    nowMs = 60_000;
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());

    expect(screen.getByRole("heading", { name: "Timed Melody Session Review" })).toBeTruthy();
    expect(screen.queryByText(/Time remaining/)).toBeNull();
    expect(screen.queryByText(/Keyboard /)).toBeNull();
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    act(() => midi.options?.onSustainPedalChanged?.(true));
    act(() => midi.options?.onSustainPedalChanged?.(false));
    expect(screen.getByRole("heading", { name: "Timed Melody Session Review" })).toBeTruthy();
    expect(createAudioContext).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Retry This Melody" }));
    await waitFor(() => expect(screen.getByText("Lead-in")).toBeTruthy());
    expect(screen.getAllByText(/Keyboard /)).toHaveLength(1);
    expect(seedFactory).toHaveBeenCalledTimes(1);
    audio.setNow(40);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.getByText("Original + 1 retry")).toBeTruthy();
    expect(screen.getByText("Needs Review", { selector: "p" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Trial 1 result" }));

    fireEvent.click(screen.getByRole("button", { name: "Retry This Melody" }));
    await waitFor(() => expect(screen.getByText("Lead-in")).toBeTruthy());
    const retainedExercise = generateMelodyExercise(DEFAULT_MELODY_SETTINGS, "review-retry-seed");
    for (const attack of getMelodyTimedExpectedAttacks(retainedExercise)) {
      audio.setNow(42.1 + attack.expectedTimeSeconds);
      act(() => midi.options?.onNotePlayed?.(attack.midiNumber));
    }
    audio.setNow(60);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());

    expect(screen.getByText("Original + 2 retries")).toBeTruthy();
    expect(screen.getByText("Mastered", { selector: "p" })).toBeTruthy();
    expect(screen.getByText(/Repair complete/)).toBeTruthy();
    expect(screen.getByText("All diagnostic trials mastered")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry This Melody" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(screen.queryByText(/Keyboard /)).toBeNull();
    expect(seedFactory).toHaveBeenCalledTimes(1);
    expect(createAudioContext).toHaveBeenCalledTimes(1);
  });

  it("resets a diagnostic MIDI lock so a Review retry can lock to the virtual keyboard", async () => {
    const audio = fakeAudio();
    let nowMs = 0;
    render(<MelodySession createAudioContext={() => audio.context} nowMs={() => nowMs} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Session duration" }), { target: { value: "1" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    audio.setNow(2.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    act(() => midi.options?.onNotePlayed?.(60));
    expect(screen.getByText(/Input: MIDI/)).toBeTruthy();
    nowMs = 60_000;
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.click(screen.getByRole("button", { name: "Retry This Melody" }));
    await waitFor(() => expect(screen.getByText("Lead-in")).toBeTruthy());
    audio.setNow(22.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.pointerDown(screen.getByRole("button", { name: "Virtual note" }));
    expect(screen.getByText(/Input: On-screen keyboard/)).toBeTruthy();
    act(() => midi.options?.onNotePlayed?.(60));
    expect(screen.getByText(/Input: On-screen keyboard/)).toBeTruthy();
    expect(screen.getAllByText(/Keyboard /)).toHaveLength(1);
    audio.setNow(40);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.queryByText(/Keyboard /)).toBeNull();
  });

  it("resets a diagnostic virtual lock so a Review retry can lock to MIDI", async () => {
    const audio = fakeAudio();
    let nowMs = 0;
    render(<MelodySession createAudioContext={() => audio.context} nowMs={() => nowMs} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Session duration" }), { target: { value: "1" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    audio.setNow(2.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.pointerDown(screen.getByRole("button", { name: "Virtual note" }));
    expect(screen.getByText(/Input: On-screen keyboard/)).toBeTruthy();
    nowMs = 60_000;
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.click(screen.getByRole("button", { name: "Retry This Melody" }));
    await waitFor(() => expect(screen.getByText("Lead-in")).toBeTruthy());
    audio.setNow(22.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    act(() => midi.options?.onNotePlayed?.(60));
    expect(screen.getByText(/Input: MIDI/)).toBeTruthy();
    fireEvent.pointerDown(screen.getByRole("button", { name: "Virtual note" }));
    expect(screen.getByText(/Input: MIDI/)).toBeTruthy();
    expect(screen.getAllByText(/Keyboard /)).toHaveLength(1);
  });

  it("keeps one responsive keyboard and one shared score/count scroll track for both measures", () => {
    const { container } = render(<MelodySession seedFactory={() => "seed"} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Length" }), { target: { value: "2" } });
    expect(screen.getAllByText(/Keyboard /)).toHaveLength(1);
    expect(screen.getAllByText(/Score measure/)).toHaveLength(2);
    const scroll = container.querySelector(".melody-score-scroll");
    expect(scroll?.getAttribute("data-measure-count")).toBe("2");
    expect(screen.getByLabelText("Melody exercise score and preparatory lead-in").tabIndex).toBe(0);
    expect(scroll?.querySelectorAll(".melody-score-track")).toHaveLength(1);
    expect(scroll?.querySelectorAll('[aria-label="Preparatory lead-in and count guide"]')).toHaveLength(1);
  });

  it("enters and exits Mobile Play in setup without regenerating or duplicating practice UI", async () => {
    const seedFactory = vi.fn(() => "stable-seed");
    render(<MelodySession seedFactory={seedFactory} />);

    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));

    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(screen.getAllByText(/Keyboard /)).toHaveLength(1);
    expect(screen.getAllByText("Score measure 1")).toHaveLength(1);
    expect(screen.getAllByLabelText("Preparatory lead-in and count guide")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Start Exercise" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Tempo" })).toBeTruthy();
    expect(seedFactory).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Mobile Play" })));
    expect(seedFactory).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText(/Keyboard /)).toHaveLength(1);
  });

  it("preserves count-in, one AudioContext, and the active clock across Mobile Play", async () => {
    const audio = fakeAudio();
    const createAudioContext = vi.fn(() => audio.context);
    render(<MelodySession createAudioContext={createAudioContext} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });

    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    expect(screen.getByText("Lead-in")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    expect(screen.getByText("Lead-in")).toBeTruthy();
    expect(createAudioContext).toHaveBeenCalledTimes(1);

    audio.setNow(2.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.getByText(/^Play/)).toBeTruthy();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
  });

  it("preserves the performing recorder and MIDI source lock across entry and exit", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    audio.setNow(2.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    act(() => midi.options?.onNotePlayed?.(60));
    expect(screen.getByText(/Input: MIDI/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Virtual note" }));
    expect(screen.getByText(/Input: MIDI/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    act(() => midi.options?.onNotePlayed?.(60));

    audio.setNow(8.6);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.getByRole("heading", { name: "Melody results" })).toBeTruthy();
  });

  it("preserves a virtual source lock across Mobile Play", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    audio.setNow(2.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.pointerDown(screen.getByRole("button", { name: "Virtual note" }));
    expect(screen.getByText(/Input: On-screen keyboard/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    act(() => midi.options?.onNotePlayed?.(60));
    expect(screen.getByText(/Input: On-screen keyboard/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    expect(screen.getAllByText(/Keyboard /)).toHaveLength(1);
  });

  it("keeps Mobile Play active through results and result actions", async () => {
    const seeds = ["first", "second"];
    const seedFactory = vi.fn(() => seeds.shift() ?? "later");
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={seedFactory} />);
    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    audio.setNow(8.6);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());

    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: "Pitch results on the staff" })).toHaveLength(1);
    expect(screen.getByLabelText("Melody pitch result score").tabIndex).toBe(0);
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Melody results" }));
    const resultActions = screen.getByRole("group", {
      name: "Melody primary result actions",
    });
    expect(resultActions.parentElement?.className).toContain(
      "melody-result-legend-row",
    );
    expect(
      screen.getByLabelText("Pitch result legend").parentElement,
    ).toBe(resultActions.parentElement);
    expect(
      screen.getByRole("button", { name: "Settings" }).closest("header")
        ?.className,
    ).toContain("melody-result-header");
    expect(screen.getAllByRole("button", { name: "Retry Same" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Try Another" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Settings" })).toHaveLength(1);
    expect(screen.getAllByLabelText("Melody pitch result score")).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Retry Same" }));
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(seedFactory).toHaveBeenCalledTimes(1);

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    audio.setNow(17.2);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.click(screen.getByRole("button", { name: "Try Another" }));
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(seedFactory).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("combobox", { name: "Tempo" })).toBeTruthy();

    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    audio.setNow(25.8);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: "Tempo" })).toBeTruthy();
  });

  it("requires a release after carrying sustain into results, then routes one fresh down", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    act(() => midi.options?.onSustainPedalChanged?.(true));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    audio.setNow(8.6);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.getByRole("heading", { name: "Melody results" })).toBeTruthy();

    act(() => midi.options?.onSustainPedalChanged?.(true));
    expect(screen.getByRole("heading", { name: "Melody results" })).toBeTruthy();
    act(() => midi.options?.onSustainPedalChanged?.(false));
    act(() => midi.options?.onSustainPedalChanged?.(true));
    expect(screen.getByRole("button", { name: "Start Exercise" })).toBeTruthy();
  });

  it("preserves exercise and lazy AudioContext ownership across resize", async () => {
    const audio = fakeAudio();
    const createAudioContext = vi.fn(() => audio.context);
    render(<MelodySession createAudioContext={createAudioContext} seedFactory={() => "stable"} />);
    const scoreBefore = screen.getByText("Score measure 1");
    fireEvent(window, new Event("resize"));
    expect(screen.getByText("Score measure 1")).toBe(scoreBefore);
    expect(createAudioContext).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    fireEvent(window, new Event("resize"));
    expect(createAudioContext).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Lead-in")).toBeTruthy();
  });

  it.each(["count-in", "performing"] as const)("aborts without scoring when hidden during %s", async (phase) => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    if (phase === "performing") {
      audio.setNow(2.1);
      act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    }
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("status").textContent).toContain("no longer active");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getAllByText(/Exercise stopped because Prelude was no longer active/)).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Start Exercise" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Melody results" })).toBeNull();
    expect(audio.close).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("button", { name: "Start Exercise" })).toBeTruthy();
  });

  it("aborts safely while audio startup is pending", async () => {
    const audio = fakeAudio();
    let resolveResume: (() => void) | undefined;
    audio.context.state = "suspended";
    audio.context.resume.mockImplementation(() => new Promise<undefined>((resolve) => { resolveResume = () => resolve(undefined); }));
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    act(() => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    expect(screen.getByText("Starting audio…")).toBeTruthy();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("status").textContent).toContain("no longer active");
    expect(screen.queryByRole("alert")).toBeNull();
    resolveResume?.();
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByRole("button", { name: "Start Exercise" })).toBeTruthy();
    expect(audio.nodes.every(({ stop }) => stop.mock.calls.length >= 2)).toBe(true);
  });

  it("ignores visibility changes during setup and results and removes its listener on unmount", async () => {
    const add = vi.spyOn(document, "addEventListener");
    const remove = vi.spyOn(document, "removeEventListener");
    const audio = fakeAudio();
    const view = render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("button", { name: "Start Exercise" })).toBeTruthy();
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    audio.setNow(8.6);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("heading", { name: "Melody results" })).toBeTruthy();
    view.unmount();
    expect(add.mock.calls.some(([type]) => type === "visibilitychange")).toBe(true);
    expect(remove.mock.calls.some(([type]) => type === "visibilitychange")).toBe(true);
    add.mockRestore();
    remove.mockRestore();
  });

  it("starts explicitly, samples authoritative clock, records continuously, and presents results", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    expect(audio.context.createOscillator).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    expect(screen.getByText("Lead-in")).toBeTruthy();
    act(() => midi.options?.onNotePlayed?.(60));
    audio.setNow(2.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.getByText(/^Play/)).toBeTruthy();
    act(() => midi.options?.onNotePlayed?.(60));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Virtual note" }));
    expect(screen.queryByText(/wrong|incorrect/i)).toBeNull();
    audio.setNow(8.6);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Melody results" }));
    expect(screen.getByRole("heading", { name: "Pitch" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Movement" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Timing" })).toBeTruthy();
    expect(screen.getByLabelText("Pitch result legend").textContent).toBe("CorrectMissedWrong pitch");
    expect(screen.getByText("The staff below shows pitch results. Timing is scored separately.")).toBeTruthy();
    expect(screen.getByLabelText("Pitch result details").querySelectorAll("li").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Keyboard 60-72/)).toBeNull();
  });

  it("keeps Retry Same notation and gives Try Another a fresh seed", async () => {
    const seeds = ["same", "different"];
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => seeds.shift() ?? "later"} />);
    const firstScore = screen.getByText("Score measure 1").getAttribute("data-staff");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    audio.setNow(8.6);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.click(screen.getByRole("button", { name: "Retry Same" }));
    expect(screen.getByText("Score measure 1").getAttribute("data-staff")).toBe(firstScore);
  });

  it("reports audio startup failure without entering performance", async () => {
    render(<MelodySession createAudioContext={() => { throw new Error("no audio"); }} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    expect(screen.getByRole("alert").textContent).toContain("couldn't start");
    expect(screen.getByRole("button", { name: "Start Exercise" })).toBeTruthy();
  });

  it("cancels scheduled audio on unmount", async () => {
    const audio = fakeAudio();
    const view = render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    view.unmount();
    expect(audio.nodes.every(({ stop }) => stop.mock.calls.length >= 2)).toBe(true);
    expect(audio.close).toHaveBeenCalledTimes(1);
  });

  it("lazily creates one context and reuses it for Retry Same, Try Another, and Settings starts", async () => {
    const audio = fakeAudio();
    const createAudioContext = vi.fn(() => audio.context);
    render(<MelodySession createAudioContext={createAudioContext} seedFactory={() => "seed"} />);
    expect(createAudioContext).not.toHaveBeenCalled();

    const startAndComplete = async () => {
      await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
      audio.setNow(8.6);
      act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
      expect(screen.getByRole("heading", { name: "Melody results" })).toBeTruthy();
    };

    await startAndComplete();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
    expect(audio.close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retry Same" }));
    audio.setNow(0);
    await startAndComplete();
    fireEvent.click(screen.getByRole("button", { name: "Try Another" }));
    audio.setNow(0);
    await startAndComplete();
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    audio.setNow(0);
    await startAndComplete();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
    expect(audio.close).not.toHaveBeenCalled();
    expect(audio.nodes.some(({ stop }) => stop.mock.calls.length >= 2)).toBe(true);
  });

  it("retries context creation after the factory itself fails", async () => {
    const audio = fakeAudio();
    const createAudioContext = vi.fn()
      .mockImplementationOnce(() => { throw new Error("creation failed"); })
      .mockImplementationOnce(() => audio.context);
    render(<MelodySession createAudioContext={createAudioContext} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    expect(screen.getByRole("alert")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    expect(createAudioContext).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Lead-in")).toBeTruthy();
  });

  it("reuses a created context after clock startup fails", async () => {
    const audio = fakeAudio();
    let failScheduling = true;
    audio.context.createOscillator.mockImplementation(() => {
      if (failScheduling) { failScheduling = false; throw new Error("schedule failed"); }
      const node = { frequency: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), type: "sine" as OscillatorType };
      audio.nodes.push(node); return node;
    });
    const createAudioContext = vi.fn(() => audio.context);
    render(<MelodySession createAudioContext={createAudioContext} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    expect(screen.getByRole("alert")).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    expect(createAudioContext).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Lead-in")).toBeTruthy();
  });

  it("contains synchronous and asynchronous context close failures on unmount", async () => {
    const asyncAudio = fakeAudio();
    asyncAudio.close.mockRejectedValueOnce(new Error("close rejected"));
    const asyncView = render(<MelodySession createAudioContext={() => asyncAudio.context} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    expect(() => asyncView.unmount()).not.toThrow();

    const syncAudio = fakeAudio();
    syncAudio.context.close = vi.fn(() => { throw new Error("close threw"); });
    const syncView = render(<MelodySession createAudioContext={() => syncAudio.context} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    expect(() => syncView.unmount()).not.toThrow();
  });
});
