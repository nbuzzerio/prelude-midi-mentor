import { createStaffBuilderLlmSpecification } from "../staff-builder-llm-specification";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createStaffBuilderScore } from "../staff-builder-score";
import { STAFF_BUILDER_STORAGE_KEYS, type StaffBuilderStorage } from "../persistence/staff-builder-storage";
import type { StaffBuilderScore } from "../staff-builder-types";
import StaffBuilderSession from "./staff-builder-session";
import { shouldSustainPedalLock } from "../staff-builder-capture";
import { createPiecePracticeSession, submitPiecePracticeAttempt } from "@/features/piece-practice/piece-practice-session";
import { focusPiecePracticeProjection, projectStaffBuilderPieceForPractice } from "@/features/piece-practice/piece-practice-projection";
import { createPiecePracticeRun, type PiecePracticeRunRecordV1 } from "@/features/piece-practice/persistence/piece-practice-runs";

const { fileBoundary, midiBoundary, practiceBoundary, runBoundary } = vi.hoisted(() => ({
  fileBoundary: { download: vi.fn(), read: vi.fn() },
  midiBoundary: { onNote: null as ((midiNumber: number) => void) | null, onSustain: null as ((isDown: boolean) => void) | null, registrations: 0 },
  practiceBoundary: { piece: null as null | import("@/features/piece-practice/piece-practice-types").PiecePracticePiece, sourceScore: null as null | import("../staff-builder-types").StaffBuilderScore, recoveredRun: null as null | import("@/features/piece-practice/persistence/piece-practice-runs").PiecePracticeRunRecordV1, projectionScores: [] as import("../staff-builder-types").StaffBuilderScore[], forceFailure: false },
  runBoundary: { records: [] as unknown[], discarded: [] as string[] },
}));
vi.mock("@/features/piece-practice/persistence/piece-practice-runs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/piece-practice/persistence/piece-practice-runs")>();
  return { ...actual, piecePracticeRunStore: {
    async list() { return [...runBoundary.records]; },
    async save(record: unknown) { runBoundary.records.push(record); },
    async discard(runId: string) { runBoundary.discarded.push(runId); runBoundary.records = runBoundary.records.filter((value) => typeof value !== "object" || value === null || !("runId" in value) || value.runId !== runId); },
  } };
});
vi.mock("../persistence/staff-builder-piece-file-browser", () => ({
  downloadStaffBuilderPiece: fileBoundary.download,
  readStaffBuilderPieceFile: fileBoundary.read,
}));
vi.mock("../hooks/use-staff-builder-input", () => ({
  useStaffBuilderInput: (onNote: (midiNumber: number) => void, onSustain: (isDown: boolean) => void) => {
    midiBoundary.onNote = onNote;
    midiBoundary.onSustain = onSustain;
    midiBoundary.registrations += 1;
    return { connectMidi: vi.fn(), deviceName: "Test MIDI", error: null, status: "connected" as const };
  },
}));
vi.mock("@/features/piece-practice/components/piece-practice-session", () => ({ PiecePracticeSession: ({ piece, sourceScore, recoveredRun, onExit }: { piece: import("@/features/piece-practice/piece-practice-types").PiecePracticePiece; sourceScore?: import("../staff-builder-types").StaffBuilderScore; recoveredRun?: import("@/features/piece-practice/persistence/piece-practice-runs").PiecePracticeRunRecordV1; onExit: () => void }) => {
  practiceBoundary.piece = piece;
  practiceBoundary.sourceScore = sourceScore ?? null;
  practiceBoundary.recoveredRun = recoveredRun ?? null;
  return <section><h1>Blocking Piece Practice: {piece.title}</h1><button onClick={onExit} type="button">Exit Piece Practice</button></section>;
} }));
vi.mock("@/features/piece-practice/piece-practice-projection", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/piece-practice/piece-practice-projection")>();
  return { ...actual, projectStaffBuilderPieceForPractice: (score: import("../staff-builder-types").StaffBuilderScore) => {
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
  practiceBoundary.sourceScore = null;
  practiceBoundary.recoveredRun = null;
  practiceBoundary.projectionScores = [];
  practiceBoundary.forceFailure = false;
  runBoundary.records = [];
  runBoundary.discarded = [];
  midiBoundary.onNote = null;
  midiBoundary.onSustain = null;
  midiBoundary.registrations = 0;
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
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); Reflect.deleteProperty(navigator, "clipboard"); });

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
    schemaVersion: 4 as const, annotations: [], id: `saved-${title}`, title, createdAt: "2026-08-10T12:00:00.000Z", updatedAt: "2026-08-10T12:00:00.000Z",
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

function savedPracticeRun(score: StaffBuilderScore, completed = false): PiecePracticeRunRecordV1 {
  const projected = projectStaffBuilderPieceForPractice(score);
  if (!projected.ok) throw new Error("Expected a practiceable score.");
  const focused = focusPiecePracticeProjection(projected.piece, "upper");
  const started = createPiecePracticeSession(focused, { startMeasureIndex: 0, startedAtMs: 100 });
  if (!started.ok) throw new Error("Expected a practice session.");
  let state = started.state;
  if (completed) {
    const first = focused.measures[0]!.targets[0]!;
    const result = submitPiecePracticeAttempt(focused, state, { targetId: first.id, attempt: { attackMidiNumbers: [60] } });
    if (!result.accepted) throw new Error("Expected a completed attempt.");
    state = result.state;
  }
  return createPiecePracticeRun(score, state, 200);
}

describe("Staff Builder recovery entry", () => {
  it("offers Resume and Discard for the newest valid active run and opens its saved snapshot and focus", async () => {
    const storage = new MemoryStorage();
    const saved = savedValidScore("Stored Study");
    seedLibrary(storage, [{ ...saved, title: "Edited Library Study", updatedAt: "2026-08-11T12:00:00.000Z" }]);
    const older = savedPracticeRun(savedValidScore("Older Study"));
    const newest = savedPracticeRun(saved);
    runBoundary.records = [{ ...older, updatedAt: "2026-08-09T12:00:00.000Z" }, { ...newest, updatedAt: "2026-08-12T12:00:00.000Z" }];
    render(<StaffBuilderSession storage={storage} />);
    const recovery = await screen.findByRole("region", { name: "Recovered practice session" });
    expect(recovery.textContent).toContain("Stored Study");
    expect(within(recovery).getAllByRole("button", { name: "Resume Practice" })).toHaveLength(2);
    expect(within(recovery).getAllByRole("button", { name: "Discard" })).toHaveLength(2);
    fireEvent.click(within(recovery).getAllByRole("button", { name: "Resume Practice" })[0]!);
    expect(practiceBoundary.piece?.title).toBe("Stored Study");
    expect(practiceBoundary.sourceScore).toEqual(saved);
    expect(practiceBoundary.recoveredRun?.runId).toBe(newest.runId);
    expect(practiceBoundary.recoveredRun?.configuration.assessmentFocus).toBe("upper");
  });

  it("offers Open Report for the latest completed run and passes its persisted record", async () => {
    const storage = new MemoryStorage();
    seedLibrary(storage, []);
    const completed = savedPracticeRun(savedValidScore("Finished Study"), true);
    runBoundary.records = [completed];
    render(<StaffBuilderSession storage={storage} />);
    const report = await screen.findByRole("region", { name: "Last completed practice" });
    expect(report.textContent).toContain("Finished Study");
    fireEvent.click(screen.getByRole("button", { name: "Open Report" }));
    expect(practiceBoundary.recoveredRun).toEqual(completed);
    expect(practiceBoundary.sourceScore).toEqual(completed.sourceScore);
  });

  it("discards only the selected run and keeps other saved runs", async () => {
    const storage = new MemoryStorage();
    seedLibrary(storage, []);
    const active = savedPracticeRun(savedValidScore("Unfinished"));
    const completed = savedPracticeRun(savedValidScore("Finished"), true);
    runBoundary.records = [active, completed];
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<StaffBuilderSession storage={storage} />);
    await screen.findByRole("region", { name: "Recovered practice session" });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));
    await waitFor(() => expect(runBoundary.discarded).toEqual([active.runId]));
    expect(runBoundary.records).toEqual([completed]);
    expect(screen.getByRole("button", { name: "Open Report" })).toBeTruthy();
  });

  it("does not hydrate corrupt or future-version active data", async () => {
    const storage = new MemoryStorage();
    seedLibrary(storage, []);
    const active = savedPracticeRun(savedValidScore("Unsupported"));
    runBoundary.records = [{ ...active, schemaVersion: 2 }, { ...active, runId: "corrupt-run", sourceScore: null, updatedAt: "2026-08-13T12:00:00.000Z" }];
    render(<StaffBuilderSession storage={storage} />);
    const recovery = await screen.findByText("Unrecoverable saved runs (2)");
    expect(recovery.closest("details")?.textContent).toMatch(/unsupported version/);
    expect(screen.queryByRole("button", { name: "Resume Practice" })).toBeNull();
    expect(practiceBoundary.piece).toBeNull();
    expect(within(recovery.closest("details")!).getAllByRole("button", { name: "Discard", hidden: true })).toHaveLength(2);
  });

  it("keeps valid Resume and Open Report visible behind newer invalid entries and discards only the chosen invalid run", async () => {
    const storage = new MemoryStorage();
    seedLibrary(storage, []);
    const active = savedPracticeRun(savedValidScore("Valid Active"));
    const completed = savedPracticeRun(savedValidScore("Valid Report"), true);
    const invalidActive = { ...active, runId: "invalid-active", schemaVersion: 2, updatedAt: "2026-12-31T00:00:00.000Z" };
    const invalidCompleted = { ...completed, runId: "invalid-completed", sourceScore: null, completedAt: "2026-12-31T00:00:00.000Z" };
    runBoundary.records = [invalidActive, invalidCompleted, active, completed];
    vi.stubGlobal("confirm", vi.fn(() => true));
    render(<StaffBuilderSession storage={storage} />);
    expect((await screen.findByRole("region", { name: "Recovered practice session" })).textContent).toContain("Valid Active");
    expect(screen.getByRole("region", { name: "Last completed practice" }).textContent).toContain("Valid Report");
    const invalid = screen.getByText("Unrecoverable saved runs (2)").closest("details")!;
    expect(invalid.textContent).toContain("unsupported version");
    expect(invalid.textContent).toContain("corrupt data");
    fireEvent.click(within(invalid).getAllByRole("button", { name: "Discard", hidden: true })[0]!);
    await waitFor(() => expect(runBoundary.discarded).toEqual(["invalid-active"]));
    expect(runBoundary.records).toContain(active);
    expect(runBoundary.records).toContain(completed);
    expect(runBoundary.records).toContain(invalidCompleted);
    fireEvent.click(screen.getByRole("button", { name: "Open Report" }));
    expect(practiceBoundary.recoveredRun?.runId).toBe(completed.runId);
  });
});

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
    expect(JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "null").practiceMetadataByPieceId).toEqual({});
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

  it("prints the exact persisted library score without opening or saving it", () => {
    vi.useFakeTimers();
    const storage = new MemoryStorage();
    const saved = savedTwoMeasureScore("Library Print");
    seedLibrary(storage, [saved]);
    const before = new Map(storage.values);
    const print = vi.fn();
    vi.stubGlobal("print", print);
    render(<StaffBuilderSession storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Print / PDF Library Print" }));
    expect(screen.getByRole("dialog", { name: "Print / Save PDF" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Print / Save PDF" }));
    expect([...document.querySelectorAll<HTMLElement>("[data-measure-number-lane=bottom]")].map(({ textContent }) => textContent)).toEqual(["Measure 1", "Measure 2"]);
    expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Piece library" })).toBeTruthy();
    expect(storage.values).toEqual(before);
    act(() => vi.advanceTimersByTime(0));
    expect(print).toHaveBeenCalledOnce();
    act(() => window.dispatchEvent(new Event("afterprint")));
    expect(document.querySelector(".staff-builder-print-document")).toBeNull();
    vi.useRealTimers();
  });

  it("records practice once at the successful Phase A launch boundary and does not rewrite it while rendered", () => {
    const storage = new MemoryStorage();
    const saved = savedValidScore();
    seedLibrary(storage, [saved]);
    render(<StaffBuilderSession storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Practice Practice Study" }));
    expect(screen.getByRole("heading", { name: "Blocking Piece Practice: Practice Study" })).toBeTruthy();
    expect(practiceBoundary.projectionScores).toEqual([saved]);
    expect(practiceBoundary.piece).toMatchObject({ sourceScoreId: saved.id, sourceScoreUpdatedAt: saved.updatedAt, title: saved.title });
    const launchedLibrary = storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "";
    const metadata = JSON.parse(launchedLibrary).practiceMetadataByPieceId[saved.id];
    expect(metadata).toMatchObject({ lastPracticedAt: expect.any(String) });
    expect(Number.isNaN(Date.parse(metadata.lastPracticedAt))).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Exit Piece Practice" }));
    expect(screen.getByRole("heading", { name: "Piece library" })).toBeTruthy();
    expect(screen.queryByRole("heading", { name: "Measure 1 of 1" })).toBeNull();
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library)).toBe(launchedLibrary);
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
    expect(JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "null").practiceMetadataByPieceId).toBeUndefined();
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

  it("launches the existing Piece Practice path from a valid opened baseline and tracks edit and Undo equivalence", () => {
    const storage = new MemoryStorage();
    const saved = savedValidScore("Editor Practice");
    seedLibrary(storage, [saved]);
    render(<StaffBuilderSession storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Editor Practice" }));

    const practiceButton = screen.getByRole("button", { name: "Practice Piece" }) as HTMLButtonElement;
    expect(practiceButton.disabled).toBe(false);

    act(() => midiBoundary.onNote?.(64));
    expect(practiceButton.disabled).toBe(true);
    expect(screen.getByText("Lock in or clear pending notes before practicing.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear Current Entry" }));
    expect(practiceButton.disabled).toBe(false);

    const tempo = screen.getByRole("spinbutton", { name: "Tempo" });
    fireEvent.change(tempo, { target: { value: "104" } });
    fireEvent.keyDown(tempo, { key: "Enter" });
    expect(practiceButton.disabled).toBe(true);
    expect(screen.getByText("Save before practicing.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Undo last score edit" }));
    expect(practiceButton.disabled).toBe(false);

    const libraryBeforeLaunch = storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library);
    const draftBeforeLaunch = storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft);
    fireEvent.click(practiceButton);
    expect(screen.getByRole("heading", { name: "Blocking Piece Practice: Editor Practice" })).toBeTruthy();
    expect(practiceBoundary.projectionScores).toHaveLength(1);
    expect(practiceBoundary.projectionScores[0]).toMatchObject({ id: saved.id, title: saved.title, tempoBpm: saved.tempoBpm, measures: saved.measures });
    const libraryAfterLaunch = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library) ?? "null");
    expect(libraryAfterLaunch.pieces).toEqual(JSON.parse(libraryBeforeLaunch ?? "null").pieces);
    expect(libraryAfterLaunch.practiceMetadataByPieceId[saved.id]).toMatchObject({ lastPracticedAt: expect.any(String) });
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft)).toBe(draftBeforeLaunch);
  });

  it("does not enable editor practice for invalid persisted or newly created pieces", () => {
    const persistedStorage = new MemoryStorage();
    const invalid = createStaffBuilderScore({ title: "Invalid Saved", tempoBpm: 96, initialKeySignatureId: "c-major", initialTimeSignature: "4/4" });
    seedLibrary(persistedStorage, [invalid]);
    const persisted = render(<StaffBuilderSession storage={persistedStorage} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Invalid Saved" }));
    expect((screen.getByRole("button", { name: "Practice Piece" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Fix validation issues before practicing.")).toBeTruthy();
    persisted.unmount();

    const newStorage = new MemoryStorage();
    render(<StaffBuilderSession storage={newStorage} />);
    dismissIntroduction();
    createPiece("New Draft");
    expect((screen.getByRole("button", { name: "Practice Piece" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Fix validation issues before practicing.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Fill All Empty Beats With Rests" }));
    expect((screen.getByRole("button", { name: "Practice Piece" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Save before practicing.")).toBeTruthy();
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

  it("uses pedal-down to advance an empty Lock position and does not retrigger while held", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Pedal Capture");
    expect((screen.getByRole("button", { name: "Lock pitches and continue" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByLabelText("Sustain pedal commits and advances input"));
    act(() => midiBoundary.onSustain?.(true));
    expect(screen.getByText(/Beat 2 .*tick 480/)).toBeTruthy();
    act(() => midiBoundary.onSustain?.(true));
    expect(screen.getByText(/Beat 2 .*tick 480/)).toBeTruthy();
    act(() => midiBoundary.onSustain?.(false));
    expect(screen.getByText(/Beat 2 .*tick 480/)).toBeTruthy();

    act(() => midiBoundary.onNote?.(60));
    expect((screen.getByRole("button", { name: "Lock pitches and continue" }) as HTMLButtonElement).disabled).toBe(false);
    act(() => midiBoundary.onSustain?.(true));
    expect(screen.getByText(/quarter note C4 at tick 480/)).toBeTruthy();
    expect(screen.getByText(/Beat 3 .*tick 960/)).toBeTruthy();
    let draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    expect(draft.score.measures[0].events).toHaveLength(1);
    expect(draft.captureState.cursor).toEqual({ measureIndex: 0, offsetTicks: 960 });
    expect(draft.score).not.toHaveProperty("sustainPedalLocksInput");

    act(() => midiBoundary.onNote?.(60));
    fireEvent.click(screen.getByRole("button", { name: "Lock pitches and continue" }));
    draft = JSON.parse(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.draft) ?? "null");
    const [pedalEvent, buttonEvent] = draft.score.measures[0].events;
    expect(buttonEvent).toMatchObject({
      ...pedalEvent,
      id: expect.any(String),
      startTick: 960,
      pitches: pedalEvent.pitches.map((pitch: { id: string }) => ({ ...pitch, id: expect.any(String) })),
    });
    expect(draft.captureState.cursor).toEqual({ measureIndex: 1, offsetTicks: 0 });
  });

  it("distinguishes invalid pending input from an empty Lock position", () => {
    expect(shouldSustainPedalLock(false, false)).toBe(true);
    expect(shouldSustainPedalLock(true, true)).toBe(true);
    expect(shouldSustainPedalLock(true, false)).toBe(false);
  });

  it("ignores pedal-up, disabled, stale-enabling, and non-capture pedal events", () => {
    const storage = new MemoryStorage();
    render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Guarded Pedal");
    act(() => midiBoundary.onNote?.(60));
    act(() => midiBoundary.onSustain?.(true));
    act(() => midiBoundary.onSustain?.(false));
    expect(screen.getByText(/Beat 1 .*tick 0/)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Sustain pedal commits and advances input"));
    expect(screen.getByText(/Beat 1 .*tick 0/)).toBeTruthy();
    act(() => midiBoundary.onSustain?.(false));
    expect(screen.getByText(/Beat 1 .*tick 0/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Study View" }));
    act(() => midiBoundary.onSustain?.(true));
    fireEvent.click(screen.getByRole("button", { name: "Exit Study View" }));
    expect(screen.getByText(/Beat 1 .*tick 0/)).toBeTruthy();
  });

  it("persists pedal preference across reload without placing it in score data", () => {
    const storage = new MemoryStorage();
    const first = render(<StaffBuilderSession storage={storage} />);
    dismissIntroduction();
    createPiece("Persistent Pedal");
    fireEvent.click(screen.getByLabelText("Sustain pedal commits and advances input"));
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.sustainPedalLocksInput)).toBe("true");
    first.unmount();

    render(<StaffBuilderSession storage={storage} />);
    expect((screen.getByLabelText("Sustain pedal commits and advances input") as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByLabelText("Sustain pedal commits and advances input"));
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.sustainPedalLocksInput)).toBe("false");
  });

  it("surfaces pedal preference write failure while leaving score storage untouched", () => {
    const storage = new MemoryStorage();
    seedLibrary(storage, [savedValidScore("Protected Score")]);
    const originalLibrary = storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library);
    storage.setItem = (key, value) => {
      if (key === STAFF_BUILDER_STORAGE_KEYS.sustainPedalLocksInput) throw new Error("blocked");
      storage.values.set(key, value);
    };
    render(<StaffBuilderSession storage={storage} />);
    fireEvent.click(screen.getByRole("button", { name: "Open Protected Score" }));
    fireEvent.click(screen.getByLabelText("Sustain pedal commits and advances input"));
    expect(screen.getByRole("alert").textContent).toContain("Staff Builder changes could not be saved in this browser.");
    expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library)).toBe(originalLibrary);
    expect((screen.getByLabelText("Sustain pedal commits and advances input") as HTMLInputElement).checked).toBe(true);
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

it.each([false, true])("copies a new piece's unsaved editor score without storage/history mutation (clipboard failure: %s)", async (clipboardFails) => {
  const storage = new MemoryStorage();

  const writeText = clipboardFails ? vi.fn().mockRejectedValue(new Error("Denied")) : vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, get: () => ({ writeText }) });
  render(<StaffBuilderSession storage={storage} />);
  dismissIntroduction();
  createPiece("Copy Study");
  fireEvent.change(screen.getByRole("spinbutton", { name: "Tempo" }), { target: { value: "112" } });
  fireEvent.blur(screen.getByRole("spinbutton", { name: "Tempo" }));
  fireEvent.click(screen.getByText("Measure 1 display clefs: Upper Treble \u00b7 Lower Bass"));
  fireEvent.change(screen.getByLabelText("Lower staff display clef"), { target: { value: "treble" } });
  const snapshot = new Map(storage.values);
  const setItem = vi.spyOn(storage, "setItem");
  const removeItem = vi.spyOn(storage, "removeItem");
  const undoDisabled = (screen.getByRole("button", { name: "Undo last score edit" }) as HTMLButtonElement).disabled;
  fireEvent.click(screen.getByRole("button", { name: "Copy Score for AI" }));
  if (clipboardFails) await screen.findByRole("textbox", { name: "Staff Builder score JSON" });
  else await screen.findByText("Score JSON copied.");
  const { parseStaffBuilderPieceFileText } = await import("../persistence/staff-builder-piece-file");
  const currentDraft = JSON.parse(snapshot.get(STAFF_BUILDER_STORAGE_KEYS.draft)!).score;
  expect(parseStaffBuilderPieceFileText(writeText.mock.calls[0]![0])).toEqual({ ok: true, score: currentDraft });
  expect(currentDraft.tempoBpm).toBe(112);
  expect(currentDraft.measures[0].clefChanges).toEqual({ bass: "treble" });
  expect(storage.values.get(STAFF_BUILDER_STORAGE_KEYS.library)).toBe(snapshot.get(STAFF_BUILDER_STORAGE_KEYS.library));
  expect(setItem).not.toHaveBeenCalled();
  expect(removeItem).not.toHaveBeenCalled();
  expect(storage.values).toEqual(snapshot);
  expect((screen.getByRole("button", { name: "Undo last score edit" }) as HTMLButtonElement).disabled).toBe(undoDisabled);
});


it.each([false, true])("keeps editor and storage unchanged throughout guide preview, copy, failure, retry, and close (failure: %s)", async (fails) => {
  const storage = new MemoryStorage();
  const existing = savedValidScore("Existing Piece");
  storage.values.set(STAFF_BUILDER_STORAGE_KEYS.library, JSON.stringify({ schemaVersion: 4, pieces: [existing], practiceMetadataByPieceId: { [existing.id]: { lastPracticedAt: "2026-09-28T12:00:00.000Z" } } }));
  const writeText = vi.fn();
  if (fails) writeText.mockRejectedValueOnce(new Error("Denied"));
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  render(<StaffBuilderSession storage={storage} />);
  dismissIntroduction(); createPiece("Authoring Help Study");
  fireEvent.click(screen.getByRole("button", { name: "C, MIDI 60" }));
  fireEvent.click(screen.getByRole("button", { name: "Lock pitches and continue" }));
  const snapshot = new Map(storage.values);
  const setItem = vi.spyOn(storage, "setItem");
  const removeItem = vi.spyOn(storage, "removeItem");
  const undo = screen.getByRole("button", { name: "Undo last score edit" }) as HTMLButtonElement;
  const undoBefore = undo.disabled;
  const redo = screen.getByRole("button", { name: "Redo last score edit" }) as HTMLButtonElement;
  const redoBefore = redo.disabled;
  const trigger = screen.getByRole("button", { name: "Staff Builder AI authoring guide" });
  fireEvent.click(trigger);
  fireEvent.click(screen.getByText("Read the authoring guide"));
  fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));
  if (fails) {
    await screen.findByRole("textbox", { name: "Staff Builder AI authoring guide text" });
    fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));
  }
  await screen.findByText("Authoring guide copied.");
  for (const call of writeText.mock.calls) expect(call).toEqual([createStaffBuilderLlmSpecification()]);
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(document.activeElement).toBe(trigger);
  expect(storage.values).toEqual(snapshot);
  expect(setItem).not.toHaveBeenCalled(); expect(removeItem).not.toHaveBeenCalled();
  expect(undo.disabled).toBe(undoBefore); expect(redo.disabled).toBe(redoBefore);
  fireEvent.click(screen.getByRole("button", { name: "Copy Score for AI" }));
  await screen.findByText("Score JSON copied.");
  const { parseStaffBuilderPieceFileText } = await import("../persistence/staff-builder-piece-file");
  expect(parseStaffBuilderPieceFileText(writeText.mock.calls.at(-1)![0])).toEqual({ ok: true, score: JSON.parse(snapshot.get(STAFF_BUILDER_STORAGE_KEYS.draft)!).score });
  expect(storage.values).toEqual(snapshot);
});
