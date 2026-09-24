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
