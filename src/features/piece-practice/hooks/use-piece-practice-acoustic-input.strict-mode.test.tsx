import { act, cleanup, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { StaffBuilderScore } from "@/features/staff-builder/staff-builder-types";
import { equalTemperedFrequency } from "@/lib/audio/monophonic/pitch-math";
import { PiecePracticeRecordingControls } from "../components/piece-practice-recording-controls";
import { projectStaffBuilderPieceForPractice } from "../piece-practice-projection";
import { createPiecePracticeSession, type PiecePracticeSessionState } from "../piece-practice-session";
import { usePiecePracticeAcousticInput } from "./use-piece-practice-acoustic-input";

const score: StaffBuilderScore = {
  schemaVersion: 4, id: "strict-recording", title: "Repeated E4", createdAt: "2026-10-09T12:00:00.000Z", updatedAt: "2026-10-09T12:00:00.000Z",
  initialKeySignatureId: "c-major", initialTimeSignature: "4/4", tempoBpm: 120, annotations: [], ties: [], measures: [{ id: "m", events: [
    ...[0, 1, 2].map((i) => ({ id: `e${i}`, kind: "notes" as const, staff: "treble" as const, startTick: i * 480,
      rhythm: { status: "final" as const, duration: "quarter" as const }, pitches: [{ id: `p${i}`, midiNumber: 64, letter: "E" as const, accidental: "natural" as const, octave: 4 }] })),
    { id: "r", kind: "rest", staff: "treble", startTick: 1440, rhythm: { status: "final", duration: "quarter" } },
    { id: "b", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
  ] }],
};

// Only browser APIs are faked: hook, capture, detector, onset grading and recorder controller are real.
function browserAudio() {
  const origin = Date.now();
  const signal = { hz: 0 };
  class Track extends EventTarget {
    readyState = "live";
    muted = false;
    stop = vi.fn(() => { this.readyState = "ended"; });
    added = vi.spyOn(this as EventTarget, "addEventListener");
    removed = vi.spyOn(this as EventTarget, "removeEventListener");
  }
  const streams: { stream: MediaStream; track: Track }[] = [];
  const getUserMedia = vi.fn(async () => {
    const track = new Track();
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
    streams.push({ stream, track });
    return stream;
  });
  const contexts: Context[] = [];
  class Context extends EventTarget {
    state = "running";
    sampleRate = 48000;
    added = vi.spyOn(this as EventTarget, "addEventListener");
    removed = vi.spyOn(this as EventTarget, "removeEventListener");
    disconnect = vi.fn();
    source = vi.fn((stream: MediaStream) => ({ stream, connect: vi.fn(), disconnect: this.disconnect }));
    constructor() { super(); contexts.push(this); }
    get currentTime() { return (Date.now() - origin) / 1000; }
    resume = vi.fn(async () => undefined);
    close = vi.fn(async () => { this.state = "closed"; });
    createMediaStreamSource(stream: MediaStream) { return this.source(stream); }
    createAnalyser() {
      return { disconnect: this.disconnect, getFloatTimeDomainData: (buffer: Float32Array) => {
        for (let i = 0; i < buffer.length; i += 1) buffer[i] = signal.hz ? 0.2 * Math.sin(2 * Math.PI * signal.hz * i / this.sampleRate) : 0;
      } };
    }
  }
  const recorders: Recorder[] = [];
  class Recorder {
    static isTypeSupported = () => true;
    state: RecordingState = "inactive";
    mimeType = "audio/webm;codecs=opus";
    onstart: (() => void) | null = null;
    onstop: (() => void) | null = null;
    ondataavailable: ((event: BlobEvent) => void) | null = null;
    onerror: (() => void) | null = null;
    constructor(readonly stream: MediaStream) { recorders.push(this); }
    start = vi.fn(() => { this.state = "recording"; });
    stop = vi.fn(() => { this.state = "inactive"; });
    chunk() { this.ondataavailable?.({ data: new Blob(["performance"], { type: this.mimeType }) } as BlobEvent); }
    finish() { this.chunk(); this.onstop?.(); }
  }
  const createURL = vi.fn(() => `blob:strict-${recorders.length}`);
  const revokeURL = vi.fn();
  vi.stubGlobal("isSecureContext", true);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal("AudioContext", Context);
  vi.stubGlobal("MediaRecorder", Recorder);
  vi.stubGlobal("URL", class extends URL {
    static createObjectURL = createURL;
    static revokeObjectURL = revokeURL;
  });
  return { now: () => Date.now() - origin, signal, streams, contexts, recorders, getUserMedia, createURL, revokeURL };
}

function mountRun(env: ReturnType<typeof browserAudio>, strict: boolean) {
  const projected = projectStaffBuilderPieceForPractice(score);
  if (!projected.ok) throw Error("Invalid fixture");
  const piece = projected.piece;
  const created = createPiecePracticeSession(piece, { startMeasureIndex: 0, startedAtMs: 0,
    inputConfiguration: { mode: "microphone", instrument: "ocarina", pitchToleranceCents: 25 } });
  if (!created.ok) throw Error("Invalid session");
  const initialState = created.state;
  let current!: { input: ReturnType<typeof usePiecePracticeAcousticInput>; state: PiecePracticeSessionState };
  function Owner({ runId }: { runId: string }) {
    const [state, setState] = useState(initialState);
    const input = usePiecePracticeAcousticInput({ piece, sessionState: state, onSessionStateChange: setState,
      available: true, now: env.now, runId });
    current = { input, state };
    return <PiecePracticeRecordingControls recording={input.recording} listening={input.status.state === "listening"} />;
  }
  const tree = (runId: string) => strict ? <StrictMode><Owner key={runId} runId={runId} /></StrictMode> : <Owner key={runId} runId={runId} />;
  const view = render(tree("run-one"));
  return { ...view, current: () => current, replace: () => view.rerender(tree("run-two")) };
}

beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe("recording with actual acoustic capture under React effect replay", () => {
  it.each([true, false])("records, grades once and finalizes normally with Strict Mode=%s", async (strict) => {
    const env = browserAudio();
    const added = vi.spyOn(document, "addEventListener");
    const removed = vi.spyOn(document, "removeEventListener");
    const windowAdded = vi.spyOn(window, "addEventListener");
    const windowRemoved = vi.spyOn(window, "removeEventListener");
    const s = mountRun(env, strict);
    expect(added.mock.calls.filter(([name]) => name === "freeze")).toHaveLength(strict ? 2 : 1);
    expect(removed.mock.calls.filter(([name]) => name === "freeze")).toHaveLength(strict ? 1 : 0);
    expect(env.getUserMedia).not.toHaveBeenCalled();
    expect(env.recorders).toHaveLength(0);
    expect(s.current().input.recording.enabled).toBe(false);
    expect(s.current().input.recording.hasUnsavedAudio()).toBe(false);

    await act(async () => { s.current().input.start(); });
    expect(s.current().input.status.state).toBe("listening");
    expect(env.getUserMedia).toHaveBeenCalledTimes(1);
    expect(env.recorders).toHaveLength(0);
    act(() => s.current().input.recording.setEnabled(true));
    expect(env.recorders).toHaveLength(1);
    const recorder = env.recorders[0];
    expect(recorder.stream).toBe(env.streams[0].stream);
    expect(env.contexts[0].source).toHaveBeenCalledWith(recorder.stream);
    expect(recorder.start).toHaveBeenCalledTimes(1);
    expect(s.current().input.recording.phase).toBe("starting");
    act(() => recorder.onstart?.());
    expect(s.current().input.recording.phase).toBe("recording");
    expect(s.current().input.recording.hasUnsavedAudio()).toBe(true);

    await act(async () => { await vi.advanceTimersByTimeAsync(150); });
    env.signal.hz = equalTemperedFrequency(64);
    await act(async () => { await vi.advanceTimersByTimeAsync(500); });
    expect(s.current().state.completedTargetCount).toBe(1);
    expect(s.current().state.acousticEvidence).toHaveLength(1);
    expect(env.recorders).toHaveLength(1);
    act(() => s.current().input.stop());
    expect(s.current().input.recording.phase).toBe("finalizing");
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(env.streams[0].track.stop).toHaveBeenCalledTimes(1);
    expect(env.streams[0].track.removed.mock.calls).toEqual(env.streams[0].track.added.mock.calls);
    expect(env.contexts[0].removed.mock.calls).toEqual(env.contexts[0].added.mock.calls);
    expect(s.current().input.recording.segments).toHaveLength(0);
    act(() => recorder.finish()); // Final chunk is asynchronous, after tracks have stopped.
    const segment = s.current().input.recording.segments[0];
    expect(segment).toMatchObject({ runId: "run-one", sequence: 1, mimeType: recorder.mimeType });
    expect(segment.blob.size).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Download segment 1", hidden: true }).getAttribute("href")).toBe(segment.url);
    expect(segment.filename).toMatch(/\.webm$/);
    expect(env.revokeURL).not.toHaveBeenCalled();
    s.unmount();
    expect(env.revokeURL).toHaveBeenCalledExactlyOnceWith(segment.url);
    expect(recorder.ondataavailable).toBeNull();
    expect(recorder.onstop).toBeNull();
    for (const name of ["freeze", "visibilitychange"]) {
      expect(removed.mock.calls.filter(([event]) => event === name)).toEqual(added.mock.calls.filter(([event]) => event === name));
    }
    expect(windowRemoved.mock.calls.filter(([name]) => name === "pagehide")).toEqual(windowAdded.mock.calls.filter(([name]) => name === "pagehide"));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("disposes the old run's finalized and active audio and ignores late callbacks after keyed replacement", async () => {
    const env = browserAudio();
    const s = mountRun(env, true);
    act(() => s.current().input.recording.setEnabled(true));
    await act(async () => { s.current().input.start(); });
    const first = env.recorders[0];
    act(() => first.onstart?.());
    act(() => s.current().input.stop());
    act(() => first.finish());
    const oldURL = s.current().input.recording.segments[0].url;
    await act(async () => { s.current().input.start(); });
    const second = env.recorders[1];
    act(() => second.onstart?.());
    const lateData = second.ondataavailable;
    const lateStop = second.onstop;
    const staleEnable = s.current().input.recording.setEnabled;
    s.replace();
    expect(env.revokeURL).toHaveBeenCalledExactlyOnceWith(oldURL);
    expect(second.stop).toHaveBeenCalledTimes(1);
    expect(second.ondataavailable).toBeNull();
    expect(second.onstop).toBeNull();
    expect(env.streams.every(({ track }) => track.stop.mock.calls.length === 1)).toBe(true);
    expect(s.current().input.recording).toMatchObject({ enabled: false, phase: "off", segments: [] });
    act(() => {
      lateData?.({ data: new Blob(["late"], { type: second.mimeType }) } as BlobEvent);
      lateStop?.();
      staleEnable(true);
    });
    expect(s.current().input.recording).toMatchObject({ enabled: false, phase: "off", segments: [] });
    expect(env.createURL).toHaveBeenCalledTimes(1);
    expect(env.getUserMedia).toHaveBeenCalledTimes(2);
    expect(env.recorders).toHaveLength(2);

    await act(async () => { s.current().input.start(); });
    expect(env.recorders).toHaveLength(2); // Replacement run still defaults Off.
    act(() => s.current().input.recording.setEnabled(true));
    expect(env.recorders).toHaveLength(3);
    expect(env.recorders[2].stream).toBe(env.streams[2].stream);
    act(() => env.recorders[2].onstart?.());
    expect(s.current().input.recording.phase).toBe("recording");
    s.unmount();
    expect(env.streams[2].track.stop).toHaveBeenCalledTimes(1);
    expect(env.recorders[2].stop).toHaveBeenCalledTimes(1);
    expect(env.recorders[2].onstop).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("disposes pending finalization on actual unmount without retaining late chunks or URLs", async () => {
    const env = browserAudio();
    const s = mountRun(env, true);
    act(() => s.current().input.recording.setEnabled(true));
    await act(async () => { s.current().input.start(); });
    const recorder = env.recorders[0];
    act(() => recorder.onstart?.());
    act(() => s.current().input.stop());
    expect(s.current().input.recording.phase).toBe("finalizing");
    act(() => recorder.chunk());
    const lateData = recorder.ondataavailable;
    const lateStop = recorder.onstop;
    s.unmount();
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(recorder.onstart).toBeNull();
    expect(recorder.ondataavailable).toBeNull();
    expect(recorder.onstop).toBeNull();
    expect(recorder.onerror).toBeNull();
    expect(s.current().input.recording.hasUnsavedAudio()).toBe(false);
    lateData?.({ data: new Blob(["late"], { type: recorder.mimeType }) } as BlobEvent);
    lateStop?.();
    expect(env.createURL).not.toHaveBeenCalled();
    expect(env.streams[0].track.stop).toHaveBeenCalledTimes(1);
    expect(env.contexts[0].state).toBe("closed");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("releases a late microphone grant for a replaced run without lending it to the new recorder", async () => {
    const env = browserAudio();
    const request = env.getUserMedia.getMockImplementation()!;
    let grant!: () => void;
    env.getUserMedia.mockImplementationOnce(async () => {
      const stream = await request();
      return new Promise<MediaStream>((resolve) => { grant = () => resolve(stream); });
    });
    const s = mountRun(env, true);
    act(() => s.current().input.recording.setEnabled(true));
    await act(async () => { s.current().input.start(); });
    expect(s.current().input.status.state).toBe("requesting");
    s.replace();
    await act(async () => { grant(); });
    expect(env.streams[0].track.stop).toHaveBeenCalledTimes(1);
    expect(env.contexts[0].state).toBe("closed");
    expect(env.recorders).toHaveLength(0);
    expect(s.current().input.recording).toMatchObject({ enabled: false, phase: "off", segments: [] });
    act(() => s.current().input.recording.setEnabled(true));
    await act(async () => { s.current().input.start(); });
    expect(env.getUserMedia).toHaveBeenCalledTimes(2);
    expect(env.recorders).toHaveLength(1);
    expect(env.recorders[0].stream).toBe(env.streams[1].stream);
    act(() => env.recorders[0].onstart?.());
    expect(s.current().input.recording.phase).toBe("recording");
    s.unmount();
    expect(env.streams[1].track.stop).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
