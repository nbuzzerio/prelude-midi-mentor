import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import InstrumentVolumeControl from "./instrument-volume-control";

afterEach(cleanup);

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
});
