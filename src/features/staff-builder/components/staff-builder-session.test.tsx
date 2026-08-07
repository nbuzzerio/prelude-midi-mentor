import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStaffBuilderScore } from "../staff-builder-score";
import { STAFF_BUILDER_STORAGE_KEYS, type StaffBuilderStorage } from "../persistence/staff-builder-storage";
import StaffBuilderSession from "./staff-builder-session";

class MemoryStorage implements StaffBuilderStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 8 }),
  } as CanvasRenderingContext2D);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function dismissIntroduction() {
  fireEvent.click(screen.getByRole("button", { name: "Begin" }));
}

function createPiece(title = "Minuet") {
  fireEvent.change(screen.getByLabelText("Title"), { target: { value: title } });
  fireEvent.change(screen.getByLabelText("Initial key"), { target: { value: "g-major" } });
  fireEvent.change(screen.getByLabelText("Time signature"), { target: { value: "3/4" } });
  fireEvent.change(screen.getByLabelText("Tempo (BPM)"), { target: { value: "108" } });
  fireEvent.click(screen.getByRole("button", { name: "Create Piece" }));
}

describe("Staff Builder session", () => {
  it("shows, dismisses, persists, and reopens the introduction", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    expect(screen.getByRole("dialog", { name: "About Staff Builder" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Begin" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Don’t show this again" }));
    dismissIntroduction();
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.introductionDismissed)).toBe("true");
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About Staff Builder" }));
    expect(screen.getByRole("dialog", { name: "About Staff Builder" })).toBeTruthy();
  });

  it("traps focus in both directions and closes on Escape", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    const begin = screen.getByRole("button", { name: "Begin" });
    const dismiss = screen.getByRole("checkbox", { name: /show this again/ });
    begin.focus();
    fireEvent.keyDown(begin, { key: "Tab" });
    expect(document.activeElement).toBe(dismiss);
    fireEvent.keyDown(dismiss, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(begin);
    fireEvent.keyDown(begin, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "About Staff Builder" }));
  });

  it("restores focus to the opener after reopening and closing", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    const opener = screen.getByRole("button", { name: "About Staff Builder" });
    opener.focus();
    fireEvent.click(opener);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Begin" }));
    dismissIntroduction();
    expect(document.activeElement).toBe(opener);
  });

  it("validates setup, creates a local piece, and restores it after unmount", () => {
    const storage = new MemoryStorage();
    const first = render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    fireEvent.click(screen.getByRole("button", { name: "Create Piece" }));
    expect(screen.getByRole("alert").textContent).toContain("Enter a title");
    createPiece();
    expect(screen.getByRole("heading", { name: "Minuet" })).toBeTruthy();
    expect(screen.getByText("G major")).toBeTruthy();
    expect(screen.getByText("3/4")).toBeTruthy();
    expect(screen.getByText("108 BPM")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Measure 1 of 1" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Previous Position" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next Position" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/Effective key: G major/)).toBeTruthy();
    expect(screen.getByText(/Pieces are stored only in this browser and device/)).toBeTruthy();
    first.unmount();
    render(<StaffBuilderSession storage={storage} />);
    expect(screen.getByRole("heading", { name: "Minuet" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Measure 1 of 1" })).toBeTruthy();
  });

  it("renames, opens, and deletes library pieces after confirmation", () => {
    const storage = new MemoryStorage();
    vi.spyOn(window, "prompt").mockReturnValue("Renamed Study");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Study");
    fireEvent.click(screen.getByRole("button", { name: "Rename Study" }));
    expect(screen.getByRole("heading", { name: "Renamed Study" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back to Library" }));
    expect(screen.getByRole("heading", { name: "Create a piece" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Renamed Study" }));
    expect(screen.getByRole("heading", { name: "Measure 1 of 1" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete Renamed Study" }));
    expect(screen.getByText("No Staff Builder pieces yet.")).toBeTruthy();
  });

  it("offers restoration when a draft is newer than its library piece", () => {
    const storage = new MemoryStorage();
    let id = 0;
    const base = createStaffBuilderScore({ title: "Saved", tempoBpm: 100, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", factories: { createId: () => `id-${++id}`, now: () => "2026-08-06T12:00:00.000Z" } });
    const draftScore = { ...base, title: "Draft", updatedAt: "2026-08-06T13:00:00.000Z" };
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, JSON.stringify({ schemaVersion: 1, pieces: [base] }));
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.draft, JSON.stringify({ schemaVersion: 1, savedPieceId: base.id, updatedAt: draftScore.updatedAt, score: draftScore, editorPass: "capture" }));
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    expect(screen.getByText("A newer Staff Builder draft is available.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restore Draft" }));
    expect(screen.getByRole("heading", { name: "Draft" })).toBeTruthy();
  });

  it("persists locked unresolved capture and cursor, but not pending virtual input", () => {
    const storage = new MemoryStorage();
    const first = render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Capture");
    fireEvent.click(screen.getByRole("button", { name: "C, MIDI 60" }));
    let draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft.score.measures[0].events).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Lock & Continue" }));
    draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft.score.measures[0].events[0]).toMatchObject({ staff: "treble", startTick: 0, rhythm: { status: "unresolved" }, pitches: [{ midiNumber: 60 }] });
    expect(draft.captureState.cursor).toEqual({ measureIndex: 0, offsetTicks: 480 });
    first.unmount();
    render(<StaffBuilderSession storage={storage} />);
    expect(screen.getByText("A newer Staff Builder draft is available.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Restore Draft" }));
    expect(screen.getByText(/unresolved rhythm note C4 at tick 0/)).toBeTruthy();
    expect(screen.getByText(/Measure 1, Beat 2 \(quarter-note beat; tick 480\)/)).toBeTruthy();
  });

  it("announces storage failures, keeps in-memory work, and clears corrupt data only after confirmation", () => {
    const storage = new MemoryStorage();
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, "corrupt");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    expect(screen.getByText(/Stored Staff Builder data could not be read/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear library data" }));
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library)).toBe("corrupt");
    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear library data" }));
    expect(storage.values.has(STAFF_BUILDER_STORAGE_KEYS.library)).toBe(false);
  });
});
