import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MelodySession from "./melody-session";

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
vi.mock("@/features/staff-builder/components/staff-builder-score-view", () => ({ StaffBuilderScoreView: ({ measureIndex, visibleStaff, playbackPosition }: Record<string, unknown>) => <div data-offset={(playbackPosition as { offsetTicks?: number } | undefined)?.offsetTicks} data-staff={visibleStaff}>Score measure {Number(measureIndex) + 1}</div> }));
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

  it("shows defaults, generated notation, one keyboard, and changes settings", () => {
    render(<MelodySession seedFactory={() => "seed"} />);
    expect((screen.getByRole("combobox", { name: "Staff" }) as HTMLSelectElement).value).toBe("treble");
    expect((screen.getByRole("combobox", { name: "Tempo" }) as HTMLSelectElement).value).toBe("60");
    expect(screen.getAllByText(/Score measure/)).toHaveLength(1);
    expect(screen.getByText("Keyboard 60-72")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Staff" }), { target: { value: "bass" } });
    expect(screen.getByText("Keyboard 48-60")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Length" }), { target: { value: "2" } });
    expect(screen.getAllByText(/Score measure/)).toHaveLength(2);
  });

  it("keeps Continuous Practice optional with a ten-attempt default", () => {
    render(<MelodySession seedFactory={() => "seed"} />);
    const continuous = screen.getByRole("checkbox", {
      name: "Continuous Practice",
    });
    expect((continuous as HTMLInputElement).checked).toBe(false);
    expect(screen.getByRole("button", { name: "Start Exercise" })).toBeTruthy();
    expect(screen.queryByRole("combobox", { name: "Session length" })).toBeNull();

    fireEvent.click(continuous);
    const length = screen.getByRole("combobox", { name: "Session length" });
    expect((length as HTMLSelectElement).value).toBe("10");
    expect([...length.querySelectorAll("option")].map(({ value }) => value)).toEqual([
      "5",
      "10",
      "20",
    ]);
    expect(screen.getByRole("button", { name: "Start Session" })).toBeTruthy();
  });

  it("starts continuous retries directly and completes the configured session", async () => {
    const audio = fakeAudio();
    const createAudioContext = vi.fn(() => audio.context);
    render(<MelodySession createAudioContext={createAudioContext} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Session length" }), {
      target: { value: "5" },
    });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      audio.setNow(attempt * 20);
      act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
      if (attempt < 5) {
        expect(screen.getByText(`Attempt ${attempt} of 5 complete`)).toBeTruthy();
        fireEvent.click(screen.getByRole("button", { name: "Retry Same" }));
        await waitFor(() => expect(screen.getByText("Count in")).toBeTruthy());
        expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();
      }
    }

    expect(screen.getByRole("heading", { name: "Session complete" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Session complete" }));
    expect(screen.getByText("5", { selector: "strong" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Retry Same" })).toBeNull();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
    const completedScore = screen.queryByText("Score measure 1");
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    await waitFor(() => expect(screen.getByText("Count in")).toBeTruthy());
    expect(screen.getByText("Attempt 1 of 5")).toBeTruthy();
    expect(screen.getByText("Score measure 1")).not.toBe(completedScore);
    expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();
  });

  it("ends a completed Continuous Practice session through Settings", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Session length" }), { target: { value: "5" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      audio.setNow(attempt * 20);
      act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
      if (attempt < 5) {
        fireEvent.click(screen.getByRole("button", { name: "Retry Same" }));
        await waitFor(() => expect(screen.getByText("Count in")).toBeTruthy());
      }
    }
    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    expect(screen.getByRole("button", { name: "Start Session" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Session complete" })).toBeNull();
    expect(screen.queryByText(/Attempt \d+ of 5/)).toBeNull();
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
    await waitFor(() => expect(screen.getByText("Count in")).toBeTruthy());
    expect(screen.getByText("Score measure 1")).not.toBe(firstScore);
    expect(seedFactory).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button", { name: /Start (Session|Exercise)/ })).toBeNull();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
  });

  it("routes an imperfect Continuous Practice result pedal press into a direct retry", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());

    act(() => midi.options?.onSustainPedalChanged?.(true));
    await waitFor(() => expect(screen.getByText("Count in")).toBeTruthy());
    expect(screen.getByText("Attempt 2 of 10")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start Session" })).toBeNull();
  });

  it("cancels Continuous Practice and clears progress when hidden", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.click(screen.getByRole("button", { name: "Retry Same" }));
    await waitFor(() => expect(screen.getByText("Attempt 2 of 10")).toBeTruthy());

    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(screen.getByRole("button", { name: "Start Session" })).toBeTruthy();
    expect(screen.queryByText(/Attempt \d+ of 10/)).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("no longer active");
  });

  it("resets attempt source locking between Continuous Practice attempts", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    fireEvent.click(screen.getByRole("checkbox", { name: "Continuous Practice" }));
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Session" })); });
    audio.setNow(4.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    act(() => midi.options?.onNotePlayed?.(60));
    expect(screen.getByText(/Input: MIDI/)).toBeTruthy();
    audio.setNow(20);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.click(screen.getByRole("button", { name: "Retry Same" }));
    await waitFor(() => expect(screen.getByText("Count in")).toBeTruthy());
    expect(screen.queryByText(/Input:/)).toBeNull();
    audio.setNow(24.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    fireEvent.pointerDown(screen.getByRole("button", { name: "Virtual note" }));
    expect(screen.getByText(/Input: On-screen keyboard/)).toBeTruthy();
  });

  it("keeps one responsive keyboard and one shared score/count scroll track for both measures", () => {
    const { container } = render(<MelodySession seedFactory={() => "seed"} />);
    fireEvent.change(screen.getByRole("combobox", { name: "Length" }), { target: { value: "2" } });
    expect(screen.getAllByText(/Keyboard /)).toHaveLength(1);
    expect(screen.getAllByText(/Score measure/)).toHaveLength(2);
    const scroll = container.querySelector(".melody-score-scroll");
    expect(scroll?.getAttribute("data-measure-count")).toBe("2");
    expect(screen.getByLabelText("Melody exercise score and count guide").tabIndex).toBe(0);
    expect(scroll?.querySelectorAll(".melody-score-track")).toHaveLength(1);
    expect(scroll?.querySelectorAll('[aria-label="Count guide"]')).toHaveLength(1);
  });

  it("enters and exits Mobile Play in setup without regenerating or duplicating practice UI", async () => {
    const seedFactory = vi.fn(() => "stable-seed");
    render(<MelodySession seedFactory={seedFactory} />);

    fireEvent.click(screen.getByRole("button", { name: "Mobile Play" }));

    expect(screen.getByRole("button", { name: "Exit Mobile Play" })).toBeTruthy();
    expect(screen.getAllByText(/Keyboard /)).toHaveLength(1);
    expect(screen.getAllByText("Score measure 1")).toHaveLength(1);
    expect(screen.getAllByLabelText("Count guide")).toHaveLength(1);
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
    expect(screen.getByText("Count in")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exit Mobile Play" }));
    expect(screen.getByText("Count in")).toBeTruthy();
    expect(createAudioContext).toHaveBeenCalledTimes(1);

    audio.setNow(4.1);
    act(() => (globalThis as typeof globalThis & { runMelodyFrame: () => void }).runMelodyFrame());
    expect(screen.getByText(/^Play/)).toBeTruthy();
    expect(createAudioContext).toHaveBeenCalledTimes(1);
  });

  it("preserves the performing recorder and MIDI source lock across entry and exit", async () => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    audio.setNow(4.1);
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
    audio.setNow(4.1);
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
    expect(screen.getByText("Count in")).toBeTruthy();
  });

  it.each(["count-in", "performing"] as const)("aborts without scoring when hidden during %s", async (phase) => {
    const audio = fakeAudio();
    render(<MelodySession createAudioContext={() => audio.context} seedFactory={() => "seed"} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Start Exercise" })); });
    if (phase === "performing") {
      audio.setNow(4.1);
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
    expect(screen.getByText("Count in")).toBeTruthy();
    act(() => midi.options?.onNotePlayed?.(60));
    audio.setNow(4.1);
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
    expect(screen.getByText("Count in")).toBeTruthy();
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
    expect(screen.getByText("Count in")).toBeTruthy();
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
