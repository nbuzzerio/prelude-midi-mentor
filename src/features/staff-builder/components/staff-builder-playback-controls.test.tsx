import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderPlaybackState } from "../hooks/use-staff-builder-playback";
import type { StaffBuilderEvent } from "../staff-builder-types";
import { StaffBuilderPlaybackControls } from "./staff-builder-playback-controls";

afterEach(cleanup);

const selectedEvent: StaffBuilderEvent = {
  id: "event", kind: "notes", staff: "treble", startTick: 0,
  rhythm: { status: "final", duration: "quarter" },
  pitches: [{ id: "pitch", midiNumber: 60, letter: "C", accidental: "natural", octave: 4 }],
};
const idle: StaffBuilderPlaybackState = { status: "idle", scope: null, message: "Playback ready." };

function renderControls(options: { issueCount?: number; event?: StaffBuilderEvent | null; state?: StaffBuilderPlaybackState; editorPass?: "capture" | "rhythm" } = {}) {
  const callbacks = { audition: vi.fn(), measure: vi.fn(), from: vi.fn(), entire: vi.fn(), stop: vi.fn() };
  render(<StaffBuilderPlaybackControls
    editorPass={options.editorPass ?? "rhythm"}
    issueCount={options.issueCount ?? 0}
    onAuditionSelectedEvent={callbacks.audition}
    onPlayCurrentMeasure={callbacks.measure}
    onPlayEntirePiece={callbacks.entire}
    onPlayFromHere={callbacks.from}
    onStop={callbacks.stop}
    selectedEvent={options.event === undefined ? selectedEvent : options.event}
    state={options.state ?? idle}
  />);
  return callbacks;
}

describe("StaffBuilderPlaybackControls", () => {
  it("invokes every available playback scope with simplified labels", () => {
    const callbacks = renderControls();
    fireEvent.click(screen.getByRole("button", { name: "Audition Selected Event" }));
    fireEvent.click(screen.getByRole("button", { name: "Play Measure" }));
    fireEvent.click(screen.getByRole("button", { name: "Play From Here" }));
    fireEvent.click(screen.getByRole("button", { name: "Play Piece" }));
    expect(callbacks.audition).toHaveBeenCalledOnce();
    expect(callbacks.measure).toHaveBeenCalledOnce();
    expect(callbacks.from).toHaveBeenCalledOnce();
    expect(callbacks.entire).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText("Instrument volume")).toBeNull();
    expect(screen.queryByRole("button", { name: "Stop" })).toBeNull();
  });

  it("gates rhythmic playback by current issue count with an accessible explanation", () => {
    renderControls({ issueCount: 2 });
    expect((screen.getByRole("button", { name: "Play Measure" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Play From Here" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Play Piece" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Playback unavailable: 2 score issues remain.")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Audition Selected Event" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("only renders audition for an eligible Rhythm event", () => {
    const rest: StaffBuilderEvent = { id: "rest", kind: "rest", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "quarter" } };
    const { rerender } = render(<StaffBuilderPlaybackControls editorPass="rhythm" issueCount={1} onAuditionSelectedEvent={vi.fn()} onPlayCurrentMeasure={vi.fn()} onPlayEntirePiece={vi.fn()} onPlayFromHere={vi.fn()} onStop={vi.fn()} selectedEvent={rest} state={idle} />);
    expect(screen.queryByRole("button", { name: "Audition Selected Event" })).toBeNull();
    rerender(<StaffBuilderPlaybackControls editorPass="capture" issueCount={1} onAuditionSelectedEvent={vi.fn()} onPlayCurrentMeasure={vi.fn()} onPlayEntirePiece={vi.fn()} onPlayFromHere={vi.fn()} onStop={vi.fn()} selectedEvent={selectedEvent} state={idle} />);
    expect(screen.queryByRole("button", { name: "Audition Selected Event" })).toBeNull();
  });

  it("keeps Stop reachable while playing and announces failure", () => {
    const callbacks = renderControls({ state: { status: "playing", scope: "entire-piece", message: "Playing entire piece." } });
    expect(screen.getByRole("button", { name: "Play Piece" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(callbacks.stop).toHaveBeenCalledOnce();
    cleanup();
    renderControls({ state: { status: "failed", scope: null, message: "Audio could not start." } });
    expect(screen.getByRole("alert").textContent).toBe("Audio could not start.");
  });
});
