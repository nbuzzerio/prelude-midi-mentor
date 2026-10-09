import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPiecePracticeRecordingCapture } from "./piece-practice-recording-capture";
import type { CaptureStatus, CaptureStreamLease } from "@/lib/audio/monophonic/microphone-capture";

function microphone() {
  class Track extends EventTarget {
    readyState = "live"; muted = false;
    stop = vi.fn(() => { this.readyState = "ended"; });
  }
  const track = new Track();
  return { track, stream: { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream };
}
const disposals: (() => void)[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(() => { disposals.splice(0).forEach((dispose) => dispose()); vi.restoreAllMocks(); vi.useRealTimers(); });
function setup(request?: () => Promise<MediaStream>) {
  const mic = microphone();
  const getUserMedia = vi.fn(request ?? (async () => mic.stream));
  const statuses: CaptureStatus[] = [], events: { kind: string; lease: CaptureStreamLease; live: boolean }[] = [];
  let allowed = true;
  const capture = createPiecePracticeRecordingCapture({ secure: true, mediaDevices: { getUserMedia }, eligible: () => allowed,
    onStatus: (value) => statuses.push(value),
    onStreamReady: (lease) => events.push({ kind: "ready", lease, live: mic.track.readyState === "live" }),
    onStreamEnding: (lease) => events.push({ kind: "ending", lease, live: mic.track.readyState === "live" }) });
  disposals.push(capture.dispose);
  return { ...mic, getUserMedia, statuses, events, capture, disallow: () => { allowed = false; } };
}

describe("recording-only microphone owner", () => {
  it("is inert until explicit start, acquires once, and signals ending before its own tracks stop", async () => {
    const s = setup();
    expect(s.getUserMedia).not.toHaveBeenCalled();
    const add = vi.spyOn(s.track, "addEventListener"), remove = vi.spyOn(s.track, "removeEventListener");
    const starting = s.capture.start();
    await s.capture.start(); await starting;
    expect(s.getUserMedia).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ video: false, audio: expect.any(Object) }));
    expect(s.events).toHaveLength(1);
    expect(s.events[0].lease.stream).toBe(s.stream);
    s.capture.stop(); s.capture.stop();
    expect(s.events.map(({ kind, live }) => [kind, live])).toEqual([["ready", true], ["ending", true]]);
    expect(s.track.stop).toHaveBeenCalledTimes(1);
    expect(remove.mock.calls).toEqual(add.mock.calls);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["stop", "dispose", "timeout"] as const)("releases a permission grant arriving after %s without delivering it", async (ending) => {
    let grant!: (stream: MediaStream) => void;
    const s = setup(() => new Promise((resolve) => { grant = resolve; }));
    const starting = s.capture.start();
    if (ending === "timeout") await vi.advanceTimersByTimeAsync(30_001);
    else if (ending === "dispose") s.capture.dispose(); else s.capture.stop();
    grant(s.stream); await starting;
    expect(s.track.stop).toHaveBeenCalledTimes(1);
    expect(s.events).toEqual([]);
    expect(s.capture.active()).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
  it.each(["mute", "ended", "freeze", "pagehide"])("stops on %s and never reacquires silently", async (event) => {
    const s = setup(); await s.capture.start();
    (event === "freeze" ? document : event === "pagehide" ? window : s.track).dispatchEvent(new Event(event));
    expect(s.statuses.at(-1)?.state).toBe("paused");
    expect(s.track.stop).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5000);
    expect(s.getUserMedia).toHaveBeenCalledTimes(1);
    expect(s.events.map(({ kind }) => kind)).toEqual(["ready", "ending"]);
  });
  it("reports denial and permits an explicit retry with a new generation", async () => {
    const s = setup();
    s.getUserMedia.mockRejectedValueOnce(new DOMException("Denied", "NotAllowedError"));
    await s.capture.start();
    expect(s.statuses.at(-1)?.state).toBe("denied");
    expect(s.capture.active()).toBe(false);
    await s.capture.start();
    expect(s.getUserMedia).toHaveBeenCalledTimes(2);
    expect(s.events[0].lease.generation).toBeGreaterThan(1);
  });
  it("does not acquire while ineligible and releases a grant if eligibility changes", async () => {
    let grant!: (stream: MediaStream) => void;
    const s = setup(() => new Promise((resolve) => { grant = resolve; }));
    const starting = s.capture.start(); s.disallow(); grant(s.stream); await starting;
    expect(s.track.stop).toHaveBeenCalledTimes(1);
    expect(s.events).toEqual([]);
    await s.capture.start(); expect(s.getUserMedia).toHaveBeenCalledTimes(1);
  });
  it("isolates stream-observer exceptions from track cleanup", async () => {
    const mic = microphone();
    const capture = createPiecePracticeRecordingCapture({ secure: true, mediaDevices: { getUserMedia: async () => mic.stream }, eligible: () => true,
      onStatus: vi.fn(), onStreamReady: () => { throw Error("recorder"); }, onStreamEnding: () => { throw Error("recorder"); } });
    await capture.start(); capture.dispose();
    expect(mic.track.stop).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
});
