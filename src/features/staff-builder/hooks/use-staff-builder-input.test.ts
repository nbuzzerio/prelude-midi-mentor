import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useStaffBuilderInput } from "./use-staff-builder-input";

const { useAppMidiInput } = vi.hoisted(() => ({ useAppMidiInput: vi.fn((options: { onNotePlayed: (midiNumber: number) => void; onSustainPedalChanged?: (isDown: boolean) => void }) => {
  void options;
  return { status: "connected", deviceName: "Keys", error: null, connectMidi: vi.fn() };
}) }));
vi.mock("@/hooks/use-app-midi-input", () => ({ useAppMidiInput }));

beforeEach(() => useAppMidiInput.mockClear());

describe("useStaffBuilderInput", () => {
  it("translates the existing MIDI note-on boundary without owning capture state", () => {
    const onMidiNote = vi.fn();
    const { result } = renderHook(() => useStaffBuilderInput(onMidiNote));
    const options = useAppMidiInput.mock.calls[0]?.[0];
    options?.onNotePlayed(64);
    expect(onMidiNote).toHaveBeenCalledWith(64);
    expect(result.current.status).toBe("connected");
  });

  it("forwards pedal edges through the same Staff Builder MIDI consumer", () => {
    const onMidiNote = vi.fn();
    const onSustainPedalChanged = vi.fn();
    renderHook(() => useStaffBuilderInput(onMidiNote, onSustainPedalChanged));
    expect(useAppMidiInput).toHaveBeenCalledTimes(1);
    useAppMidiInput.mock.calls[0]?.[0].onSustainPedalChanged?.(true);
    useAppMidiInput.mock.calls[0]?.[0].onSustainPedalChanged?.(false);
    expect(onSustainPedalChanged.mock.calls).toEqual([[true], [false]]);
  });
});
