import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setInstrumentVolume } from "@/lib/audio/instrument-volume";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderScoreToolbar } from "./staff-builder-score-toolbar";

const score: StaffBuilderScore = {
  schemaVersion: 3, annotations: [], id: "score", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100,
  initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events: [] }, { id: "m2", events: [] }], ties: [],
};
afterEach(() => { cleanup(); setInstrumentVolume(0.5); });

describe("StaffBuilderScoreToolbar", () => {
  it("composes one immediate row in previous, measure, next, volume order without key or time", () => {
    const { container } = render(<StaffBuilderScoreToolbar measureIndex={1} onNavigate={vi.fn()} score={score} />);
    const labels = [...container.querySelectorAll(".staff-builder-score-toolbar-row button")].map((button) => button.getAttribute("aria-label"));
    expect(labels).toEqual(["Previous Measure", "Measure 2 of 2", "Next Measure", "Instrument volume, 50 percent"]);
    expect(container.querySelectorAll(".staff-builder-score-toolbar-row")).toHaveLength(1);
    expect(container.querySelectorAll(".staff-builder-score-toolbar-playback, .staff-builder-score-toolbar-navigation, .staff-builder-score-toolbar-volume")).toHaveLength(3);
    expect(container.querySelector(".staff-builder-measure-label-full")?.textContent).toBe("Measure 2 of 2");
    expect(container.querySelector(".staff-builder-measure-label-compact")?.textContent).toBe("M 2/2");
    expect(container.querySelector(".staff-builder-volume-percent")?.textContent).toBe("50%");
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

  it("offers accessible measure-relative insertion actions and applies the shared lock", () => {
    const before = vi.fn();
    const after = vi.fn();
    const { rerender } = render(<StaffBuilderScoreToolbar measureIndex={1} onInsertMeasureAfter={after} onInsertMeasureBefore={before} onNavigate={vi.fn()} score={score} />);
    fireEvent.click(screen.getByRole("button", { name: "Insert Measure Before Measure 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Insert Measure After Measure 2" }));
    expect(before).toHaveBeenCalledOnce();
    expect(after).toHaveBeenCalledOnce();
    rerender(<StaffBuilderScoreToolbar measureIndex={1} navigationDisabled navigationDisabledReason="Playback owns the score." onInsertMeasureAfter={after} onInsertMeasureBefore={before} onNavigate={vi.fn()} score={score} />);
    expect((screen.getByRole("button", { name: "Insert Measure Before Measure 2" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Insert Measure After Measure 2" }).getAttribute("title")).toBe("Playback owns the score.");
  });

  it("offers the Study View entry through the supplied persistent launcher ref", () => {
    const open = vi.fn();
    const launcher = { current: null } as React.RefObject<HTMLButtonElement | null>;
    render(<StaffBuilderScoreToolbar measureIndex={0} onNavigate={vi.fn()} onOpenStudyView={open} score={score} studyViewButtonRef={launcher} />);
    fireEvent.click(screen.getByRole("button", { name: "Study View" }));
    expect(open).toHaveBeenCalledOnce();
    expect(launcher.current).toBeInstanceOf(HTMLButtonElement);
  });
});
