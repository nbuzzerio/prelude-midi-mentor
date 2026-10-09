import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AcousticAnalysisExportControls } from "./acoustic-analysis-export-controls";

afterEach(cleanup);

it("collapses display independently of collection preference, keeping loss/error notices visible", () => {
  const control = { enabled: true, notice: "Collected evidence can still be exported.", changeEnabled: vi.fn(), export: vi.fn() };
  const view = render(<AcousticAnalysisExportControls control={control} capturing />);
  const summary = screen.getByText(/Acoustic Analysis \/ Export/);
  const details = summary.closest("details")!;
  expect(details.open).toBe(false);
  expect(screen.getByText(/Export before leaving/).closest("details")).toBeNull();
  expect(screen.getByRole("status").closest("details")).toBeNull();
  summary.focus(); expect(document.activeElement).toBe(summary);
  fireEvent.click(summary); expect(details.open).toBe(true);
  fireEvent.click(summary); expect(details.open).toBe(false);
  expect(control.changeEnabled).not.toHaveBeenCalled();
  expect(control.export).not.toHaveBeenCalled();
  view.rerender(<AcousticAnalysisExportControls control={control} capturing={false} />);
  fireEvent.click(summary);
  fireEvent.click(screen.getByRole("button", { name: "Export Acoustic Analysis" }));
  expect(control.export).toHaveBeenCalledOnce();
  fireEvent.change(screen.getByLabelText("Analysis data"), { target: { value: "off" } });
  expect(control.changeEnabled).toHaveBeenCalledExactlyOnceWith(false);
});
