import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RolodexEditor } from "./rolodex-editor";
import { createEntry } from "./rolodex-model";
import { testScore } from "../continuous/continuous-test-fixtures";
import type { RolodexStore } from "./rolodex-types";
vi.mock("../continuous/continuous-score", () => ({ ContinuousScore: ({ measureIndex }: { measureIndex: number }) => <div>Authored measure {measureIndex + 1}</div> }));
afterEach(cleanup);
const store = (save: RolodexStore["save"]): RolodexStore => ({ save, list: async () => ({ entries: [], unavailableCount: 0 }), remove: async () => {}, importEntries: async () => {}, acknowledge: async () => {} });
describe("manual passage editor", () => {
  it("requires explicit instrument confirmation and no MIDI or performance", async () => {
    const entry = createEntry(testScore()), saved = vi.fn(), save = vi.fn(async () => ({ entry, duplicate: false }));
    render(<RolodexEditor entry={entry} store={store(save)} onSaved={saved} onCancel={vi.fn()} />);
    expect((screen.getByText("Save Passage") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Source instrument") as HTMLSelectElement).value).toBe("unknown");
    fireEvent.click(screen.getByLabelText(/I confirm/)); fireEvent.click(screen.getByText("Save Passage"));
    await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(save.mock.calls).toHaveLength(1);
  });
  it("waits for acknowledgement and fences double clicks", async () => {
    const entry = createEntry(testScore(), "piano"), saved = vi.fn();
    let finish!: () => void;
    const save = vi.fn(() => new Promise<{ entry: typeof entry; duplicate: boolean }>(resolve => { finish = () => resolve({ entry, duplicate: false }); }));
    render(<RolodexEditor entry={entry} store={store(save)} onSaved={saved} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByLabelText(/I confirm/)); fireEvent.click(screen.getByText("Save Passage"));
    expect(saved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Saving passage…")); expect(save).toHaveBeenCalledTimes(1);
    await act(async () => finish()); expect(saved).toHaveBeenCalledTimes(1);
  });
  it("keeps the same identity and frozen payload through failed Save and Retry", async () => {
    const entry = createEntry(testScore(), "piano"), saved = vi.fn();
    const save = vi.fn<RolodexStore["save"]>().mockRejectedValueOnce(Error("Quota exceeded")).mockImplementation(async e => ({ entry: e, duplicate: false }));
    render(<RolodexEditor entry={entry} store={store(save)} onSaved={saved} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Passage nickname (optional)"), { target: { value: "Transition" } });
    fireEvent.click(screen.getByLabelText(/I confirm/)); fireEvent.click(screen.getByText("Save Passage"));
    await screen.findByText("Retry Save Passage"); expect(saved).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Retry Save Passage")); await waitFor(() => expect(saved).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[1]![0]).toBe(save.mock.calls[0]![0]);
    expect(save.mock.calls[1]![0]).toMatchObject({ id: entry.id, nickname: "Transition", sourceInstrument: "piano" });
  });
  it("changes declared instrument defaults and permits explicit cross-instrument opt-in", () => {
    render(<RolodexEditor entry={createEntry(testScore())} onSaved={vi.fn()} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Source instrument"), { target: { value: "violin" } });
    expect((screen.getByLabelText("Violin") as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText("Piano") as HTMLInputElement).checked).toBe(false);
    fireEvent.click(screen.getByLabelText("Piano"));
    expect((screen.getByLabelText("Practice instrument") as HTMLSelectElement).value).toBe("violin");
    expect(screen.getByText(/Saved collection only until/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Practice instrument"), { target: { value: "piano" } });
    expect(screen.queryByText(/Saved collection only until/)).toBeNull();
  });
});
