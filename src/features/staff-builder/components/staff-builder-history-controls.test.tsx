import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StaffBuilderHistoryControls } from "./staff-builder-history-controls";

afterEach(cleanup);

describe("StaffBuilderHistoryControls", () => {
  it("routes enabled history actions with explicit icon-button names", () => {
    const undo = vi.fn(); const redo = vi.fn();
    render(<StaffBuilderHistoryControls canRedo canUndo onRedo={redo} onUndo={undo} />);
    const undoButton = screen.getByRole("button", { name: "Undo last score edit" });
    const redoButton = screen.getByRole("button", { name: "Redo last score edit" });
    expect(undoButton.title).toBe("Undo last score edit");
    expect(redoButton.title).toBe("Redo last score edit");
    expect(undoButton.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
    fireEvent.click(undoButton); fireEvent.click(redoButton);
    expect(undo).toHaveBeenCalledOnce(); expect(redo).toHaveBeenCalledOnce();
  });

  it("uses native disabled state", () => {
    render(<StaffBuilderHistoryControls canRedo={false} canUndo={false} onRedo={vi.fn()} onUndo={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Undo last score edit" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Redo last score edit" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
