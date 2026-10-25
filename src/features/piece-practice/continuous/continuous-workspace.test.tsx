import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppMidiContext, type AppMidiConsumer, type AppMidiContextValue } from "@/components/midi/midi-context";
import { ContinuousPlayer, ContinuousWorkspace } from "./continuous-workspace";
import { ContinuousSession } from "./continuous-session";
import { projectContinuousPassage } from "./continuous-projection";
import { raw, TEST_INPUT, testScore } from "./continuous-test-fixtures";
import { MidiProvider } from "@/components/midi/midi-provider";
import type { ContinuousAttempt } from "./continuous-types";
import { assessContinuous } from "./continuous-assessment";

vi.mock("./continuous-score", () => ({
  ContinuousScore: ({ measureIndex }: { measureIndex: number }) => <div data-testid="authored-score">Authored measure {measureIndex + 1}</div>,
}));
afterEach(() => { cleanup(); localStorage.clear(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); Reflect.deleteProperty(navigator, "requestMIDIAccess"); });
function context() {
  let consumer: AppMidiConsumer | undefined;
  const value: AppMidiContextValue = { status: "connected", deviceName: TEST_INPUT.name, error: null, connectedInputs: [TEST_INPUT], connectMidi: vi.fn(async () => {}),
    registerConsumer: vi.fn((c) => { consumer = c; c.onOwnershipChange?.(true); return () => { consumer = undefined; c.onOwnershipChange?.(false); }; }) };
  return { value, consumer: () => consumer };
}
describe("continuous workspace and native ownership boundary", () => {
  it("selects exact 16-bar ranges, never truncates a start change and keeps longer music out of Rolodex", () => {
    const c = context(); render(<AppMidiContext.Provider value={c.value}><ContinuousWorkspace score={testScore("4/4", 20)} store={{ save: vi.fn(), list: async () => [] }} onExit={vi.fn()} onPitchFirst={vi.fn()} /></AppMidiContext.Provider>);
    fireEvent.click(screen.getByText("16 measures"));
    expect((screen.getByLabelText("End measure (inclusive)") as HTMLSelectElement).value).toBe("15");
    expect((screen.getByText("Save to Practice Rolodex") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/currently support 1–4/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Start measure"), { target: { value: "17" } });
    expect((screen.getByLabelText("End measure (inclusive)") as HTMLSelectElement).value).toBe("15");
    expect(screen.getByRole("alert").textContent).toContain("not been shortened");
    expect((screen.getByText("Prepare Range") as HTMLButtonElement).disabled).toBe(true);
  });
  it("loads eight history summaries and a single validated detail on demand, without list or eager result rendering", async () => {
    const passage = projectContinuousPassage(testScore("4/4", 16), 0, 15, 60);
    const r: ContinuousAttempt = { version: 1, id: "saved-16", revision: 1, passage, input: TEST_INPUT, status: "completed",
      startedAt: "2026-10-24T00:00:00.000Z", endedAt: "2026-10-24T00:00:00.000Z", performanceStartedAt: "2026-10-24T00:00:00.000Z",
      observedThroughMs: passage.durationMs + passage.tailMs, reason: null, attacks: [], assessment: assessContinuous(passage, []), terminalSaveAttempts: 1 };
    const cursor = { startedAt: r.startedAt, id: "old-7" };
    const store = { save: vi.fn(), list: vi.fn(async () => []), get: vi.fn(async () => r), historyPage: vi.fn(async () => ({
      entries: Array.from({ length: 8 }, (_, i) => ({ id: i ? `old-${i}` : r.id, startedAt: r.startedAt, start: 0, end: 15, bpm: 60, status: "completed", unavailable: false })), next: cursor })) };
    render(<ContinuousWorkspace score={passage.score} store={store} onExit={vi.fn()} onPitchFirst={vi.fn()} />);
    expect(store.historyPage).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByText("Load Saved Attempts")));
    expect(screen.getAllByText("Review Saved Attempt")).toHaveLength(8);
    expect(screen.queryByLabelText("Continuous results")).toBeNull(); expect(store.list).not.toHaveBeenCalled(); expect(store.get).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getAllByText("Review Saved Attempt")[0]!));
    expect(store.get).toHaveBeenCalledExactlyOnceWith(r.id); expect(screen.getAllByLabelText("Continuous results")).toHaveLength(1);
    expect(screen.getByText("No MIDI note attacks were captured during this performance.")).toBeTruthy();
    expect(screen.queryByText(/Raw retained attack evidence/)).toBeNull();
    await act(async () => fireEvent.click(screen.getByText("Older Attempts")));
    expect(store.historyPage).toHaveBeenLastCalledWith(passage.score.id, cursor); expect(screen.queryByLabelText("Continuous results")).toBeNull();
    store.get.mockRejectedValueOnce(Error("corrupt"));
    await act(async () => fireEvent.click(screen.getAllByText("Review Saved Attempt")[0]!));
    expect(screen.getByRole("alert").textContent).toContain("preserved");
  });
  it("disables preparation against the current input list while preserving the unavailable explicit preference", () => {
    const c = context(), score = testScore(), save = vi.fn(async () => {});
    const tree = (connected: boolean) => <AppMidiContext.Provider value={{ ...c.value, connectedInputs: connected ? [TEST_INPUT] : [{ id: "silent", name: "Silent port" }] }}><ContinuousWorkspace score={score} store={{ save, list: async () => [] }} onExit={vi.fn()} onPitchFirst={vi.fn()} /></AppMidiContext.Provider>;
    const v = render(tree(true)); fireEvent.change(screen.getByLabelText("Physical MIDI Input"), { target: { value: TEST_INPUT.id } });
    expect((screen.getByText("Prepare Range") as HTMLButtonElement).disabled).toBe(false);
    v.rerender(tree(false)); expect((screen.getByText("Prepare Range") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("alert").textContent).toContain("No other port has been substituted"); expect(save).not.toHaveBeenCalled();
  });
  it("distinguishes available from verified and clears verification on foreground or ownership loss", () => {
    const c = context(), p = projectContinuousPassage(testScore(), 0, 1, 60), store = { save: vi.fn(async () => {}), list: async () => [] };
    const session = new ContinuousSession(p, TEST_INPUT, store);
    const tree = (active: boolean) => <AppMidiContext.Provider value={c.value}><ContinuousPlayer passage={p} input={TEST_INPUT} store={store} createSession={() => session} onExit={vi.fn()} lessonHost={{ active, onView: vi.fn() }} /></AppMidiContext.Provider>;
    const v = render(tree(true)); const start = () => screen.getByText("Ready — Begin Count-in") as HTMLButtonElement;
    expect(start().disabled).toBe(true); expect(screen.getByText(/Input available — play a note/)).toBeTruthy();
    act(() => c.consumer()?.onRawMessage?.(raw())); expect(start().disabled).toBe(false); expect(screen.getByText("MIDI received: C4")).toBeTruthy();
    act(() => c.consumer()?.onOwnershipChange?.(false)); expect(start().disabled).toBe(true); expect(session.snapshot().midiNote).toBeNull();
    v.rerender(tree(false)); expect(c.consumer()).toBeUndefined(); v.rerender(tree(true));
    act(() => c.consumer()?.onRawMessage?.(raw())); expect(start().disabled).toBe(false); expect(store.save).not.toHaveBeenCalled();
    v.unmount(); expect(session.snapshot().midiNote).toBeNull(); expect(c.consumer()).toBeUndefined();
  });
  it("does not silently accept a different device with the same browser ID", () => {
    const c = context(), p = projectContinuousPassage(testScore(), 0, 1, 60), store = { save: vi.fn(async () => {}), list: async () => [] };
    const session = new ContinuousSession(p, TEST_INPUT, store);
    const tree = (name: string) => <AppMidiContext.Provider value={{ ...c.value, connectedInputs: [{ ...TEST_INPUT, name }] }}><ContinuousPlayer passage={p} input={TEST_INPUT} store={store} createSession={() => session} onExit={vi.fn()} /></AppMidiContext.Provider>;
    const v = render(tree(TEST_INPUT.name)); act(() => c.consumer()?.onRawMessage?.(raw()));
    v.rerender(tree("Other device")); expect(session.snapshot().midiNote).toBeNull(); expect(screen.getByRole("alert").textContent).toContain("Reconnect");
  });
  it("routes only the deliberately chosen second port through real MIDI transport and keeps ordinary Replay verified", async () => {
    vi.useFakeTimers();
    const port = (id: string, name: string) => Object.assign(new EventTarget(), { id, name, state: "connected" });
    const a = port("silent", "Midi Through Port-0"), b = port("piano", "CH345 MIDI 1");
    const access = Object.assign(new EventTarget(), { inputs: new Map([[a.id, a], [b.id, b]]) });
    Object.defineProperty(navigator, "requestMIDIAccess", { configurable: true, value: vi.fn(async () => access) });
    const audio = { currentTime: 0, state: "running", destination: {}, resume: async () => {}, close: vi.fn(async () => {}),
      createOscillator: () => ({ frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {}, start() {}, stop() {} }),
      createGain: () => ({ gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} }) };
    vi.stubGlobal("AudioContext", class { constructor() { return audio; } });
    vi.spyOn(performance, "now").mockImplementation(() => audio.currentTime * 1000);
    const emit = (input: typeof a, bytes: number[]) => { const e = new Event("midimessage"); Object.defineProperties(e, { data: { value: Uint8Array.from(bytes) }, timeStamp: { value: performance.now() } }); input.dispatchEvent(e); };
    const records = new Map<string, ContinuousAttempt>(), save = vi.fn(async (r: ContinuousAttempt) => { records.set(r.id, r); });
    const attachA = vi.spyOn(a, "addEventListener"), attachB = vi.spyOn(b, "addEventListener");
    render(<MidiProvider><ContinuousWorkspace score={testScore()} store={{ save, list: async () => [...records.values()] }} onExit={vi.fn()} onPitchFirst={vi.fn()} /></MidiProvider>);
    await act(async () => fireEvent.click(screen.getByText("Connect MIDI")));
    expect((screen.getByText("Prepare Range") as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Physical MIDI Input"), { target: { value: "silent" } }); fireEvent.click(screen.getByText("Prepare Range"));
    act(() => emit(b, [0x90, 60, 90])); expect((screen.getByText("Ready — Begin Count-in") as HTMLButtonElement).disabled).toBe(true); expect(save).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("Exit Continuous Practice"));
    fireEvent.change(screen.getByLabelText("Physical MIDI Input"), { target: { value: "piano" } }); fireEvent.click(screen.getByText("Prepare Range"));
    act(() => emit(b, [0x9f, 60, 90])); expect(save).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByText("Ready — Begin Count-in")));
    act(() => { emit(b, [0x90, 60, 90]); audio.currentTime = 4.1; vi.advanceTimersByTime(40);
      emit(a, [0x90, 99, 90]); emit(b, [0x9f, 60, 90]); emit(b, [0x90, 60, 0]); emit(b, [0x80, 60, 20]); emit(b, [0xbf, 64, 127]);
      audio.currentTime = 8.1; vi.advanceTimersByTime(40); emit(b, [0x91, 62, 90]); });
    await act(async () => { audio.currentTime = 13; vi.advanceTimersByTime(40); });
    const first = [...records.values()][0]!;
    expect(first.input).toEqual({ id: "piano", name: "CH345 MIDI 1" }); expect(first.attacks).toHaveLength(2); expect(first.assessment?.matched).toBe(2);
    fireEvent.click(screen.getByText("Replay Same Range")); expect((screen.getByText("Ready — Begin Count-in") as HTMLButtonElement).disabled).toBe(false);
    await act(async () => fireEvent.click(screen.getByText("Ready — Begin Count-in")));
    await act(async () => { b.state = "disconnected"; access.dispatchEvent(new Event("statechange")); });
    expect([...records.values()][1]!.status).toBe("interrupted");
    await act(async () => { const replacement = port("new-piano", "CH345 MIDI 1"); access.inputs.set(replacement.id, replacement); access.dispatchEvent(new Event("statechange")); });
    expect((screen.getByText("Replay Same Range") as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { b.state = "connected"; access.dispatchEvent(new Event("statechange")); });
    fireEvent.click(screen.getByText("Replay Same Range")); expect((screen.getByText("Ready — Begin Count-in") as HTMLButtonElement).disabled).toBe(true);
    expect(attachA).toHaveBeenCalledTimes(1); expect(attachB).toHaveBeenCalledTimes(2);
    act(() => emit(b, [0x90, 60, 90])); expect((screen.getByText("Ready — Begin Count-in") as HTMLButtonElement).disabled).toBe(false);
    const sameIdentityReplacement = port("piano", "CH345 MIDI 1");
    act(() => { access.inputs.set("piano", sameIdentityReplacement); access.dispatchEvent(new Event("statechange")); });
    expect((screen.getByText("Ready — Begin Count-in") as HTMLButtonElement).disabled).toBe(true);
    act(() => emit(sameIdentityReplacement, [0x90, 60, 90]));
    expect((screen.getByText("Ready — Begin Count-in") as HTMLButtonElement).disabled).toBe(false);
  });
  it("uses the manual host Finish label without changing Ready, audio or save ownership", () => {
    const c = context(), passage = projectContinuousPassage(testScore(), 0, 1, 60);
    const store = { save: vi.fn(async () => {}), list: async () => [] }, audio = vi.fn(() => { throw Error("not in Ready"); });
    const session = new ContinuousSession(passage, TEST_INPUT, store, audio), exit = vi.fn();
    render(<AppMidiContext.Provider value={c.value}><ContinuousPlayer passage={passage} input={TEST_INPUT} store={store} createSession={() => session} onExit={exit} lessonHost={{ active: true, onView: vi.fn(), finishLabel: "Finish practice" }} /></AppMidiContext.Provider>);
    expect(screen.getByText("Ready — Begin Count-in")).toBeTruthy(); expect(screen.queryByText("Finish Lesson")).toBeNull();
    fireEvent.click(screen.getByText("Finish practice")); expect(exit).toHaveBeenCalledOnce(); expect(audio).not.toHaveBeenCalled(); expect(store.save).not.toHaveBeenCalled();
  });
  it("hosted terminal failure blocks Finish and departure until Retry saves the same identity", async () => {
    const c = context(), p = projectContinuousPassage(testScore(), 0, 1, 60);
    const store = { save: vi.fn().mockRejectedValueOnce(Error("quota")).mockResolvedValue(undefined), list: async () => [] };
    const session = new ContinuousSession(p, TEST_INPUT, store, () => { throw Error("audio denied"); });
    const onExit = vi.fn(), onAcknowledgedAttempt = vi.fn(), onView = vi.fn();
    let guard: (() => boolean) | null = null;
    const tree = (active: boolean) => <AppMidiContext.Provider value={c.value}><ContinuousPlayer passage={p} input={TEST_INPUT} store={store} onExit={onExit} createSession={() => session} onAcknowledgedAttempt={onAcknowledgedAttempt} onGuardChange={value => { guard = value; }} lessonHost={{ active, onView }} /></AppMidiContext.Provider>;
    const view = render(tree(true));
    act(() => c.consumer()?.onRawMessage?.(raw()));
    await act(async () => fireEvent.click(screen.getByText("Ready — Begin Count-in")));
    expect(screen.getByText("Result not saved")).toBeTruthy();
    expect((screen.getByText("Finish Lesson") as HTMLButtonElement).disabled).toBe(true);
    expect(guard!()).toBe(false); expect(onAcknowledgedAttempt).not.toHaveBeenCalled();
    const id = session.snapshot().attempt!.id;
    await act(async () => fireEvent.click(screen.getByText("Retry Save")));
    expect(session.snapshot().attempt!.id).toBe(id); expect(onAcknowledgedAttempt).toHaveBeenCalledWith(expect.objectContaining({ id, status: "failed" }));
    expect(guard!()).toBe(true);
    view.rerender(tree(false)); expect(c.consumer()).toBeUndefined();
    view.rerender(tree(true)); expect(c.consumer()).toBeDefined();
    fireEvent.click(screen.getByText("Finish Lesson")); expect(onExit).toHaveBeenCalledOnce();
  });
  it("allows manual Rolodex saving without a physical MIDI connection or attempt", () => {
    const save = vi.fn(async () => {});
    render(<ContinuousWorkspace score={testScore()} onExit={vi.fn()} onPitchFirst={vi.fn()} store={{ save, list: async () => [] }} />);
    fireEvent.click(screen.getByText("Save to Practice Rolodex"));
    expect(screen.getByLabelText("First measure")).toBeTruthy();
    expect((screen.getByLabelText("Source instrument") as HTMLSelectElement).value).toBe("piano");
    expect(save).not.toHaveBeenCalled();
  });
  it("offers a bounded range, tempo, physical input and explicit untimed preparation", () => {
    const c = context(); const save = vi.fn(async () => {});
    render(<AppMidiContext.Provider value={c.value}><ContinuousWorkspace score={testScore("4/4", 6)} onExit={vi.fn()} onPitchFirst={vi.fn()} store={{ save, list: async () => [] }} /></AppMidiContext.Provider>);
    expect(screen.getByLabelText("End measure (inclusive)").querySelectorAll("option")).toHaveLength(6);
    fireEvent.change(screen.getByLabelText("Physical MIDI Input"), { target: { value: TEST_INPUT.id } });
    fireEvent.click(screen.getByText("Prepare Range"));
    expect(screen.getByText("Ready — Begin Count-in")).toBeTruthy();
    expect(screen.getAllByTestId("authored-score")).toHaveLength(2);
    act(() => c.consumer()?.onRawMessage?.(raw()));
    expect(save).not.toHaveBeenCalled();
  });
  it("does not offer a scored start without physical MIDI", () => {
    const c = context();
    render(<AppMidiContext.Provider value={{ ...c.value, status: "disconnected", connectedInputs: [] }}><ContinuousWorkspace score={testScore()} onExit={vi.fn()} onPitchFirst={vi.fn()} /></AppMidiContext.Provider>);
    expect((screen.getByText("Prepare Range") as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Microphone, simulation and virtual keys/)).toBeTruthy();
  });
  it("reports an ineligible range before attempting persistence or audio", () => {
    const c = context(); const save = vi.fn(async () => {});
    render(<AppMidiContext.Provider value={c.value}><ContinuousWorkspace score={testScore("2/4")} onExit={vi.fn()} onPitchFirst={vi.fn()} store={{ save, list: async () => [] }} /></AppMidiContext.Provider>);
    fireEvent.change(screen.getByLabelText("Physical MIDI Input"), { target: { value: TEST_INPUT.id } });
    fireEvent.click(screen.getByText("Prepare Range"));
    expect(screen.getByRole("alert").textContent).toContain("3/4, 4/4 and 6/8");
    expect(save).not.toHaveBeenCalled();
  });
  it("survives Strict Mode effect replay without audio creation and unregisters on exit", () => {
    const c = context(); const audio = vi.fn(() => { throw Error("must not allocate in Ready"); });
    const p = projectContinuousPassage(testScore(), 0, 1, 60);
    const store = { save: vi.fn(async () => {}), list: async () => [] };
    const session = new ContinuousSession(p, TEST_INPUT, store, audio);
    const mounted = render(<StrictMode><AppMidiContext.Provider value={c.value}><ContinuousPlayer passage={p} input={TEST_INPUT} store={store} onExit={vi.fn()} createSession={() => session} /></AppMidiContext.Provider></StrictMode>);
    expect(audio).not.toHaveBeenCalled(); expect(store.save).not.toHaveBeenCalled();
    expect(c.consumer()).toBeDefined(); mounted.unmount(); expect(c.consumer()).toBeUndefined();
  });
  it("background, disconnect and departure stop an active owner and await its terminal acknowledgement", async () => {
    const c = context(); const p = projectContinuousPassage(testScore(), 0, 1, 60);
    const audio = { currentTime: 0, state: "running" as AudioContextState, destination: {},
      resume: async () => {}, close: vi.fn(async () => {}),
      createOscillator: () => ({ type: "sine" as OscillatorType, frequency: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {}, disconnect: () => {}, start: () => {}, stop: () => {} }),
      createGain: () => ({ gain: { setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} }, connect: () => {}, disconnect: () => {} }) };
    const store = { save: vi.fn(async () => {}), list: async () => [] };
    const session = new ContinuousSession(p, TEST_INPUT, store, () => audio);
    render(<AppMidiContext.Provider value={c.value}><ContinuousPlayer passage={p} input={TEST_INPUT} store={store} onExit={vi.fn()} createSession={() => session} /></AppMidiContext.Provider>);
    act(() => c.consumer()?.onRawMessage?.(raw()));
    await act(async () => { fireEvent.click(screen.getByText("Ready — Begin Count-in")); });
    expect(screen.getByText(/Count-in ·/)).toBeTruthy();
    await act(async () => { c.consumer()?.onInputConnectionChange?.({ provenance: "input-availability", input: TEST_INPUT, state: "disconnected", receivedAtMs: 1 }); });
    expect(screen.getByText("Attempt interrupted")).toBeTruthy();
    expect(screen.getByText("Result saved locally")).toBeTruthy();
    expect(audio.close).toHaveBeenCalledTimes(1);
  });
});
