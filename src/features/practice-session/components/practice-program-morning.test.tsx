import { StrictMode, forwardRef, useImperativeHandle } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppMidiContext, type AppMidiContextValue } from "@/components/midi/midi-context";
import { FakeImprovIndexedDb } from "../../improv/persistence/improv-indexeddb-fake";
import { IndexedDbPracticePrograms } from "../persistence/practice-program-indexeddb";
import { IndexedDbPracticeAttempts } from "../persistence/practice-attempt-indexeddb";
import { PRACTICE_LESSON_PREFERENCE_KEY as preferenceKey } from "../practice-lesson-preferences";
import { testProgram } from "../practice-program-test-fixtures";
import PracticeProgramLibrary from "./practice-program-library";
import { REPERTOIRE_PREFERENCE_KEY } from "../practice-repertoire-preferences";
import { createEntry, editEntry } from "../../piece-practice/rolodex/rolodex-model";
import { testScore } from "../../piece-practice/continuous/continuous-test-fixtures";
import type { RolodexStore } from "../../piece-practice/rolodex/rolodex-types";

type NativeProps = { initialConfig: unknown; hostedStart?: boolean; onPracticeUnitCompleted?: () => void };
function Native(props: NativeProps) { return <div data-testid="native" data-hosted-start={String(props.hostedStart)} data-config={JSON.stringify(props.initialConfig)}><button onClick={props.onPracticeUnitCompleted}>native unit</button></div>; }
vi.mock("@/features/flashcards/components/flashcard-session", () => ({ default: Native }));
vi.mock("@/features/sequences/components/sequence-session", () => ({ default: Native }));
vi.mock("@/features/ear-training/components/ear-training-session", () => ({ default: Native }));
vi.mock("@/features/melody/components/melody-session", () => ({ default: forwardRef(function Melody(props: NativeProps, ref) { useImperativeHandle(ref, () => ({ continuePractice: () => true })); return <Native {...props} />; }) }));

const now = () => new Date(2026, 9, 18, 8).getTime();
function program(revision = 1, exerciseIds = ["exercise-0", "exercise-8"]) {
  const value = testProgram();
  return { ...value, revision, program: { ...value.program, revision, suggestedRotation: [{ day: "sunday" as const, exerciseIds }] } };
}
let fake: FakeImprovIndexedDb, original: PropertyDescriptor | undefined;
beforeEach(async () => {
  fake = new FakeImprovIndexedDb(); original = Object.getOwnPropertyDescriptor(globalThis, "indexedDB");
  Object.defineProperty(globalThis, "indexedDB", { configurable: true, value: fake.factory });
  const attempts = new IndexedDbPracticeAttempts(fake.factory); await attempts.list(program().programId); attempts.close();
  const definitions = new IndexedDbPracticePrograms(fake.factory); await definitions.list(); definitions.close();
});
afterEach(async () => {
  cleanup(); await Promise.resolve(); vi.restoreAllMocks();
  if (original) Object.defineProperty(globalThis, "indexedDB", original); else Reflect.deleteProperty(globalThis, "indexedDB");
});
async function fixture(preferred: string | null = program().programId, source = program()) {
  const definitions = new IndexedDbPracticePrograms(fake.factory); await definitions.save(source, null); definitions.close();
  let stored = preferred ? JSON.stringify({ version: 1, programId: preferred }) : null;
  const storage = { getItem: vi.fn(() => stored), setItem: vi.fn((_key: string, value: string) => { stored = value; }) };
  const createStore = () => new IndexedDbPracticePrograms(fake.factory);
  const midi: AppMidiContextValue = { status: "connected", deviceName: "Test piano", error: null, connectMidi: vi.fn(async () => undefined), connectedInputs: [], registerConsumer: vi.fn(() => () => {}) };
  const props = { createStore, preferenceStorage: () => storage, now };
  const tree = (active = true) => <StrictMode><AppMidiContext.Provider value={midi}><PracticeProgramLibrary active={active} {...props}><div data-testid="legacy">Legacy builder</div></PracticeProgramLibrary></AppMidiContext.Provider></StrictMode>;
  return { props, tree, storage, midi, stored: () => stored, createStore };
}
async function ready() {
  const button = await screen.findByRole("button", { name: "Start Today's Lesson" });
  await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false)); return button;
}
async function rows() { const store = new IndexedDbPracticeAttempts(fake.factory); try { return await store.list(program().programId); } finally { store.close(); } }
const lessonCard = () => within(screen.getByRole("region", { name: "Today's Piano Lesson" }));

describe("one-action morning launch through the existing V2 owner", () => {
  it("rereads acknowledged repertoire at Start, freezes it, and never inserts a V2 exercise", async () => {
    const f = await fixture(undefined, program(1, ["exercise-0"]));
    let entries = [createEntry(testScore(), "piano")];
    const repertoireStore: RolodexStore = { list: vi.fn(async () => ({ entries, unavailableCount: 0 })), save: vi.fn(), remove: vi.fn(), importEntries: vi.fn(), acknowledge: vi.fn() };
    f.storage.getItem.mockImplementation((...args: unknown[]) => args[0] === REPERTOIRE_PREFERENCE_KEY ? JSON.stringify({ version: 1, enabled: true, instruments: ["piano"] }) : f.stored());
    render(<PracticeProgramLibrary {...f.props} repertoireStore={repertoireStore} />);
    await screen.findByText(/Optional repertoire: Synthetic piano study/);
    entries = [editEntry(entries[0]!, { bpm: 89 })];
    fireEvent.click(await ready()); await screen.findByTestId("native");
    entries = []; // Another tab deletes the entry after launch.
    fireEvent.click(screen.getByText("native unit"));
    const next = await screen.findByRole("button", { name: "Next: Repertoire" });
    await waitFor(() => expect((next as HTMLButtonElement).disabled).toBe(false)); fireEvent.click(next);
    await screen.findByText(/89 quarter BPM/);
    expect((await rows()).map(row => row.exerciseId)).toEqual(["exercise-0"]);
    expect(repertoireStore.list).toHaveBeenCalledTimes(2);
  });
  it("unavailable repertoire does not block the normal authored lesson", async () => {
    const f = await fixture();
    f.storage.getItem.mockImplementation((...args: unknown[]) => args[0] === REPERTOIRE_PREFERENCE_KEY ? JSON.stringify({ version: 1, enabled: true, instruments: ["piano"] }) : f.stored());
    const repertoireStore: RolodexStore = { list: vi.fn(async () => { throw Error("unavailable"); }), save: vi.fn(), remove: vi.fn(), importEntries: vi.fn(), acknowledge: vi.fn() };
    render(<PracticeProgramLibrary {...f.props} repertoireStore={repertoireStore} />);
    fireEvent.click(await ready()); await screen.findByTestId("native");
    expect((await rows()).map(row => row.exerciseId)).toEqual(["exercise-0"]);
    expect(screen.queryByText("Next: Repertoire")).toBeNull();
  });
  it("places the lesson above legacy setup and remembers only an explicit choice/change", async () => {
    const f = await fixture(null); render(f.tree());
    expect(f.storage.setItem).not.toHaveBeenCalled();
    const card = screen.getByRole("region", { name: "Today's Piano Lesson" });
    expect(card.compareDocumentPosition(screen.getByTestId("legacy")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.click(lessonCard().getByRole("button", { name: "Choose Weekly Program" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use Flexible foundations for today's lesson" }));
    await ready(); expect(f.storage.setItem).toHaveBeenCalledExactlyOnceWith(preferenceKey, JSON.stringify({ version: 1, programId: program().programId }));
    const other = program(); const separate = { ...other, programId: "another", program: { ...other.program, programId: "another", title: "Another program" } };
    const store = f.createStore(); await store.save(separate, null); store.close();
    fireEvent.click(lessonCard().getByRole("button", { name: "Change Weekly Program" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use Another program for today's lesson" }));
    await waitFor(() => expect(lessonCard().getByText(/Another program/)).toBeTruthy());
    expect(JSON.parse(f.stored()!)).toEqual({ version: 1, programId: "another" });
  });
  it("does not designate a preferred program when definitions are viewed or manually practiced", async () => {
    const f = await fixture(null); render(f.tree());
    fireEvent.click(screen.getByRole("button", { name: "View saved programs" }));
    fireEvent.click(await screen.findByRole("button", { name: "Flexible foundations · Revision 1" }));
    fireEvent.click(await screen.findByRole("button", { name: "Practice current revision" }));
    fireEvent.click(screen.getByRole("checkbox", { name: program().program.exercises[0]!.label }));
    fireEvent.click(screen.getByRole("button", { name: "Prepare selected exercises" }));
    fireEvent.click(screen.getByRole("button", { name: "Start selected exercise" })); await screen.findByTestId("native");
    expect(f.storage.setItem).not.toHaveBeenCalled();
  });
  it("loads preferences without writes and launches the first authored selection with one action", async () => {
    const f = await fixture(); render(f.tree());
    const start = await ready(); expect(f.storage.setItem).not.toHaveBeenCalled();
    expect(lessonCard().getAllByRole("listitem").map(value => value.textContent)).toEqual([
      expect.stringContaining(program().program.exercises[0]!.label), expect.stringContaining(program().program.exercises[8]!.label),
    ]);
    fireEvent.click(start); await screen.findByTestId("native");
    expect(screen.queryByRole("button", { name: "Start selected exercise" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Prepare selected exercises" })).toBeNull();
    expect(JSON.parse(screen.getByTestId("native").getAttribute("data-config")!)).toEqual(program().nativeExercises[0]!.config);
    expect(await rows()).toHaveLength(1); expect(f.midi.connectMidi).not.toHaveBeenCalled(); expect(f.midi.registerConsumer).not.toHaveBeenCalled();
  });
  it("resolves the latest head at Start and retains that revision after a later save", async () => {
    const f = await fixture(); render(f.tree()); await ready();
    const second = program(2, ["exercise-8", "exercise-0"]), store = f.createStore(); await store.save(second, 1, true);
    fireEvent.click(await ready()); await screen.findByTestId("native");
    expect(screen.getByRole("region", { name: "Today's active piano lesson" }).textContent).toContain("Revision 2");
    await waitFor(() => expect(screen.getByTestId("native").getAttribute("data-hosted-start")).toBe("true"));
    const config = screen.getByTestId("native").getAttribute("data-config");
    await store.save(program(3), 2, true); store.close();
    expect(screen.getByTestId("native").getAttribute("data-config")).toBe(config);
    expect((await rows())[0]).toMatchObject({ programRevision: 2, exerciseId: "exercise-8", exercise: second.nativeExercises[8] });
  });
  it("Edit Lesson uses the existing manual pool without preparing an attempt", async () => {
    const f = await fixture(); render(f.tree()); await ready(); fireEvent.click(lessonCard().getByRole("button", { name: "Edit Lesson" }));
    await screen.findByRole("group", { name: "Exercise pool" });
    expect(screen.getByRole("button", { name: "Prepare selected exercises" })).toBeTruthy(); expect(await rows()).toEqual([]);
  });
  it("retains the mounted legacy editor while weekly practice hides it", async () => {
    const f = await fixture(); render(f.tree()); const legacy = screen.getByTestId("legacy");
    fireEvent.click(await ready()); await screen.findByTestId("native");
    expect(screen.getByTestId("legacy")).toBe(legacy); expect(legacy.closest("[hidden]")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Stop Exercise" })); await screen.findByText(/Saved attempt: stopped-early/);
    fireEvent.click(screen.getByRole("button", { name: "Return" }));
    await ready(); expect(screen.getByTestId("legacy")).toBe(legacy); expect(legacy.closest("[hidden]")).toBeNull();
  });
  it("uses manual selection for a missing rotation without inventing attempts", async () => {
    const source = program(); source.program.suggestedRotation = [];
    const f = await fixture(source.programId, source); render(f.tree());
    await screen.findByText("No suggested lesson for today. Choose exercises.");
    fireEvent.click(screen.getByRole("button", { name: "Choose exercises" }));
    await screen.findByRole("group", { name: "Exercise pool" });
    expect(await rows()).toEqual([]); expect(f.midi.connectMidi).not.toHaveBeenCalled();
  });
  it("reports missing/deleted preferred identities without clearing storage", async () => {
    const f = await fixture("deleted"); render(f.tree());
    expect((await screen.findByRole("alert")).textContent).toContain("no longer available");
    expect(f.storage.setItem).not.toHaveBeenCalled(); expect(screen.queryByTestId("native")).toBeNull();
  });
  it("keeps an explicit choice usable for this tab when preference storage is denied", async () => {
    const f = await fixture(null);
    const denied = () => { throw new DOMException("Denied", "SecurityError"); };
    render(<AppMidiContext.Provider value={f.midi}><PracticeProgramLibrary {...f.props} preferenceStorage={denied} /></AppMidiContext.Provider>);
    expect(screen.getByText(/browser storage is unavailable/)).toBeTruthy();
    fireEvent.click(lessonCard().getByRole("button", { name: "Choose Weekly Program" }));
    fireEvent.click(await screen.findByRole("button", { name: "Use Flexible foundations for today's lesson" }));
    fireEvent.click(await ready()); await screen.findByTestId("native"); expect(await rows()).toHaveLength(1);
  });
  it("scopes hosted activation to each fresh lesson Repeat attempt", async () => {
    const source = program(1, ["exercise-8"]), f = await fixture(source.programId, source); render(f.tree());
    fireEvent.click(await ready()); await screen.findByTestId("native");
    await waitFor(() => expect(screen.getByTestId("native").getAttribute("data-hosted-start")).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "Stop Exercise" })); await screen.findByText(/Saved attempt: stopped-early/);
    fireEvent.click(screen.getByRole("button", { name: "Repeat Exercise" })); await screen.findByTestId("native");
    expect(screen.getByTestId("native").getAttribute("data-hosted-start")).toBe("true"); expect(await rows()).toHaveLength(2);
  });
  it("reports unavailable definitions and allows an explicit retry", async () => {
    const f = await fixture(); const list = vi.spyOn(IndexedDbPracticePrograms.prototype, "list"); list.mockRejectedValueOnce(Error("Definitions unavailable"));
    render(f.tree()); await screen.findByRole("alert"); fireEvent.click(screen.getByRole("button", { name: "Retry loading lesson" })); await ready();
    expect(f.storage.setItem).not.toHaveBeenCalled();
  });
  it("rejects an invalid current rotation without silently dropping references", async () => {
    const f = await fixture(); const invalid = program(2, ["exercise-0", "missing"]);
    vi.spyOn(IndexedDbPracticePrograms.prototype, "list").mockResolvedValue([invalid]);
    render(f.tree()); expect((await screen.findByRole("alert")).textContent).toContain("unavailable exercise: missing");
    expect(screen.queryByTestId("native")).toBeNull(); expect(await rows()).toEqual([]);
  });
  it("waits for acknowledgement and rejects rapid duplicate Starts under Strict Mode", async () => {
    const f = await fixture(); render(f.tree()); const start = await ready();
    const save = IndexedDbPracticeAttempts.prototype.save; let release!: () => void;
    vi.spyOn(IndexedDbPracticeAttempts.prototype, "save").mockImplementationOnce(function(this: IndexedDbPracticeAttempts, record, previous) { return new Promise((resolve, reject) => { release = () => { void save.call(this, record, previous).then(resolve, reject); }; }); });
    fireEvent.click(start); fireEvent.click(start);
    await waitFor(() => expect(release).toBeTypeOf("function"));
    expect(screen.queryByTestId("native")).toBeNull(); expect(await rows()).toEqual([]);
    await act(async () => release()); await screen.findByTestId("native"); expect(await rows()).toHaveLength(1);
  });
  it("retries a rejected start with the original attempt identity", async () => {
    const f = await fixture(); render(f.tree()); await ready();
    const save = vi.spyOn(IndexedDbPracticeAttempts.prototype, "save").mockRejectedValueOnce(Error("Attempt storage unavailable"));
    fireEvent.click(await ready()); await screen.findByRole("alert"); expect(screen.queryByTestId("native")).toBeNull();
    const record = save.mock.calls[0]![0]; fireEvent.click(screen.getByRole("button", { name: "Retry saving" })); await screen.findByTestId("native");
    expect((await rows())[0]).toMatchObject({ recordId: record.recordId }); expect(await rows()).toHaveLength(1);
  });
  it("interrupts a morning start acknowledged after leaving the page, without mounting or resuming", async () => {
    const f = await fixture(), view = render(f.tree()); await ready();
    const save = IndexedDbPracticeAttempts.prototype.save; let release!: () => void;
    vi.spyOn(IndexedDbPracticeAttempts.prototype, "save").mockImplementationOnce(function(this: IndexedDbPracticeAttempts, record, previous) { return new Promise((resolve, reject) => { release = () => { void save.call(this, record, previous).then(resolve, reject); }; }); });
    fireEvent.click(await ready()); await waitFor(() => expect(release).toBeTypeOf("function")); view.rerender(f.tree(false));
    await act(async () => release()); await waitFor(async () => expect((await rows())[0]).toMatchObject({ outcome: "interrupted", closed: true }));
    expect(screen.queryByTestId("native")).toBeNull(); view.rerender(f.tree(true)); expect(screen.queryByTestId("native")).toBeNull();
  });
  it.each(["disconnected", "error"] as const)("uses existing MIDI connection from Start (%s), retaining the selection after denial", async status => {
    const f = await fixture(); Object.assign(f.midi, { status });
    if (status === "error") vi.mocked(f.midi.connectMidi).mockRejectedValueOnce(Error("Permission denied"));
    render(f.tree()); fireEvent.click(await ready()); await screen.findByTestId("native");
    expect(f.midi.connectMidi).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/MIDI is not connected/)).toBeTruthy(); expect(await rows()).toHaveLength(1);
  });
  it("cancels a pending definition read without mounting an engine or starting an attempt", async () => {
    const f = await fixture(); render(f.tree()); await ready();
    let release!: () => void; vi.spyOn(IndexedDbPracticePrograms.prototype, "list").mockImplementationOnce(() => new Promise(resolve => { release = () => resolve([program()]); }));
    fireEvent.click(await ready()); fireEvent.click(screen.getByRole("button", { name: "Cancel launch" }));
    await act(async () => release()); expect(screen.queryByTestId("native")).toBeNull(); expect(await rows()).toEqual([]);
    fireEvent.click(await ready()); await screen.findByTestId("native");
  });
  it("allows choosing again after navigation cancels an unconfigured program lookup", async () => {
    const f = await fixture(null), view = render(f.tree()); let release!: () => void;
    vi.spyOn(IndexedDbPracticePrograms.prototype, "list").mockImplementationOnce(() => new Promise(resolve => { release = () => resolve([program()]); }));
    fireEvent.click(lessonCard().getByRole("button", { name: "Choose Weekly Program" }));
    view.rerender(f.tree(false)); await act(async () => release()); view.rerender(f.tree(true));
    await waitFor(() => expect((lessonCard().getByRole("button", { name: "Choose Weekly Program" }) as HTMLButtonElement).disabled).toBe(false));
    expect(f.storage.setItem).not.toHaveBeenCalled(); expect(await rows()).toEqual([]);
  });
});
