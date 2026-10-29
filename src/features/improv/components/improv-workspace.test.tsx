// @vitest-environment jsdom
import { Profiler, StrictMode, useEffect } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ImprovWorkspace, { type ImprovDepartureGuard } from "./improv-workspace";
import { MidiProvider } from "@/components/midi/midi-provider";
import { useAppMidiInput } from "@/hooks/use-app-midi-input";
import type { useMidi } from "@/hooks/use-midi";
import { IndexedDbImprovLibrary } from "../persistence/improv-indexeddb";
import { FakeImprovIndexedDb } from "../persistence/improv-indexeddb-fake";
import type { ImprovArchiveLibrary } from "../improv-library";
import { performanceFixture } from "../improv-test-fixture";
import { encodeImprovBackup } from "../improv-backup";
import { improvMidiBlob } from "../improv-midi-export";
import { exportPreferences } from "@/lib/files/export-preferences";
import { analyzeImprovTake, type ImprovMusicalInsights } from "../insights/improv-musical-insights";
type UseMidiOptions = Parameters<typeof useMidi>[0];

const midi = vi.hoisted(() => ({ options: null as UseMidiOptions | null, owners: 0, connect: vi.fn(),
  inputs: [{ id: "piano", name: "Room piano" }, { id: "other", name: "Other keys" }] as { id: string | null; name: string }[] }));
const sound = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), dispose: vi.fn(), fail: false }));
const insights = vi.hoisted(() => ({ result: null as ImprovMusicalInsights | null }));
vi.mock("../hooks/use-improv-insights", () => ({ useImprovInsights: () => insights.result
  ? { status: "ready", insights: insights.result } : { status: "unavailable" } }));
vi.mock("@/hooks/use-midi", () => ({ useMidi(options: UseMidiOptions) {
  midi.options = options;
  useEffect(() => { midi.owners++; return () => { midi.owners--; }; }, []);
  return { status: "connected", connectedInputs: midi.inputs, deviceName: "Room piano", error: null, connectMidi: midi.connect };
} }));
vi.mock("@/components/notation/music-staff", () => ({ default: () => <div>Live grand staff</div> }));
vi.mock("../improv-piano-voices", () => ({ createImprovPianoVoices: () => ({
  attack: (...args: unknown[]) => { if (sound.fail) throw new Error("Audio unavailable"); sound.start(...args); return { release: sound.stop, started: Promise.resolve(true) }; },
  stopAll: sound.stop, dispose: sound.dispose,
}) }));

let fake: FakeImprovIndexedDb; let library: IndexedDbImprovLibrary; let sequence: number;
let guard: ImprovDepartureGuard | null;
const createUrl = vi.fn((blob: Blob) => { expect(blob).toBeInstanceOf(Blob); return "blob:improv-test"; }); const revokeUrl = vi.fn();
const setGuard = (value: ImprovDepartureGuard | null) => { guard = value; };
beforeEach(() => {
  fake = new FakeImprovIndexedDb(); library = new IndexedDbImprovLibrary({ factory: fake.factory }); sequence = 0; guard = null;
  midi.inputs = [{ id: "piano", name: "Room piano" }, { id: "other", name: "Other keys" }]; midi.owners = 0;
  sound.fail = false; insights.result = null; vi.clearAllMocks();
  vi.stubGlobal("structuredClone", globalThis.structuredClone);
  Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
  Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createUrl });
  Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeUrl });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function(this: HTMLDialogElement) { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function(this: HTMLDialogElement) { this.removeAttribute("open"); } });
});
afterEach(async () => { cleanup(); await act(async () => { await Promise.resolve(); }); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function mount(extra: { strict?: boolean; supplied?: ImprovArchiveLibrary; available?: boolean } = {}) {
  const child = <MidiProvider><ImprovWorkspace library={extra.supplied ?? library} available={extra.available} onGuardChange={setGuard} /></MidiProvider>;
  return render(extra.strict ? <StrictMode>{child}</StrictMode> : child);
}
async function setup(activity = "first-take-sight-reading") {
  await waitFor(() => expect((screen.getByRole("button", { name: "Create collection" }) as HTMLButtonElement).disabled).toBe(false));
  if (activity !== "first-take-sight-reading") fireEvent.change(screen.getByLabelText("Activity"), { target: { value: activity } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Create collection" }) as HTMLButtonElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText(activity === "first-take-sight-reading" ? "New piece title" : "New session title"), { target: { value: "Disney book" } });
  fireEvent.click(screen.getByRole("button", { name: "Create collection" }));
  await screen.findByRole("heading", { name: "Disney book" });
  await waitFor(() => expect((screen.getByLabelText("Physical MIDI input") as HTMLSelectElement).disabled).toBe(false));
  fireEvent.change(screen.getByLabelText("Physical MIDI input"), { target: { value: "piano" } });
  await waitFor(() => expect((screen.getByRole("button", { name: "Start Take" }) as HTMLButtonElement).disabled).toBe(false));
}
function send(bytes = [0x90, 60, 90], inputId = "piano") {
  act(() => midi.options?.onRawMessage?.({ provenance: "browser-midi-message", input: { id: inputId, name: inputId === "piano" ? "Room piano" : "Other keys" },
    sequence: ++sequence, bytes, dataStatus: "available", sourceTimeStampMs: performance.now(), receivedAtMs: performance.now() }));
}
async function start() { fireEvent.click(screen.getByRole("button", { name: "Start Take" })); await screen.findByRole("button", { name: "Stop Take" }); }
async function stop() { fireEvent.click(screen.getByRole("button", { name: "Stop Take" })); await screen.findByText("Saved locally"); await screen.findByRole("button", { name: "Replay take" }); }
async function records() { const collection = (await library.listCollections())[0]; return library.listTakes(collection.collectionId); }
function unload() { const event = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(event); return event.defaultPrevented; }

class RoomRecorder {
  static instances: RoomRecorder[] = []; static finalize = true;
  static isTypeSupported = (mime: string) => mime === "audio/webm;codecs=opus";
  state: RecordingState = "inactive"; mimeType = "audio/webm;codecs=opus";
  onstart: ((e: Event) => void) | null = null; onstop: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null; ondataavailable: ((e: BlobEvent) => void) | null = null;
  onpause: ((e: Event) => void) | null = null; onresume: ((e: Event) => void) | null = null;
  pause() { this.state = "paused"; queueMicrotask(() => this.onpause?.(new Event("pause"))); }
  resume() { this.state = "recording"; queueMicrotask(() => this.onresume?.(new Event("resume"))); }
  constructor() { RoomRecorder.instances.push(this); }
  start() { this.state = "recording"; queueMicrotask(() => this.onstart?.(new Event("start"))); }
  stop() { this.state = "inactive"; if (RoomRecorder.finalize) queueMicrotask(() => this.finish()); }
  finish() { this.ondataavailable?.({ data: new Blob(["room sound"], { type: this.mimeType }) } as BlobEvent); this.onstop?.(new Event("stop")); }
}
function roomBrowser(request?: MediaDevices["getUserMedia"]) {
  RoomRecorder.instances = []; RoomRecorder.finalize = true;
  const track = Object.assign(new EventTarget(), { readyState: "live", muted: false, stop: vi.fn() });
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  const getUserMedia = request ?? vi.fn(async () => stream);
  vi.stubGlobal("isSecureContext", true); vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("MediaRecorder", RoomRecorder);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  return { track, stream, getUserMedia };
}
async function prepareRoom() {
  fireEvent.click(screen.getByLabelText("Record room audio with this take"));
  fireEvent.click(screen.getByRole("button", { name: "Prepare room microphone" }));
  await screen.findByText("Microphone ready. Press Start Take.");
}

describe("playing-first Improv workspace", () => {
  it.each(["first-take-sight-reading", "free-improvisation"])("Pause/Resume preserves the same %s take and excludes paused notes", async activity => {
    mount({ strict: true }); await setup(activity); await start(); send([0x90, 60, 80]);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const resume = await screen.findByRole("button", { name: "Resume" }); await waitFor(() => expect((resume as HTMLButtonElement).disabled).toBe(false));
    send([0x90, 70, 100]); await waitFor(() => expect(document.querySelector('.improv-live svg')?.getAttribute('data-recording')).toBe('false'));
    expect(document.querySelector('.improv-live [data-pitch="70"]')).toBeNull(); expect(screen.getByRole("button", { name: "Stop Take" })).toBeTruthy();
    fireEvent.click(resume); await screen.findByRole("button", { name: "Pause" }); send([0x90, 64, 90]); await stop();
    expect(await screen.findByText("Intentional pauses")).toBeTruthy(); const history = await records(); expect(history).toHaveLength(1);
    const take = await library.loadTake(history[0].takeId); expect(take.record.number).toBe(1); expect(take.record.controls).toHaveLength(5);
    expect(take.chunks.flatMap(c => c.events.map(e => e.raw.bytes))).toEqual([[0x90, 60, 80], [0x90, 70, 100], [0x90, 64, 90]]);
  });
  it("keeps keyboard-focusable Resume and Stop, protects departure, and stops a paused take", async () => {
    mount(); await setup(); await start(); fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const resume = await screen.findByRole("button", { name: "Resume" }); await waitFor(() => expect((resume as HTMLButtonElement).disabled).toBe(false));
    resume.focus(); expect(document.activeElement).toBe(resume); expect(unload()).toBe(true);
    let left = false; act(() => guard?.(() => { left = true; })); expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Stay in Improv" })); expect(left).toBe(false); await stop();
    const history = await records(); const take = await library.loadTake(history[0].takeId); expect(take.record.controls).toHaveLength(2);
    expect(take.record.capture.terminal?.reason).toBe("user-stop"); expect(unload()).toBe(false);
  });
  it("keeps Resume disabled after a failed pause checkpoint until explicit Retry Save", async () => {
    mount(); await setup(); await start(); await waitFor(async () => expect((await records()).length).toBe(1));
    fake.commitError = "QuotaExceededError"; fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const resume = await screen.findByRole("button", { name: "Resume" }); await screen.findByRole("button", { name: "Retry Save" });
    expect((resume as HTMLButtonElement).disabled).toBe(true); send([0x90, 70, 90]);
    fireEvent.click(screen.getByRole("button", { name: "Retry Save" })); await waitFor(() => expect((resume as HTMLButtonElement).disabled).toBe(false));
    expect(document.querySelector('.improv-live [data-pitch="70"]')).toBeNull(); fireEvent.click(resume); await screen.findByRole("button", { name: "Pause" }); await stop();
  });
  it("keeps room audio and MIDI coordinated through Pause/Resume on one native recorder", async () => {
    const room = roomBrowser(); mount(); await setup(); await prepareRoom(); await start(); send();
    fireEvent.click(screen.getByRole("button", { name: "Pause" })); const resume = await screen.findByRole("button", { name: "Resume" });
    await waitFor(() => expect((resume as HTMLButtonElement).disabled).toBe(false)); expect(RoomRecorder.instances[0].state).toBe("paused");
    expect(room.track.stop).not.toHaveBeenCalled(); await screen.findByText(/microphone remains acquired/);
    fireEvent.click(resume); await screen.findByRole("button", { name: "Pause" }); expect(RoomRecorder.instances[0].state).toBe("recording");
    expect(RoomRecorder.instances).toHaveLength(1); await stop(); await screen.findByRole("button", { name: "Download room audio" });
    expect(room.track.stop).toHaveBeenCalledOnce();
  });
  it.each([false, true])("independent microphone loss preserves MIDI and permits later MIDI-only Pause/Resume: paused=%s", async paused => {
    const room = roomBrowser(); mount(); await setup(); await prepareRoom(); await start(); send();
    if (paused) { fireEvent.click(screen.getByRole("button", { name: "Pause" })); const resume = await screen.findByRole("button", { name: "Resume" }); await waitFor(() => expect((resume as HTMLButtonElement).disabled).toBe(false)); }
    act(() => room.track.dispatchEvent(new Event("ended"))); await screen.findAllByText(/MIDI continues independently/);
    if (!paused) { fireEvent.click(screen.getByRole("button", { name: "Pause" })); await screen.findByRole("button", { name: "Resume" }); }
    fireEvent.click(screen.getByRole("button", { name: "Resume" })); await screen.findByRole("button", { name: "Pause" }); send([0x90, 64, 90]); await stop();
    const take = await library.loadTake((await records())[0].takeId); expect(take.record.capture.status).toBe("completed"); expect(take.record.controls).toHaveLength(5);
    expect(take.chunks.flatMap(c => c.events)).toHaveLength(2);
  });
  it("a coordinated native transition exception interrupts MIDI instead of silently downgrading", async () => {
    const room = roomBrowser(); mount(); await setup(); await prepareRoom(); await start(); send();
    vi.spyOn(RoomRecorder.instances[0], "pause").mockImplementation(() => { throw new Error("Native pause failed"); });
    fireEvent.click(screen.getByRole("button", { name: "Pause" })); await screen.findByText("Interrupted · captured prefix saved locally");
    const take = await library.loadTake((await records())[0].takeId); expect(take.record.capture.terminal?.reason).toBe("coordination-failed");
    expect(room.track.stop).toHaveBeenCalledOnce(); expect(take.chunks.flatMap(c => c.events)).toHaveLength(1);
  });
  it("source loss while Paused remains terminal and cannot silently Resume", async () => {
    mount(); await setup(); await start(); fireEvent.click(screen.getByRole("button", { name: "Pause" })); await screen.findByRole("button", { name: "Resume" });
    act(() => midi.options?.onInputConnectionChange?.({ provenance: "input-availability", input: { id: "piano", name: "Room piano" }, state: "disconnected", receivedAtMs: performance.now() }));
    await screen.findByText("Interrupted · captured prefix saved locally"); expect(screen.queryByRole("button", { name: "Resume" })).toBeNull();
    const take = await library.loadTake((await records())[0].takeId); expect(take.record.capture.terminal?.reason).toBe("device-disconnected");
  });
  it("shows an empty ready staff and keeps released accepted notes visible after Stop", async () => {
    mount({ strict: true }); await setup(); send();
    const live = document.querySelector('.improv-live svg')!;
    expect(live.getAttribute('data-note-count')).toBe('0'); await start(); send([0x90, 60, 90]); send([0x80, 60, 0]);
    await waitFor(() => expect(live.getAttribute('data-note-count')).toBe('1'));
    await stop(); send([0x90, 67, 90]); await waitFor(() => expect(live.getAttribute('data-recording')).toBe('false'));
    expect(live.querySelector('[data-pitch="60"]')).toBeTruthy(); expect(live.querySelector('[data-pitch="67"]')).toBeNull();
    expect(live.querySelector('[data-pitch="60"]')?.getAttribute('data-release-ms')).not.toBe('unreleased');
  });
  it("loads original saved history and navigates windows without evidence writes", async () => {
    const f = await performanceFixture([{ receivedAtMs: 200, bytes: [0x90, 60, 80] }, { receivedAtMs: 300, bytes: [0x80, 60, 0] },
      { receivedAtMs: 20_100, bytes: [0x90, 67, 80] }], { end: 30_100 });
    const load = vi.spyOn(f.lib, 'loadTake'); const checkpoint = vi.spyOn(f.lib, 'checkpoint'); mount({ supplied: f.lib });
    await screen.findByRole('option', { name: 'Disney book' }); fireEvent.change(screen.getByLabelText('Piece'), { target: { value: 'book' } });
    fireEvent.click(screen.getByText(/Take history and library/)); fireEvent.click(await screen.findByRole('button', { name: 'Review Take 1' }));
    const slider = await screen.findByRole('slider', { name: 'Review time position' });
    fireEvent.change(slider, { target: { value: '19000' } });
    await waitFor(() => expect(document.querySelector('details[open] [data-pitch="67"]')).toBeTruthy());
    expect(load).toHaveBeenCalledWith('take-1'); expect(checkpoint).not.toHaveBeenCalled();
    expect((await f.lib.loadTake('take-1')).chunks).toEqual(f.loaded.chunks);
  });
  it("keeps first-take review available after later captures and resets a fresh live timeline", async () => {
    mount(); await setup(); await start(); send([0x90, 60, 90]); await stop();
    await waitFor(() => expect(document.querySelector('.improv-live [data-pitch="60"]')).toBeTruthy());
    await start(); await waitFor(() => expect(document.querySelector('.improv-live [data-attack]')).toBeNull());
    send([0x90, 67, 90]); await stop(); fireEvent.click(screen.getByText(/Take history and library/));
    fireEvent.click(await screen.findByRole('button', { name: 'Review Take 1' }));
    await screen.findByText(/Review Take 1.*Original/);
    await waitFor(() => expect(document.querySelector('details[open] [data-pitch="60"]')).toBeTruthy());
    expect((await records()).map(t => t.number)).toEqual([1, 2]);
  });
  it("keeps MIDI-only default permission-free, including under Strict Mode", async () => {
    const room = roomBrowser(); mount({ strict: true }); await setup(); await start(); send(); await stop();
    expect(room.getUserMedia).not.toHaveBeenCalled(); expect(RoomRecorder.instances).toHaveLength(0);
  });
  it("records/finalizes room audio independently, protects replacement, and keeps it out of JSON", async () => {
    const room = roomBrowser(); mount({ strict: true }); await setup(); await prepareRoom(); expect(await records()).toEqual([]);
    await start(); send(); RoomRecorder.finalize = false; await stop();
    expect(screen.getByText("Saved locally")).toBeTruthy(); expect(screen.queryByLabelText("Preview room audio")).toBeNull();
    await act(async () => RoomRecorder.instances[0].finish()); await screen.findByLabelText("Preview room audio");
    expect(room.getUserMedia).toHaveBeenCalledOnce(); expect(room.track.stop).toHaveBeenCalledOnce();
    expect((screen.getByRole("button", { name: "Start Take" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Piece") as HTMLSelectElement).disabled).toBe(true); expect(unload()).toBe(true);
    const history = await library.exportCollection((await library.listCollections())[0].collectionId);
    expect(encodeImprovBackup(history)).not.toMatch(/room sound|blob:improv|audio\/webm/);
    fireEvent.click(screen.getByRole("button", { name: "Download room audio" })); expect(unload()).toBe(true);
    const retained = screen.getByLabelText("Preview room audio").getAttribute("src");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByLabelText("Preview room audio").getAttribute("src")).toBe(retained); expect(unload()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Download room audio" }));
    expect(screen.getByLabelText("Filename preview").textContent).toBe("disney_book_001.webm");
    fireEvent.click(screen.getByRole("button", { name: "Download" })); expect(unload()).toBe(true);
    vi.spyOn(window, "confirm").mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "Discard temporary audio" }));
    await waitFor(() => expect(unload()).toBe(false));
    await waitFor(() => expect((screen.getByRole("button", { name: "Start Take" }) as HTMLButtonElement).disabled).toBe(false)); await start(); await stop();
    expect(room.getUserMedia).toHaveBeenCalledOnce(); expect((await records()).map(t => t.number)).toEqual([1, 2]);
  });
  it("denied preparation consumes no take, and requires an explicit MIDI-only choice", async () => {
    roomBrowser(vi.fn(async () => { throw Object.assign(new Error("denied"), { name: "NotAllowedError" }); })); mount(); await setup();
    fireEvent.click(screen.getByLabelText("Record room audio with this take")); fireEvent.click(screen.getByRole("button", { name: "Prepare room microphone" }));
    await screen.findAllByText(/Microphone permission denied/); expect(await records()).toEqual([]);
    expect((screen.getByRole("button", { name: "Start Take" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Use MIDI only / Cancel audio" })); await start(); await stop(); expect((await records())[0].number).toBe(1);
  });
  it("native room-audio saving retains the recording, preview and departure safeguard", async () => {
    roomBrowser();mount({strict:true});await setup();await prepareRoom();await start();send();await stop();
    const preview=await screen.findByLabelText("Preview room audio"),url=preview.getAttribute("src"),urlCount=createUrl.mock.calls.length;
    const write=vi.fn().mockResolvedValue(undefined),directory={kind:"directory" as const,name:"Music",queryPermission:async()=>"granted" as const,requestPermission:async()=>"granted" as const};
    vi.stubGlobal("isSecureContext",true);vi.stubGlobal("showDirectoryPicker",vi.fn().mockResolvedValue(directory));
    vi.stubGlobal("showSaveFilePicker",vi.fn().mockResolvedValue({name:"disney_book_001.webm",createWritable:async()=>({write,close:async()=>{},abort:async()=>{}})}));
    try { await act(async()=>{await exportPreferences.choose();});fireEvent.click(screen.getByRole("button",{name:"Download room audio"}));
      fireEvent.click(await screen.findByRole("button",{name:"Save As…"}));await screen.findAllByText(/Saved\. Temporary audio remains/);
      expect((await (write.mock.calls[0][0] as Blob).text())).toContain("room sound");expect(preview.getAttribute("src")).toBe(url);
      expect(createUrl).toHaveBeenCalledTimes(urlCount);expect(unload()).toBe(true);expect((screen.getByRole("button",{name:"Start Take"}) as HTMLButtonElement).disabled).toBe(true);
    } finally { cleanup();await act(async()=>{await exportPreferences.forget();}); }
  });
  it("cancels pending permission on selected device loss without allocating Take 1", async () => {
    let resolve!: (stream: MediaStream) => void; const room = roomBrowser(vi.fn(() => new Promise<MediaStream>(r => { resolve = r; })));
    mount(); await setup(); fireEvent.click(screen.getByLabelText("Record room audio with this take")); fireEvent.click(screen.getByRole("button", { name: "Prepare room microphone" }));
    act(() => midi.options?.onInputConnectionChange?.({ provenance: "input-availability", input: { id: "piano", name: "Room piano" }, state: "disconnected", receivedAtMs: 100 }));
    await act(async () => resolve(room.stream)); expect(room.track.stop).toHaveBeenCalledOnce(); expect(await records()).toEqual([]);
  });
  it.each(["pagehide", "freeze", "visibilitychange", "device", "consumer"])("ends room capture on %s and never resumes", async reason => {
    const room = roomBrowser(); const view = mount(); await setup(); await prepareRoom(); await start(); send();
    if (reason === "device") act(() => midi.options?.onInputConnectionChange?.({ provenance: "input-availability", input: { id: "piano", name: "Room piano" }, state: "disconnected", receivedAtMs: 100 }));
    else if (reason === "consumer") {
      function Competitor() { useAppMidiInput({ onNotePlayed: vi.fn() }); return null; }
      view.rerender(<MidiProvider><ImprovWorkspace library={library} onGuardChange={setGuard} /><Competitor /></MidiProvider>);
    } else act(() => { if (reason === "visibilitychange") Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); (reason === "pagehide" ? window : document).dispatchEvent(new Event(reason)); });
    await screen.findByLabelText("Preview room audio"); expect(room.track.stop).toHaveBeenCalledOnce();
    expect((await library.loadTake((await records())[0].takeId)).record.status).toBe("interrupted"); expect(RoomRecorder.instances).toHaveLength(1);
  });
  it("retains audio departure protection after MIDI has been safely saved", async () => {
    roomBrowser(); mount(); await setup(); await prepareRoom(); await start(); send(); await stop(); await screen.findByLabelText("Preview room audio");
    const proceed = vi.fn(); act(() => guard?.(proceed)); await screen.findByRole("dialog"); expect(proceed).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Stop / Retry Save and Leave" })); await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(proceed).not.toHaveBeenCalled(); expect(unload()).toBe(true);
    act(() => guard?.(proceed)); fireEvent.click(screen.getByRole("button", { name: "Leave Without Saving" })); expect(proceed).toHaveBeenCalledOnce();
  });
  it("releases tracks and preview resources on actual unmount", async () => {
    const room = roomBrowser(); const view = mount({ strict: true }); await setup(); await prepareRoom(); await start();
    view.unmount(); await act(async () => { await Promise.resolve(); }); expect(room.track.stop).toHaveBeenCalledOnce();
  });
  it("keeps MIDI recording after a microphone failure", async () => {
    const room = roomBrowser(); mount(); await setup(); await prepareRoom(); await start();
    act(() => RoomRecorder.instances[0].onerror?.(new Event("error"))); await waitFor(() => expect(room.track.stop).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Stop Take" })).toBeTruthy(); send(); await stop();
    expect((await library.loadTake((await records())[0].takeId)).record.committedEventWatermark).toBe(1);
  });
  it("allocates one take/recorder despite rapid repeated Start and Stop", async () => {
    const room = roomBrowser(); mount(); await setup(); await prepareRoom();
    const startButton = screen.getByRole("button", { name: "Start Take" }); fireEvent.click(startButton); fireEvent.click(startButton);
    const stopButton = await screen.findByRole("button", { name: "Stop Take" }); send(); fireEvent.click(stopButton); fireEvent.click(stopButton);
    await screen.findByText("Saved locally"); await screen.findByLabelText("Preview room audio");
    expect(await records()).toHaveLength(1); expect(RoomRecorder.instances).toHaveLength(1); expect(room.track.stop).toHaveBeenCalledOnce();
  });
  it("stops room audio when the MIDI unsaved-backlog limit terminates capture", async () => {
    const room = roomBrowser(); mount(); await setup(); await prepareRoom(); await start();
    await waitFor(async () => expect((await records())[0]?.number).toBe(1)); fake.commitError = "QuotaExceededError";
    act(() => { for (let i = 0; i < 2049; i++) midi.options?.onRawMessage?.({ provenance: "browser-midi-message", input: { id: "piano", name: "Room piano" },
      sequence: ++sequence, bytes: [0xb0, 64, 37], dataStatus: "available", sourceTimeStampMs: 100, receivedAtMs: 100 }); });
    await screen.findByLabelText("Preview room audio"); expect(room.track.stop).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button", { name: "Stop Take" })).toBeNull(); fireEvent.click(await screen.findByRole("button", { name: "Retry Save" }));
    await screen.findByText(/Interrupted.*captured prefix saved locally/);
    expect((await library.loadTake((await records())[0].takeId)).record.committedEventWatermark).toBe(2048);
  });
  it("clears the live staff on Stop and ignores later notes until a new take starts", async () => {
    mount(); await setup(); await start(); send(); await screen.findByText("C4"); await stop();
    send([0x90, 64, 90]); await screen.findByText("No held notes");
    expect((await library.loadTake((await records())[0].takeId)).record.committedEventWatermark).toBe(1);
    await start(); send([0x90, 67, 90]); await screen.findByText("G4"); await stop();
    expect((await records()).map(t => t.number)).toEqual([1, 2]);
  });
  it("records a physical-book performance through durable save, then a separate Take 2", async () => {
    mount(); await setup(); expect(await records()).toEqual([]); await start();
    send([0x93, 60, 85]); send([0xb3, 64, 37]); send([0xb3, 64, 37]); send([0x83, 60, 45]); await stop();
    const first = (await records())[0]; expect(first.kind).toBe("take");
    const take = await library.loadTake(first.takeId); expect(take.record).toMatchObject({ status: "completed", number: 1, committedEventWatermark: 4 });
    expect(take.chunks[0].events.map((e) => e.raw.bytes)).toEqual([[0x93, 60, 85], [0xb3, 64, 37], [0xb3, 64, 37], [0x83, 60, 45]]);
    await start(); await stop(); expect((await records()).map((t) => t.number)).toEqual([1, 2]);
    expect((await library.listCollections())[0].firstTakeId).toBe(first.takeId);
    expect(screen.queryByText(/accuracy percentage|sight-reading score/i)).toBeNull(); expect(midi.owners).toBe(1);
  });
  it("supports an empty free-improvisation attempt and neutral untitled names", async () => {
    mount(); await waitFor(() => expect((screen.getByRole("button", { name: "Create collection" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.change(screen.getByLabelText("Activity"), { target: { value: "free-improvisation" } });
    await waitFor(() => expect((screen.getByRole("button", { name: "Create collection" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Create collection" })); await screen.findByRole("heading", { name: "Untitled improvisation" });
    fireEvent.change(screen.getByLabelText("Physical MIDI input"), { target: { value: "piano" } }); await start(); await stop();
    const take = await library.loadTake((await records())[0].takeId); expect(take.record.committedEventWatermark).toBe(0);
    expect((await library.listCollections())[0].activity).toBe("free-improvisation");
  });
  it("requires explicit physical selection and excludes wrong-source raw messages", async () => {
    mount(); await setup(); fireEvent.change(screen.getByLabelText("Physical MIDI input"), { target: { value: "" } });
    expect((screen.getByRole("button", { name: "Start Take" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /virtual/i })).toBeNull();
    fireEvent.change(screen.getByLabelText("Physical MIDI input"), { target: { value: "piano" } }); await start(); send(undefined, "other"); send(); await stop();
    expect((await library.loadTake((await records())[0].takeId)).record.committedEventWatermark).toBe(1);
  });
  it("batches held-note feedback, keeps timer quiet, and does not rewrite key context evidence", async () => {
    mount(); await setup(); fireEvent.click(screen.getByText("Notation context"));
    fireEvent.change(screen.getByLabelText("Display key"), { target: { value: "g-major" } }); await start();
    for (let i = 0; i < 40; i++) send([0x90, 66, 80]);
    await screen.findByText(/F♯4|F#4/, { selector: "span" }); expect(screen.getByLabelText("Musical elapsed time").getAttribute("aria-live")).toBe("off");
    const held = screen.getByText(/F♯4|F#4/, { selector: "span" }); expect(held.getAttribute("aria-live")).toBe("off");
    await stop(); const take = await library.loadTake((await records())[0].takeId);
    expect(take.record.committedEventWatermark).toBe(40); expect(take.chunks[0].events.every((e) => e.raw.bytes?.[1] === 66)).toBe(true);
  });
  it("does not register a competing consumer or open storage when hosted practice excludes Improv", () => {
    const heldOwner = vi.fn(); function HostedConsumer() { useAppMidiInput({ onNotePlayed: heldOwner }); return <p>Hosted capture</p>; }
    const list = vi.spyOn(library, "listCollections"); render(<MidiProvider><HostedConsumer /><ImprovWorkspace library={library} available={false} /></MidiProvider>);
    expect(screen.getByText(/Finish or end the active Practice Session/)).toBeTruthy(); expect(list).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Start Take" })).toBeNull();
    act(() => midi.options?.onNotePlayed(60, 80)); expect(heldOwner).toHaveBeenCalledWith(60, 80);
  });
  it("shows Saving and keeps unload protection until the terminal transaction commits", async () => {
    mount(); await setup(); await start(); await waitFor(async () => expect((await records())[0]?.number).toBe(1));
    expect(unload()).toBe(true); const hold = fake.holdNextCommit(); fireEvent.click(screen.getByRole("button", { name: "Stop Take" }));
    await waitFor(() => expect(hold.ready()).toBe(true)); expect(screen.queryByText("Saved locally")).toBeNull(); expect(unload()).toBe(true);
    await act(async () => hold.release()); await screen.findByText("Saved locally"); expect(unload()).toBe(false);
  });
  it("retains quota-failed evidence and offers explicit Retry Save", async () => {
    mount(); await setup(); await start(); await waitFor(async () => expect((await records())[0]?.number).toBe(1)); send();
    fake.commitError = "QuotaExceededError"; fireEvent.click(screen.getByRole("button", { name: "Stop Take" }));
    await screen.findByRole("button", { name: "Retry Save" }); expect(screen.getByText(/Browser storage is full/)).toBeTruthy(); expect(unload()).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retry Save" })); await screen.findByText("Saved locally");
    expect((await records()).map((t) => t.number)).toEqual([1]); expect(unload()).toBe(false);
  });
  it.each(["visibilitychange", "pagehide", "freeze"])("ends and saves a take on %s without automatic resumption", async (event) => {
    mount(); await setup(); await start(); send();
    act(() => { if (event === "visibilitychange") Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
      (event === "pagehide" ? window : document).dispatchEvent(new Event(event)); });
    await screen.findByText(/Interrupted.*captured prefix saved locally/); expect(screen.queryByRole("button", { name: "Stop Take" })).toBeNull();
    send([0x90, 64, 90]); await screen.findByText("No held notes");
    const take = await library.loadTake((await records())[0].takeId); expect(take.record.status).toBe("interrupted"); expect(take.record.committedEventWatermark).toBe(1);
    act(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" }); document.dispatchEvent(new Event("visibilitychange")); });
    expect(await records()).toHaveLength(1);
  });
  it("reports selected-source loss with no fallback to the other keyboard", async () => {
    const view = mount(); await setup(); await start(); send();
    act(() => midi.options?.onInputConnectionChange?.({ provenance: "input-availability", input: { id: "piano", name: "Room piano" }, state: "disconnected", receivedAtMs: performance.now() }));
    midi.inputs = [{ id: "other", name: "Other keys" }]; view.rerender(<MidiProvider><ImprovWorkspace library={library} onGuardChange={setGuard} /></MidiProvider>);
    await screen.findByText(/Interrupted.*captured prefix saved locally/); expect((screen.getByLabelText("Physical MIDI input") as HTMLSelectElement).value).toBe("piano");
    expect(screen.getByText("Selected input unavailable")).toBeTruthy(); expect((screen.getByRole("button", { name: "Start Take" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("interrupts on consumer replacement and fences subsequent competing events", async () => {
    function Competitor() { useAppMidiInput({ onNotePlayed: vi.fn() }); return <div>Competing consumer</div>; }
    const view = mount(); await setup(); await start(); send();
    view.rerender(<MidiProvider><ImprovWorkspace library={library} onGuardChange={setGuard} /><Competitor /></MidiProvider>);
    await screen.findByText(/Interrupted.*captured prefix saved locally/); send();
    const take = await library.loadTake((await records())[0].takeId); expect(take.record.capture.terminal?.reason).toBe("consumer-lost");
    expect(take.record.committedEventWatermark).toBe(1);
  });
  it("Strict Mode owns one MIDI lifecycle and allocates exactly one empty take", async () => {
    mount({ strict: true }); await setup(); await start(); await stop(); expect(await records()).toHaveLength(1); expect(midi.owners).toBe(1);
  });
  it("finalizes interruption and releases the MIDI owner on real unmount", async () => {
    const view = mount(); await setup(); await start(); send(); const id = (await records())[0].takeId; view.unmount();
    const reopened = new IndexedDbImprovLibrary({ factory: fake.factory });
    await waitFor(async () => expect((await reopened.loadTake(id)).record.status).toBe("interrupted")); expect(midi.owners).toBe(0); expect(unload()).toBe(false); reopened.close();
  });
  it("offers Stay or Stop/Save before in-app departure, and restores focus on Stay", async () => {
    mount(); await setup(); await start(); const stopButton = screen.getByRole("button", { name: "Stop Take" }); stopButton.focus(); const proceed = vi.fn();
    act(() => guard?.(proceed)); expect(screen.getByRole("dialog")).toBeTruthy(); expect(document.activeElement).toBe(screen.getByRole("button", { name: "Stay in Improv" }));
    fireEvent.click(screen.getByRole("button", { name: "Stay in Improv" })); expect(proceed).not.toHaveBeenCalled(); expect(document.activeElement).toBe(stopButton);
    act(() => guard?.(proceed)); fireEvent.click(screen.getByRole("button", { name: "Stop / Retry Save and Leave" }));
    await waitFor(() => expect(proceed).toHaveBeenCalledTimes(1)); expect((await library.loadTake((await records())[0].takeId)).record.status).toBe("completed");
  });
  it("requires explicit abandonment and does not bypass a failed departure save", async () => {
    mount(); await setup(); await start(); await waitFor(async () => expect((await records())[0]?.number).toBe(1)); const proceed = vi.fn();
    act(() => guard?.(proceed)); fake.commitError = "QuotaExceededError";
    fireEvent.click(screen.getByRole("button", { name: "Stop / Retry Save and Leave" })); await screen.findByText(/not safely saved yet/);
    expect(proceed).not.toHaveBeenCalled(); fireEvent.click(screen.getByRole("button", { name: "Leave Without Saving" })); expect(proceed).toHaveBeenCalledOnce();
  });
  it("opens a saved collection and keeps first identity after confirmed deletion and Take 2", async () => {
    mount(); await setup(); await start(); await stop(); fireEvent.click(screen.getByText(/Take history and library/));
    const first = (await records())[0]; vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Delete Take 1" })); expect((await records())[0].kind).toBe("take");
    vi.mocked(window.confirm).mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "Delete Take 1" }));
    await waitFor(async () => expect((await records())[0].kind).toBe("deleted-take"));
    await waitFor(() => expect((screen.getByRole("button", { name: "Start Take" }) as HTMLButtonElement).disabled).toBe(false)); await start(); await stop();
    expect((await records()).map((t) => t.number)).toEqual([1, 2]); expect((await library.listCollections())[0].firstTakeId).toBe(first.takeId);
    expect(screen.getByText(/Original first take.*deleted/)).toBeTruthy();
  });
  it("renames collection metadata and explicitly deletes the collection", async () => {
    mount(); await setup(); fireEvent.click(screen.getByText(/Take history and library/));
    fireEvent.change(screen.getByLabelText("Collection title"), { target: { value: "New title" } }); fireEvent.click(screen.getByRole("button", { name: "Rename collection" }));
    await screen.findByRole("heading", { name: "New title" }); vi.spyOn(window, "confirm").mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete collection" })); await waitFor(async () => expect(await library.listCollections()).toEqual([]));
    await screen.findByRole("button", { name: "Create collection" });
  });
  it("loads an incomplete recovered prefix and explains the unknown end", async () => {
    const f = await performanceFixture([{}], { mode: "incomplete" }); mount({ supplied: f.lib });
    await waitFor(() => expect(screen.getByRole("option", { name: "Disney book" })).toBeTruthy()); fireEvent.change(screen.getByLabelText("Piece"), { target: { value: "book" } });
    fireEvent.click(screen.getByText(/Take history and library/)); fireEvent.click(await screen.findByRole("button", { name: "Review Take 1" }));
    await screen.findByText(/Unknown end/); expect(screen.getByText(/incomplete/i, { selector: "p" })).toBeTruthy();
  });
  it("requests MIDI/JSON downloads and cleans temporary URLs without claiming completed downloads", async () => {
    mount(); await setup(); await start(); send(); await stop(); fireEvent.click(screen.getByRole("button", { name: "Download MIDI" }));
    const before = JSON.stringify(await records());
    const collection = (await library.listCollections())[0];
    const original = (await records())[0];
    const expectedMidi = improvMidiBlob(await library.loadTake(original.takeId)).blob;
    expect(createUrl).not.toHaveBeenCalled(); expect(screen.getByLabelText("Filename preview").textContent).toBe("disney_book_001.mid");
    fireEvent.change(screen.getByLabelText("Number"), { target: { value: "8" } });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await screen.findByText(/Download requested: .*generated cleanup/); expect(createUrl).toHaveBeenCalledOnce();
    expect(await (createUrl.mock.calls[0][0] as Blob).arrayBuffer()).toEqual(await expectedMidi.arrayBuffer());
    expect(JSON.stringify(await records())).toBe(before);
    fireEvent.click(screen.getByText("JSON backup and restore")); fireEvent.click(screen.getByRole("button", { name: "Download JSON backup" }));
    await screen.findByRole("dialog", { name: "Download file" });
    const expectedJson = encodeImprovBackup(await library.exportCollection(collection.collectionId));
    expect(screen.getByLabelText("Filename preview").textContent).toBe("disney_book_001.json");
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    await screen.findByText(/Download requested for committed/); expect(createUrl).toHaveBeenCalledTimes(2);
    expect(await (createUrl.mock.calls[1][0] as Blob).text()).toBe(expectedJson);
    expect(JSON.stringify(await records())).toBe(before);
    await waitFor(() => expect(revokeUrl).toHaveBeenCalledTimes(2), { timeout: 2000 });
    expect(document.querySelector('a[download]')).toBeNull();
  });
  it("native MIDI and backup saves preserve bytes and original Take 1 identity without anchor fallback", async () => {
    mount();await setup();await start();send();await stop();
    const before=JSON.stringify(await records()),collection=(await library.listCollections())[0],original=(await records())[0];
    const expectedMidi=improvMidiBlob(await library.loadTake(original.takeId)).blob;
    const expectedJson=encodeImprovBackup(await library.exportCollection(collection.collectionId));
    const directory={kind:"directory" as const,name:"Music",queryPermission:async()=>"granted" as const,requestPermission:async()=>"granted" as const};
    const write=vi.fn().mockResolvedValue(undefined);let filename="disney_book_001.mid";
    vi.stubGlobal("isSecureContext",true);vi.stubGlobal("showDirectoryPicker",vi.fn().mockResolvedValue(directory));
    vi.stubGlobal("showSaveFilePicker",vi.fn().mockImplementation(async()=>({name:filename,createWritable:async()=>({write,close:async()=>{},abort:async()=>{}})})));
    try { await act(async()=>{await exportPreferences.choose();});fireEvent.click(screen.getByRole("button",{name:"Download MIDI"}));
      fireEvent.click(await screen.findByRole("button",{name:"Save As…"}));await screen.findByText(/Saved: .*generated cleanup/);
      expect(await (write.mock.calls[0][0] as Blob).arrayBuffer()).toEqual(await expectedMidi.arrayBuffer());
      filename="disney_book_001.json";fireEvent.click(screen.getByText("JSON backup and restore"));fireEvent.click(screen.getByRole("button",{name:"Download JSON backup"}));
      await screen.findByRole("dialog",{name:"Download file"});fireEvent.click(await screen.findByRole("button",{name:"Save As…"}));
      await screen.findByText(/Saved for committed collection/);expect(await (write.mock.calls[1][0] as Blob).text()).toBe(expectedJson);
      expect(JSON.stringify(await records())).toBe(before);expect((await library.listCollections())[0].firstTakeId).toBe(original.takeId);expect(createUrl).not.toHaveBeenCalled();
    } finally { cleanup();await act(async()=>{await exportPreferences.forget();}); }
  });
  it("restores a JSON history into a new collection without replacing Take 1", async () => {
    const f = await performanceFixture([{}]); mount(); await setup(); await start(); await stop(); const before = (await library.listCollections())[0];
    fireEvent.click(screen.getByText("JSON backup and restore"));
    const file = new File(["backup"], "take.json", { type: "application/json" }); Object.defineProperty(file, "text", { value: async () => encodeImprovBackup(f.evidence) });
    fireEvent.change(screen.getByLabelText("Restore JSON backup"), { target: { files: [file] } }); await screen.findByText(/Backup restored as a separate collection/);
    const collections = await library.listCollections(); expect(collections).toHaveLength(2); expect(collections.find((c) => c.collectionId === before.collectionId)?.firstTakeId).toBe(before.firstTakeId);
    expect(screen.queryByText("Saved locally")).toBeNull(); expect(screen.getByText("No active take")).toBeTruthy();
    expect((screen.getByLabelText("Restore JSON backup") as HTMLInputElement).value).toBe(""); f.lib.close();
  });
  it.each(["not json", '{"format":"prelude-improv-backup","version":999,"evidenceKind":"original-midi-delivery","evidence":{}}'])("rejects corrupt/unsupported backups without partial mutation: %s", async (json) => {
    mount(); await setup(); fireEvent.click(screen.getByText("JSON backup and restore")); const file = new File([json], "bad.json");
    Object.defineProperty(file, "text", { value: async () => json }); fireEvent.change(screen.getByLabelText("Restore JSON backup"), { target: { files: [file] } });
    const alert = await screen.findByRole("alert"); expect(alert.textContent).toMatch(json === "not json" ? /invalid or corrupt/ : /not supported/);
    expect(await library.listCollections()).toHaveLength(1); expect(await records()).toEqual([]);
  });
  it("reports unavailable IndexedDB without enabling capture", async () => {
    const unavailable = new IndexedDbImprovLibrary(); mount({ supplied: unavailable }); await screen.findByText(/Local storage is unavailable/);
    expect((screen.getByRole("button", { name: "Start Take" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("reopens saved history using a new database handle", async () => {
    const view = mount(); await setup(); await start(); send(); await stop(); view.unmount();
    await act(async () => { await Promise.resolve(); });
    const reopened = new IndexedDbImprovLibrary({ factory: fake.factory }); mount({ supplied: reopened });
    await waitFor(() => expect(screen.getByRole("option", { name: "Disney book" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Piece"), { target: { value: (await reopened.listCollections())[0].collectionId } });
    fireEvent.click(screen.getByText(/Take history and library/)); fireEvent.click(await screen.findByRole("button", { name: "Review Take 1" }));
    await screen.findByRole("button", { name: "Replay take" }); expect((await reopened.listCollections())[0].nextTakeNumber).toBe(2);
  });
  it.each(["stop", "background", "freeze", "visibility", "review", "collection", "departure", "unmount"].flatMap(action =>
    ["whole take", "selected passage"].map(scope => ({ action, scope }))))("cancels $scope replay and releases voices on $action", async ({ action, scope }) => {
    const f = await performanceFixture([{}], { end: 30_000 });
    if (scope === "selected passage") insights.result = analyzeImprovTake(f.loaded);
    const view = mount({ supplied: f.lib });
    const evidence = encodeImprovBackup(await f.lib.exportCollection("book"));
    await waitFor(() => expect(screen.getByRole("option", { name: "Disney book" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Piece"), { target: { value: "book" } }); fireEvent.click(screen.getByText(/Take history and library/));
    fireEvent.click(await screen.findByRole("button", { name: "Review Take 1" }));
    if (scope === "selected passage") {
      fireEvent.click(await screen.findByRole("button", { name: /phrase 1/i })); expect(sound.start).not.toHaveBeenCalled();
      fireEvent.click(screen.getByRole("button", { name: "Replay selected passage" }));
    } else fireEvent.click(await screen.findByRole("button", { name: "Replay take" }));
    await waitFor(() => expect(sound.start).toHaveBeenCalledOnce()); expect(sound.start.mock.calls[0][0]).toMatchObject({ pitch: 60, velocity: 90 });
    expect((screen.getByRole("slider", { name: "Review time position" }) as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Start Take" }) as HTMLButtonElement).disabled).toBe(true);
    if (action === "stop") fireEvent.click(screen.getByRole("button", { name: "Stop Playback" }));
    if (action === "background") act(() => window.dispatchEvent(new Event("pagehide")));
    if (action === "freeze") act(() => document.dispatchEvent(new Event("freeze")));
    if (action === "visibility") act(() => { Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" }); document.dispatchEvent(new Event("visibilitychange")); });
    if (action === "review") fireEvent.click(screen.getByRole("button", { name: "Review Take 1" }));
    if (action === "collection") fireEvent.change(screen.getByLabelText("Piece"), { target: { value: "" } });
    if (action === "departure") { const proceed = vi.fn(); act(() => guard?.(proceed)); expect(proceed).toHaveBeenCalledOnce(); }
    if (action === "unmount") view.unmount();
    await waitFor(() => expect(sound.dispose).toHaveBeenCalledOnce()); expect(sound.stop).toHaveBeenCalledOnce();
    const reader = action === "unmount" ? new IndexedDbImprovLibrary({ factory: f.fake.factory }) : f.lib;
    expect(await reader.loadTake(f.loaded.record.takeId)).toEqual(f.loaded);
    expect(encodeImprovBackup(await reader.exportCollection("book"))).toBe(evidence);
    if (action === "unmount") reader.close();
    if (["stop", "background", "freeze", "visibility"].includes(action)) expect((screen.getByRole("slider", { name: "Review time position" }) as HTMLInputElement).disabled).toBe(false);
  });
  it("presents an audio failure instead of pretending replay succeeded", async () => {
    const f = await performanceFixture([{}], { end: 30_000 }); mount({ supplied: f.lib });
    await waitFor(() => expect(screen.getByRole("option", { name: "Disney book" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Piece"), { target: { value: "book" } }); fireEvent.click(screen.getByText(/Take history and library/));
    fireEvent.click(await screen.findByRole("button", { name: "Review Take 1" })); sound.fail = true;
    fireEvent.click(await screen.findByRole("button", { name: "Replay take" })); await screen.findByText(/Piano replay could not continue/);
    expect((screen.getByRole("button", { name: "Stop Playback" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("slider", { name: "Review time position" }) as HTMLInputElement).disabled).toBe(false);
  });
  it("refuses an oversized backup without reading it", async () => {
    mount(); await setup(); fireEvent.click(screen.getByText("JSON backup and restore")); const file = new File([], "huge.json");
    const read = vi.fn(); Object.defineProperties(file, { size: { value: 64 * 1024 * 1024 + 1 }, text: { value: read } });
    fireEvent.change(screen.getByLabelText("Restore JSON backup"), { target: { files: [file] } }); await screen.findByText(/exceeds the 64 MiB limit/); expect(read).not.toHaveBeenCalled();
  });
  it("reports stale collection edits without replacing evidence", async () => {
    mount(); await setup(); const item = (await library.listCollections())[0];
    await library.renameCollection(item.collectionId, "Changed in another tab", item.revision);
    fireEvent.click(screen.getByText(/Take history and library/)); fireEvent.click(screen.getByRole("button", { name: "Rename collection" }));
    await screen.findByText(/Another tab changed this item/); expect((await library.listCollections())[0].title).toBe("Changed in another tab");
  });
  it("keeps a high-frequency raw burst out of React commits while preserving every event", async () => {
    const commits = vi.fn(); render(<Profiler id="workspace" onRender={commits}><MidiProvider><ImprovWorkspace library={library} /></MidiProvider></Profiler>);
    await setup(); await start(); const before = commits.mock.calls.length;
    act(() => { for (let i = 0; i < 200; i++) midi.options?.onRawMessage?.({ provenance: "browser-midi-message", input: { id: "piano", name: "Room piano" },
      sequence: ++sequence, bytes: [0xb0, 64, i % 128], dataStatus: "available", sourceTimeStampMs: 100, receivedAtMs: 100 }); });
    expect(commits.mock.calls.length).toBe(before); await stop();
    expect((await library.loadTake((await records())[0].takeId)).record.committedEventWatermark).toBe(200);
  });
  it("does not recover a prefix still owned by a live capture", async () => {
    const f = await performanceFixture([{}], { mode: "recording" }); mount({ supplied: f.lib });
    await waitFor(() => expect(screen.getByRole("option", { name: "Disney book" })).toBeTruthy());
    fireEvent.change(screen.getByLabelText("Piece"), { target: { value: "book" } }); fireEvent.click(screen.getByText(/Take history and library/));
    fireEvent.click(await screen.findByRole("button", { name: "Recover saved prefix" })); await screen.findByText(/Another capture owns this take/);
    expect((await f.lib.loadTake("take-1")).record.status).toBe("recording");
  });
  it("announces the unsaved backlog limit and retains the full bounded prefix for Retry", async () => {
    mount(); await setup(); await start(); await waitFor(async () => expect((await records())[0]?.number).toBe(1));
    fake.commitError = "QuotaExceededError";
    act(() => { for (let i = 0; i < 2049; i++) midi.options?.onRawMessage?.({ provenance: "browser-midi-message", input: { id: "piano", name: "Room piano" },
      sequence: ++sequence, bytes: [0x90, 60, 90], dataStatus: "available", sourceTimeStampMs: 100, receivedAtMs: 100 }); });
    send([0x90, 64, 90]);
    await waitFor(() => expect(screen.getByText("No held notes")).toBeTruthy());
    await screen.findByText(/Capture ended at the unsaved-data limit/); fireEvent.click(await screen.findByRole("button", { name: "Retry Save" }));
    await screen.findByText(/Interrupted.*captured prefix saved locally/); const take = await library.loadTake((await records())[0].takeId);
    expect(take.record).toMatchObject({ committedEventWatermark: 2048, captureFailure: { reason: "unsaved-backlog-limit" } });
    expect(take.chunks.flatMap(c => c.events)).toHaveLength(2048);
  });
  it("explains unidentified inputs instead of inventing physical provenance", async () => {
    midi.inputs = [{ id: null, name: "Unidentified keys" }]; await library.createCollection("none", "Piece", "first-take-sight-reading"); mount();
    await screen.findByRole("option", { name: "Piece" }); fireEvent.change(screen.getByLabelText("Piece"), { target: { value: "none" } });
    await screen.findByRole("heading", { name: "Piece" });
    expect(screen.getByText(/no usable browser identity/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Start Take" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("option", { name: "Unidentified keys" })).toBeNull();
  });
});
