import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useStaffBuilderInput } from "./use-staff-builder-input";

const { useMidi } = vi.hoisted(() => ({ useMidi: vi.fn((options: { onNotePlayed: (midiNumber: number) => void }) => {
  void options;
  return { status: "connected", deviceName: "Keys", error: null, connectMidi: vi.fn() };
}) }));
vi.mock("@/hooks/use-midi", () => ({ useMidi }));

describe("useStaffBuilderInput", () => {
  it("translates the existing MIDI note-on boundary without owning capture state", () => {
    const onMidiNote = vi.fn();
    const { result } = renderHook(() => useStaffBuilderInput(onMidiNote));
    const options = useMidi.mock.calls[0]?.[0];
    options?.onNotePlayed(64);
    expect(onMidiNote).toHaveBeenCalledWith(64);
    expect(result.current.status).toBe("connected");
  });
});
