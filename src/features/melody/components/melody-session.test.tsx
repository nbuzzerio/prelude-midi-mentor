import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MelodySession from "./melody-session";

const midi = vi.hoisted(() => ({ options: null as null | { onNotePlayed?: (midi: number) => void } }));
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
