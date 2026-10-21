import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { AppMidiContext, type AppMidiContextValue } from "@/components/midi/midi-context";
import { RolodexAcceptanceControl, RolodexProgressPanel } from "./rolodex-progress-panel";
import { createEntry } from "./rolodex-model";
import { testScore, TEST_INPUT } from "../continuous/continuous-test-fixtures";

afterEach(cleanup);
it("keeps automatic qualification off on opening and requires a deliberate device and QA confirmation", () => {
  const save = vi.fn();
  const midi: AppMidiContextValue = { status: "connected", connectedInputs: [TEST_INPUT], deviceName: TEST_INPUT.name, error: null, connectMidi: vi.fn(), registerConsumer: vi.fn() };
  render(<AppMidiContext.Provider value={midi}><RolodexAcceptanceControl acceptance={null} busy={false} onSave={save} /></AppMidiContext.Provider>);
  const button = screen.getByRole("button", { name: "Enable Future Qualification", hidden: true }) as HTMLButtonElement;
  expect(button.disabled).toBe(true); expect(save).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Physically tested MIDI device"), { target: { value: "piano" } });
  expect(button.disabled).toBe(true);
  fireEvent.click(screen.getByRole("checkbox", { hidden: true })); expect(button.disabled).toBe(false); expect(save).not.toHaveBeenCalled();
  fireEvent.click(button); expect(save).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ enabled: true, inputId: "piano", version: 1 }));
  expect(button.disabled).toBe(true);
});
it("cannot enable an absent physical input or turn import into acceptance", () => {
  const save = vi.fn(); render(<RolodexAcceptanceControl acceptance={null} busy={false} onSave={save} />);
  fireEvent.click(screen.getByRole("checkbox", { hidden: true }));
  expect((screen.getByRole("button", { name: "Enable Future Qualification", hidden: true }) as HTMLButtonElement).disabled).toBe(true);
  expect(save).not.toHaveBeenCalled();
});
it("does not display manually chosen Improving as measured qualifying credit", () => {
  render(<RolodexProgressPanel entry={{ ...createEntry(testScore(), "piano"), status: "improving" }} />);
  expect(screen.getByText(/0\/3 qualifying clean runs/)).toBeTruthy();
  expect(screen.getByText(/Not enough comparable practice history yet/)).toBeTruthy();
  expect(screen.getByText(/Physical timing acceptance defaults off/)).toBeTruthy();
});
it.each(["violin", "ocarina"] as const)("does not invent Piano qualification for the selected %s profile", instrument => {
  render(<RolodexProgressPanel entry={createEntry(testScore(), instrument)} />);
  expect(screen.getByText(new RegExp(`Qualification is unavailable for the selected ${instrument} profile`))).toBeTruthy();
  expect(screen.queryByText(/qualifying clean runs/)).toBeNull();
});
