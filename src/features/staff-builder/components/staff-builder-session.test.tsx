import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStaffBuilderScore } from "../staff-builder-score";
import { STAFF_BUILDER_STORAGE_KEYS, type StaffBuilderStorage } from "../persistence/staff-builder-storage";
import StaffBuilderSession from "./staff-builder-session";

const { midiBoundary } = vi.hoisted(() => ({ midiBoundary: { onNote: null as ((midiNumber: number) => void) | null } }));
vi.mock("../hooks/use-staff-builder-input", () => ({
  useStaffBuilderInput: (onNote: (midiNumber: number) => void) => {
    midiBoundary.onNote = onNote;
    return { connectMidi: vi.fn(), deviceName: "Test MIDI", error: null, status: "connected" as const };
  },
}));

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
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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
    expect(screen.getByRole("heading", { name: "Piece library" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Create a piece" })).toBeTruthy();
    expect(first.container.querySelector(".staff-builder-columns")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Create Piece" }));
    expect(screen.getByRole("alert").textContent).toContain("Enter a title");
    createPiece();
    expect(screen.queryByRole("heading", { name: "Piece library" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Create a piece" })).toBeNull();
    expect(first.container.querySelector(".staff-builder-columns")).toBeNull();
    expect(first.container.querySelector(".staff-builder-editor-layout")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Minuet" })).toBeTruthy();
    const measureSettings = screen.getByText("Measure settings").parentElement as HTMLDetailsElement;
    expect(measureSettings.open).toBe(false);
    fireEvent.click(screen.getByText("Measure settings"));
    expect((screen.getByLabelText("Key signature") as HTMLSelectElement).value).toBe("g-major");
    expect((screen.getByLabelText("Time signature") as HTMLSelectElement).value).toBe("3/4");
    expect((screen.getByRole("spinbutton", { name: "Tempo" }) as HTMLInputElement).value).toBe("108");
    expect(screen.getByRole("heading", { name: "Measure 1 of 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Piece Library" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Capture Notes" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: "Capture Notes" })).toBeTruthy();
    expect(screen.queryByText("Fast Capture")).toBeNull();
    expect((screen.getByRole("button", { name: "Previous Position" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Next Position" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText(/Effective key: G major/)).toBeTruthy();
    expect(screen.getByText(/Pieces are stored only in this browser and device/)).toBeTruthy();
    first.unmount();
    render(<StaffBuilderSession storage={storage} />);
    expect(screen.getByRole("heading", { name: "Minuet" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Measure 1 of 1" })).toBeTruthy();
  });

  it("edits tempo through authoritative persistence and immediate history", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Tempo Study");
    const tempo = screen.getByRole("spinbutton", { name: "Tempo" }) as HTMLInputElement;
    fireEvent.change(tempo, { target: { value: "101" } });
    fireEvent.keyDown(tempo, { key: "Enter" });
    expect((screen.getByRole("spinbutton", { name: "Tempo" }) as HTMLInputElement).value).toBe("101");
    expect(JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null").score.tempoBpm).toBe(101);
    fireEvent.click(screen.getByRole("button", { name: "Undo last score edit" }));
    expect((screen.getByRole("spinbutton", { name: "Tempo" }) as HTMLInputElement).value).toBe("108");
    fireEvent.click(screen.getByRole("button", { name: "Redo last score edit" }));
    expect((screen.getByRole("spinbutton", { name: "Tempo" }) as HTMLInputElement).value).toBe("101");
  });

  it("renames, opens, and deletes library pieces after confirmation", () => {
    const storage = new MemoryStorage();
    vi.spyOn(window, "prompt").mockReturnValue("Renamed Study");
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Study");
    expect(screen.queryByRole("heading", { name: "Piece library" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Piece Library" }));
    fireEvent.click(screen.getByRole("button", { name: "Rename Study" }));
    expect(screen.getByText("Renamed Study")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Create a piece" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Open Renamed Study" }));
    expect(screen.getByRole("heading", { name: "Measure 1 of 1" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Piece library" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Piece Library" }));
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

  it("persists locked final-quarter capture and cursor, but not pending virtual input", () => {
    const storage = new MemoryStorage();
    const first = render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Capture");
    fireEvent.click(screen.getByRole("button", { name: "C, MIDI 60" }));
    expect(screen.getByLabelText(/Pending treble preview: note C4 at tick 0/)).toBeTruthy();
    expect(screen.getByLabelText(/Pending bass preview: none/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear Current Entry" }));
    expect(screen.getByLabelText(/Pending treble preview: none/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "C, MIDI 60" }));
    let draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft.score.measures[0].events).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Lock pitches and continue" }));
    expect(screen.getByLabelText(/Pending treble preview: none/)).toBeTruthy();
    expect(screen.getByText(/quarter note C4 at tick 0/)).toBeTruthy();
    draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft.score.measures[0].events[0]).toMatchObject({ staff: "treble", startTick: 0, rhythm: { status: "final", duration: "quarter" }, pitches: [{ midiNumber: 60 }] });
    expect(draft.captureState.cursor).toEqual({ measureIndex: 0, offsetTicks: 480 });
    first.unmount();
    render(<StaffBuilderSession storage={storage} />);
    expect(screen.queryByText("A newer Staff Builder draft is available.")).toBeNull();
    expect(screen.getByText(/quarter note C4 at tick 0/)).toBeTruthy();
    expect(screen.getByLabelText(/Pending treble preview: none/)).toBeTruthy();
    expect(screen.getByText(/Measure 1, Beat 2 \(quarter-note beat; tick 480\)/)).toBeTruthy();
  });

  it("owns the mobile keyboard lifecycle without reopening across editor-state or presentation changes", async () => {
    let mobile = false;
    let mediaListener: ((event: MediaQueryListEvent) => void) | null = null;
    vi.stubGlobal("matchMedia", vi.fn(() => ({
      get matches() { return mobile; },
      media: "(max-width: 700px), (pointer: coarse) and (max-width: 900px)",
      onchange: null,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => { mediaListener = listener; },
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Responsive Capture");

    expect(screen.getAllByTestId("staff-builder-virtual-keyboard")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Open virtual keyboard" })).toBeNull();

    act(() => {
      mobile = true;
      mediaListener?.({ matches: true } as MediaQueryListEvent);
    });
    expect(screen.queryByTestId("staff-builder-virtual-keyboard")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open virtual keyboard" }));
    const sheet = screen.getByRole("region", { name: "Virtual keyboard" });
    expect(screen.getAllByTestId("staff-builder-virtual-keyboard")).toHaveLength(1);
    fireEvent.click(sheet.querySelector('[aria-label="C, MIDI 60"]') as HTMLElement);
    expect(screen.getByLabelText(/Pending treble preview: note C4 at tick 0/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close virtual keyboard" }));
    expect(screen.queryByRole("region", { name: "Virtual keyboard" })).toBeNull();
    expect(screen.getByLabelText(/Pending treble preview: note C4 at tick 0/)).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open virtual keyboard" })));

    fireEvent.click(screen.getByRole("button", { name: "Open virtual keyboard" }));
    fireEvent.click(screen.getByRole("region", { name: "Virtual keyboard" }).querySelector('[aria-label="Lock pitches and continue"]') as HTMLElement);
    expect(screen.getByRole("region", { name: "Virtual keyboard" })).toBeTruthy();
    expect(screen.getAllByTestId("staff-builder-virtual-keyboard")).toHaveLength(1);
    expect(screen.getByText(/quarter note C4 at tick 0/)).toBeTruthy();
    expect(screen.getByText(/tick 480/)).toBeTruthy();

    const rhythmDismissedLauncher = screen.getByRole("button", { name: "Open virtual keyboard" });
    const rhythmDismissedFocus = vi.spyOn(rhythmDismissedLauncher, "focus");
    fireEvent.click(screen.getByRole("button", { name: "Rhythm Correction" }));
    expect(screen.queryByRole("region", { name: "Virtual keyboard" })).toBeNull();
    expect(screen.queryByTestId("staff-builder-virtual-keyboard")).toBeNull();
    expect(rhythmDismissedFocus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Capture Notes" }));
    expect(screen.queryByRole("region", { name: "Virtual keyboard" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open virtual keyboard" })).toBeTruthy();
    expect(screen.getByText(/tick 480/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open virtual keyboard" }));
    expect(screen.getAllByTestId("staff-builder-virtual-keyboard")).toHaveLength(1);
    const validationDismissedLauncher = screen.getByRole("button", { name: "Open virtual keyboard" });
    const validationDismissedFocus = vi.spyOn(validationDismissedLauncher, "focus");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("heading", { name: "Structural correction" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Virtual keyboard" })).toBeNull();
    expect(screen.queryByTestId("staff-builder-virtual-keyboard")).toBeNull();
    expect(validationDismissedFocus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close Correction Mode" }));
    expect(screen.queryByRole("region", { name: "Virtual keyboard" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open virtual keyboard" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open virtual keyboard" }));
    fireEvent.click(screen.getByRole("region", { name: "Virtual keyboard" }).querySelector('[aria-label="D, MIDI 62"]') as HTMLElement);
    expect(screen.getByLabelText(/Pending treble preview: note D4 at tick 480/)).toBeTruthy();
    const responsiveDismissedLauncher = screen.getByRole("button", { name: "Open virtual keyboard" });
    const responsiveDismissedFocus = vi.spyOn(responsiveDismissedLauncher, "focus");

    act(() => {
      mobile = false;
      mediaListener?.({ matches: false } as MediaQueryListEvent);
    });
    expect(screen.queryByRole("region", { name: "Virtual keyboard" })).toBeNull();
    expect(screen.getAllByTestId("staff-builder-virtual-keyboard")).toHaveLength(1);
    expect(screen.getByLabelText(/Pending treble preview: note D4 at tick 480/)).toBeTruthy();
    expect(responsiveDismissedFocus).not.toHaveBeenCalled();

    act(() => {
      mobile = true;
      mediaListener?.({ matches: true } as MediaQueryListEvent);
    });
    expect(screen.queryByRole("region", { name: "Virtual keyboard" })).toBeNull();
    expect(screen.queryByTestId("staff-builder-virtual-keyboard")).toBeNull();
    expect(screen.getByRole("button", { name: "Open virtual keyboard" })).toBeTruthy();
    expect(screen.getByLabelText(/Pending treble preview: note D4 at tick 480/)).toBeTruthy();
  });

  it("shows playback controls while gating rhythmic scopes from the current structural issues", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Playback Draft");
    const primaryBar = document.querySelector(".staff-builder-primary-editor-bar") as HTMLElement;
    expect(primaryBar.contains(screen.getByRole("spinbutton", { name: "Tempo" }))).toBe(true);
    expect(primaryBar.contains(screen.getByRole("button", { name: "Capture Notes" }))).toBe(true);
    expect(primaryBar.contains(screen.getByRole("button", { name: "Rhythm Correction" }))).toBe(true);
    expect(primaryBar.contains(screen.getByRole("button", { name: "Undo last score edit" }))).toBe(true);
    expect(primaryBar.contains(screen.getByRole("status", { name: "2 structural issues" }))).toBe(true);
    expect(screen.getByRole("status", { name: "2 structural issues" }).textContent).toBe("2 issues");
    expect(document.querySelectorAll(".staff-builder-score-toolbar-row")).toHaveLength(1);
    expect(document.querySelectorAll(".staff-builder-score-toolbar-playback, .staff-builder-score-toolbar-navigation, .staff-builder-score-toolbar-volume")).toHaveLength(3);
    expect(document.querySelectorAll(".staff-builder-quick-playback")).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Play Measure" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByRole("button", { name: "Play From Here" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByRole("button", { name: "Play Piece" }).every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.getAllByText("Playback unavailable: 2 score issues remain.")).toHaveLength(2);
    expect(screen.getAllByText("2 issues block playback")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Stop playback" })).toBeNull();
    expect(screen.queryByLabelText("Instrument volume")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /Instrument volume/ }));
    expect(screen.getByLabelText("Instrument volume")).toBeTruthy();
  });

  it("uses Save to guide gap correction while preserving autosave and requiring explicit final readiness", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Save Study");
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    const issue = screen.getByText("This treble staff has empty beats in measure 1.");
    expect(document.activeElement).toBe(issue);
    expect(screen.queryByText("Saved and ready for playback.")).toBeNull();
    expect(screen.getByRole("button", { name: "Add Rest" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fill All Empty Beats With Rests" }));
    expect(screen.getByText("All issues are corrected. Ready to save.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Save" })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Play Piece" }).every((button) => !(button as HTMLButtonElement).disabled)).toBe(true);
    expect(screen.queryByText("Saved and ready for playback.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Saved and ready for playback.")).toBeTruthy();
    const library = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "null");
    const draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(library.pieces[0].measures[0].events).toHaveLength(2);
    expect(draft.score).toEqual(library.pieces[0]);
    expect(draft.updatedAt).toBe(library.pieces[0].updatedAt);
  });

  it("shows MIDI note-on input immediately as a pending staff preview", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("MIDI Capture");
    act(() => midiBoundary.onNote?.(66));
    expect(screen.getByLabelText(/Pending treble preview: note .* at tick 0/)).toBeTruthy();
    const draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft.score.measures[0].events).toEqual([]);
  });

  it("routes MIDI and virtual pitches through Grand Staff previews and commits both staffs", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Grand Capture");
    fireEvent.click(screen.getByRole("button", { name: /Input Options: Grand Staff/ }));
    expect(screen.getByRole("button", { name: "Grand Staff" }).getAttribute("aria-pressed")).toBe("true");
    act(() => { midiBoundary.onNote?.(48); midiBoundary.onNote?.(60); });
    expect(screen.getByLabelText(/Pending treble preview: note C4 at tick 0/)).toBeTruthy();
    expect(screen.getByLabelText(/Pending bass preview: note C3 at tick 0/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "B, MIDI 59" }));
    expect(screen.getByLabelText(/Pending bass preview: chord C3, B3 at tick 0/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "B, MIDI 59" }));
    expect(screen.getByLabelText(/Pending bass preview: note C3 at tick 0/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Lock pitches and continue" }));
    const draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft.captureState.inputMode).toBe("grand");
    expect(draft.captureState).not.toHaveProperty("activeStaff");
    expect(draft.score.measures[0].events).toEqual(expect.arrayContaining([
      expect.objectContaining({ staff: "bass", pitches: [expect.objectContaining({ midiNumber: 48 })] }),
      expect.objectContaining({ staff: "treble", pitches: [expect.objectContaining({ midiNumber: 60 })] }),
    ]));
  });

  it("keeps cross-staff pending pitches highlighted while virtual toggles change only the routed copy", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Keyboard Highlight");
    const lowKey = screen.getByRole("button", { name: "C, MIDI 48" });
    const highKey = screen.getByRole("button", { name: "C, MIDI 72" });

    fireEvent.click(screen.getByRole("button", { name: /Input Options: Grand Staff/ }));
    fireEvent.click(screen.getByRole("button", { name: "Treble Only" }));
    act(() => midiBoundary.onNote?.(48));
    fireEvent.click(screen.getByRole("button", { name: "Grand Staff" }));
    expect(lowKey.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Bass Only" }));
    act(() => { midiBoundary.onNote?.(48); midiBoundary.onNote?.(72); });
    fireEvent.click(screen.getByRole("button", { name: "Grand Staff" }));
    expect(lowKey.getAttribute("aria-pressed")).toBe("true");
    expect(highKey.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(lowKey);
    expect(screen.getByText(/pending treble MIDI pitches 48; pending bass MIDI pitches 72/)).toBeTruthy();
    expect(lowKey.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(lowKey);
    expect(screen.getByText(/pending treble MIDI pitches 48; pending bass MIDI pitches 48, 72/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear Current Entry" }));
    expect(lowKey.getAttribute("aria-pressed")).toBe("false");
    expect(highKey.getAttribute("aria-pressed")).toBe("false");
  });

  it("switches to Rhythm Correction, edits the selected event, and persists Undo and Redo", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Rhythm Study");
    fireEvent.click(screen.getByRole("button", { name: "C, MIDI 60" }));
    fireEvent.click(screen.getByRole("button", { name: "Lock pitches and continue" }));
    expect(screen.getByTestId("staff-builder-capture-cursor")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Rhythm Correction" }));
    expect(screen.queryByTestId("staff-builder-capture-cursor")).toBeNull();
    expect(screen.getByTestId("staff-builder-selection-outline")).toBeTruthy();
    const rhythmDetails = screen.getByText("Rhythm Correction controls").parentElement as HTMLDetailsElement;
    expect(rhythmDetails.open).toBe(false);
    fireEvent.click(screen.getByText("Rhythm Correction controls"));
    expect(screen.getByText(/Selected event: measure 1, treble, .*tick 0.*, C4, quarter/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Target Duration"), { target: { value: "eighth" } });
    fireEvent.click(screen.getByRole("button", { name: "Assign Duration" }));
    expect(screen.getByText(/eighth note C4 at tick 0/)).toBeTruthy();
    let draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft).toMatchObject({ editorPass: "rhythm", rhythmState: { measureIndex: 0 } });
    expect(draft.score.measures[0].events[0].rhythm).toEqual({ status: "final", duration: "eighth" });

    fireEvent.click(screen.getByRole("button", { name: "Capture Notes" }));
    fireEvent.click(screen.getByRole("button", { name: "Rhythm Correction" }));
    expect((screen.getByText("Rhythm Correction controls").parentElement as HTMLDetailsElement).open).toBe(false);
    fireEvent.click(screen.getByText("Rhythm Correction controls"));

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getByText(/quarter note C4 at tick 0/)).toBeTruthy();
    draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft.score.measures[0].events[0].rhythm).toEqual({ status: "final", duration: "quarter" });
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getByText(/eighth note C4 at tick 0/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete Event" }));
    expect(screen.getByText("No event selected.")).toBe(document.activeElement);
    draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft.score.measures[0].events).toEqual([]);
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
