import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getInstrumentVolume, setInstrumentVolume } from "@/lib/audio/instrument-volume";
import InstrumentVolumeControl from "./instrument-volume-control";

afterEach(() => { cleanup(); setInstrumentVolume(0.5); });

describe("InstrumentVolumeControl", () => {
  it("hides the replay section for volume-only consumers", () => {
    render(<InstrumentVolumeControl showReplayCompletedChords={false} />);

    expect(screen.getByRole("slider", { name: "Instrument volume" })).toBeTruthy();
    expect(screen.queryByRole("checkbox", { name: /replay completed chords/i })).toBeNull();
  });

  it("keeps visible replay behavior and invokes its required callback", () => {
    const onReplayChange = vi.fn();
    render(
      <InstrumentVolumeControl
        onReplayCorrectVirtualChordsChange={onReplayChange}
        replayCorrectVirtualChords={false}
      />,
    );

    fireEvent.click(
      screen.getByRole("checkbox", { name: /replay completed chords/i }),
    );

    expect(onReplayChange).toHaveBeenCalledWith(true);
  });

  it("supports a scoped input id while retaining shared volume storage", () => {
    render(<InstrumentVolumeControl inputId="staff-volume" showReplayCompletedChords={false} />);
    const slider = screen.getByRole("slider", { name: "Instrument volume" });
    expect(slider.getAttribute("id")).toBe("staff-volume");
    fireEvent.change(slider, { target: { value: "70" } });
    expect(getInstrumentVolume()).toBe(0.7);
  });
});
