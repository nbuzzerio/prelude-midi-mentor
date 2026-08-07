import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { StaffBuilderMeasureContextControls } from "./staff-builder-measure-context-controls";

afterEach(cleanup);
const score: StaffBuilderScoreV1 = { schemaVersion: 1, id: "s", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", measures: [{ id: "m1", events: [] }, { id: "m2", events: [] }], ties: [] };

describe("StaffBuilderMeasureContextControls", () => {
  it("edits initial context and exposes inherited later context", () => {
    const key = vi.fn(); const time = vi.fn();
    const { rerender } = render(<StaffBuilderMeasureContextControls measureIndex={0} onKeyChange={key} onTimeChange={time} score={score} />);
    fireEvent.change(screen.getByLabelText("Key signature"), { target: { value: "g-major" } });
    fireEvent.change(screen.getByLabelText("Time signature"), { target: { value: "3/4" } });
    expect(key).toHaveBeenCalledWith(0, "g-major"); expect(time).toHaveBeenCalledWith(0, "3/4");
    rerender(<StaffBuilderMeasureContextControls measureIndex={1} onKeyChange={key} onTimeChange={time} score={score} />);
    expect(screen.getByText("This measure inherits its key and time.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Key signature"), { target: { value: "inherit" } });
    expect(key).toHaveBeenLastCalledWith(1, null);
  });
});
