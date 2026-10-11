import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createImprovRoomAudio } from "./improv-room-audio";
import { fixtureContext } from "./improv-test-fixture";

class Recorder {
  static instances: Recorder[] = []; static mime = "audio/webm;codecs=opus"; static throws = false;
  static isTypeSupported(mime: string) { return mime === Recorder.mime; }
  state: RecordingState = "inactive"; mimeType = Recorder.mime;
  onstart: ((e: Event) => void) | null = null; onstop: ((e: Event) => void) | null = null;
  onerror: ((e: Event) => void) | null = null; ondataavailable: ((e: BlobEvent) => void) | null = null;
  onpause: ((e: Event) => void) | null = null; onresume: ((e: Event) => void) | null = null;
  pause = vi.fn(() => { this.state = "paused"; }); resume = vi.fn(() => { this.state = "recording"; });
  paused() { this.onpause?.(new Event("pause")); } resumed() { this.onresume?.(new Event("resume")); }
  constructor() { if (Recorder.throws) throw new Error("unsupported"); Recorder.instances.push(this); }
  start() { this.state = "recording"; } stop = vi.fn(() => { this.state = "inactive"; });
  started() { this.onstart?.(new Event("start")); }
  data(size = 10) { this.ondataavailable?.({ data: new Blob([new Uint8Array(size)], { type: Recorder.mime }) } as BlobEvent); }
  ended() { this.state = "inactive"; this.onstop?.(new Event("stop")); }
}
const owned: ReturnType<typeof createImprovRoomAudio>[] = [];
function fixture(getUserMedia?: MediaDevices["getUserMedia"]) {
  const track = Object.assign(new EventTarget(), { readyState: "live", muted: false, stop: vi.fn() });
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  let time = 100; let eligible = true; const revoke = vi.fn(); const request = getUserMedia ?? vi.fn(async () => stream);
  const controller = createImprovRoomAudio({ eligible: () => eligible, now: () => time, secure: true,
    mediaDevices: { getUserMedia: request }, Recorder: Recorder as unknown as typeof MediaRecorder,
    createObjectURL: () => "blob:preview", revokeObjectURL: revoke }); owned.push(controller);
  const begin = vi.fn(() => ({ takeId: "take-1", observation: { atMs: time, context: fixtureContext } }));
  const start = async () => { await controller.prepare(); const pending = controller.start(begin); time += 5; Recorder.instances.at(-1)!.started(); await pending; return Recorder.instances.at(-1)!; };
  return { controller, track, stream, request, begin, start, revoke, setTime: (n: number) => { time = n; }, unavailable: () => { eligible = false; } };
}
beforeEach(() => { vi.useFakeTimers(); Recorder.instances = []; Recorder.mime = "audio/webm;codecs=opus"; Recorder.throws = false; });
afterEach(() => { owned.splice(0).forEach(c => c.dispose()); vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("temporary Improv room audio", () => {
  it("does not claim MIDI continues when a late recorder error follows the observed terminal", async () => {
    const f = fixture(); const r = await f.start(); r.data();
    f.controller.observeTerminal({ atMs: 300, context: fixtureContext }); r.onerror?.(new Event("error")); r.ended();
    expect(f.controller.snapshot().segment?.size).toBe(10); expect(f.controller.snapshot().message).not.toContain("MIDI continues");
    expect(f.controller.snapshot().message).toContain("MIDI save and audio finalization remain separate");
  });
  it("keeps the existing 20-minute wall-span limit inclusive of a long native pause", async () => {
    const f = fixture(); const r = await f.start(); r.data(); const p = f.controller.pause(); r.paused(); await p;
    f.setTime(21 * 60 * 1000); vi.advanceTimersByTime(1000); r.ended();
    expect(f.controller.snapshot().phase).toBe("available"); expect(f.controller.snapshot().message).toMatch(/limit/);
    expect(f.track.stop).toHaveBeenCalledOnce(); expect(r.resume).not.toHaveBeenCalled();
  });
  it("rechecks foreground eligibility before native Resume", async () => {
    const f = fixture(); const r = await f.start(); const p = f.controller.pause(); r.paused(); await p; f.unavailable();
    await expect(f.controller.resume()).rejects.toThrow(); expect(r.resume).not.toHaveBeenCalled(); f.controller.stop(); r.data(); r.ended();
  });
  it("waits for native Pause/Resume acknowledgment and keeps one recorder and stream", async () => {
    const f = fixture(); const r = await f.start(); f.setTime(200); const pausing = f.controller.pause();
    expect(f.controller.snapshot().phase).toBe("pausing"); vi.advanceTimersByTime(1000);
    expect(f.controller.snapshot().phase).toBe("pausing"); f.setTime(210); r.paused(); await pausing;
    expect(f.controller.snapshot().phase).toBe("paused"); expect(f.track.stop).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000); expect(f.controller.snapshot().phase).toBe("paused");
    f.setTime(10_000); const resuming = f.controller.resume(); expect(f.controller.snapshot().phase).toBe("resuming");
    f.setTime(10_030); r.resumed(); await resuming; expect(f.controller.snapshot().phase).toBe("recording");
    expect(Recorder.instances).toHaveLength(1); expect(f.request).toHaveBeenCalledOnce(); expect(f.begin).toHaveBeenCalledOnce();
    expect(f.controller.snapshot().timing.transitions).toEqual([{ kind: "pause", requestedAtMs: 200, acknowledgedAtMs: 210 }, { kind: "resume", requestedAtMs: 10_000, acknowledgedAtMs: 10_030 }]);
    f.controller.stop(); r.data(); r.ended(); expect(f.controller.snapshot().segment?.size).toBe(10);
  });
  it("finalizes a paused native recorder without Resume and retains its real chunks", async () => {
    const f = fixture(); const r = await f.start(); r.data(); const p = f.controller.pause(); r.paused(); await p;
    f.controller.stop(); r.data(); r.ended(); expect(r.resume).not.toHaveBeenCalled();
    expect(f.controller.snapshot().segment?.size).toBe(20); expect(f.controller.snapshot().phase).toBe("available"); expect(f.track.stop).toHaveBeenCalledOnce();
  });
  it.each(["pause", "resume"] as const)("Stop cancels a pending native %s and ignores its late acknowledgment", async kind => {
    const f = fixture(); const r = await f.start();
    if (kind === "resume") { const p = f.controller.pause(); r.paused(); await p; }
    const p = f.controller[kind](); const rejection = expect(p).rejects.toThrow(/canceled/); f.controller.stop(); await rejection;
    if (kind === "pause") r.paused(); else r.resumed(); r.data(); r.ended(); expect(f.controller.snapshot().phase).toBe("available");
    expect(f.controller.snapshot().timing.transitions.at(-1)?.acknowledgedAtMs).toBeNull();
  });
  it.each(["pause", "resume"] as const)("reports a native %s exception for the coordinator to terminate", async kind => {
    const f = fixture(); const r = await f.start();
    if (kind === "resume") { const p = f.controller.pause(); r.paused(); await p; }
    r[kind].mockImplementation(() => { throw new Error("Native refused"); }); await expect(f.controller[kind]()).rejects.toThrow(/failed/);
    f.controller.stop(); r.data(); r.ended(); expect(f.controller.snapshot().segment).not.toBeNull();
  });
  it("bounds delayed native acknowledgments and cleans timers after Stop", async () => {
    const f = fixture(); const r = await f.start(); const p = f.controller.pause(); const rejection = expect(p).rejects.toThrow(/timed out/);
    vi.advanceTimersByTime(10_000); await rejection; f.controller.stop(); r.data(); r.ended(); expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects inconsistent native state instead of claiming Paused", async () => {
    const f = fixture(); const r = await f.start(); const p = f.controller.pause(); const rejection = expect(p).rejects.toThrow(/inconsistent/);
    r.state = "recording"; r.paused(); await rejection; expect(f.controller.snapshot().phase).not.toBe("paused"); f.controller.stop(); r.data(); r.ended();
  });
  it("reports unsupported pause capability without changing existing Start/Stop capture", async () => {
    const f = fixture(); const r = await f.start(); Reflect.set(r, "pause", undefined);
    expect(f.controller.canPause()).toBe(false); await expect(f.controller.pause()).rejects.toThrow();
    expect(f.controller.snapshot().phase).toBe("recording"); f.controller.stop(); r.data(); r.ended(); expect(f.controller.snapshot().segment).not.toBeNull();
  });
  it("reports an independent microphone failure while Paused and keeps its prefix", async () => {
    const f = fixture(); const r = await f.start(); r.data(); const p = f.controller.pause(); r.paused(); await p;
    f.track.dispatchEvent(new Event("ended")); r.ended(); expect(f.controller.active()).toBe(false);
    expect(f.controller.status()).toBe("failed"); expect(f.controller.snapshot().message).toContain("MIDI continues independently");
    expect(f.controller.snapshot().segment?.size).toBe(10); expect(f.begin).toHaveBeenCalledOnce();
  });
  it("rejects coordinated Pause on microphone loss without losing legitimate audio", async () => {
    const f = fixture(); const r = await f.start(); r.data(); const p = f.controller.pause(); const rejection = expect(p).rejects.toThrow(/interrupted/);
    f.track.dispatchEvent(new Event("mute")); await rejection; r.ended(); expect(f.controller.snapshot().segment?.size).toBe(10);
  });
  it("fences old native transition/error callbacks from a replacement recorder", async () => {
    const f = fixture(); const old = await f.start(); const oldPause = old.onpause!, oldError = old.onerror!, oldStop = old.onstop!;
    f.controller.discard(); const fresh = await f.start(); const p = f.controller.pause();
    oldPause(new Event("pause")); oldError(new Event("error")); oldStop(new Event("stop"));
    expect(f.controller.snapshot().phase).toBe("pausing"); fresh.paused(); await p; expect(f.controller.snapshot().phase).toBe("paused");
    f.controller.stop(); fresh.data(); fresh.ended();
  });
  it("defaults off and requests only audio with conservative processing constraints on explicit Prepare", async () => {
    const f = fixture(); expect(f.request).not.toHaveBeenCalled(); expect(f.controller.needsGuard()).toBe(false);
    await f.controller.prepare(); expect(f.request).toHaveBeenCalledExactlyOnceWith({ audio: { channelCount: { ideal: 1 }, echoCancellation: { ideal: false }, noiseSuppression: { ideal: false }, autoGainControl: { ideal: false } }, video: false });
    expect(f.controller.snapshot().phase).toBe("ready"); expect(f.begin).not.toHaveBeenCalled(); expect(Recorder.instances).toHaveLength(0);
  });
  it("waits for recorder start before MIDI and waits for final data/stop before audio is available", async () => {
    const f = fixture(); await f.controller.prepare(); const pending = f.controller.start(f.begin); const r = Recorder.instances[0];
    expect(f.begin).not.toHaveBeenCalled(); f.setTime(120); r.started(); await pending;
    expect(f.controller.snapshot()).toMatchObject({ phase: "recording", timing: { audioStartedAtMs: 120, midiStart: { atMs: 120 }, takeId: "take-1" } });
    f.setTime(400); f.controller.observeTerminal({ atMs: 400, context: fixtureContext }); f.controller.stop();
    expect(r.stop).toHaveBeenCalledOnce(); expect(f.track.stop).toHaveBeenCalledOnce(); expect(f.controller.snapshot().phase).toBe("finalizing");
    r.data(); expect(f.controller.snapshot().segment).toBeNull(); r.ended();
    expect(f.controller.snapshot()).toMatchObject({ phase: "available", segment: { size: 10, mimeType: Recorder.mime }, timing: { midiTerminal: { atMs: 400 } } });
    expect(f.controller.needsGuard()).toBe(true);
  });
  it.each(["NotAllowedError", "NotFoundError", "NotReadableError"])("handles %s without starting MIDI", async name => {
    const f = fixture(vi.fn(async () => { throw Object.assign(new Error("permission"), { name }); })); await f.controller.prepare();
    expect(f.controller.snapshot().phase).toBe("failed"); expect(f.begin).not.toHaveBeenCalled(); expect(Recorder.instances).toHaveLength(0);
  });
  it("releases a late permission result after cancel and cannot overwrite a newer preparation", async () => {
    let resolve!: (stream: MediaStream) => void; const f = fixture(vi.fn(() => new Promise<MediaStream>(r => { resolve = r; })));
    const pending = f.controller.prepare(); expect(f.controller.snapshot().phase).toBe("preparing"); f.controller.discard();
    resolve(f.stream); await pending; expect(f.track.stop).toHaveBeenCalledOnce(); expect(f.controller.snapshot().phase).toBe("discarded");
  });
  it("rechecks eligibility after permission and releases unavailable streams", async () => {
    let resolve!: (stream: MediaStream) => void; const f = fixture(vi.fn(() => new Promise<MediaStream>(r => { resolve = r; })));
    const pending = f.controller.prepare(); f.unavailable(); resolve(f.stream); await pending;
    expect(f.track.stop).toHaveBeenCalledOnce(); expect(f.controller.snapshot().phase).toBe("failed"); expect(f.begin).not.toHaveBeenCalled();
  });
  it("handles absent native recorder without requesting a microphone", async () => {
    vi.stubGlobal("MediaRecorder", undefined); const request = vi.fn(); const c = createImprovRoomAudio({ eligible: () => true, mediaDevices: { getUserMedia: request } }); owned.push(c);
    await c.prepare(); expect(c.snapshot().phase).toBe("failed"); expect(request).not.toHaveBeenCalled();
  });
  it("handles missing capture support without allocating a MIDI take", async () => {
    const c = createImprovRoomAudio({ eligible: () => true, Recorder: Recorder as unknown as typeof MediaRecorder, secure: false }); owned.push(c);
    await c.prepare(); expect(c.snapshot().phase).toBe("failed");
  });
  it.each(["audio/weird", "constructor-failure"])("rejects unsupported recording: %s", async kind => {
    if (kind === "audio/weird") Recorder.mime = kind; else Recorder.throws = true;
    const f = fixture(); await f.controller.prepare(); await expect(f.controller.start(f.begin)).rejects.toThrow();
    expect(f.begin).not.toHaveBeenCalled(); expect(f.track.stop).toHaveBeenCalledOnce();
  });
  it("rechecks the MIDI owner at recorder start, before invoking its Start boundary", async () => {
    const f = fixture(); await f.controller.prepare(); const pending = f.controller.start(f.begin); f.unavailable(); Recorder.instances[0].started();
    await expect(pending).rejects.toThrow(/ownership/); expect(f.begin).not.toHaveBeenCalled(); expect(f.track.stop).toHaveBeenCalledOnce();
  });
  it.each(["background", "freeze", "pagehide", "device-loss", "owner-loss"])("finalizes the legitimate prefix after %s without resuming", async reason => {
    const f = fixture(); const r = await f.start(); r.data();
    if (reason === "pagehide") window.dispatchEvent(new Event(reason));
    else if (reason === "freeze") document.dispatchEvent(new Event(reason));
    else f.controller.stop();
    r.data(); r.ended(); expect(f.controller.snapshot().phase).toBe("available"); expect(f.track.stop).toHaveBeenCalledOnce();
    await expect(f.controller.start(f.begin)).rejects.toThrow(); expect(f.begin).toHaveBeenCalledOnce();
  });
  it("reports empty audio honestly", async () => {
    const f = fixture(); const r = await f.start(); f.controller.stop(); r.ended();
    expect(f.controller.snapshot().phase).toBe("failed"); expect(f.controller.snapshot().segment).toBeNull();
  });
  it("keeps MIDI ownership independent on audio failure and retains usable prefix", async () => {
    const f = fixture(); const r = await f.start(); r.data(); r.onerror?.(new Event("error")); r.ended();
    expect(f.controller.snapshot().segment?.size).toBe(10); expect(f.begin).toHaveBeenCalledOnce(); expect(f.track.stop).toHaveBeenCalledOnce();
  });
  it.each(["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"])("retains actual MIME and download naming for %s", async mime => {
    Recorder.mime = mime; const f = fixture(); const r = await f.start(); f.controller.stop(); r.data(); r.ended();
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:download"), revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      expect(this.download).toBe(`prelude-Book-take-1.${mime.startsWith("audio/mp4") ? "m4a" : mime.startsWith("audio/ogg") ? "ogg" : "webm"}`);
    });
    f.controller.download("Book", 1); expect(click).toHaveBeenCalledOnce(); expect(f.controller.needsGuard()).toBe(true);
    expect(URL.revokeObjectURL).not.toHaveBeenCalled(); vi.advanceTimersByTime(1000); expect(URL.revokeObjectURL).toHaveBeenCalledOnce();
    f.controller.discard(); expect(f.revoke).toHaveBeenCalledExactlyOnceWith("blob:preview");
  });
  it.each([false, true])("bounds audio independently, including oversized final chunks: stopped=%s", async stopped => {
    const f = fixture(); const r = await f.start(); r.data(100); if (stopped) f.controller.stop(); r.data(17 * 1024 * 1024); r.ended();
    expect(f.controller.snapshot().segment?.size).toBe(100); expect(f.controller.snapshot().message).toMatch(/limit/); expect(f.track.stop).toHaveBeenCalledOnce();
  });
  it("stops at the shared 20-minute duration limit", async () => {
    const f = fixture(); const r = await f.start(); r.data(); f.setTime(21 * 60 * 1000); vi.advanceTimersByTime(1000); r.ended();
    expect(f.controller.snapshot().phase).toBe("available"); expect(f.controller.snapshot().message).toMatch(/limit/); expect(f.track.stop).toHaveBeenCalledOnce();
  });
  it("fences old recorder callbacks after explicit discard and a fresh take", async () => {
    const f = fixture(); const old = await f.start(); const late = old.ondataavailable!; f.controller.discard(); const fresh = await f.start();
    late({ data: new Blob([new Uint8Array(17 * 1024 * 1024)]) } as BlobEvent);
    expect(f.controller.snapshot().phase).toBe("recording"); expect(fresh.stop).not.toHaveBeenCalled();
  });
  it("bounds startup/finalization waiting and cleans tracks on teardown", async () => {
    const f = fixture(); await f.controller.prepare(); const pending = f.controller.start(f.begin); const rejected = expect(pending).rejects.toThrow(/canceled/);
    vi.advanceTimersByTime(10_000); await rejected; expect(f.begin).not.toHaveBeenCalled(); expect(f.track.stop).toHaveBeenCalledOnce();
    f.controller.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  it("reports missing finalization instead of claiming available audio", async () => {
    const f = fixture(); const r = await f.start(); r.data(); f.controller.stop(); vi.advanceTimersByTime(10_000);
    expect(f.controller.snapshot().phase).toBe("failed"); expect(f.controller.snapshot().segment).toBeNull();
    expect(f.track.stop).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
});
