import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FakeImprovIndexedDb } from "../../improv/persistence/improv-indexeddb-fake";
import { WEEKLY_PROGRAM_EXAMPLE, createPracticeProgramLlmSpecification } from "../import/practice-program-specification";
import { IndexedDbPracticePrograms } from "../persistence/practice-program-indexeddb";
import { validatePracticeProgram } from "../practice-program-validation";
import PracticeProgramLibrary from "./practice-program-library";
import PracticeProgramImportDialog from "./practice-program-import-dialog";
import WeeklyPracticeGuideDialog from "./weekly-practice-guide-dialog";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function fixture() { const fake = new FakeImprovIndexedDb(); return { fake, createStore: () => new IndexedDbPracticePrograms(fake.factory) }; }
function paste(value: unknown = WEEKLY_PROGRAM_EXAMPLE) { fireEvent.change(screen.getByRole("textbox", { name: "Weekly program JSON" }), { target: { value: JSON.stringify(value) } }); }
async function preview() { fireEvent.click(screen.getByRole("button", { name: "Validate and preview" })); await screen.findByRole("heading", { name: "Flexible foundations" }); }

describe("weekly program foundation interface", () => {
  it("previews without saving, explicitly saves and reads immutable definitions after remount", async () => {
    const { createStore } = fixture(); const first = render(<PracticeProgramLibrary createStore={createStore} />);
    fireEvent.click(screen.getByRole("button", { name: "Import Weekly Program" })); paste(); await preview();
    expect(await createStore().list()).toEqual([]); expect(screen.queryByRole("button", { name: /Start Weekly/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Save program" })); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("status").textContent).toContain("Saved"); first.unmount(); render(<PracticeProgramLibrary createStore={createStore} />);
    fireEvent.click(screen.getByRole("button", { name: "View saved programs" })); fireEvent.click(await screen.findByRole("button", { name: "Flexible foundations · Revision 1" }));
    expect(await screen.findByRole("heading", { name: "Flexible foundations" })).toBeTruthy(); expect(screen.getByRole("combobox", { name: "Saved revision" })).toBeTruthy();
  });
  it("keeps Cancel unsaved and restores the import trigger focus", async () => {
    const { createStore } = fixture(); render(<PracticeProgramLibrary createStore={createStore} />);
    const trigger = screen.getByRole("button", { name: "Import Weekly Program" }); fireEvent.click(trigger); paste(); await preview();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" })); expect(await createStore().list()).toEqual([]); expect(document.activeElement).toBe(trigger);
  });
  it("rejects invalid JSON with field-level errors and disables saving", async () => {
    const { createStore } = fixture(); render(<PracticeProgramLibrary createStore={createStore} />);
    fireEvent.click(screen.getByRole("button", { name: "Import Weekly Program" })); paste({ ...WEEKLY_PROGRAM_EXAMPLE, attempts: [] });
    fireEvent.click(screen.getByRole("button", { name: "Validate and preview" })); expect((await screen.findByRole("alert")).textContent).toContain("program.attempts");
    expect((screen.getByRole("button", { name: "Save program" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("shows identical imports as no-ops and rejects conflicting revisions", async () => {
    const { createStore } = fixture(); const parsed = validatePracticeProgram(WEEKLY_PROGRAM_EXAMPLE); if (!parsed.ok) throw Error("fixture"); await createStore().save(parsed.value, null);
    render(<PracticeProgramLibrary createStore={createStore} />); fireEvent.click(screen.getByRole("button", { name: "Import Weekly Program" })); paste(); await preview();
    expect(screen.getByText(/identical revision is already saved/)).toBeTruthy(); expect((screen.getByRole("button", { name: "Save program" }) as HTMLButtonElement).disabled).toBe(true);
    paste({ ...WEEKLY_PROGRAM_EXAMPLE, title: "Conflicting content" }); fireEvent.click(screen.getByRole("button", { name: "Validate and preview" })); expect((await screen.findByRole("alert")).textContent).toContain("different content");
  });
  it("requires a newer-revision checkbox and offers earlier immutable definitions", async () => {
    const { createStore } = fixture(); const parsed = validatePracticeProgram(WEEKLY_PROGRAM_EXAMPLE); if (!parsed.ok) throw Error("fixture"); await createStore().save(parsed.value, null);
    render(<PracticeProgramLibrary createStore={createStore} />); fireEvent.click(screen.getByRole("button", { name: "Import Weekly Program" })); paste({ ...WEEKLY_PROGRAM_EXAMPLE, revision: 2 }); await preview();
    const save = screen.getByRole("button", { name: "Save program" }) as HTMLButtonElement; expect(save.disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox")); expect(save.disabled).toBe(false); fireEvent.click(save);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull()); fireEvent.click(await screen.findByRole("button", { name: "Flexible foundations · Revision 2" }));
    const revisions = await screen.findByRole("combobox", { name: "Saved revision" }); expect(within(revisions).getAllByRole("option")).toHaveLength(2);
    fireEvent.change(revisions, { target: { value: "1" } }); expect(screen.getByText(/piano-foundations · Revision 1/)).toBeTruthy();
  });
  it("retains JSON after quota failure, requires fresh review and allows retry", async () => {
    const { createStore, fake } = fixture(); render(<PracticeProgramLibrary createStore={createStore} />); fireEvent.click(screen.getByRole("button", { name: "Import Weekly Program" })); paste(); await preview();
    fake.commitError = "QuotaExceededError"; fireEvent.click(screen.getByRole("button", { name: "Save program" }));
    expect((await screen.findByRole("alert")).textContent).toContain("storage failed"); expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe(JSON.stringify(WEEKLY_PROGRAM_EXAMPLE)); expect(await createStore().list()).toEqual([]);
    await preview(); fireEvent.click(screen.getByRole("button", { name: "Save program" })); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });
  it("ignores stale review callbacks after cancellation/unmount", async () => {
    const { createStore } = fixture(); const store = createStore(); const parsed = validatePracticeProgram(WEEKLY_PROGRAM_EXAMPLE); if (!parsed.ok) throw Error("fixture");
    let resolve!: (value: Awaited<ReturnType<typeof store.review>>) => void;
    vi.spyOn(store, "review").mockImplementation(() => new Promise(done => { resolve = done; }));
    const onSaved = vi.fn(); const view = render(<PracticeProgramImportDialog store={store} onClose={vi.fn()} onSaved={onSaved} />); paste(); fireEvent.click(screen.getByRole("button", { name: "Validate and preview" })); view.unmount();
    await act(async () => resolve({ kind: "new", currentRevision: null, candidate: parsed.value })); expect(onSaved).not.toHaveBeenCalled(); expect(await createStore().list()).toEqual([]);
  });
  it("permits an explicitly requested transaction to finish after closing without a stale save callback", async () => {
    const { createStore, fake } = fixture(); const store = createStore(), onSaved = vi.fn(); const view = render(<PracticeProgramImportDialog store={store} onClose={vi.fn()} onSaved={onSaved} />);
    paste(); await preview(); const hold = fake.holdNextCommit(); fireEvent.click(screen.getByRole("button", { name: "Save program" })); await waitFor(() => expect(hold.ready()).toBe(true)); view.unmount();
    await act(async () => hold.release()); await waitFor(async () => expect(await createStore().list()).toHaveLength(1)); expect(onSaved).not.toHaveBeenCalled();
  });
  it("isolates Strict Mode store lifetimes and opens storage only on explicit user action", async () => {
    const { createStore, fake } = fixture(); const create = vi.fn(createStore); const view = render(<StrictMode><PracticeProgramLibrary createStore={create} /></StrictMode>);
    expect(create).toHaveBeenCalledTimes(2); expect(fake.openedNames).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: "Import Weekly Program" })); paste(); await preview(); fireEvent.click(screen.getByRole("button", { name: "Save program" })); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    view.unmount(); expect(await createStore().list()).toHaveLength(1);
  });
  it("reads file text and rejects oversized files before reading", async () => {
    const { createStore } = fixture(); render(<PracticeProgramImportDialog store={createStore()} onClose={vi.fn()} onSaved={vi.fn()} />);
    const file = new File(["{}"], "program.json", { type: "application/json" }); Object.defineProperty(file, "text", { value: async () => JSON.stringify(WEEKLY_PROGRAM_EXAMPLE) });
    fireEvent.change(screen.getByLabelText("Upload weekly program JSON"), { target: { files: [file] } }); await waitFor(() => expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toContain("piano-foundations")); await preview();
    const read = vi.fn(); const large = new File(["x".repeat(262145)], "large.json"); Object.defineProperty(large, "text", { value: read });
    fireEvent.change(screen.getByLabelText("Upload weekly program JSON"), { target: { files: [large] } }); expect((await screen.findByRole("alert")).textContent).toContain("256 KiB"); expect(read).not.toHaveBeenCalled();
  });
  it("copies the version-2 contract independently of legacy guidance", async () => {
    const writeText = vi.fn(async () => undefined); render(<WeeklyPracticeGuideDialog onClose={vi.fn()} writeText={writeText} version={2} />);
    expect(screen.getByRole("heading", { name: "Generate a weekly program with AI" })).toBeTruthy(); fireEvent.click(screen.getByRole("button", { name: "Copy for AI" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(createPracticeProgramLlmSpecification())); expect(screen.getByText(/using Import Weekly Program/)).toBeTruthy();
  });
});
