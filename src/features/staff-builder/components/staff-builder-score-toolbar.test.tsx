import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setInstrumentVolume } from "@/lib/audio/instrument-volume";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { StaffBuilderScoreToolbar } from "./staff-builder-score-toolbar";

const score: StaffBuilderScoreV1 = {
  schemaVersion: 1, id: "score", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100,
  initialKeySignatureId: "c-major", initialTimeSignature: "4/4",
  measures: [{ id: "m1", events: [] }, { id: "m2", events: [], keySignatureChange: "g-major", timeSignatureChange: "3/4" }, { id: "m3", events: [] }], ties: [],
};

afterEach(() => { cleanup(); setInstrumentVolume(0.5); });

describe("StaffBuilderScoreToolbar", () => {
  it("shows inherited effective context and opens only one editor at a time", () => {
    const onKeyChange = vi.fn(); const onTimeChange = vi.fn();
    render(<StaffBuilderScoreToolbar measureIndex={2} onKeyChange={onKeyChange} onTimeChange={onTimeChange} score={score} />);
    const key = screen.getByRole("button", { name: "Key signature: G major" });
    const time = screen.getByRole("button", { name: "Time signature: 3/4" });
    expect(key.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(key);
    expect(screen.getByLabelText("Key signature")).toBeTruthy();
    expect(screen.queryByLabelText("Time signature")).toBeNull();
    fireEvent.change(screen.getByLabelText("Key signature"), { target: { value: "inherit" } });
    expect(onKeyChange).toHaveBeenCalledWith(2, null);
    fireEvent.click(time);
    expect(key.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByLabelText("Key signature")).toBeNull();
    expect(screen.getByLabelText("Time signature")).toBeTruthy();
  });

  it("edits measure 1 initial context through existing callbacks", () => {
    const onKeyChange = vi.fn();
    render(<StaffBuilderScoreToolbar measureIndex={0} onKeyChange={onKeyChange} onTimeChange={vi.fn()} score={score} />);
    fireEvent.click(screen.getByRole("button", { name: "Key signature: C major" }));
    fireEvent.change(screen.getByLabelText("Key signature"), { target: { value: "a-minor" } });
    expect(onKeyChange).toHaveBeenCalledWith(0, "a-minor");
  });

  it("updates effective override and inherited context when the visible measure changes", () => {
    const props = { onKeyChange: vi.fn(), onTimeChange: vi.fn(), score };
    const { rerender } = render(<StaffBuilderScoreToolbar measureIndex={0} {...props} />);
    expect(screen.getByRole("button", { name: "Key signature: C major" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Time signature: 4/4" })).toBeTruthy();
    rerender(<StaffBuilderScoreToolbar measureIndex={1} {...props} />);
    expect(screen.getByRole("button", { name: "Key signature: G major" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Time signature: 3/4" })).toBeTruthy();
    rerender(<StaffBuilderScoreToolbar measureIndex={2} {...props} />);
    expect(screen.getByRole("button", { name: "Key signature: G major" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Time signature: 3/4" })).toBeTruthy();
  });

  it("discloses shared volume and exposes a non-color-only muted state", () => {
    setInstrumentVolume(0);
    const { container } = render(<StaffBuilderScoreToolbar measureIndex={0} onKeyChange={vi.fn()} onTimeChange={vi.fn()} score={score} />);
    const trigger = screen.getByRole("button", { name: "Instrument volume, 0 percent, muted" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(trigger.textContent).toContain("0%");
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(trigger);
    fireEvent.change(screen.getByLabelText("Instrument volume"), { target: { value: "70" } });
    expect(screen.getByRole("button", { name: "Instrument volume, 70 percent" })).toBeTruthy();
  });
});
