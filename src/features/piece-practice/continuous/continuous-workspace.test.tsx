import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppMidiContext, type AppMidiConsumer, type AppMidiContextValue } from "@/components/midi/midi-context";
import { ContinuousPlayer, ContinuousWorkspace } from "./continuous-workspace";
import { ContinuousSession } from "./continuous-session";
import { projectContinuousPassage } from "./continuous-projection";
import { raw, TEST_INPUT, testScore } from "./continuous-test-fixtures";

vi.mock("./continuous-score", () => ({
  ContinuousScore: ({ measureIndex }: { measureIndex: number }) => <div data-testid="authored-score">Authored measure {measureIndex + 1}</div>,
}));
afterEach(() => cleanup());
function context() {
  let consumer: AppMidiConsumer | undefined;
  const value: AppMidiContextValue = { status: "connected", deviceName: TEST_INPUT.name, error: null, connectedInputs: [TEST_INPUT], connectMidi: vi.fn(async () => {}),
    registerConsumer: vi.fn((c) => { consumer = c; c.onOwnershipChange?.(true); return () => { consumer = undefined; c.onOwnershipChange?.(false); }; }) };
  return { value, consumer: () => consumer };
}
describe("continuous workspace and native ownership boundary", () => {
  it("offers a bounded range, tempo, physical input and explicit untimed preparation", () => {
    const c = context(); const save = vi.fn(async () => {});
    render(<AppMidiContext.Provider value={c.value}><ContinuousWorkspace score={testScore("4/4", 6)} onExit={vi.fn()} onPitchFirst={vi.fn()} store={{ save, list: async () => [] }} /></AppMidiContext.Provider>);
    expect(screen.getByLabelText("End measure (inclusive)").querySelectorAll("option")).toHaveLength(4);
    fireEvent.click(screen.getByText("Prepare Range"));
    expect(screen.getByText("Ready — Begin Count-in")).toBeTruthy();
    expect(screen.getAllByTestId("authored-score")).toHaveLength(2);
    c.consumer()?.onRawMessage?.(raw());
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
    await act(async () => { fireEvent.click(screen.getByText("Ready — Begin Count-in")); });
    expect(screen.getByText(/Count-in ·/)).toBeTruthy();
    await act(async () => { c.consumer()?.onInputConnectionChange?.({ provenance: "input-availability", input: TEST_INPUT, state: "disconnected", receivedAtMs: 1 }); });
    expect(screen.getByText("Attempt interrupted")).toBeTruthy();
    expect(screen.getByText("Result saved locally")).toBeTruthy();
    expect(audio.close).toHaveBeenCalledTimes(1);
  });
});
