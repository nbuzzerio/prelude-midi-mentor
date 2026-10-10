// @vitest-environment jsdom

import { StrictMode, useContext } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MidiProvider } from "./midi-provider";
import { AppMidiContext, type AppMidiConsumer } from "./midi-context";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import type { MidiInputConnectionChange, RawMidiMessage } from "@/lib/midi/midi-transport";

function makeInput(id: string | null = "keys", name: string | null = "Piano") {
  const input = Object.assign(new EventTarget(), { id, name, state: "connected" }) as unknown as MIDIInput;
  const attach = vi.spyOn(input, "addEventListener");
  const detach = vi.spyOn(input, "removeEventListener");
  const emit = (data: Uint8Array | null | undefined, timeStamp = 10) => {
    const event = new Event("midimessage");
    Object.defineProperties(event, { data: { value: data }, timeStamp: { value: timeStamp } });
    input.dispatchEvent(event);
    return event as MIDIMessageEvent;
  };
  return { input, attach, detach, emit };
}

function installAccess(initial: MIDIInput[] = []) {
  const inputs = new Map(initial.map((input, index) => [input.id ?? `unidentified-${index}`, input]));
  const access = Object.assign(new EventTarget(), { inputs }) as unknown as MIDIAccess;
  const request = vi.fn(async () => access);
  Object.defineProperty(navigator, "requestMIDIAccess", { configurable: true, value: request });
  const change = () => access.dispatchEvent(new Event("statechange"));
  return { access, inputs, request, change };
}

const bytes = (...values: number[]) => Uint8Array.from(values);
const strict = ({ children }: React.PropsWithChildren) => <StrictMode><MidiProvider>{children}</MidiProvider></StrictMode>;

async function connect(view: { result: { current: { connectMidi: () => Promise<void> } } }) {
  await act(async () => view.result.current.connectMidi());
}

afterEach(() => { cleanup(); Reflect.deleteProperty(navigator, "requestMIDIAccess"); vi.restoreAllMocks(); });

describe("raw MIDI transport fidelity", () => {
  it("copies and freezes full source bytes and metadata before normalized delivery", async () => {
    const port = makeInput(); installAccess([port.input]);
    vi.spyOn(performance, "now").mockReturnValue(123.75);
    const raw: RawMidiMessage[] = []; const order: string[] = []; const normalized = vi.fn();
    const view = renderHook(() => useAppMidiInput({ onRawMessage: (message) => { raw.push(message); order.push("raw"); },
      onNotePlayed: (...args) => { order.push("note"); normalized(...args); } }), { wrapper: MidiProvider });
    await connect(view);
    const data = bytes(0x95, 72, 91);
    act(() => port.emit(data, 44.125)); data[1] = 60; data[2] = 1;
    expect(raw[0]).toEqual({ provenance: "browser-midi-message", sequence: 1, input: { id: "keys", name: "Piano" },
      bytes: [0x95, 72, 91], dataStatus: "available", sourceTimeStampMs: 44.125, receivedAtMs: 123.75 });
    expect([raw[0], raw[0].input, raw[0].bytes].every(Object.isFrozen)).toBe(true);
    expect(order).toEqual(["raw", "note"]); expect(normalized).toHaveBeenCalledWith(72, 91, 44.125);
  });

  it("observes receipt time before reading browser data", async () => {
    const port = makeInput(); installAccess([port.input]);
    const clock = vi.spyOn(performance, "now").mockReturnValue(20);
    const onRawMessage = vi.fn(); const view = renderHook(() => useAppMidiInput({ onRawMessage }), { wrapper: MidiProvider });
    await connect(view);
    const event = new Event("midimessage");
    Object.defineProperty(event, "data", { get: () => { clock.mockReturnValue(99); return bytes(0xf8); } });
    act(() => port.input.dispatchEvent(event));
    expect(onRawMessage.mock.calls[0][0].receivedAtMs).toBe(20);
  });

  it("preserves both releases and zero-velocity note-on encodings", async () => {
    const port = makeInput(); installAccess([port.input]);
    const onRawMessage = vi.fn(); const onNoteReleased = vi.fn(); const onNotePlayed = vi.fn();
    const view = renderHook(() => useAppMidiInput({ onRawMessage, onNoteReleased, onNotePlayed }), { wrapper: MidiProvider });
    await connect(view);
    act(() => { port.emit(bytes(0x82, 72, 41), 40); port.emit(bytes(0x92, 72, 0), 41); });
    expect(onRawMessage.mock.calls.map(([message]) => message.bytes)).toEqual([[0x82, 72, 41], [0x92, 72, 0]]);
    expect(onNoteReleased.mock.calls).toEqual([[{ midiNumber: 72, encoding: "note-off", releaseVelocity: 41, sourceTimeStampMs: 40 }],
      [{ midiNumber: 72, encoding: "note-on-zero", sourceTimeStampMs: 41 }]]);
    expect(onNotePlayed).not.toHaveBeenCalled();
  });

  it("keeps every CC64 value and repetition while legacy sustain still reports edges", async () => {
    const port = makeInput(); installAccess([port.input]);
    const onRawMessage = vi.fn(); const onSustainPedalChanged = vi.fn();
    const view = renderHook(() => useAppMidiInput({ onRawMessage, onSustainPedalChanged }), { wrapper: MidiProvider });
    await connect(view);
    act(() => { for (let value = 0; value <= 127; value++) port.emit(bytes(0xbf, 64, value));
      port.emit(bytes(0xbf, 64, 127)); port.emit(bytes(0xbf, 64, 0)); port.emit(bytes(0xbf, 64, 0)); });
    expect(onRawMessage.mock.calls.map(([message]) => message.bytes[2])).toEqual([...Array.from({ length: 128 }, (_, i) => i), 127, 0, 0]);
    expect(onSustainPedalChanged.mock.calls).toEqual([[true], [false]]);
  });

  it("preserves repeated notes, equal and regressing timestamps in receipt order", async () => {
    const port = makeInput(); installAccess([port.input]);
    const clock = vi.spyOn(performance, "now").mockReturnValue(100);
    const onRawMessage = vi.fn(); const onNotePlayed = vi.fn();
    const view = renderHook(() => useAppMidiInput({ onRawMessage, onNotePlayed }), { wrapper: MidiProvider });
    await connect(view);
    act(() => { clock.mockReturnValue(200); port.emit(bytes(0x90, 60, 90), 50);
      clock.mockReturnValue(201); port.emit(bytes(0x90, 60, 90), 50);
      clock.mockReturnValue(202); port.emit(bytes(0x91, 64, 80), 12); });
    const raw = onRawMessage.mock.calls.map(([message]) => message);
    expect(raw.map((message) => message.sequence)).toEqual([1, 2, 3]);
    expect(raw.map((message) => message.sourceTimeStampMs)).toEqual([50, 50, 12]);
    expect(raw.map((message) => message.receivedAtMs)).toEqual([200, 201, 202]);
    expect(onNotePlayed).toHaveBeenCalledTimes(3);
  });

  it("delivers full system, short and other channel messages without React/context updates", async () => {
    const port = makeInput(); installAccess([port.input]);
    const onRawMessage = vi.fn(); const onNotePlayed = vi.fn(); let renders = 0;
    const view = renderHook(() => { renders++; return useAppMidiInput({ onRawMessage, onNotePlayed }); }, { wrapper: MidiProvider });
    await connect(view); const before = renders;
    const messages = [[0xf8], [0xfe], [0xfa], [0xc3, 7], [0xd3, 30], [0xe3, 20, 70], [0xb3, 1, 64], [0xf0, 1, 2, 3, 4, 0xf7]];
    act(() => messages.forEach((message) => port.emit(bytes(...message))));
    expect(onRawMessage.mock.calls.map(([message]) => message.bytes)).toEqual(messages);
    expect(onNotePlayed).not.toHaveBeenCalled(); expect(renders).toBe(before);
  });

  it("explicitly retains missing, empty, truncated and invalid payloads without crashing music callbacks", async () => {
    const port = makeInput(); installAccess([port.input]);
    const onRawMessage = vi.fn(); const onNotePlayed = vi.fn();
    const view = renderHook(() => useAppMidiInput({ onRawMessage, onNotePlayed }), { wrapper: MidiProvider });
    await connect(view);
    act(() => { port.emit(null); port.emit(undefined); port.emit(bytes()); port.emit(bytes(0x90)); port.emit(bytes(0x90, 60, 255)); });
    expect(onRawMessage.mock.calls.map(([message]) => [message.dataStatus, message.bytes]))
      .toEqual([["unavailable", null], ["unavailable", null], ["available", []], ["available", [0x90]], ["available", [0x90, 60, 255]]]);
    expect(onNotePlayed.mock.calls).toEqual([[60, undefined, 10]]);
  });

  it("marks unreadable data and preserves anomalous timestamps without deriving valid source timing", async () => {
    const port = makeInput(); installAccess([port.input]);
    const onRawMessage = vi.fn(); const onNotePlayed = vi.fn();
    const view = renderHook(() => useAppMidiInput({ onRawMessage, onNotePlayed }), { wrapper: MidiProvider });
    await connect(view);
    const event = new Event("midimessage"); Object.defineProperty(event, "data", { get: () => { throw Error("Unavailable data"); } });
    act(() => { port.input.dispatchEvent(event); port.emit(bytes(0x90, 60, 80), Number.NaN); port.emit(bytes(0x90, 64, 80), -1); });
    const missingTime = new Event("midimessage");
    Object.defineProperties(missingTime, { data: { value: bytes(0x90, 67, 80) }, timeStamp: { value: undefined } });
    act(() => port.input.dispatchEvent(missingTime));
    expect(onRawMessage.mock.calls[0][0]).toMatchObject({ bytes: null, dataStatus: "unreadable" });
    expect(onRawMessage.mock.calls[1][0].sourceTimeStampMs).toBeNaN();
    expect(onRawMessage.mock.calls[2][0].sourceTimeStampMs).toBe(-1);
    expect(onRawMessage.mock.calls[3][0].sourceTimeStampMs).toBeNull();
    expect(onNotePlayed.mock.calls).toEqual([[60, 80], [64, 80], [67, 80]]);
  });
});

describe("raw MIDI ownership and input availability", () => {
  it("selects only one raw input while legacy normalized behavior remains aggregated", async () => {
    const first = makeInput("first", "First"); const second = makeInput("second", "Second"); installAccess([first.input, second.input]);
    const onRawMessage = vi.fn(); const onNotePlayed = vi.fn(); const onInputConnectionChange = vi.fn();
    const view = renderHook(() => useAppMidiInput({ rawInputId: "second", onRawMessage, onNotePlayed, onInputConnectionChange }), { wrapper: MidiProvider });
    await connect(view);
    expect(view.result.current.connectedInputs).toEqual([{ id: "first", name: "First" }, { id: "second", name: "Second" }]);
    act(() => { first.emit(bytes(0x90, 60, 80)); second.emit(bytes(0x91, 64, 90)); });
    expect(onRawMessage).toHaveBeenCalledTimes(1); expect(onRawMessage.mock.calls[0][0].input).toEqual({ id: "second", name: "Second" });
    expect(onNotePlayed.mock.calls).toEqual([[60, 80, 10], [64, 90, 10]]);
    expect(onInputConnectionChange.mock.calls.map(([change]) => [change.state, change.input.id])).toEqual([["connected", "second"]]);
  });

  it("reports selected loss without substituting another input; reconnect uses the same browser identity", async () => {
    const first = makeInput("first"); const second = makeInput("second"); const env = installAccess([first.input, second.input]);
    const onRawMessage = vi.fn(); const changes: MidiInputConnectionChange[] = [];
    const view = renderHook(() => useAppMidiInput({ rawInputId: "first", onRawMessage, onInputConnectionChange: (change) => changes.push(change) }), { wrapper: MidiProvider });
    await connect(view);
    act(() => { env.inputs.delete("first"); env.change(); second.emit(bytes(0x90, 64, 90)); });
    expect(view.result.current.status).toBe("connected"); expect(view.result.current.connectedInputs.map((input) => input.id)).toEqual(["second"]);
    expect(onRawMessage).not.toHaveBeenCalled(); expect(changes.map(({ state, input }) => [state, input.id])).toEqual([["connected", "first"], ["disconnected", "first"]]);
    const replacement = makeInput("first", "Reconnected piano");
    act(() => { env.inputs.set("first", replacement.input); env.change(); env.change(); replacement.emit(bytes(0x90, 60, 90)); });
    expect(onRawMessage).toHaveBeenCalledTimes(1); expect(onRawMessage.mock.calls[0][0].input).toEqual({ id: "first", name: "Reconnected piano" });
    expect(replacement.attach).toHaveBeenCalledTimes(1); expect(changes.at(-1)?.state).toBe("connected");
  });

  it("reports hotplug and retained disconnected ports once, without inventing releases or raw messages", async () => {
    const env = installAccess(); const onRawMessage = vi.fn(); const onNoteReleased = vi.fn(); const onInputConnectionChange = vi.fn();
    const view = renderHook(() => useAppMidiInput({ onRawMessage, onNoteReleased, onInputConnectionChange }), { wrapper: MidiProvider });
    await connect(view); const port = makeInput();
    act(() => { env.inputs.set("keys", port.input); env.change(); env.change(); port.emit(bytes(0x90, 60, 80)); });
    Object.defineProperty(port.input, "state", { value: "disconnected", configurable: true });
    act(() => { env.change(); env.change(); });
    expect(view.result.current.connectedInputs).toEqual([]); expect(view.result.current.status).toBe("disconnected");
    expect(onInputConnectionChange.mock.calls.map(([change]) => change.state)).toEqual(["connected", "disconnected"]);
    expect(onNoteReleased).not.toHaveBeenCalled(); expect(onRawMessage).toHaveBeenCalledTimes(1);
    expect(port.attach).toHaveBeenCalledTimes(1); expect(port.detach).toHaveBeenCalledTimes(1);
  });

  it("exposes unavailable device metadata honestly and never matches it to a requested ID", async () => {
    const port = makeInput(null, null); installAccess([port.input]); const onRawMessage = vi.fn();
    const view = renderHook(({ rawInputId }: { rawInputId?: string }) => useAppMidiInput({ rawInputId, onRawMessage }),
      { wrapper: MidiProvider, initialProps: { rawInputId: "unknown" as string | undefined } });
    await connect(view); expect(view.result.current.connectedInputs).toEqual([{ id: null, name: null }]);
    act(() => port.emit(bytes(0xf8))); expect(onRawMessage).not.toHaveBeenCalled();
    view.rerender({ rawInputId: undefined }); act(() => port.emit(bytes(0xf8)));
    expect(onRawMessage.mock.calls[0][0].input).toEqual({ id: null, name: null });
  });

  it("updates selection and callbacks without reconnecting, rerouting stale consumers or replaying history", async () => {
    const first = makeInput("first"); const second = makeInput("second"); const env = installAccess([first.input, second.input]);
    const old = vi.fn(); const current = vi.fn();
    const view = renderHook((consumer: AppMidiConsumer) => useAppMidiInput(consumer),
      { wrapper: MidiProvider, initialProps: { rawInputId: "first", onRawMessage: old } });
    await connect(view); act(() => first.emit(bytes(0xf8)));
    view.rerender({ rawInputId: "second", onRawMessage: current }); expect(current).not.toHaveBeenCalled();
    act(() => { first.emit(bytes(0xf8)); second.emit(bytes(0xf8)); });
    expect(old).toHaveBeenCalledTimes(1); expect(current).toHaveBeenCalledTimes(1);
    expect(env.request).toHaveBeenCalledTimes(1); expect(first.attach).toHaveBeenCalledTimes(1); expect(second.attach).toHaveBeenCalledTimes(1);
    view.unmount(); act(() => second.emit(bytes(0xf8))); expect(current).toHaveBeenCalledTimes(1);
  });

  it("ignores detached listeners even after reconnecting the same port object", async () => {
    const port = makeInput(); const env = installAccess([port.input]); const onRawMessage = vi.fn();
    const view = renderHook(() => useAppMidiInput({ onRawMessage }), { wrapper: MidiProvider }); await connect(view);
    const obsolete = port.attach.mock.calls[0][1] as EventListener;
    act(() => { env.inputs.clear(); env.change(); env.inputs.set("keys", port.input); env.change(); });
    const event = new Event("midimessage"); Object.defineProperty(event, "data", { value: bytes(0xf8) });
    act(() => { obsolete(event); port.emit(bytes(0xf8)); }); expect(onRawMessage).toHaveBeenCalledTimes(1);
    view.unmount(); act(() => obsolete(event)); expect(onRawMessage).toHaveBeenCalledTimes(1);
  });

  it("does not connect on mount or duplicate listeners and delivery under Strict Mode", async () => {
    const port = makeInput(); const env = installAccess([port.input]); const onRawMessage = vi.fn(); const onNotePlayed = vi.fn();
    const view = renderHook(() => useAppMidiInput({ onRawMessage, onNotePlayed }), { wrapper: strict });
    expect(env.request).not.toHaveBeenCalled(); await connect(view); await connect(view);
    act(() => port.emit(bytes(0x90, 60, 80))); expect(onRawMessage).toHaveBeenCalledTimes(1); expect(onNotePlayed).toHaveBeenCalledTimes(1);
    expect(env.request).toHaveBeenCalledTimes(1); expect(port.attach).toHaveBeenCalledTimes(1);
    view.unmount(); expect(port.detach).toHaveBeenCalledTimes(1);
  });

  it("cleans up consumer routing without tearing down the owner and old cleanup cannot remove a replacement", async () => {
    const port = makeInput(); installAccess([port.input]);
    const view = renderHook(() => useContext(AppMidiContext)!, { wrapper: MidiProvider }); await connect(view);
    const first = vi.fn(); const second = vi.fn(); let releaseFirst!: () => void; let releaseSecond!: () => void;
    act(() => { releaseFirst = view.result.current.registerConsumer({ onRawMessage: first });
      releaseSecond = view.result.current.registerConsumer({ onRawMessage: second }); releaseFirst(); port.emit(bytes(0xf8)); });
    expect(first).not.toHaveBeenCalled(); expect(second).toHaveBeenCalledTimes(1);
    act(() => { releaseSecond(); port.emit(bytes(0xf8)); }); expect(second).toHaveBeenCalledTimes(1);
    expect(port.detach).not.toHaveBeenCalled();
  });

  it("does not deliver a previous consumer's normalized remainder to a reentrant replacement", async () => {
    const port = makeInput(); installAccess([port.input]);
    const view = renderHook(() => useContext(AppMidiContext)!, { wrapper: MidiProvider }); await connect(view);
    const nextRaw = vi.fn(); const nextNote = vi.fn(); const firstNote = vi.fn();
    act(() => { view.result.current.registerConsumer({ onNotePlayed: firstNote, onRawMessage: () => {
      view.result.current.registerConsumer({ onRawMessage: nextRaw, onNotePlayed: nextNote });
    } }); port.emit(bytes(0x90, 60, 80)); });
    expect(nextRaw).not.toHaveBeenCalled(); expect(nextNote).not.toHaveBeenCalled(); expect(firstNote).not.toHaveBeenCalled();
    act(() => port.emit(bytes(0x90, 64, 80))); expect(nextRaw).toHaveBeenCalledTimes(1); expect(nextNote).toHaveBeenCalledWith(64, 80, 10);
  });

  it("preserves queued deliveries until the disconnect notification retires the attachment", async () => {
    const port = makeInput(); const env = installAccess([port.input]); const onRawMessage = vi.fn(); const onNotePlayed = vi.fn();
    const view = renderHook(() => useAppMidiInput({ onRawMessage, onNotePlayed }), { wrapper: MidiProvider }); await connect(view);
    Object.defineProperty(port.input, "state", { value: "disconnected" });
    act(() => { port.emit(bytes(0x90, 60, 80)); env.change(); port.emit(bytes(0x90, 64, 80)); });
    expect(onRawMessage).toHaveBeenCalledTimes(1); expect(onNotePlayed.mock.calls).toEqual([[60, 80, 10]]);
  });

  it("retains the raw delivery but stops its normalized remainder when the source disconnects in a callback", async () => {
    const port = makeInput(); const env = installAccess([port.input]); const onNotePlayed = vi.fn(); const onNoteReleased = vi.fn();
    const onRawMessage = vi.fn(() => {
      Object.defineProperty(port.input, "state", { value: "disconnected" }); env.change();
    });
    const view = renderHook(() => useAppMidiInput({ onRawMessage, onNotePlayed, onNoteReleased }), { wrapper: MidiProvider }); await connect(view);
    act(() => port.emit(bytes(0x90, 60, 80)));
    expect(onRawMessage).toHaveBeenCalledTimes(1); expect(onNotePlayed).not.toHaveBeenCalled(); expect(onNoteReleased).not.toHaveBeenCalled();
    expect(view.result.current.connectedInputs).toEqual([]);
  });

  it("does not attach a late permission result after owner unmount", async () => {
    const port = makeInput(); const env = installAccess([port.input]);
    let resolve!: (access: MIDIAccess) => void; env.request.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const view = renderHook(() => useAppMidiInput({ onRawMessage: vi.fn() }), { wrapper: MidiProvider });
    let pending!: Promise<void>; act(() => { pending = view.result.current.connectMidi(); }); view.unmount();
    await act(async () => { resolve(env.access); await pending; }); expect(port.attach).not.toHaveBeenCalled();
  });

  it("preserves permission failure and allows an explicit retry", async () => {
    const port = makeInput(); const env = installAccess([port.input]); env.request.mockRejectedValueOnce(Error("Denied"));
    const view = renderHook(() => useAppMidiInput({ onRawMessage: vi.fn() }), { wrapper: MidiProvider }); await connect(view);
    expect(view.result.current.status).toBe("error"); expect(view.result.current.error).toBe("Denied"); expect(port.attach).not.toHaveBeenCalled();
    await connect(view); expect(view.result.current.status).toBe("connected"); expect(env.request).toHaveBeenCalledTimes(2);
  });
});
