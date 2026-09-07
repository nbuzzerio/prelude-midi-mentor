import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRACTICE_SESSION_LIBRARY_STORAGE_KEY, type PracticeSessionStorage } from "../practice-session-library";
import PracticeSessionBuilder from "./practice-session-builder";

afterEach(cleanup);
class MemoryStorage implements PracticeSessionStorage {
  values = new Map<string, string>();
  getItem = vi.fn((key: string) => this.values.get(key) ?? null);
  setItem = vi.fn((key: string, value: string) => { this.values.set(key, value); });
}
const ids = (...values: string[]) => vi.fn(() => values.shift() ?? `id-${Math.random()}`);

describe("Practice Session builder", () => {
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
    expect(JSON.parse(storage.values.get(PRACTICE_SESSION_LIBRARY_STORAGE_KEY)!)).toEqual({ schemaVersion: 1, presets: [], lastUsedPresetId: null });
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
});
