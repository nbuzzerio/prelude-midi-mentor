import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRACTICE_SESSION_LIBRARY_STORAGE_KEY, type PracticeSessionStorage } from "../practice-session-library";
import { PRACTICE_SESSION_BUILDER_OPTIONS } from "../practice-session-builder-options";
import PracticeSessionBuilder from "./practice-session-builder";
import { MINIMAL_WEEKLY_PRACTICE_EXAMPLE } from "../import/weekly-practice-examples";

vi.mock("./practice-session-runtime", () => ({
  PracticeSessionRuntime: ({ run }: { run: { snapshot: { presetName: string } } }) => <p>Running {run.snapshot.presetName}</p>,
  PracticeSessionSummary: () => <p>Summary</p>,
}));

afterEach(cleanup);
class MemoryStorage implements PracticeSessionStorage {
  values = new Map<string, string>();
  getItem = vi.fn((key: string) => this.values.get(key) ?? null);
  setItem = vi.fn((key: string, value: string) => { this.values.set(key, value); });
}
const ids = (...values: string[]) => vi.fn(() => values.shift() ?? `id-${Math.random()}`);
const readyLibrary = (lastUsedPresetId: string | null = null) => ({
  schemaVersion: 2 as const,
  presets: [{ schemaVersion: 1 as const, id: "p1", name: "Daily", exercises: [{ ...PRACTICE_SESSION_BUILDER_OPTIONS[0]!.createEntry("e1"), target: { kind: "correct-answers" as const, count: 2 } }] }],
  curricula: [],
  lastUsedPresetId,
});

describe("Practice Session builder", () => {
  it("opens the adjacent AI guide without storage changes and restores its own trigger focus", async () => {
    const storage = new MemoryStorage(); render(<PracticeSessionBuilder storage={storage} />);
    const help = screen.getByRole("button", { name: "How to generate a Weekly Practice plan with AI" });
    const importButton = screen.getByRole("button", { name: "Import Weekly Plan" });
    expect(help.parentElement).toBe(importButton.parentElement);
    fireEvent.click(help); expect(screen.getByRole("dialog", { name: "Generate a plan with AI" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Generate a plan with AI" })).toBeNull(); expect(storage.setItem).not.toHaveBeenCalled();
    await waitFor(() => expect(document.activeElement).toBe(help)); expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("imports into working state only, selects the imported preset, and leaves explicit Save authoritative", () => {
    const storage = new MemoryStorage(); storage.values.set(PRACTICE_SESSION_LIBRARY_STORAGE_KEY, JSON.stringify(readyLibrary("p1")));
    render(<PracticeSessionBuilder createId={ids("curriculum", "imported-preset", "imported-exercise")} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Import Weekly Plan" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Weekly Practice JSON" }), { target: { value: JSON.stringify(MINIMAL_WEEKLY_PRACTICE_EXAMPLE) } });
    fireEvent.click(screen.getByRole("button", { name: "Validate and preview" })); fireEvent.click(screen.getByRole("button", { name: "Import weekly plan" }));
    expect(screen.queryByRole("dialog")).toBeNull(); expect(screen.getByDisplayValue(MINIMAL_WEEKLY_PRACTICE_EXAMPLE.days[0].name)).toBeTruthy();
    expect(screen.getByText("Unsaved changes")).toBeTruthy(); expect(screen.getByRole("status").textContent).toContain("not saved yet");
    expect(storage.setItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const saved = JSON.parse(storage.values.get(PRACTICE_SESSION_LIBRARY_STORAGE_KEY)!);
    expect(saved.presets.map(({ id }: { id: string }) => id)).toEqual(["p1", "imported-preset"]); expect(saved.lastUsedPresetId).toBe("p1");
  });

  it("restores a blank preset name from the committed library on blur", () => {
    const storage = new MemoryStorage();
    storage.values.set(PRACTICE_SESSION_LIBRARY_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, presets: [{ schemaVersion: 1, id: "p1", name: "Committed Name", exercises: [] }], lastUsedPresetId: null }));
    render(<PracticeSessionBuilder storage={storage} />);
    const name = screen.getByRole("textbox", { name: "Preset name" }) as HTMLInputElement;
    fireEvent.change(name, { target: { value: "" } });
    expect(name.value).toBe("");
    fireEvent.blur(name);
    expect(name.value).toBe("Committed Name");
    expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("loads empty storage cleanly without writing, then creates and explicitly saves", () => {
    const storage = new MemoryStorage();
    render(<PracticeSessionBuilder createId={ids("p1")} storage={storage} />);
    expect(screen.getByText("Saved")).toBeTruthy(); expect(storage.setItem).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "New Preset" }));
    expect(screen.getByText("Unsaved changes")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Start Practice" })).toBeNull();
    fireEvent.change(screen.getByRole("textbox", { name: "Preset name" }), { target: { value: "Week 3" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(storage.setItem).toHaveBeenCalledTimes(1); expect(screen.getByText("Saved")).toBeTruthy();
  });

  it("adds, configures, reorders, duplicates, and removes exercises", () => {
    render(<PracticeSessionBuilder createId={ids("p1", "e1", "e2", "copy")} storage={new MemoryStorage()} />);
    fireEvent.click(screen.getByRole("button", { name: "New Preset" }));
    fireEvent.click(screen.getByRole("button", { name: /Note Recognition/ }));
    expect(screen.getAllByText("Choose a target").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByRole("spinbutton", { name: /^Target/ }), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: /Ear Intervals/ }));
    fireEvent.click(screen.getByRole("button", { name: "Move Ear Intervals up" }));
    const list = screen.getByRole("heading", { name: "Exercises" }).nextElementSibling as HTMLElement;
    expect(within(list).getAllByRole("listitem")[0]!.textContent).toContain("Ear Intervals");
    fireEvent.click(screen.getByRole("button", { name: "Duplicate Ear Intervals" }));
    expect(screen.getAllByRole("button", { name: "Remove Ear Intervals" })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole("button", { name: "Remove Ear Intervals" })[0]!);
    expect(screen.getByText("Removed Ear Intervals.")).toBeTruthy();
  });

  it("duplicates and confirms deletion of a preset", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PracticeSessionBuilder createId={ids("p1", "p2")} storage={new MemoryStorage()} />);
    fireEvent.click(screen.getByRole("button", { name: "New Preset" })); fireEvent.click(screen.getByRole("button", { name: "Duplicate preset" }));
    expect(screen.getByDisplayValue("New Practice Session — Copy")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete preset" }));
    expect(confirm).toHaveBeenCalled(); confirm.mockRestore();
  });

  it("blocks corrupt storage until confirmed Start Fresh and saves an empty replacement", () => {
    const storage = new MemoryStorage(); const raw = "not-json"; storage.values.set(PRACTICE_SESSION_LIBRARY_STORAGE_KEY, raw);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PracticeSessionBuilder storage={storage} />);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull(); expect(storage.values.get(PRACTICE_SESSION_LIBRARY_STORAGE_KEY)).toBe(raw);
    fireEvent.click(screen.getByRole("button", { name: "Start Fresh" }));
    expect((screen.getByRole("button", { name: "Save" }) as HTMLButtonElement).disabled).toBe(false); expect(storage.values.get(PRACTICE_SESSION_LIBRARY_STORAGE_KEY)).toBe(raw);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(JSON.parse(storage.values.get(PRACTICE_SESSION_LIBRARY_STORAGE_KEY)!)).toEqual({ schemaVersion: 2, presets: [], curricula: [], lastUsedPresetId: null });
    confirm.mockRestore();
  });

  it("keeps failed saves dirty and suppresses inactive announcements", () => {
    const storage = new MemoryStorage(); storage.setItem.mockImplementation(() => { throw new Error(); });
    const view = render(<PracticeSessionBuilder active={false} createId={ids("p1")} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "New Preset" }));
    expect(screen.queryByRole("status")).toBeNull();
    view.rerender(<PracticeSessionBuilder active createId={ids()} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("status").textContent).toContain("unsaved changes remain"); expect(screen.getByText("Unsaved changes")).toBeTruthy();
  });

  it("starts a ready preset immediately and persists last-used from a clean baseline", () => {
    const storage = new MemoryStorage(); storage.values.set(PRACTICE_SESSION_LIBRARY_STORAGE_KEY, JSON.stringify(readyLibrary()));
    render(<PracticeSessionBuilder createExerciseToken={() => "token"} createRunId={() => "run"} now={() => 1} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    expect(screen.getByText("Running Daily")).toBeTruthy();
    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.values.get(PRACTICE_SESSION_LIBRARY_STORAGE_KEY)!).lastUsedPresetId).toBe("p1");
  });

  it("starts the current unsaved ready preset without writing unrelated edits", () => {
    const storage = new MemoryStorage(); storage.values.set(PRACTICE_SESSION_LIBRARY_STORAGE_KEY, JSON.stringify(readyLibrary()));
    render(<PracticeSessionBuilder createExerciseToken={() => "token"} createRunId={() => "run"} now={() => 1} storage={storage} />);
    fireEvent.change(screen.getByRole("textbox", { name: "Preset name" }), { target: { value: "Unsaved Daily" } });
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    expect(screen.getByText("Running Unsaved Daily")).toBeTruthy();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(JSON.parse(storage.values.get(PRACTICE_SESSION_LIBRARY_STORAGE_KEY)!).presets[0].name).toBe("Daily");
  });

  it("does not cancel start when a clean last-used preference write fails", () => {
    const storage = new MemoryStorage(); storage.values.set(PRACTICE_SESSION_LIBRARY_STORAGE_KEY, JSON.stringify(readyLibrary()));
    storage.setItem.mockImplementation(() => { throw new Error(); });
    render(<PracticeSessionBuilder createExerciseToken={() => "token"} createRunId={() => "run"} now={() => 1} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    expect(screen.getByText("Running Daily")).toBeTruthy();
    expect(screen.getByRole("status").textContent).toContain("could not be saved");
  });

  it("does not write storage when starting after authorized recovery", () => {
    const storage = new MemoryStorage(); storage.values.set(PRACTICE_SESSION_LIBRARY_STORAGE_KEY, "not-json");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<PracticeSessionBuilder createExerciseToken={() => "token"} createId={ids("p1", "e1")} createRunId={() => "run"} now={() => 1} storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Start Fresh" }));
    fireEvent.click(screen.getByRole("button", { name: "New Preset" }));
    fireEvent.click(screen.getByRole("button", { name: /Note Recognition/ }));
    fireEvent.change(screen.getByRole("spinbutton", { name: /^Target/ }), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    expect(screen.getByText("Running New Practice Session")).toBeTruthy();
    expect(storage.setItem).not.toHaveBeenCalled();
    expect(storage.values.get(PRACTICE_SESSION_LIBRARY_STORAGE_KEY)).toBe("not-json");
    confirm.mockRestore();
  });
});
