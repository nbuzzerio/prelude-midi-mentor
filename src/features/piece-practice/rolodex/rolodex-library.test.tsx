import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RolodexLibrary } from "./rolodex-library";
import { createEntry } from "./rolodex-model";
import { testScore } from "../continuous/continuous-test-fixtures";
import type { RolodexStore } from "./rolodex-types";
vi.mock("../continuous/continuous-score", () => ({ ContinuousScore: () => <div>Frozen notation</div> }));
vi.mock("../persistence/piece-practice-runs", async original => ({ ...await original<object>(), piecePracticeRunStore: { list: async () => [] } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("compact Rolodex library", () => {
  const entry = createEntry(testScore(), "piano");
  function store(): RolodexStore {
    return { list: vi.fn(async () => ({ entries: [entry], unavailableCount: 0 })), save: vi.fn(async e => ({ entry: e, duplicate: false })),
      remove: vi.fn(async () => {}), importEntries: vi.fn(async () => {}), acknowledge: vi.fn(async () => {}) };
  }
  it("finds and prepares frozen music after original deletion", async () => {
    render(<RolodexLibrary sources={[]} store={store()} onExit={vi.fn()} />);
    await screen.findByText("1 active passages · your saved musical challenges");
    expect(screen.getByText(/Original piece unavailable/)).toBeTruthy();
    fireEvent.click(screen.getByText("Practice Now"));
    expect(screen.getByText(/Music comes from the saved snapshot/)).toBeTruthy();
    expect((screen.getByText("Prepare Saved Passage") as HTMLButtonElement).disabled).toBe(true);
  });
  it("keeps violin-only practice unavailable", async () => {
    const s = store(); s.list = async () => ({ entries: [createEntry(testScore(), "violin")], unavailableCount: 0 });
    render(<RolodexLibrary sources={[]} store={s} onExit={vi.fn()} />);
    await screen.findByText("Practice Now");
    expect((screen.getByText("Practice Now") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Edit eligibility and select Piano explicitly/)).toBeTruthy();
  });
  it("preserves failed changes and retries the exact mutation", async () => {
    const s = store(), save = vi.fn<RolodexStore["save"]>().mockRejectedValueOnce(Error("Quota failed")).mockImplementation(async e => ({ entry: e, duplicate: false }));
    s.save = save;
    render(<RolodexLibrary sources={[]} store={s} onExit={vi.fn()} />);
    await screen.findByText("Prioritize"); fireEvent.click(screen.getByText("Prioritize"));
    await screen.findByText("Quota failed");
    fireEvent.click(screen.getByText("Retry Rolodex Change"));
    await screen.findByText("Passage updated locally.");
    expect(save.mock.calls[1]![0]).toBe(save.mock.calls[0]![0]);
  });
  it("requires explicit confirmation before removal", async () => {
    const s = store(), confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<RolodexLibrary sources={[]} store={s} onExit={vi.fn()} />);
    await screen.findByText("Remove"); fireEvent.click(screen.getByText("Remove"));
    expect(s.remove).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); fireEvent.click(screen.getByText("Remove"));
    await waitFor(() => expect(s.remove).toHaveBeenCalledWith(entry.id, entry.revision));
  });
  it("shows preserved unreadable records without fabricating entries", async () => {
    const s = store(); s.list = async () => ({ entries: [], unavailableCount: 1 });
    render(<RolodexLibrary sources={[]} store={s} onExit={vi.fn()} />);
    expect(await screen.findByText(/1 corrupt or unsupported records/)).toBeTruthy();
    expect(screen.queryByText("Practice Now")).toBeNull();
  });
});
