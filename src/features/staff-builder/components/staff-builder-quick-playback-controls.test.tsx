import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffBuilderQuickPlaybackControls } from "./staff-builder-quick-playback-controls";

afterEach(cleanup);
const ready = { auditionReady: true, auditionReason: null, fullPlaybackReady: true, fullPlaybackReason: null };

describe("StaffBuilderQuickPlaybackControls", () => {
  it("keeps stable order, complete names, tooltips, and exact callback routing", () => {
    const callbacks = [vi.fn(), vi.fn(), vi.fn(), vi.fn(), vi.fn()];
    const { container } = render(<StaffBuilderQuickPlaybackControls availability={ready} onAuditionSelectedEvent={callbacks[0]} onPlayCurrentMeasure={callbacks[1]} onPlayFromHere={callbacks[2]} onPlayEntirePiece={callbacks[3]} onStop={callbacks[4]} state={{ status: "idle", scope: null, message: "Ready." }} />);
    const buttons = [...container.querySelectorAll("button")];
    expect(buttons.map(({ ariaLabel }) => ariaLabel)).toEqual(["Audition Selected Event", "Play Measure", "Play From Here", "Play Piece"]);
    expect(buttons.map(({ title }) => title)).toEqual(["Audition Selected Event", "Play Measure", "Play From Here", "Play Piece"]);
    expect(screen.queryByRole("button", { name: "Stop playback" })).toBeNull();
    buttons.forEach((button) => fireEvent.click(button));
    callbacks.slice(0, 4).forEach((callback) => expect(callback).toHaveBeenCalledOnce());
    expect(callbacks[4]).not.toHaveBeenCalled();
    expect(buttons.every((button) => button.querySelector("svg")?.getAttribute("aria-hidden") === "true")).toBe(true);
  });

  it("shares disabled reasons and announces the active playback scope", () => {
    const stop = vi.fn();
    const { container } = render(<StaffBuilderQuickPlaybackControls availability={{ auditionReady: false, auditionReason: "Select a finished note or chord in Rhythm Correction to audition it.", fullPlaybackReady: false, fullPlaybackReason: "Playback unavailable: 2 score issues remain." }} onAuditionSelectedEvent={vi.fn()} onPlayCurrentMeasure={vi.fn()} onPlayFromHere={vi.fn()} onPlayEntirePiece={vi.fn()} onStop={stop} state={{ status: "playing", scope: "current-measure", message: "Playing." }} />);
    const audition = screen.getByRole("button", { name: "Audition Selected Event" }) as HTMLButtonElement;
    const measure = screen.getByRole("button", { name: "Play Measure" }) as HTMLButtonElement;
    expect(audition.disabled).toBe(true);
    expect(audition.title).toContain("Select a finished note");
    expect(measure.disabled).toBe(true);
    expect(measure.title).toContain("2 score issues");
    expect(measure.getAttribute("aria-pressed")).toBe("true");
    expect(measure.getAttribute("aria-describedby")).toBe("staff-builder-quick-playback-reason");
    expect(audition.getAttribute("aria-describedby")).toBe("staff-builder-quick-audition-reason");
    expect(container.querySelectorAll(".staff-builder-quick-playback-reason")).toHaveLength(1);
    expect(screen.getByText("2 issues block playback")).toBeTruthy();
    expect(screen.getByText("Playback unavailable: 2 score issues remain.", { selector: ".sr-only" })).toBeTruthy();
    const stopButton = screen.getByRole("button", { name: "Stop playback" }) as HTMLButtonElement;
    expect(stopButton.disabled).toBe(false);
    fireEvent.click(stopButton);
    expect(stop).toHaveBeenCalledOnce();
  });
});
