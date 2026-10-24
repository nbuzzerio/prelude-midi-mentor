import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ContinuousInputSelector } from "./continuous-input-selector";
import { saveContinuousInputPreference } from "./continuous-input-preference";
const a = { id: "silent", name: "Same name" }, b = { id: "piano", name: "Same name" };
beforeEach(() => localStorage.clear());
afterEach(cleanup);
it("shows distinguishable ports, requires a choice, and restores the explicit second port", () => {
  const onSelection = vi.fn(), v = render(<ContinuousInputSelector inputs={[a, b]} onSelection={onSelection} />);
  const select = screen.getByLabelText("Physical MIDI Input") as HTMLSelectElement;
  expect(select.value).toBe(""); expect(screen.getByText("Same name · silent")).toBeTruthy(); expect(screen.getByText("Same name · piano")).toBeTruthy();
  fireEvent.change(select, { target: { value: "piano" } }); expect(onSelection).toHaveBeenLastCalledWith(b);
  v.unmount(); render(<ContinuousInputSelector inputs={[a, b]} onSelection={onSelection} />);
  expect((screen.getByLabelText("Physical MIDI Input") as HTMLSelectElement).value).toBe("piano");
});
it("explains a lost or changed identity and requires deliberate selection of its replacement", () => {
  saveContinuousInputPreference(b); const onSelection = vi.fn();
  const v = render(<ContinuousInputSelector inputs={[a]} onSelection={onSelection} />);
  expect(screen.getByRole("alert").textContent).toContain("No other port has been substituted"); expect(onSelection).toHaveBeenLastCalledWith(null);
  v.rerender(<ContinuousInputSelector inputs={[a, { ...b, id: "new" }]} onSelection={onSelection} />);
  expect((screen.getByLabelText("Physical MIDI Input") as HTMLSelectElement).value).toBe("");
  fireEvent.change(screen.getByLabelText("Physical MIDI Input"), { target: { value: "new" } });
  expect(onSelection).toHaveBeenLastCalledWith({ ...b, id: "new" });
});
it("displays unidentifiable ports but cannot select them or ambiguous IDs", () => {
  render(<ContinuousInputSelector inputs={[{ id: null, name: "Keys" }, b, b]} onSelection={vi.fn()} />);
  const options = screen.getAllByRole("option") as HTMLOptionElement[];
  expect(options.slice(1).every(o => o.disabled)).toBe(true);
  expect(screen.getByText(/browser identity unavailable/)).toBeTruthy();
});
