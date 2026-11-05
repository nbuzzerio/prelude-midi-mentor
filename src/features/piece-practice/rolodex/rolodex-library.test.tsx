import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RolodexLibrary } from "./rolodex-library";
import { createEntry } from "./rolodex-model";
import { testScore } from "../continuous/continuous-test-fixtures";
import type { RolodexStore } from "./rolodex-types";
import { createPiecePracticeRun, piecePracticeRunStore } from "../persistence/piece-practice-runs";
import { createPiecePracticeSession, skipCurrentPiecePracticeTarget } from "../piece-practice-session";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { rolodexSuggestions } from "./rolodex-suggestions";
vi.mock("../continuous/continuous-score", () => ({ ContinuousScore: () => <div>Frozen notation</div> }));
vi.mock("../persistence/piece-practice-runs", async original => ({ ...await original<object>(), piecePracticeRunStore: { list: vi.fn(async () => []) } }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe("compact Rolodex library", () => {
  const entry = createEntry(testScore(), "piano");
  function store(): RolodexStore {
    return { list: vi.fn(async () => ({ entries: [entry], unavailableCount: 0 })), save: vi.fn(async e => ({ entry: e, duplicate: false })),
      remove: vi.fn(async () => {}), importEntries: vi.fn(async () => {}), acknowledge: vi.fn(async () => {}) };
  }
  function completed() {
    const score = testScore("4/4", 1), projected = projectStaffBuilderPieceForPractice(score);
    if (!projected.ok) throw Error("fixture");
    const session = createPiecePracticeSession(projected.piece, { startMeasureIndex: 0, startedAtMs: 0 });
    if (!session.ok) throw Error("fixture");
    return createPiecePracticeRun(score, skipCurrentPiecePracticeTarget(projected.piece, session.state, 100).state, 200);
  }
  it("returns focus to the library heading after canceling a manual draft without saving", async () => {
    const s = store();
    render(<RolodexLibrary sources={[]} initialDraft={entry} store={s} onExit={vi.fn()} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Practice Rolodex" }));
    await screen.findByText("Practice Now");
    expect(s.save).not.toHaveBeenCalled();
  });
  it("offers only unsaved suggestions, keeps dismissal across reload and restores focus", async () => {
    const run = completed(), s = store();
    vi.mocked(piecePracticeRunStore.list).mockResolvedValue([run]);
    s.list = vi.fn(async () => ({ entries: [], unavailableCount: 0 }));
    render(<RolodexLibrary sources={[]} store={s} onExit={vi.fn()} />);
    await screen.findByText("No passages in this view.");
    fireEvent.click(screen.getByText("Optional suggestions from saved pitch-first practice"));
    fireEvent.click(screen.getByText("Load Saved Suggestions"));
    fireEvent.click(await screen.findByText("Save Suggested Passage to Rolodex"));
    expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Save to Practice Rolodex" }));
    expect(s.save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Cancel"));
    expect(document.activeElement).toBe(screen.getByText("Load Saved Suggestions"));
    fireEvent.click(screen.getByText("Dismiss Suggestion"));
    expect(screen.queryByText("Save Suggested Passage to Rolodex")).toBeNull();
    expect(document.activeElement).toBe(screen.getByText("Load Saved Suggestions"));
    fireEvent.click(screen.getByText("Load Saved Suggestions"));
    await screen.findByText("No retained completed-run recommendations.");
    expect(s.save).not.toHaveBeenCalled();
  });
  it("confirms an attributable suggestion, preserves its serialized source and suppresses it after saving", async () => {
    const run = completed(), s = store();
    const durable: string[] = [];
    s.list = async () => ({ entries: durable.map(raw => JSON.parse(raw)), unavailableCount: 0 });
    s.save = vi.fn(async entry => { durable.push(JSON.stringify(entry)); return { entry, duplicate: false }; });
    vi.mocked(piecePracticeRunStore.list).mockResolvedValue([run]);
    render(<RolodexLibrary sources={[]} store={s} onExit={vi.fn()} />);
    await screen.findByText("No passages in this view.");
    fireEvent.click(screen.getByText("Optional suggestions from saved pitch-first practice"));
    fireEvent.click(screen.getByText("Load Saved Suggestions"));
    fireEvent.click(await screen.findByText("Save Suggested Passage to Rolodex"));
    fireEvent.click(screen.getByLabelText(/I confirm/)); fireEvent.click(screen.getByText("Save Passage"));
    await screen.findByText("Passage saved locally.");
    await waitFor(() => expect(screen.queryByText("Save Suggested Passage to Rolodex")).toBeNull());
    expect(s.save).toHaveBeenCalledTimes(1);
    expect(JSON.parse(durable[0])).toMatchObject({ score: run.sourceScore, measureIds: ["m0"], evidence: rolodexSuggestions([run])[0].evidence });
    expect(run.status).toBe("completed");
    fireEvent.click(screen.getByText("Load Saved Suggestions"));
    await screen.findByText("No retained completed-run recommendations.");
  });
  it("clears old offers on a failed evidence reload and never saves", async () => {
    const s = store(); s.list = async () => ({ entries: [], unavailableCount: 0 });
    vi.mocked(piecePracticeRunStore.list).mockResolvedValueOnce([completed()]).mockRejectedValueOnce(Error("Read failed"));
    render(<RolodexLibrary sources={[]} store={s} onExit={vi.fn()} />);
    await screen.findByText("No passages in this view.");
    fireEvent.click(screen.getByText("Load Saved Suggestions"));
    await screen.findByText("Save Suggested Passage to Rolodex");
    fireEvent.click(screen.getByText("Load Saved Suggestions"));
    await screen.findByText(/Saved recommendations are unavailable/);
    expect(screen.queryByText("Save Suggested Passage to Rolodex")).toBeNull(); expect(s.save).not.toHaveBeenCalled();
  });
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
