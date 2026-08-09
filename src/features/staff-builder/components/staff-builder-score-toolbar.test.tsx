import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setInstrumentVolume } from "@/lib/audio/instrument-volume";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { StaffBuilderScoreToolbar } from "./staff-builder-score-toolbar";

const score: StaffBuilderScoreV1 = {
  schemaVersion: 1, id: "score", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100,
  initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events: [] }, { id: "m2", events: [] }], ties: [],
};
afterEach(() => { cleanup(); setInstrumentVolume(0.5); });

describe("StaffBuilderScoreToolbar", () => {
  it("composes one immediate row in previous, measure, next, volume order without key or time", () => {
    const { container } = render(<StaffBuilderScoreToolbar measureIndex={1} onNavigate={vi.fn()} score={score} />);
    const labels = [...container.querySelectorAll(".staff-builder-score-toolbar-row button")].map((button) => button.getAttribute("aria-label"));
    expect(labels).toEqual(["Previous Measure", "Current measure: Measure 2 of 2", "Next Measure", "Instrument volume, 50 percent"]);
    expect(screen.queryByRole("button", { name: /Key signature/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Time signature/ })).toBeNull();
  });

  it("retains navigation callbacks, disabled meaning, and volume disclosure", () => {
    const navigate = vi.fn();
    render(<StaffBuilderScoreToolbar measureIndex={1} navigationDisabled navigationDisabledReason="Playback follows the score." onNavigate={navigate} score={score} />);
    const previous = screen.getByRole("button", { name: "Previous Measure" }) as HTMLButtonElement;
    expect(previous.disabled).toBe(true);
    expect(previous.title).toBe("Playback follows the score.");
    const volume = screen.getByRole("button", { name: "Instrument volume, 50 percent" });
    fireEvent.click(volume);
    expect(volume.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByLabelText("Instrument volume")).toBeTruthy();
  });
});
