// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StrictMode, useEffect } from "react";
import { MidiProvider } from "./midi-provider";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";

const lowLevel = vi.hoisted(() => ({
  connectMidi: vi.fn(async () => undefined),
  options: null as null | Readonly<{
    onHeldNotesChanged?: (notes: ReadonlySet<number>) => void;
    onNotePlayed: (midiNumber: number) => void;
    onSustainPedalChanged?: (isDown: boolean) => void;
  }>,
  ownerCount: 0,
}));

vi.mock("@/hooks/use-midi", () => ({
  useMidi: (options: typeof lowLevel.options) => {
    useEffect(() => {
      lowLevel.ownerCount += 1;
      return () => { lowLevel.ownerCount -= 1; };
    }, []);
    lowLevel.options = options;
    return { connectMidi: lowLevel.connectMidi, deviceName: "Shared Keys", error: null, status: "connected" as const };
  },
}));

function Consumer({ label, onHeld, onNote, onSustain = vi.fn() }: Readonly<{
  label: string;
  onHeld: (notes: ReadonlySet<number>) => void;
  onNote: (midiNumber: number) => void;
  onSustain?: (isDown: boolean) => void;
}>) {
  const midi = useAppMidiInput({ onHeldNotesChanged: onHeld, onNotePlayed: onNote, onSustainPedalChanged: onSustain });
  return <button onClick={() => void midi.connectMidi()} type="button">{label}: {midi.status} {midi.deviceName}</button>;
}

describe("MidiProvider", () => {
  beforeEach(() => {
    lowLevel.connectMidi.mockClear();
    lowLevel.options = null;
    lowLevel.ownerCount = 0;
  });
  afterEach(cleanup);

  it("owns one low-level MIDI lifecycle and shares connection presentation", () => {
    render(<MidiProvider><Consumer label="Feature" onHeld={vi.fn()} onNote={vi.fn()} /></MidiProvider>);
    expect(lowLevel.ownerCount).toBe(1);
    expect(screen.getByRole("button").textContent).toContain("connected Shared Keys");
    fireEvent.click(screen.getByRole("button"));
    expect(lowLevel.connectMidi).toHaveBeenCalledTimes(1);
  });

  it("routes attacks only to the newest consumer and old cleanup cannot unregister it", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <MidiProvider>
        <Consumer key="first" label="First" onHeld={vi.fn()} onNote={first} />
        <Consumer key="second" label="Second" onHeld={vi.fn()} onNote={second} />
      </MidiProvider>,
    );
    act(() => lowLevel.options?.onNotePlayed(60));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(60);

    rerender(<MidiProvider><Consumer key="second" label="Second" onHeld={vi.fn()} onNote={second} /></MidiProvider>);
    act(() => lowLevel.options?.onNotePlayed(62));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenLastCalledWith(62);
  });

  it("routes sustain changes only to the active consumer", () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(
      <MidiProvider>
        <Consumer label="First" onHeld={vi.fn()} onNote={vi.fn()} onSustain={first} />
        <Consumer label="Second" onHeld={vi.fn()} onNote={vi.fn()} onSustain={second} />
      </MidiProvider>,
    );
    act(() => lowLevel.options?.onSustainPedalChanged?.(true));
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith(true);

    rerender(<MidiProvider><div>No consumer</div></MidiProvider>);
    act(() => lowLevel.options?.onSustainPedalChanged?.(false));
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("preserves held notes across consumer switches without replaying an attack", () => {
    const firstNote = vi.fn();
    const secondNote = vi.fn();
    const firstHeld = vi.fn();
    const secondHeld = vi.fn();
    const { rerender } = render(<MidiProvider><Consumer key="first" label="First" onHeld={firstHeld} onNote={firstNote} /></MidiProvider>);
    act(() => {
      lowLevel.options?.onHeldNotesChanged?.(new Set([60]));
      lowLevel.options?.onNotePlayed(60);
    });
    expect(firstNote).toHaveBeenCalledWith(60);

    rerender(<MidiProvider><Consumer key="second" label="Second" onHeld={secondHeld} onNote={secondNote} /></MidiProvider>);
    expect(secondHeld).toHaveBeenLastCalledWith(new Set([60]));
    expect(secondNote).not.toHaveBeenCalled();
    act(() => lowLevel.options?.onHeldNotesChanged?.(new Set()));
    expect(secondHeld).toHaveBeenLastCalledWith(new Set());
  });

  it("uses current callback refs without replacing the low-level owner", () => {
    const oldCallback = vi.fn();
    const currentCallback = vi.fn();
    const { rerender } = render(<MidiProvider><Consumer label="Feature" onHeld={vi.fn()} onNote={oldCallback} /></MidiProvider>);
    rerender(<MidiProvider><Consumer label="Feature" onHeld={vi.fn()} onNote={currentCallback} /></MidiProvider>);
    act(() => lowLevel.options?.onNotePlayed(67));
    expect(oldCallback).not.toHaveBeenCalled();
    expect(currentCallback).toHaveBeenCalledWith(67);
    expect(lowLevel.ownerCount).toBe(1);
  });

  it("keeps physical held state while no consumer is mounted", () => {
    const held = vi.fn();
    const { rerender } = render(<MidiProvider><div>No MIDI consumer</div></MidiProvider>);
    act(() => lowLevel.options?.onHeldNotesChanged?.(new Set([65])));
    rerender(<MidiProvider><Consumer label="Next" onHeld={held} onNote={vi.fn()} /></MidiProvider>);
    expect(held).toHaveBeenLastCalledWith(new Set([65]));
  });

  it("does not connect automatically or duplicate active routing under Strict Mode", () => {
    const onNote = vi.fn();
    render(<StrictMode><MidiProvider><Consumer label="Strict" onHeld={vi.fn()} onNote={onNote} /></MidiProvider></StrictMode>);
    expect(lowLevel.connectMidi).not.toHaveBeenCalled();
    expect(lowLevel.ownerCount).toBe(1);
    act(() => lowLevel.options?.onNotePlayed(69));
    expect(onNote).toHaveBeenCalledTimes(1);
  });
});
