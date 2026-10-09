import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPiecePracticeRecording, recordingExtension } from "./piece-practice-recording";

class FakeRecorder {
  static instances: FakeRecorder[] = [];
  static supported = new Set(["audio/webm;codecs=opus"]);
  static isTypeSupported = (mime: string) => FakeRecorder.supported.has(mime);
  state: RecordingState = "inactive";
  mimeType: string;
  onstart: (() => void) | null = null;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onstop: (() => void) | null = null;
  onerror: (() => void) | null = null;
  stop = vi.fn(() => { this.state = "inactive"; });
  constructor(readonly stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? "audio/webm;codecs=opus";
    FakeRecorder.instances.push(this);
  }
  start() { this.state = "recording"; }
  emitStart() { this.onstart?.(); }
  emitData(data: Blob) { this.ondataavailable?.({ data } as BlobEvent); }
  emitStop() { this.state = "inactive"; this.onstop?.(); }
}

const stream = { getAudioTracks: () => [], getTracks: () => [] } as unknown as MediaStream;
let time = 1000;
const createURL = vi.fn(() => `blob:test-${createURL.mock.calls.length}`);
const revokeURL = vi.fn();
const make = () => createPiecePracticeRecording({
  runId: "run-123456789", instrument: "violin", analysisSessionId: "analysis-1", originMs: 500,
  now: () => time, wallNow: () => new Date("2026-10-09T14:30:00.000Z"),
  Recorder: FakeRecorder as unknown as typeof MediaRecorder,
  createObjectURL: createURL, revokeObjectURL: revokeURL,
});
const lease = (generation = 1) => ({ stream, generation, atMs: time });
const chunk = (size = 12) => new Blob([new Uint8Array(size)], { type: "audio/webm" });
function start(controller: ReturnType<typeof make>, generation = 1) {
  controller.setEligible(true); controller.setEnabled(true); controller.onStreamReady(lease(generation));
  const recorder = FakeRecorder.instances.at(-1)!;
  expect(recorder.stream).toBe(stream);
  expect(controller.snapshot().phase).toBe("starting");
  recorder.emitStart();
  return recorder;
}
beforeEach(() => { vi.useFakeTimers(); FakeRecorder.instances = []; FakeRecorder.supported = new Set(["audio/webm;codecs=opus"]); time = 1000; createURL.mockClear(); revokeURL.mockClear(); });
afterEach(() => vi.useRealTimers());

describe("local performance recording", () => {
  it("keeps piano room-audio identity without fabricating acoustic analysis", () => {
    const controller = createPiecePracticeRecording({ runId: "piano-run", instrument: "piano", analysisSessionId: null,
      originMs: 500, now: () => time, Recorder: FakeRecorder as unknown as typeof MediaRecorder,
      createObjectURL: createURL, revokeObjectURL: revokeURL });
    const recorder = start(controller); time += 100; controller.onStreamEnding(lease()); recorder.emitData(chunk()); recorder.emitStop();
    expect(controller.snapshot().segments[0]).toMatchObject({ source: "room-microphone", analysisSessionId: null,
      runId: "piano-run", captureGeneration: 1, startedAtMs: 500, endedAtMs: 600, durationMs: 100 });
    expect(controller.snapshot().segments[0].filename).toMatch(/^prelude-piano-.*\.webm$/);
    controller.dispose();
  });
  it("defaults Off and borrows the exact stream only after eligibility", () => {
    const controller = make();
    controller.onStreamReady(lease());
    controller.setEligible(true);
    expect(FakeRecorder.instances).toHaveLength(0);
    controller.setEligible(false); // violin calibration
    controller.setEnabled(true);
    expect(controller.snapshot().phase).toBe("armed");
    expect(FakeRecorder.instances).toHaveLength(0);
    controller.setEligible(true);
    expect(FakeRecorder.instances).toHaveLength(1);
    expect(FakeRecorder.instances[0].stream).toBe(stream);
    controller.dispose();
  });

  it("does not announce active recording until start fires; disabling finalizes after the last chunk", () => {
    const controller = make(), recorder = start(controller);
    expect(controller.snapshot().phase).toBe("recording");
    time += 1800;
    controller.setEnabled(false);
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    expect(controller.snapshot().phase).toBe("finalizing");
    controller.setEnabled(false);
    controller.onStreamEnding(lease());
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    recorder.emitData(chunk());
    recorder.emitStop();
    const result = controller.snapshot();
    expect(result.phase).toBe("off");
    expect(result.segments).toHaveLength(1);
    expect(result.segments[0]).toMatchObject({ runId: "run-123456789", analysisSessionId: "analysis-1", captureGeneration: 1, durationMs: 1800, mimeType: "audio/webm;codecs=opus" });
    expect(result.segments[0].filename).toMatch(/segment-001\.webm$/);
    expect(controller.hasUnsavedAudio()).toBe(true);
    controller.dispose();
    expect(revokeURL).toHaveBeenCalledWith(result.segments[0].url);
    expect(controller.hasUnsavedAudio()).toBe(false);
  });

  it("keeps separate playable segments through interruption and a later capture generation", () => {
    const controller = make(), first = start(controller);
    first.emitData(chunk());
    controller.onStreamEnding(lease());
    controller.onStreamReady(lease(2));
    expect(controller.snapshot().phase).toBe("finalizing");
    expect(FakeRecorder.instances).toHaveLength(1);
    first.emitData(chunk()); first.emitStop();
    expect(FakeRecorder.instances).toHaveLength(2);
    const second = FakeRecorder.instances[1]; second.emitStart();
    second.emitData(chunk(6)); controller.onStreamEnding(lease(2)); second.emitStop();
    expect(controller.snapshot().segments.map((segment) => [segment.sequence, segment.captureGeneration, segment.size])).toEqual([[1, 1, 24], [2, 2, 6]]);
    first.emitData(chunk(99)); first.emitStop();
    expect(controller.snapshot().segments).toHaveLength(2);
    controller.dispose();
  });

  it("negotiates native containers and names output from the actual format", () => {
    FakeRecorder.supported = new Set(["audio/mp4;codecs=mp4a.40.2"]);
    const controller = make(), recorder = start(controller);
    recorder.mimeType = "audio/mp4;codecs=mp4a.40.2";
    recorder.emitData(new Blob(["a"], { type: "audio/mp4" }));
    controller.setEnabled(false); recorder.emitStop();
    expect(controller.snapshot().segments[0].filename).toMatch(/\.m4a$/);
    expect(recordingExtension("audio/ogg;codecs=opus")).toBe("ogg");
    expect(recordingExtension("audio/mpeg")).toBeNull();
    controller.dispose();
  });

  it("refuses conflicting output format without mislabeling the file", () => {
    const controller = make(), recorder = start(controller);
    recorder.emitData(new Blob(["a"], { type: "audio/ogg" }));
    controller.setEnabled(false); recorder.emitStop();
    expect(controller.snapshot().phase).toBe("error");
    expect(controller.snapshot().segments).toHaveLength(0);
    controller.dispose();
  });

  it("stops on the byte threshold, preserves final overshoot, and never auto-restarts", () => {
    const controller = make(), recorder = start(controller);
    recorder.emitData(chunk(14 * 1024 * 1024));
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    recorder.emitData(chunk(3 * 1024 * 1024)); recorder.emitStop();
    expect(controller.snapshot().phase).toBe("limited");
    expect(controller.snapshot().message).toContain("exceeded the soft 16 MiB budget");
    expect(controller.snapshot().segments[0].size).toBe(17 * 1024 * 1024);
    controller.setEnabled(false);
    expect(controller.snapshot().phase).toBe("limited");
    controller.onStreamReady(lease(2));
    expect(FakeRecorder.instances).toHaveLength(1);
    controller.dispose();
  });

  it("stops at the cumulative time limit independently of chunk delivery", () => {
    const controller = make(), recorder = start(controller);
    time += 20 * 60 * 1000;
    vi.advanceTimersByTime(1000);
    expect(recorder.stop).toHaveBeenCalledTimes(1);
    recorder.emitData(chunk()); recorder.emitStop();
    expect(controller.snapshot().phase).toBe("limited");
    controller.dispose();
  });

  it("bounds a stalled finalization and prevents stale callbacks after disposal", () => {
    const controller = make(), recorder = start(controller);
    controller.onStreamEnding(lease());
    vi.advanceTimersByTime(10_000);
    expect(controller.snapshot().phase).toBe("error");
    recorder.emitData(chunk()); recorder.emitStop();
    expect(controller.snapshot().segments).toHaveLength(0);
    controller.dispose();
    expect(recorder.onstop).toBeNull();
  });

  it("reports unsupported native formats once while practice remains eligible", () => {
    class UnsupportedRecorder { static isTypeSupported = () => false; constructor() { throw Error("unsupported"); } }
    const changes = vi.fn();
    const controller = createPiecePracticeRecording({ runId: "run", instrument: "ocarina", analysisSessionId: "analysis", originMs: 0,
      now: () => time, Recorder: UnsupportedRecorder as unknown as typeof MediaRecorder, onChange: changes });
    controller.setEnabled(true); controller.setEligible(true); controller.onStreamReady(lease());
    expect(controller.snapshot().phase).toBe("unsupported");
    const count = changes.mock.calls.length;
    controller.setEligible(true);
    expect(changes).toHaveBeenCalledTimes(count);
    controller.dispose();
  });
});
