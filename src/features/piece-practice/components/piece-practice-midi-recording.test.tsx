import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/App";
import { MidiProvider } from "@/components/midi/midi-provider";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { APP_UPDATES } from "@/features/app-update/app-updates";
import { APP_UPDATE_STORAGE_KEY } from "@/features/app-update/app-update-storage";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { createPiecePracticeSession, pausePiecePracticeClock, resumePiecePracticeClock } from "../piece-practice-session";
import { type PiecePracticeRunRecordV2, type PiecePracticeRunStore } from "../persistence/piece-practice-runs";
import { createPiecePracticeRun } from "../persistence/piece-practice-runs";
import { usePiecePracticeKeyboardRecording } from "../hooks/use-piece-practice-keyboard-recording";
import { PiecePracticeSession } from "./piece-practice-session";

vi.mock("@/features/staff-builder/components/staff-builder-score-view", () => ({ StaffBuilderScoreView: () => <div>Authored score</div> }));
vi.mock("@/lib/audio/feedback", () => ({ playSuccessChirp: vi.fn(), playIncorrectFeedback: vi.fn() }));
vi.mock("@/features/freeplay/freeplay-session", () => ({ default: () => <p>Free Play test view</p> }));
vi.mock("@/features/staff-builder/components/staff-builder-session", () => ({
  default: ({ microphoneAvailable, onAudioGuardChange }: { microphoneAvailable: boolean; onAudioGuardChange: (guard: (() => boolean) | null) => void }) =>
    <PiecePracticeSession piece={piece} sourceScore={score} microphoneAvailable={microphoneAvailable} onAudioGuardChange={onAudioGuardChange} onExit={vi.fn()} runStore={memoryStore()} />,
}));

const note = (id: string, startTick: number, pitches: { midiNumber: number; letter: "C" | "E" | "G" | "A" }[]) => ({
  id, kind: "notes" as const, staff: "treble" as const, startTick, rhythm: { status: "final" as const, duration: "quarter" as const },
  pitches: pitches.map((p, i) => ({ ...p, id: `${id}-${i}`, octave: 4, accidental: "natural" as const })),
});
const score: StaffBuilderScore = { schemaVersion: 4, id: "piano-audio", title: "Piano recording study", createdAt: "2026-10-09T12:00:00.000Z", updatedAt: "2026-10-09T12:00:00.000Z",
  initialKeySignatureId: "c-major", initialTimeSignature: "4/4", tempoBpm: 120, annotations: [], ties: [],
  measures: [
    { id: "m1", events: [note("c1", 0, [{ midiNumber: 60, letter: "C" }]), note("c2", 480, [{ midiNumber: 60, letter: "C" }]),
      note("chord", 960, [{ midiNumber: 64, letter: "E" }, { midiNumber: 67, letter: "G" }]), note("a", 1440, [{ midiNumber: 69, letter: "A" }]),
      { id: "bass1", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } }] },
    { id: "m2", events: [note("last", 0, [{ midiNumber: 60, letter: "C" }]),
      { id: "bass2", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
      { id: "treble2", kind: "rest", staff: "treble", startTick: 480, rhythm: { status: "final", duration: "dotted-half" } }] },
  ] };
const projected = projectStaffBuilderPieceForPractice(score);
if (!projected.ok) throw Error(`Invalid test score: ${JSON.stringify(projected.issues)}`);
const piece = projected.piece;
function memoryStore(): PiecePracticeRunStore & { records: PiecePracticeRunRecordV2[] } {
  const records: PiecePracticeRunRecordV2[] = [];
  return { records, list: async () => [...records], save: async (record) => { records.push(record); }, discard: async () => undefined };
}
function browser() {
  const origin = Date.now();
  class Input extends EventTarget {
    name = "Physical test piano";
    send(bytes: number[]) {
      const event = new Event("midimessage");
      Object.defineProperties(event, { data: { value: Uint8Array.from(bytes) }, timeStamp: { value: Date.now() - origin } });
      this.dispatchEvent(event);
    }
  }
  const input = new Input();
  const access = Object.assign(new EventTarget(), { inputs: new Map([["piano", input]]) });
  const requestMIDIAccess = vi.fn(async () => access as unknown as MIDIAccess);
  const streams: { stream: MediaStream; track: Track }[] = [];
  const stopOrder: string[] = [];
  class Track extends EventTarget { readyState = "live"; muted = false; stop = vi.fn(() => { stopOrder.push("track-stop"); this.readyState = "ended"; }); }
  const getUserMedia = vi.fn(async () => {
    const track = new Track();
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
    streams.push({ stream, track }); return stream;
  });
  const recorders: Recorder[] = [];
  class Recorder {
    static isTypeSupported = () => true;
    state: RecordingState = "inactive"; mimeType = "audio/webm;codecs=opus";
    onstart: (() => void) | null = null; onstop: (() => void) | null = null; onerror: (() => void) | null = null;
    ondataavailable: ((event: BlobEvent) => void) | null = null;
    constructor(readonly stream: MediaStream) { recorders.push(this); }
    start = vi.fn(() => { this.state = "recording"; });
    stop = vi.fn(() => { stopOrder.push("recorder-stop"); this.state = "inactive"; });
    finish() { this.ondataavailable?.({ data: new Blob(["real room audio"], { type: this.mimeType }) } as BlobEvent); this.onstop?.(); }
  }
  const createURL = vi.fn(() => `blob:piano-${recorders.length}`), revokeURL = vi.fn();
  const AudioContext = vi.fn();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("navigator", { requestMIDIAccess, mediaDevices: { getUserMedia } });
  vi.stubGlobal("AudioContext", AudioContext);
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("URL", class extends URL { static createObjectURL = createURL; static revokeObjectURL = revokeURL; });
  return { input, requestMIDIAccess, getUserMedia, streams, recorders, createURL, revokeURL, AudioContext, stopOrder, now: () => Date.now() - origin };
}
async function mountPractice(env: ReturnType<typeof browser>, options: Partial<Parameters<typeof PiecePracticeSession>[0]> = {}, strict = true) {
  const store = memoryStore(), exit = vi.fn();
  const content = <MidiProvider><PiecePracticeSession piece={piece} sourceScore={score} onExit={exit} now={env.now} runStore={store} {...options} /></MidiProvider>;
  const view = render(strict ? <StrictMode>{content}</StrictMode> : content);
  if (!options.recoveredRun) fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Connect MIDI" })); });
  return { ...view, store, exit };
}
async function optIn(env: ReturnType<typeof browser>) {
  await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "Record performance audio" })); });
  const recorder = env.recorders.at(-1)!;
  expect(screen.getByText("Starting recording")).toBeTruthy();
  act(() => recorder.onstart?.());
  expect(screen.getByText("● Recording performance audio")).toBeTruthy();
  return recorder;
}
const tick = async (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
function send(env: ReturnType<typeof browser>, ...messages: number[][]) { act(() => messages.forEach((message) => env.input.send(message))); }
async function perform(env: ReturnType<typeof browser>) {
  send(env, [0xb0, 64, 127]);
  send(env, [0x90, 61, 80]); send(env, [0x80, 61, 32]); // Incorrect attack remains a MIDI mistake.
  send(env, [0x90, 60, 77]); send(env, [0x80, 60, 40]); await tick(10);
  send(env, [0x90, 60, 65]); send(env, [0x90, 60, 0]); await tick(10);
  send(env, [0x90, 64, 70], [0x90, 67, 82]); await tick(226);
  send(env, [0x80, 64, 30], [0x80, 67, 35]);
  send(env, [0x90, 69, 68]); send(env, [0x80, 69, 20]); await tick(10);
  send(env, [0xb0, 64, 0], [0x90, 60, 72]);
  await act(async () => undefined); // Complete-save chain.
  expect(screen.getByRole("heading", { name: "Piece complete" })).toBeTruthy();
}
beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  const update = APP_UPDATES.at(-1)!;
  localStorage.setItem(APP_UPDATE_STORAGE_KEY, JSON.stringify({ id: update.id, sequence: update.sequence }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("piano recording through real physical MIDI and Piece Practice owners", () => {
  it("records normally without Strict Mode and protects finalizing audio until an explicit Practice Again discard", async () => {
    const env = browser(); const s = await mountPractice(env, {}, false); const recorder = await optIn(env);
    const unload = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(unload); expect(unload.defaultPrevented).toBe(true);
    await perform(env);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(screen.getByText("Finalizing recording")).toBeTruthy(); expect(recorder.onstop).not.toBeNull();
    act(() => recorder.finish());
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(env.revokeURL).toHaveBeenCalledWith("blob:piano-1");
    expect((screen.getByRole("checkbox", { name: "Record performance audio" }) as HTMLInputElement).checked).toBe(false);
    expect(env.getUserMedia).toHaveBeenCalledTimes(1); expect(s.store.records.at(-1)!.checkpoint.completedTargetCount).toBe(0);
    s.unmount();
    const freshUnload = new Event("beforeunload", { cancelable: true }); window.dispatchEvent(freshUnload); expect(freshUnload.defaultPrevented).toBe(false);
  });

  it("recovers piano evidence paused with recording Off and no temporary audio or microphone permission", async () => {
    const env = browser(); const created = createPiecePracticeSession(piece, { startMeasureIndex: 0, startedAtMs: 0 });
    if (!created.ok) throw Error();
    const recoveredRun = createPiecePracticeRun(score, created.state, 0);
    await mountPractice(env, { recoveredRun });
    expect((screen.getByRole("checkbox", { name: "Record performance audio" }) as HTMLInputElement).checked).toBe(false);
    expect(screen.getByText("Performance Recordings (0)")).toBeTruthy();
    expect(env.getUserMedia).not.toHaveBeenCalled(); expect(env.recorders).toHaveLength(0);
  });

  it("keeps rolled-chord MIDI matching independent from room recording", async () => {
    const env = browser();
    const rolledScore: StaffBuilderScore = { ...score, measures: score.measures.map((m, i) => i ? m : { ...m,
      events: m.events.map((e) => e.id === "chord" ? { ...e, arpeggiation: "up" as const } : e) }) };
    const projectedRoll = projectStaffBuilderPieceForPractice(rolledScore); if (!projectedRoll.ok) throw Error();
    const s = await mountPractice(env, { piece: projectedRoll.piece, sourceScore: rolledScore }); await optIn(env);
    send(env, [0x90, 60, 70], [0x80, 60, 20]); await tick(10); send(env, [0x90, 60, 71], [0x80, 60, 21]);
    send(env, [0x90, 64, 72]); await tick(120); send(env, [0x90, 67, 73]); await tick(226);
    expect(s.store.records.at(-1)!.checkpoint.completedTargetCount).toBe(3);
    expect(s.store.records.at(-1)!.checkpoint.mistakeEvidence).toEqual([]);
    expect(env.getUserMedia).toHaveBeenCalledTimes(1);
  });

  it.each(["unsupported", "native-error"])("releases the recording microphone after %s while physical MIDI still progresses", async (failure) => {
    const env = browser();
    if (failure === "unsupported") vi.stubGlobal("MediaRecorder", undefined);
    const s = await mountPractice(env);
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "Record performance audio" })); });
    if (failure === "native-error") { act(() => env.recorders[0].onstart?.()); act(() => env.recorders[0].onerror?.()); act(() => env.recorders[0].finish()); }
    expect(env.streams[0].track.stop).toHaveBeenCalledTimes(1);
    send(env, [0x90, 60, 80], [0x80, 60, 22]);
    expect(s.store.records.at(-1)!.checkpoint.completedTargetCount).toBe(1);
    expect(s.store.records.at(-1)!.checkpoint.clockPaused).toBe(false);
    expect(s.store.records.at(-1)!.checkpoint.mistakeEvidence).toEqual([]);
  });
  it.each([false, true])("keeps note-on/off, repeated notes, chords, pedal, mistakes and persistence unchanged with recording=%s", async (enabled) => {
    const env = browser(); const s = await mountPractice(env);
    expect(env.getUserMedia).not.toHaveBeenCalled(); expect(env.recorders).toHaveLength(0);
    const recording = enabled ? await optIn(env) : null;
    if (recording) expect(recording.stream).toBe(env.streams[0].stream);
    await perform(env);
    const record = s.store.records.at(-1)!;
    expect(record.checkpoint).toMatchObject({ status: "piece-complete", completedTargetCount: 5, clockPaused: false });
    expect(record.checkpoint.mistakeEvidence).toHaveLength(1);
    expect(record.checkpoint.attackEvidence?.map(({ midiNumber }) => midiNumber)).toEqual([61, 60, 60, 64, 67, 69, 60]);
    expect(record.checkpoint.releaseEvidence?.map(({ encoding }) => encoding)).toEqual(["note-off", "note-off", "note-on-zero", "note-off", "note-off", "note-off"]);
    expect(record.checkpoint.acousticEvidence ?? []).toEqual([]);
    expect(env.AudioContext).not.toHaveBeenCalled();
    expect(env.requestMIDIAccess).toHaveBeenCalledTimes(1);
    if (recording) {
      expect(env.getUserMedia).toHaveBeenCalledTimes(1);
      expect(env.streams[0].track.stop).toHaveBeenCalledTimes(1);
      expect(env.stopOrder).toEqual(["recorder-stop", "track-stop"]);
      expect(screen.getByText("Finalizing recording")).toBeTruthy();
      act(() => recording.finish());
      fireEvent.click(screen.getByText("Performance Recordings (1)"));
      const download = screen.getByRole("link", { name: "Download segment 1" }) as HTMLAnchorElement;
      expect(download.download).toMatch(/^prelude-piano-.*segment-001\.webm$/);
      expect(download.href).toBe("blob:piano-1");
      expect(screen.getByLabelText("Play recording segment 1")).toBeTruthy();
      expect(screen.queryByText(/Analysis null/)).toBeNull();
      s.unmount(); expect(env.revokeURL).toHaveBeenCalledWith("blob:piano-1");
    } else { expect(env.getUserMedia).not.toHaveBeenCalled(); expect(env.recorders).toHaveLength(0); }
  });

  it("continues MIDI grading after denial, allows explicit retry, and keeps Restart Measure continuous", async () => {
    const env = browser(); const s = await mountPractice(env);
    env.getUserMedia.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "Record performance audio" })); });
    expect(screen.getByRole("button", { name: "Retry recording" })).toBeTruthy();
    send(env, [0x90, 60, 78], [0x80, 60, 35]);
    expect(s.store.records.at(-1)!.checkpoint.completedTargetCount).toBe(1);
    expect(s.store.records.at(-1)!.checkpoint.clockPaused).toBe(false);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Retry recording" })); });
    const recorder = env.recorders[0]; act(() => recorder.onstart?.());
    fireEvent.click(screen.getByRole("button", { name: "Restart Measure" }));
    expect(recorder.stop).not.toHaveBeenCalled(); expect(env.getUserMedia).toHaveBeenCalledTimes(2);
    send(env, [0x90, 60, 77], [0x80, 60, 30]);
    expect(s.store.records.at(-1)!.checkpoint.completedTargetCount).toBe(1);
  });

  it("interrupts only recording and resumes only by an explicit action, stopping old playback first", async () => {
    const env = browser(); const s = await mountPractice(env); const first = await optIn(env);
    env.streams[0].track.dispatchEvent(new Event("mute"));
    await act(async () => undefined);
    act(() => first.finish());
    expect(s.store.records.at(-1)!.checkpoint.clockPaused).toBe(false);
    expect(s.store.records.at(-1)!.checkpoint.mistakeEvidence).toEqual([]);
    send(env, [0x90, 60, 75], [0x80, 60, 40]);
    expect(s.store.records.at(-1)!.checkpoint.completedTargetCount).toBe(1);
    await tick(1500); expect(env.getUserMedia).toHaveBeenCalledTimes(1);
    const player = screen.getByLabelText("Play recording segment 1") as HTMLAudioElement;
    vi.spyOn(player, "paused", "get").mockReturnValue(false);
    const pause = vi.spyOn(player, "pause").mockImplementation(() => undefined);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Resume recording" })); });
    expect(pause).toHaveBeenCalledTimes(1);
    expect(env.getUserMedia).toHaveBeenCalledTimes(2);
    expect(env.recorders[1].stream).toBe(env.streams[1].stream);
    act(() => env.recorders[1].onstart?.());
    expect(screen.queryByLabelText("Play recording segment 1")).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "Record performance audio" })); });
    act(() => env.recorders[1].finish());
    expect(screen.getByText("Performance Recordings (2)")).toBeTruthy();
  });

  it.each(["Restart Piece", "Exit Piece Practice"])("guards %s before destroying active recording and preserves MIDI on Cancel", async (action) => {
    const env = browser(); const s = await mountPractice(env); const recorder = await optIn(env);
    const confirm = vi.spyOn(window, "confirm").mockImplementation((message) => !message?.includes("Discard this audio"));
    const run = s.store.records.at(-1)!.runId;
    fireEvent.click(screen.getByRole("button", { name: action }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("Discard this audio"));
    expect(s.store.records.at(-1)!.runId).toBe(run);
    expect(recorder.stop).not.toHaveBeenCalled();
    send(env, [0x90, 60, 74], [0x80, 60, 24]);
    expect(s.store.records.at(-1)!.checkpoint.completedTargetCount).toBe(1);
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: action }));
    if (action === "Restart Piece") {
      expect(s.store.records.at(-1)!.runId).not.toBe(run);
      expect((screen.getByRole("checkbox", { name: "Record performance audio" }) as HTMLInputElement).checked).toBe(false);
      expect(recorder.onstop).toBeNull(); expect(env.streams[0].track.stop).toHaveBeenCalledTimes(1);
      expect(env.requestMIDIAccess).toHaveBeenCalledTimes(1);
    } else { expect(s.exit).toHaveBeenCalledTimes(1); s.unmount(); }
  });

  it("guards Practice Again and Targeted Practice entry/return, retaining completed comparisons and download URLs on Cancel", async () => {
    const env = browser(); const s = await mountPractice(env); const first = await optIn(env);
    await perform(env); act(() => first.finish());
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Practice Again" }));
    expect(screen.getByText("Performance Recordings (1)")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Practice measure 1" }));
    expect(screen.queryByRole("button", { name: "Return to Targeted Practice" })).toBeNull();
    expect(env.revokeURL).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "Practice measure 1" }));
    expect(env.revokeURL).toHaveBeenCalledWith("blob:piano-1");
    expect((screen.getByRole("checkbox", { name: "Record performance audio" }) as HTMLInputElement).checked).toBe(false);
    const focused = await optIn(env);
    confirm.mockImplementation((message) => !message?.includes("Discard this audio"));
    fireEvent.click(screen.getByRole("button", { name: "Return to Targeted Practice" }));
    expect(focused.stop).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Return to Targeted Practice" })).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole("checkbox", { name: "Record performance audio" })); });
    fireEvent.click(screen.getByRole("button", { name: "Return to Targeted Practice" }));
    expect(screen.getByText("Finalizing recording")).toBeTruthy();
    expect(focused.onstop).not.toBeNull();
    act(() => focused.finish());
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByRole("button", { name: "Skip Target" }));
    await act(async () => undefined);
    confirm.mockReturnValue(false); fireEvent.click(screen.getByRole("button", { name: "Return to Targeted Practice" }));
    expect(screen.getByText("Performance Recordings (1)")).toBeTruthy();
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "Return to Targeted Practice" }));
    expect(env.revokeURL).toHaveBeenCalledWith("blob:piano-2");
    expect(screen.getByRole("region", { name: "Measure 1 practice comparison" })).toBeTruthy();
    expect(env.requestMIDIAccess).toHaveBeenCalledTimes(1);
    expect(s.store.records.filter((r) => r.status === "completed").length).toBeGreaterThanOrEqual(2);
  });

  it("uses the actual App mode guard for piano recording Cancel and Discard", async () => {
    const env = browser(); render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Staff Builder" }));
    fireEvent.click(screen.getByRole("button", { name: "Start Practice" }));
    const recording = await optIn(env);
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    fireEvent.click(screen.getByRole("button", { name: "Free Play" }));
    expect(screen.getByText("● Recording performance audio")).toBeTruthy();
    expect(recording.stop).not.toHaveBeenCalled();
    confirm.mockReturnValue(true); fireEvent.click(screen.getByRole("button", { name: "Free Play" }));
    expect(screen.getByText("Free Play test view")).toBeTruthy();
    expect(recording.stop).toHaveBeenCalledTimes(1);
    expect(env.streams[0].track.stop).toHaveBeenCalledTimes(1);
    expect(recording.onstop).toBeNull();
  });

  it("offers microphone recording to VKB without producing synthesized or physical MIDI evidence", async () => {
    const env = browser(); const s = await mountPractice(env); await optIn(env);
    fireEvent.click(screen.getByRole("button", { name: /MIDI 60/ }));
    expect(s.store.records.at(-1)!.checkpoint.completedTargetCount).toBe(1);
    expect(s.store.records.at(-1)!.checkpoint.attackEvidence ?? []).toEqual([]);
    expect(env.AudioContext).not.toHaveBeenCalled();
    expect(screen.getByText(/Virtual keys do not synthesize recorded audio/)).toBeTruthy();
  });
});

describe("keyboard recording hook lifecycle", () => {
  function setup(env: ReturnType<typeof browser>) {
    const created = createPiecePracticeSession(piece, { startMeasureIndex: 0, startedAtMs: 0 });
    if (!created.ok) throw Error();
    const initial = created.state;
    const view = renderHook(({ state, runId }) => usePiecePracticeKeyboardRecording({ runId, sessionState: state, now: env.now, available: true }),
      { initialProps: { state: initial, runId: "one" }, wrapper: StrictMode });
    return { ...view, initial };
  }
  it("finalizes on practice pause and waits for explicit resume after the clock resumes", async () => {
    const env = browser(); const s = setup(env);
    await act(async () => { s.result.current.recording.setEnabled(true); });
    act(() => env.recorders[0].onstart?.());
    s.rerender({ state: pausePiecePracticeClock(s.initial, env.now()), runId: "one" });
    expect(env.streams[0].track.stop).toHaveBeenCalledTimes(1);
    expect(s.result.current.recording.phase).toBe("finalizing");
    act(() => env.recorders[0].finish());
    s.rerender({ state: resumePiecePracticeClock(pausePiecePracticeClock(s.initial, env.now()), env.now()), runId: "one" });
    expect(env.getUserMedia).toHaveBeenCalledTimes(1);
    await act(async () => { s.result.current.resume(); });
    expect(env.getUserMedia).toHaveBeenCalledTimes(2);
    expect(env.recorders).toHaveLength(2);
  });
  it("releases late grants after run replacement and resets opt-in without stale output", async () => {
    const timers = vi.spyOn(globalThis, "setTimeout"), cleared = vi.spyOn(globalThis, "clearTimeout");
    const intervals = vi.spyOn(globalThis, "setInterval"), clearedIntervals = vi.spyOn(globalThis, "clearInterval");
    const env = browser(); let grant!: (stream: MediaStream) => void;
    const request = env.getUserMedia.getMockImplementation()!;
    env.getUserMedia.mockImplementationOnce(async () => { await request(); return new Promise<MediaStream>((resolve) => { grant = resolve; }); });
    const s = setup(env);
    await act(async () => { s.result.current.recording.setEnabled(true); });
    expect(env.getUserMedia).toHaveBeenCalledTimes(1);
    s.rerender({ state: s.initial, runId: "two" });
    await act(async () => { grant(env.streams[0].stream); });
    expect(env.streams[0].track.stop).toHaveBeenCalledTimes(1);
    expect(env.recorders).toHaveLength(0);
    expect(s.result.current.recording).toMatchObject({ enabled: false, phase: "off", segments: [] });
    await act(async () => { s.result.current.recording.setEnabled(true); });
    const recorder = env.recorders[0]; act(() => recorder.onstart?.());
    const staleData = recorder.ondataavailable, staleStop = recorder.onstop;
    s.unmount();
    expect(env.streams[1].track.stop).toHaveBeenCalledTimes(1);
    staleData?.({ data: new Blob(["late"], { type: recorder.mimeType }) } as BlobEvent); staleStop?.();
    expect(env.createURL).not.toHaveBeenCalled();
    // React's scheduler can retain its own task; verify the owner's actual handles.
    for (const { value } of timers.mock.results) expect(cleared).toHaveBeenCalledWith(value);
    for (const { value } of intervals.mock.results) expect(clearedIntervals).toHaveBeenCalledWith(value);
  });
  it("releases capture when the shared recorder hits its existing byte budget", async () => {
    const env = browser(); const s = setup(env);
    await act(async () => { s.result.current.recording.setEnabled(true); });
    const recorder = env.recorders[0]; act(() => recorder.onstart?.());
    act(() => recorder.ondataavailable?.({ data: new Blob([new Uint8Array(14 * 1024 * 1024)], { type: recorder.mimeType }) } as BlobEvent));
    expect(env.streams[0].track.stop).toHaveBeenCalledTimes(1);
    expect(s.result.current.recording.limitReached).toBe(true);
    act(() => recorder.finish());
    await act(async () => { s.result.current.resume(); });
    expect(env.getUserMedia).toHaveBeenCalledTimes(1);
    expect(s.result.current.recording.segments).toHaveLength(1);
  });
});
