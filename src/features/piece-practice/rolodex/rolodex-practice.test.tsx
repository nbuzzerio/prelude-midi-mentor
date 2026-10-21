import type { ContinuousView } from "../continuous/continuous-session";
import { assessContinuous } from "../continuous/continuous-assessment";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppMidiContext, type AppMidiContextValue } from "@/components/midi/midi-context";
import { RolodexPractice } from "./rolodex-practice";
import { createEntry, editEntry } from "./rolodex-model";
import { testScore, TEST_INPUT } from "../continuous/continuous-test-fixtures";
import type { ContinuousAttempt, ContinuousPassage } from "../continuous/continuous-types";
import type { RolodexStore } from "./rolodex-types";
const capture = vi.hoisted(() => ({ passage: null as ContinuousPassage | null, view: null as ((view: ContinuousView) => void) | null, callback: null as ((a: ContinuousAttempt) => void) | null }));
vi.mock("../continuous/continuous-workspace", () => ({
  ContinuousPlayer: (props: { passage: ContinuousPassage; onAcknowledgedAttempt: (a: ContinuousAttempt) => void; onView: (view: ContinuousView) => void }) => {
    capture.passage = props.passage; capture.view = props.onView; capture.callback = props.onAcknowledgedAttempt;
    return <div>Native A1 boundary</div>;
  },
}));
afterEach(() => { cleanup(); capture.passage = null; capture.callback = null; });
const midi: AppMidiContextValue = { status: "connected", deviceName: TEST_INPUT.name, error: null, connectedInputs: [TEST_INPUT], connectMidi: async () => {}, registerConsumer: () => () => {} };
function setup() {
  const entry = createEntry(testScore(), "piano", 0, 1, 77);
  const store: RolodexStore = { list: async () => ({ entries: [entry], unavailableCount: 0 }), save: async e => ({ entry: e, duplicate: false }),
    remove: async () => {}, importEntries: async () => {}, acknowledge: vi.fn(async () => {}) };
  return { entry, store };
}
function terminal(id = "attempt-1"): ContinuousAttempt {
  return { version: 1, id, revision: 2, passage: capture.passage!, input: TEST_INPUT, status: "completed",
    startedAt: "2026-10-20T12:00:00.000Z", endedAt: "2026-10-20T12:01:00.000Z", performanceStartedAt: "2026-10-20T12:00:04.000Z",
    observedThroughMs: capture.passage!.durationMs + capture.passage!.tailMs, reason: null, attacks: [], assessment: assessContinuous(capture.passage!, []), terminalSaveAttempts: 1 };
}
describe("Rolodex A1 execution adapter", () => {
  it("uses manual Finish wording and focuses only an authorized entry", () => {
    const { entry, store } = setup();
    const focus = vi.fn(() => true), host = { active: true, finished: false, onView: vi.fn(), onAcknowledged: vi.fn(), onDates: vi.fn(), finishLabel: "Finish practice", entryFocusAllowed: focus };
    const view = render(<RolodexPractice entry={entry} store={store} onExit={vi.fn()} lessonHost={host} />);
    expect(screen.getByText("Finish practice")).toBeTruthy(); expect(document.activeElement).toBe(screen.getByRole("heading"));
    const finish = screen.getByText("Finish practice"); finish.focus();
    view.rerender(<RolodexPractice entry={entry} store={store} onExit={vi.fn()} lessonHost={{ ...host }} />);
    expect(document.activeElement).toBe(finish); expect(focus).toHaveBeenCalledOnce();
  });
  it("keeps failed date Retry mounted in a finished lesson and reports count-in-only outcomes", async () => {
    const { entry, store } = setup();
    store.acknowledge = vi.fn<RolodexStore["acknowledge"]>().mockRejectedValueOnce(Error("quota")).mockResolvedValue(undefined);
    const host = { active: true, finished: false, onView: vi.fn(), onAcknowledged: vi.fn(), onDates: vi.fn() };
    const tree = (finished: boolean) => <AppMidiContext.Provider value={midi}><RolodexPractice entry={entry} store={store} onExit={vi.fn()} lessonHost={{ ...host, finished }} /></AppMidiContext.Provider>;
    const view = render(tree(false));
    expect(screen.getByText("Native A1 boundary")).toBeTruthy(); // No repeated morning input setup.
    const { act } = await import("@testing-library/react");
    const attempt = terminal();
    await act(async () => capture.callback!(attempt));
    view.rerender(tree(true));
    expect(screen.queryByText("Native A1 boundary")).toBeNull();
    fireEvent.click(await screen.findByText("Retry Rolodex Update (1)"));
    await screen.findByText("Rolodex practice date and progress saved locally.");
    expect(host.onAcknowledged).toHaveBeenCalledExactlyOnceWith(attempt);
    expect(vi.mocked(store.acknowledge).mock.calls[0]).toEqual(vi.mocked(store.acknowledge).mock.calls[1]);
    view.rerender(tree(false));
    await act(async () => capture.callback!({ ...terminal("count-in-stop"), status: "stopped", performanceStartedAt: null }));
    expect(host.onAcknowledged).toHaveBeenLastCalledWith(expect.objectContaining({ id: "count-in-stop", status: "stopped" }));
    expect(store.acknowledge).toHaveBeenCalledTimes(2);
  });
  it("preserves a pending pre-attempt acceptance read without retroactively enabling a run", async () => {
    const { entry, store } = setup();
    let resolve!: (listing: Awaited<ReturnType<RolodexStore["list"]>>) => void;
    store.list = () => new Promise(done => { resolve = done; });
    render(<AppMidiContext.Provider value={midi}><RolodexPractice entry={entry} store={store} onExit={vi.fn()} /></AppMidiContext.Provider>);
    fireEvent.click(screen.getByText("Prepare Saved Passage"));
    const attempt = terminal(), { act } = await import("@testing-library/react");
    await act(async () => capture.view!({ phase: "starting", elapsedMs: 0, pulse: 0, attempt: { ...attempt, status: "started", endedAt: null, assessment: null }, save: "pending", error: null }));
    await act(async () => capture.callback!(attempt)); expect(store.acknowledge).not.toHaveBeenCalled();
    const gate = { version: 1 as const, generation: "simulated-test-only", enabled: true, acceptedAt: "2026-10-19T12:00:00.000Z", inputId: TEST_INPUT.id, policy: entry.policy };
    await act(async () => resolve({ entries: [entry], unavailableCount: 0, acceptance: gate }));
    await waitFor(() => expect(store.acknowledge).toHaveBeenCalledWith(entry.id, expect.objectContaining({ summary: expect.objectContaining({ acceptance: gate }) })));
  });
  it("passes frozen music, range, BPM and exact policy without current-library lookup", () => {
    const { entry, store } = setup();
    render(<AppMidiContext.Provider value={midi}><RolodexPractice entry={entry} store={store} onExit={vi.fn()} /></AppMidiContext.Provider>);
    fireEvent.click(screen.getByText("Prepare Saved Passage"));
    expect(capture.passage).toMatchObject({ score: entry.score, start: 0, end: 1, bpm: 77, policy: entry.policy });
    expect(store.acknowledge).not.toHaveBeenCalled();
  });
  it("does not replace a running lesson target with concurrently edited progress settings", async () => {
    const { entry, store } = setup(), onProgress = vi.fn();
    store.acknowledge = vi.fn(async () => editEntry(entry, { bpm: 80 }));
    const host = { active: true, finished: false, onView: vi.fn(), onAcknowledged: vi.fn(), onDates: vi.fn(), onProgress };
    render(<AppMidiContext.Provider value={midi}><RolodexPractice entry={entry} store={store} onExit={vi.fn()} lessonHost={host} /></AppMidiContext.Provider>);
    const { act } = await import("@testing-library/react"); await act(async () => capture.callback!(terminal()));
    await screen.findByText("Rolodex practice date and progress saved locally.");
    expect(onProgress).not.toHaveBeenCalled(); expect(capture.passage!.bpm).toBe(77);
  });
  it("requires physical MIDI before mounting the native player", () => {
    const { entry, store } = setup();
    render(<RolodexPractice entry={entry} store={store} onExit={vi.fn()} />);
    expect((screen.getByText("Prepare Saved Passage") as HTMLButtonElement).disabled).toBe(true);
    expect(capture.passage).toBeNull();
  });
  it("keeps A1 acknowledgement separate and retries the same practice link without a new performance", async () => {
    const { entry, store } = setup();
    const acknowledge = vi.fn<RolodexStore["acknowledge"]>().mockRejectedValueOnce(Error("quota")).mockResolvedValue(undefined);
    store.acknowledge = acknowledge;
    render(<AppMidiContext.Provider value={midi}><RolodexPractice entry={entry} store={store} onExit={vi.fn()} /></AppMidiContext.Provider>);
    fireEvent.click(screen.getByText("Prepare Saved Passage"));
    const attempt = terminal();
    const { act } = await import("@testing-library/react");
    await act(async () => { capture.callback!(attempt); capture.callback!(attempt); });
    await waitFor(() => expect(acknowledge).toHaveBeenCalledTimes(1));
    expect(screen.getByText(/A1 performance is saved/)).toBeTruthy();
    fireEvent.click(await screen.findByText("Retry Rolodex Update (1)"));
    await screen.findByText("Rolodex practice date and progress saved locally.");
    expect(acknowledge.mock.calls[0]).toEqual(acknowledge.mock.calls[1]);
    await act(async () => capture.callback!(terminal("replay-2")));
    await waitFor(() => expect(acknowledge).toHaveBeenCalledTimes(3));
    expect(acknowledge.mock.calls[2]![1].attemptId).toBe("replay-2");
  });
  it("does not call interrupted evidence completed or count a count-in-only stop as practice", async () => {
    const { entry, store } = setup();
    render(<AppMidiContext.Provider value={midi}><RolodexPractice entry={entry} store={store} onExit={vi.fn()} /></AppMidiContext.Provider>);
    fireEvent.click(screen.getByText("Prepare Saved Passage"));
    const { act } = await import("@testing-library/react");
    await act(async () => capture.callback!({ ...terminal(), status: "stopped", performanceStartedAt: null }));
    expect(store.acknowledge).not.toHaveBeenCalled();
    await act(async () => capture.callback!({ ...terminal("interrupted"), status: "interrupted" }));
    await waitFor(() => expect(store.acknowledge).toHaveBeenCalledWith(entry.id, expect.objectContaining({ outcome: "interrupted" })));
  });
});
