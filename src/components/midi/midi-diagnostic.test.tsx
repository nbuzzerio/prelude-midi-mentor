import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MidiDiagnostic from "./midi-diagnostic";

type MessageListener = (event: MIDIMessageEvent) => void;

function midiInput(id: string, name: string) {
  const listeners = new Set<MessageListener>();
  let state: MIDIPortDeviceState = "connected";
  const input = {
    id, name,
    get state() { return state; },
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => { if (type === "midimessage") listeners.add(listener as MessageListener); }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => { if (type === "midimessage") listeners.delete(listener as MessageListener); }),
  } as unknown as MIDIInput;
  return {
    input,
    listeners,
    disconnect: () => { state = "disconnected"; },
    emit: (data: number[], timeStamp: number) => { for (const listener of listeners) listener({ data: Uint8Array.from(data), timeStamp } as MIDIMessageEvent); },
  };
}

function midiAccess(initial: Array<ReturnType<typeof midiInput>>) {
  const inputs = new Map(initial.map((item) => [item.input.id, item.input]));
  let stateListener: EventListener | null = null;
  const access = {
    inputs,
    addEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => { if (type === "statechange") stateListener = listener as EventListener; }),
    removeEventListener: vi.fn((type: string, listener: EventListenerOrEventListenerObject) => { if (type === "statechange" && stateListener === listener) stateListener = null; }),
  } as unknown as MIDIAccess;
  return { access, inputs, stateChange: () => stateListener?.(new Event("statechange")) };
}

function install(access: MIDIAccess | Promise<never>) {
  const request = vi.fn(() => access instanceof Promise ? access : Promise.resolve(access));
  Object.defineProperty(navigator, "requestMIDIAccess", { configurable: true, value: request });
  return request;
}

afterEach(() => { cleanup(); Reflect.deleteProperty(navigator, "requestMIDIAccess"); vi.restoreAllMocks(); });

describe("MIDI Diagnostic", () => {
  it("reports unsupported and rejected access without requesting SysEx", async () => {
    render(<MidiDiagnostic />);
    fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" }));
    expect(await screen.findByText("This browser does not support the Web MIDI API.")).toBeTruthy();
    cleanup();
    const request = install(Promise.reject(new Error("Permission denied")));
    render(<MidiDiagnostic />);
    fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" }));
    expect(await screen.findByText("Permission denied")).toBeTruthy();
    expect(request).toHaveBeenCalledWith();
  });

  it("captures one ordered row per event with source identity and no event live region", async () => {
    const first = midiInput("one", "Yamaha Keys"); const second = midiInput("two", "Pedals");
    install(midiAccess([first, second]).access);
    render(<MidiDiagnostic />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
    expect(screen.getByText("Yamaha Keys")).toBeTruthy(); expect(screen.getByText("Pedals")).toBeTruthy();
    act(() => { first.emit([0x90, 60, 35], 100); second.emit([0xb0, 64, 47], 161.432); });
    fireEvent.click(screen.getByRole("button", { name: "Raw MIDI / All Messages" }));
    const history = screen.getByLabelText("Captured MIDI event history");
    expect(within(history).getAllByRole("row")).toHaveLength(3);
    expect(within(history).getByText("+61.432 ms")).toBeTruthy();
    expect(within(history).getByText("controller=64;value=47")).toBeTruthy();
    expect(history.getAttribute("aria-live")).toBeNull();
    expect(first.listeners.size).toBe(1); expect(second.listeners.size).toBe(1);
  });

  it("pauses without disconnecting, resumes the same origin, and Clear resets origin and sequence", async () => {
    const keys = midiInput("one", "Keys"); install(midiAccess([keys]).access); render(<MidiDiagnostic />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
    fireEvent.click(screen.getByRole("button", { name: "Raw MIDI / All Messages" }));
    act(() => keys.emit([0x90, 60, 1], 10));
    fireEvent.click(screen.getByRole("button", { name: "Pause Capture" }));
    act(() => keys.emit([0x90, 61, 2], 20));
    expect(screen.getByText(/1 retained · 1 total/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Resume Capture" }));
    act(() => keys.emit([0x90, 62, 3], 30));
    expect(screen.getByText("+20.000 ms")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    act(() => keys.emit([0x90, 63, 4], 100));
    expect(screen.getByText("+0.000 ms")).toBeTruthy();
    expect(within(screen.getByLabelText("Captured MIDI event history")).getAllByRole("row")[1]?.textContent).toContain("1");
  });

  it("handles hotplug and disconnect without duplicate listeners and cleans up on unmount", async () => {
    const first = midiInput("one", "First"); const second = midiInput("two", "Second"); const ports = midiAccess([first]); install(ports.access);
    const view = render(<MidiDiagnostic />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "First" })); fireEvent.click(screen.getByRole("button", { name: "First" })); });
    expect(first.listeners.size).toBe(1);
    ports.inputs.set("two", second.input); act(() => { ports.stateChange(); ports.stateChange(); });
    expect(second.listeners.size).toBe(1); expect(second.input.addEventListener).toHaveBeenCalledTimes(1);
    first.disconnect(); act(() => ports.stateChange());
    expect(first.listeners.size).toBe(0); expect(first.input.removeEventListener).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(second.listeners.size).toBe(0); expect(ports.access.removeEventListener).toHaveBeenCalledWith("statechange", expect.any(Function));
  });

  it("copies exact capture text and preserves it through failure and retry", async () => {
    const keys = midiInput("one", "Keys"); install(midiAccess([keys]).access);
    const writeText = vi.fn().mockRejectedValueOnce(new Error("denied")).mockResolvedValueOnce(undefined);
    render(<MidiDiagnostic writeText={writeText} />);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
    act(() => keys.emit([0x80, 60, 27], 50));
    fireEvent.click(screen.getByRole("button", { name: "Copy Capture" }));
    const fallback = await screen.findByRole("textbox", { name: "MIDI diagnostic capture" }) as HTMLTextAreaElement;
    expect(fallback.value).toContain("Prelude version: 2.8.5");
    expect(fallback.value).toContain("3\tNote Release\t1\tnote=60;name=C4;releaseVelocity=27;encoding=note-off\t80 3C 1B");
    expect(document.activeElement).toBe(fallback); expect(screen.getByText(/1 retained · 1 total/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy Capture" }));
    await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Capture copied."));
    expect(writeText).toHaveBeenCalledTimes(2); expect(writeText.mock.calls[0]?.[0]).toBe(writeText.mock.calls[1]?.[0]);
  });
});


it("defaults to musical instances and preserves F8/FE in Raw MIDI and Copy Capture", async () => {
  const keys = midiInput("one", "Yamaha Keys"); install(midiAccess([keys]).access);
  const writeText = vi.fn().mockResolvedValue(undefined);
  render(<MidiDiagnostic writeText={writeText} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
  act(() => {
    keys.emit([0xf8], 100); keys.emit([0xfe], 101);
    keys.emit([0x90, 60, 72], 731.1); keys.emit([0xb0, 64, 127], 900);
    keys.emit([0x90, 60, 0], 4251.2); keys.emit([0xb0, 64, 0], 4300);
  });
  expect(screen.getByRole("button", { name: "Musical Events" }).getAttribute("aria-pressed")).toBe("true");
  const musical = screen.getByLabelText("Musical MIDI event history");
  expect(within(musical).getAllByRole("row")).toHaveLength(4);
  expect(within(musical).getByText("C4")).toBeTruthy();
  expect(within(musical).getByText("0.631s")).toBeTruthy();
  expect(within(musical).getByText("3.520s")).toBeTruthy();
  expect(within(musical).getByText("Sustain Down — CC64 127")).toBeTruthy();
  expect(within(musical).queryByText("Timing Clock")).toBeNull();
  expect(musical.getAttribute("aria-live")).toBeNull();
  fireEvent.click(within(musical).getByText("Note details — raw #3"));
  expect(within(musical).getByText(/Release velocity: 0; encoding: note-on-zero/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Copy Capture" }));
  await screen.findByText("Capture copied.");
  const rawBefore = writeText.mock.calls[0]![0];
  expect(rawBefore).toContain("Timing Clock"); expect(rawBefore).toContain("Active Sensing");
  fireEvent.click(screen.getByRole("button", { name: "Raw MIDI / All Messages" }));
  const raw = screen.getByLabelText("Captured MIDI event history");
  expect(within(raw).getAllByRole("row")).toHaveLength(7);
  expect(within(raw).getByText("F8")).toBeTruthy(); expect(within(raw).getByText("FE")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Musical Events" }));
  fireEvent.click(screen.getByRole("button", { name: "Copy Capture" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledTimes(2));
  expect(writeText.mock.calls[1]![0]).toBe(rawBefore);
  fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
  await screen.findByText("Report copied.");
  expect(writeText.mock.calls[2]![0]).toContain("Prelude MIDI Diagnostic Report");
  expect(writeText.mock.calls[2]![0]).toContain("Note attacks represented: 1; paired releases: 1");
});

it("pause/resume excludes paused MIDI and prevents note pairing across the gap", async () => {
  const keys = midiInput("one", "Keys"); install(midiAccess([keys]).access);
  const writeText = vi.fn().mockResolvedValue(undefined);
  render(<MidiDiagnostic writeText={writeText} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
  act(() => keys.emit([0x90, 60, 72], 100));
  fireEvent.click(screen.getByRole("button", { name: "Pause Capture" }));
  act(() => { keys.emit([0xf8], 200); keys.emit([0xfe], 201); keys.emit([0x80, 60, 0], 300); });
  fireEvent.click(screen.getByRole("button", { name: "Resume Capture" }));
  act(() => keys.emit([0x80, 60, 22], 500));
  fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
  await screen.findByText("Report copied.");
  const text = writeText.mock.calls[0]![0];
  expect(text).toContain("Retained raw messages: 2"); expect(text).toContain("paired releases: 0");
  expect(text).toContain("Unmatched attacks: 1; unmatched releases: 1");
  expect(text).toContain("Timing Clock: not observed; count=0"); expect(text).toContain("Active Sensing: not observed; count=0");
  expect(text).toContain("Continuity boundaries observed during this capture: 1");
});

it("disconnect/reconnect with the same input ID starts new source continuity", async () => {
  const first = midiInput("one", "Keys"); const reconnected = midiInput("one", "Keys");
  const ports = midiAccess([first]); install(ports.access);
  const writeText = vi.fn().mockResolvedValue(undefined);
  render(<MidiDiagnostic writeText={writeText} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
  act(() => first.emit([0x90, 60, 72], 100));
  first.disconnect(); act(() => ports.stateChange());
  ports.inputs.set("one", reconnected.input); act(() => ports.stateChange());
  act(() => reconnected.emit([0x80, 60, 22], 500));
  fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
  await screen.findByText("Report copied.");
  expect(writeText.mock.calls[0]![0]).toContain("Unmatched attacks: 1; unmatched releases: 1");
  expect(writeText.mock.calls[0]![0]).toContain("paired releases: 0");
  expect(first.listeners.size).toBe(0); expect(reconnected.listeners.size).toBe(1);
});

it.each(["Copy Capture", "Copy Report"])("freezes %s fallback during incoming MIDI, then retries with current evidence", async (action) => {
  const keys = midiInput("one", "Keys"); install(midiAccess([keys]).access);
  const writeText = vi.fn().mockRejectedValueOnce(new Error("Denied")).mockResolvedValue(undefined);
  render(<MidiDiagnostic writeText={writeText} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
  act(() => keys.emit([0x90, 60, 72], 100));
  fireEvent.click(screen.getByRole("button", { name: action }));
  const label = action === "Copy Report" ? "MIDI diagnostic report" : "MIDI diagnostic capture";
  const fallback = await screen.findByRole("textbox", { name: label }) as HTMLTextAreaElement;
  const snapshot = writeText.mock.calls[0]![0];
  expect(fallback.value).toBe(snapshot); expect(fallback.readOnly).toBe(true);
  await waitFor(() => expect(document.activeElement).toBe(fallback));
  expect(fallback.selectionStart).toBe(0); expect(fallback.selectionEnd).toBe(snapshot.length);
  act(() => { keys.emit([0x80, 60, 22], 500); keys.emit([0xfe], 510); });
  expect(fallback.value).toBe(snapshot);
  fireEvent.click(screen.getByRole("button", { name: action }));
  await screen.findByText(action === "Copy Report" ? "Report copied." : "Capture copied.");
  expect(writeText.mock.calls[1]![0]).not.toBe(snapshot);
  expect(screen.queryByRole("textbox", { name: label })).toBeNull();
});

it("displays truncation prominently and reset clears counters/origin/continuity", async () => {
  const keys = midiInput("one", "Keys"); install(midiAccess([keys]).access);
  const writeText = vi.fn().mockResolvedValue(undefined);
  render(<MidiDiagnostic writeText={writeText} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
  act(() => {
    keys.emit([0x90, 60, 72], 0); keys.emit([0xfe], 1);
    for (let index = 0; index < 1000; index++) keys.emit([0xf8], index + 2);
    keys.emit([0x80, 60, 2], 2000);
  });
  expect(screen.getByText(/Partial evidence: older raw messages were dropped/)).toBeTruthy();
  expect(screen.getByText(/Timing Clock 1000, Active Sensing 1/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Copy Report" })); await screen.findByText("Report copied.");
  expect(writeText.mock.calls[0]![0]).toContain("Partial evidence");
  expect(writeText.mock.calls[0]![0]).toContain("Note attacks represented: 0; paired releases: 0");
  fireEvent.click(screen.getByRole("button", { name: "Pause Capture" }));
  fireEvent.click(screen.getByRole("button", { name: "Resume Capture" }));
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  act(() => keys.emit([0x90, 62, 77], 10000));
  fireEvent.click(screen.getByRole("button", { name: "Copy Report" })); await screen.findByText("Report copied.");
  const text = writeText.mock.calls[1]![0];
  expect(text).not.toContain("Partial evidence:"); expect(text).toContain("Timing Clock: not observed; count=0");
  expect(text).toContain("Continuity boundaries observed during this capture: 0");
  expect(text).toContain("Attack: 0.000000s"); expect(text).toContain("Raw sequences: attack=1");
});

it("retains unexpected background and malformed messages in the default view", async () => {
  const keys = midiInput("one", "Keys"); install(midiAccess([keys]).access); render(<MidiDiagnostic />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
  act(() => { keys.emit([0xf8, 1], 0); keys.emit([0xfe, 1], 1); keys.emit([0x90, 60], 2); keys.emit([0xb0, 67, 99], 3); });
  const musical = screen.getByLabelText("Musical MIDI event history");
  expect(within(musical).getAllByRole("row")).toHaveLength(5);
  expect(within(musical).getByText(/Timing Clock .*extra bytes/)).toBeTruthy();
  expect(within(musical).getByText(/Active Sensing .*extra bytes/)).toBeTruthy();
  expect(within(musical).getByText(/Note On .*truncated bytes/)).toBeTruthy();
});

it("keeps an in-flight report snapshot through Clear and prevents concurrent writes", async () => {
  const keys = midiInput("one", "Keys"); install(midiAccess([keys]).access);
  let reject!: (error: Error) => void;
  const writeText = vi.fn().mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; })).mockResolvedValue(undefined);
  render(<MidiDiagnostic writeText={writeText} />);
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
  act(() => keys.emit([0x90, 60, 72], 100));
  fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
  const snapshot = writeText.mock.calls[0]![0];
  expect((screen.getByRole("button", { name: "Copy Capture" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Clear" }));
  act(() => keys.emit([0x90, 62, 77], 500));
  fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
  expect(writeText).toHaveBeenCalledOnce();
  await act(async () => reject(new Error("Denied")));
  const fallback = await screen.findByRole("textbox", { name: "MIDI diagnostic report" }) as HTMLTextAreaElement;
  expect(fallback.value).toBe(snapshot); expect(fallback.value).toContain("C4 / MIDI 60");
  expect(fallback.value).not.toContain("D4 / MIDI 62");
  fireEvent.click(screen.getByRole("button", { name: "Copy Report" }));
  await screen.findByText("Report copied.");
  expect(writeText.mock.calls[1]![0]).toContain("D4 / MIDI 62");
  expect(writeText.mock.calls[1]![0]).not.toContain("C4 / MIDI 60");
});
