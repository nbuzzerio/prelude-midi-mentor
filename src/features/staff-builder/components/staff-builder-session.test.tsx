import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStaffBuilderScore } from "../staff-builder-score";
import { STAFF_BUILDER_STORAGE_KEYS, type StaffBuilderStorage } from "../persistence/staff-builder-storage";
import type { StaffBuilderScore } from "../staff-builder-types";
import StaffBuilderSession from "./staff-builder-session";

const { fileBoundary, midiBoundary, practiceBoundary } = vi.hoisted(() => ({
  fileBoundary: { download: vi.fn(), read: vi.fn() },
  midiBoundary: { onNote: null as ((midiNumber: number) => void) | null },
  practiceBoundary: { piece: null as null | import("@/features/piece-practice/piece-practice-types").PiecePracticePiece, projectionScores: [] as import("../staff-builder-types").StaffBuilderScore[], forceFailure: false },
}));
vi.mock("../persistence/staff-builder-piece-file-browser", () => ({
  downloadStaffBuilderPiece: fileBoundary.download,
  readStaffBuilderPieceFile: fileBoundary.read,
}));
vi.mock("../hooks/use-staff-builder-input", () => ({
  useStaffBuilderInput: (onNote: (midiNumber: number) => void) => {
    midiBoundary.onNote = onNote;
    return { connectMidi: vi.fn(), deviceName: "Test MIDI", error: null, status: "connected" as const };
  },
}));
vi.mock("@/features/piece-practice/components/piece-practice-session", () => ({ PiecePracticeSession: ({ piece, onExit }: { piece: import("@/features/piece-practice/piece-practice-types").PiecePracticePiece; onExit: () => void }) => {
  practiceBoundary.piece = piece;
  return <section><h1>Blocking Piece Practice: {piece.title}</h1><button onClick={onExit} type="button">Exit Piece Practice</button></section>;
} }));
vi.mock("@/features/piece-practice/piece-practice-projection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/piece-practice/piece-practice-projection")>();
  return { projectStaffBuilderPieceForPractice: (score: import("../staff-builder-types").StaffBuilderScore) => {
    practiceBoundary.projectionScores.push(score);
    return practiceBoundary.forceFailure ? { ok: false as const, issues: [] } : actual.projectStaffBuilderPieceForPractice(score);
  } };
});

class MemoryStorage implements StaffBuilderStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

beforeEach(() => {
  fileBoundary.download.mockReset();
  fileBoundary.read.mockReset();
  practiceBoundary.piece = null;
  practiceBoundary.projectionScores = [];
  practiceBoundary.forceFailure = false;
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, actualBoundingBoxLeft: 0, actualBoundingBoxRight: text.length * 8 }),
  } as CanvasRenderingContext2D);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.stubGlobal("ResizeObserver", class {
    callback: ResizeObserverCallback;
    constructor(callback: ResizeObserverCallback) { this.callback = callback; }
    observe(target: Element) { this.callback([{ target, contentRect: { width: 700 } } as ResizeObserverEntry], this as unknown as ResizeObserver); }
    disconnect() {}
  });
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

function savedValidScore(title = "Practice Study"): StaffBuilderScore {
  return {
    schemaVersion: 3 as const, annotations: [], id: `saved-${title}`, title, createdAt: "2026-08-10T12:00:00.000Z", updatedAt: "2026-08-10T12:00:00.000Z",
    tempoBpm: 96, initialKeySignatureId: "c-major" as const, initialTimeSignature: "4/4" as const, ties: [], measures: [{ id: "m1", events: [
      { id: "treble", kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const }, pitches: [{ id: "tp", midiNumber: 60, letter: "C" as const, accidental: "natural" as const, octave: 4 }] },
      { id: "bass", kind: "rest" as const, staff: "bass" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const } },
    ] }],
  };
}

function savedTwoMeasureScore(title = "Practice Study"): StaffBuilderScore {
  const score = savedValidScore(title);
  return {
    ...score,
    measures: [
      score.measures[0]!,
      {
        id: "m2",
        events: [
          { id: "treble-2", kind: "notes", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" }, pitches: [{ id: "tp-2", midiNumber: 62, letter: "D", accidental: "natural", octave: 4 }] },
          { id: "bass-2", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
        ],
      },
    ],
  };
}

function seedLibrary(storage: MemoryStorage, pieces: readonly StaffBuilderScore[]) {
  storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, JSON.stringify({ schemaVersion: 3, pieces }));
  storage.values.set(STAFF_BUILDER_STORAGE_KEYS.introductionDismissed, "true");
}

describe("Staff Builder session", () => {
  it("enters a clean Study View, preserves editor state, suppresses MIDI, and restores focus", async () => {
    const storage = new MemoryStorage();
    seedLibrary(storage, [savedTwoMeasureScore("Study Shell")]);
    render(<StaffBuilderSession storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Study Shell" }));
    fireEvent.click(screen.getByRole("button", { name: "Next Measure" }));
    expect(screen.getByRole("heading", { name: "Measure 2 of 2" })).toBeTruthy();
    const tempo = screen.getByRole("spinbutton", { name: "Tempo" }) as HTMLInputElement;
    fireEvent.change(tempo, { target: { value: "104" } });
    fireEvent.keyDown(tempo, { key: "Enter" });
    expect(tempo.value).toBe("104");
    expect((screen.getByRole("button", { name: "Undo last score edit" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getAllByRole("button", { name: "Play Piece" })[0]!);
    await waitFor(() => expect(screen.getByRole("button", { name: "Stop playback" })).toBeTruthy());
    act(() => midiBoundary.onNote?.(64));
    expect(screen.getByText(/pending treble MIDI pitches 64;/)).toBeTruthy();
    const launcher = screen.getByRole("button", { name: "Study View" });
    launcher.focus();
    fireEvent.click(launcher);
    expect(screen.getByRole("heading", { name: "Study Shell", level: 1 })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Next Position" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Add Annotation" })).toBeNull();
    act(() => midiBoundary.onNote?.(67));
    fireEvent.click(screen.getByRole("button", { name: "Exit Study View" }));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Study View" })));
    expect(screen.queryByRole("button", { name: "Stop playback" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Measure 2 of 2" })).toBeTruthy();
    expect(screen.getByText(/pending treble MIDI pitches 64;/)).toBeTruthy();
    const undo = screen.getByRole("button", { name: "Undo last score edit" }) as HTMLButtonElement;
    expect(undo.disabled).toBe(false);
    fireEvent.click(undo);
    expect((screen.getByRole("spinbutton", { name: "Tempo" }) as HTMLInputElement).value).toBe("96");
    expect(screen.getByRole("heading", { name: "Measure 2 of 2" })).toBeTruthy();
    act(() => midiBoundary.onNote?.(67));
    expect(screen.getByText(/pending treble MIDI pitches 64, 67;/)).toBeTruthy();
  });
  it("integrates annotation authoring and transient layer presentation with the canonical editor score", async () => {
    const storage = new MemoryStorage();
    const base = savedValidScore("Annotated Study");
    const annotated = { ...base, annotations: [
      { id: "measure-note", kind: "study-note" as const, anchor: { kind: "measure" as const, measureId: "m1" }, text: "Shape the phrase" },
      { id: "event-practice", kind: "practice-mark" as const, anchor: { kind: "event" as const, eventId: "treble" }, category: "rhythm" as const },
      { id: "event-bookmark", kind: "bookmark" as const, anchor: { kind: "event" as const, eventId: "treble" }, category: "revisit" as const },
    ] };
    seedLibrary(storage, [annotated]);
    render(<StaffBuilderSession storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Annotated Study" }));

    expect(screen.getByRole("heading", { name: "Study annotations" })).toBeTruthy();
    expect(screen.getByText("Shape the phrase")).toBeTruthy();
    await waitFor(() => expect(screen.getByLabelText("Study Note, 1 annotation")).toBeTruthy());
    expect(screen.getByLabelText("Practice Mark, 1 annotation, event in measure 1")).toBeTruthy();
    expect(screen.getByLabelText("Bookmark, 1 annotation, event in measure 1")).toBeTruthy();
    const scoreBeforeLayerChanges = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null").score;

    fireEvent.click(screen.getByLabelText("Study Notes"));
    expect(screen.queryByLabelText("Study Note, 1 annotation")).toBeNull();
    expect(screen.getByLabelText("Practice Mark, 1 annotation, event in measure 1")).toBeTruthy();
    expect(screen.getByLabelText("Bookmark, 1 annotation, event in measure 1")).toBeTruthy();
    expect(screen.getByText("Shape the phrase")).toBeTruthy();
    const undoBeforeVisibility = (screen.getByRole("button", { name: "Undo last score edit" }) as HTMLButtonElement).disabled;
    fireEvent.click(screen.getByRole("button", { name: "Study View" }));
    expect((screen.getByLabelText("Study Notes") as HTMLInputElement).checked).toBe(false);
    expect(screen.queryByText("Shape the phrase")).toBeNull();
    fireEvent.click(screen.getByLabelText("Study Notes"));
    expect(screen.getByText("Shape the phrase")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Exit Study View" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Study View" })).toBeTruthy());
    expect((screen.getByLabelText("Study Notes") as HTMLInputElement).checked).toBe(true);
    expect(screen.getByLabelText("Study Note, 1 annotation")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Undo last score edit" }) as HTMLButtonElement).disabled).toBe(undoBeforeVisibility);
    fireEvent.click(screen.getByLabelText("Practice Marks"));
    expect(screen.queryByLabelText(/Practice Mark, 1 annotation/)).toBeNull();
    expect(screen.getByLabelText("Bookmark, 1 annotation, event in measure 1")).toBeTruthy();
    fireEvent.click(screen.getByLabelText("Bookmarks"));
    expect(screen.queryByLabelText(/Bookmark, 1 annotation/)).toBeNull();
    expect(JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null").score).toEqual(scoreBeforeLayerChanges);

    fireEvent.click(screen.getByRole("button", { name: "Add Annotation" }));
    fireEvent.change(screen.getByLabelText("Study note"), { target: { value: "New integrated note" } });
    fireEvent.click(screen.getByRole("group", { name: "Add annotation" }).querySelector('button[type="button"]') as HTMLButtonElement);
    expect(screen.getByText("New integrated note")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo last score edit" }));
    expect(screen.queryByText("New integrated note")).toBeNull();
  });

  it("downloads saved pieces and imports schema-valid incomplete pieces without opening an editor", async () => {
    const storage = new MemoryStorage();
    const saved = savedValidScore();
    seedLibrary(storage, [saved]);
    const imported = {
      ...savedValidScore("Imported Sketch"),
      id: "imported-sketch",
      measures: [{ id: "imported-measure", events: [] }],
    };
    fileBoundary.read.mockResolvedValue({ ok: true, score: imported });

    render(<StaffBuilderSession storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Download Practice Study" }));
    expect(fileBoundary.download).toHaveBeenCalledWith(saved);
    expect(screen.getByRole("status").textContent).toBe('Downloaded "Practice Study".');

    const input = screen.getByLabelText("Choose Prelude piece file") as HTMLInputElement;
    const file = new File(["{}"], "imported-sketch.prelude.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByText('Imported "Imported Sketch".');

    expect(fileBoundary.read).toHaveBeenCalledWith(file);
    expect(input.value).toBe("");
    expect(screen.getByText("Imported Sketch")).toBeTruthy();
    expect(screen.getAllByText("Needs validation")).toHaveLength(1);
    expect((screen.getByRole("button", { name: "Practice Imported Sketch" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    const persisted = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "null");
    expect(persisted.pieces).toEqual([saved, imported]);
    expect(storage.values.has(STAFF_BUILDER_STORAGE_KEYS.draft)).toBe(false);
  });

  it("announces an import failure without changing the library", async () => {
    const storage = new MemoryStorage();
    const saved = savedValidScore();
    seedLibrary(storage, [saved]);
    fileBoundary.read.mockResolvedValue({ ok: false, reason: "invalid-json", message: "That file is not valid JSON." });

    render(<StaffBuilderSession storage={storage} />);
    fireEvent.change(screen.getByLabelText("Choose Prelude piece file"), {
      target: { files: [new File(["{"], "broken.prelude.json", { type: "application/json" })] },
    });

    expect((await screen.findByRole("alert")).textContent).toBe("That file is not valid JSON.");
    const persisted = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "null");
    expect(persisted.pieces).toEqual([saved]);
  });

  it("launches the exact validated saved score through Phase A and exits to the unchanged library", () => {
    const storage = new MemoryStorage();
    const saved = savedValidScore();
    seedLibrary(storage, [saved]);
    const before = new Map(storage.values);
    render(<StaffBuilderSession storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice Practice Study" }));
    expect(screen.getByRole("heading", { name: "Blocking Piece Practice: Practice Study" })).toBeTruthy();
    expect(practiceBoundary.projectionScores).toEqual([saved]);
    expect(practiceBoundary.piece).toMatchObject({ sourceScoreId: saved.id, sourceScoreUpdatedAt: saved.updatedAt, title: saved.title });
    expect(storage.values).toEqual(before);
    fireEvent.click(screen.getByRole("button", { name: "Exit Piece Practice" }));
    expect(screen.getByRole("heading", { name: "Piece library" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Measure 1 of 1" })).toBeNull();
    expect(saved).toEqual(savedValidScore());
  });

  it("offers all duplicate modes and opens a treble-range copy without changing the original", () => {
    const storage = new MemoryStorage();
    const original = savedValidScore("Duplicate Study");
    seedLibrary(storage, [original]);
    render(<StaffBuilderSession storage={storage} />);

    fireEvent.click(screen.getByLabelText("Duplicate Duplicate Study"));
    expect(screen.getByText("Treble keeps Middle C and above. Bass keeps notes below Middle C.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Duplicate full piece" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Duplicate treble-range copy" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Duplicate bass-range copy" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate treble-range copy" }));

    expect(screen.getByRole("heading", { name: "Duplicate Study — Treble Copy" })).toBeTruthy();
    const persisted = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "null");
    expect(persisted.pieces).toHaveLength(2);
    expect(persisted.pieces[0]).toEqual(original);
    expect(persisted.pieces[1]).toMatchObject({ title: "Duplicate Study — Treble Copy" });
    expect(persisted.pieces[1].id).not.toBe(original.id);
  });

  it("launches validated same-staff polyphony while invalid saved material remains disabled", () => {
    const storage = new MemoryStorage();
    const base = savedValidScore("Polyphony");
    const polyphonic = { ...base, measures: [{ ...base.measures[0]!, events: [
      ...base.measures[0]!.events,
      { id: "later", kind: "notes" as const, staff: "treble" as const, startTick: 480, rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [{ id: "later-p", midiNumber: 64, letter: "E" as const, accidental: "natural" as const, octave: 4 }] },
    ] }] };
    const invalidGap = { ...savedValidScore("Invalid Gap"), id: "invalid-gap", measures: [{ id: "m1", events: [] }] };
    const conflictBase = savedValidScore("Invalid Same Position");
    const invalidSamePosition = { ...conflictBase, id: "invalid-same-position", measures: [{ ...conflictBase.measures[0]!, events: [
      ...conflictBase.measures[0]!.events,
      { id: "conflict", kind: "notes" as const, staff: "treble" as const, startTick: 0, rhythm: { status: "final" as const, duration: "whole" as const }, pitches: [{ id: "conflict-p", midiNumber: 64, letter: "E" as const, accidental: "natural" as const, octave: 4 }] },
    ] }] };
    const tieBase = savedValidScore("Invalid Tie");
    const invalidTie = { ...tieBase, id: "invalid-tie", ties: [{ id: "bad-tie", fromEventId: "treble", fromPitchId: "tp", toEventId: "missing", toPitchId: "missing" }] };
    seedLibrary(storage, [polyphonic, invalidGap, invalidSamePosition, invalidTie]);
    render(<StaffBuilderSession storage={storage} />);
    for (const title of ["Invalid Gap", "Invalid Same Position", "Invalid Tie"]) {
      const invalidButton = screen.getByRole("button", { name: `Practice ${title}` }) as HTMLButtonElement;
      expect(invalidButton.disabled).toBe(true);
      expect(invalidButton.getAttribute("aria-describedby")).toBeTruthy();
    }
    expect(screen.getAllByText("Complete structural validation before practicing this piece.")).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "Practice Polyphony" }));
    expect(practiceBoundary.piece?.title).toBe("Polyphony");
  });

  it("fails safely when authoritative Phase A projection unexpectedly rejects a gated launch", () => {
    const storage = new MemoryStorage();
    seedLibrary(storage, [savedValidScore()]);
    practiceBoundary.forceFailure = true;
    render(<StaffBuilderSession storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice Practice Study" }));
    expect(screen.getByRole("alert").textContent).toContain("could not be opened for practice");
    expect(screen.queryByText(/Blocking Piece Practice:/)).toBeNull();
  });

  it("uses the updated saved score on the next launch without changing Open or editor behavior", () => {
    const storage = new MemoryStorage();
    seedLibrary(storage, [savedValidScore("Editable")]);
    render(<StaffBuilderSession storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Editable" }));
    const tempo = screen.getByRole("spinbutton", { name: "Tempo" });
    fireEvent.change(tempo, { target: { value: "104" } });
    fireEvent.keyDown(tempo, { key: "Enter" });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Piece Library" }));
    fireEvent.click(screen.getByRole("button", { name: "Practice Editable" }));
    expect(practiceBoundary.projectionScores[0]?.tempoBpm).toBe(104);
    expect(practiceBoundary.piece?.tempoBpm).toBe(104);
  });
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
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, JSON.stringify({ schemaVersion: 3, pieces: [base] }));
    storage.values.set(STAFF_BUILDER_STORAGE_KEYS.draft, JSON.stringify({ schemaVersion: 3, savedPieceId: base.id, updatedAt: draftScore.updatedAt, score: draftScore, editorPass: "capture" }));
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
    expect(screen.getByText(/Beat 1 .*tick 0/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open virtual keyboard" }));
    expect(screen.getAllByTestId("staff-builder-virtual-keyboard")).toHaveLength(1);
    const validationDismissedLauncher = screen.getByRole("button", { name: "Open virtual keyboard" });
    const validationDismissedFocus = vi.spyOn(validationDismissedLauncher, "focus");
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("heading", { name: "Structural correction" })).toBeTruthy();
    expect((screen.getByRole("button", { name: "Capture Notes" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Rhythm Correction" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: "Close Correction Mode" })).toHaveLength(1);
    expect(screen.queryByRole("region", { name: "Virtual keyboard" })).toBeNull();
    expect(screen.queryByTestId("staff-builder-virtual-keyboard")).toBeNull();
    expect(validationDismissedFocus).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Close Correction Mode" }));
    expect((screen.getByRole("button", { name: "Capture Notes" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByRole("region", { name: "Virtual keyboard" })).toBeNull();
    expect(screen.getByRole("button", { name: "Open virtual keyboard" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Open virtual keyboard" }));
    fireEvent.click(screen.getByRole("region", { name: "Virtual keyboard" }).querySelector('[aria-label="D, MIDI 62"]') as HTMLElement);
    expect(screen.getByLabelText(/Pending treble preview: note D4 at tick 0/)).toBeTruthy();
    const responsiveDismissedLauncher = screen.getByRole("button", { name: "Open virtual keyboard" });
    const responsiveDismissedFocus = vi.spyOn(responsiveDismissedLauncher, "focus");

    act(() => {
      mobile = false;
      mediaListener?.({ matches: false } as MediaQueryListEvent);
    });
    expect(screen.queryByRole("region", { name: "Virtual keyboard" })).toBeNull();
    expect(screen.getAllByTestId("staff-builder-virtual-keyboard")).toHaveLength(1);
    expect(screen.getByLabelText(/Pending treble preview: note D4 at tick 0/)).toBeTruthy();
    expect(responsiveDismissedFocus).not.toHaveBeenCalled();

    act(() => {
      mobile = true;
      mediaListener?.({ matches: true } as MediaQueryListEvent);
    });
    expect(screen.queryByRole("region", { name: "Virtual keyboard" })).toBeNull();
    expect(screen.queryByTestId("staff-builder-virtual-keyboard")).toBeNull();
    expect(screen.getByRole("button", { name: "Open virtual keyboard" })).toBeTruthy();
    expect(screen.getByLabelText(/Pending treble preview: note D4 at tick 0/)).toBeTruthy();
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
