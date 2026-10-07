import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMicrophoneCapture, type CaptureStatus } from "./microphone-capture";
import type { TunerSnapshot } from "./pitch-stabilizer";
import type { PitchObservationEnvelope } from "@/lib/audio/monophonic/pitch-analysis-types";

const disposals: (() => void)[] = [];
beforeEach(() => vi.useFakeTimers());
afterEach(async () => { disposals.splice(0).forEach((dispose) => dispose()); await flush(); vi.useRealTimers(); });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function setup(options: { request?: (stream: MediaStream) => Promise<MediaStream>; resume?: () => Promise<void>; failGraph?: boolean; initialState?: string } = {}) {
  const origin = Date.now(), contexts: FakeContext[] = [], statuses: CaptureStatus[] = [], readings: TunerSnapshot[] = [];
  const observations: PitchObservationEnvelope[] = [];
  let eligible = true;
  class Track extends EventTarget {
    readyState = "live"; muted = false; stop = vi.fn(() => { this.readyState = "ended"; });
  }
  const track = new Track();
  const stream = { getTracks: () => [track], getAudioTracks: () => [track] } as unknown as MediaStream;
  class FakeContext extends EventTarget {
    state = options.initialState ?? "running"; sampleRate = 48000; frozen = false; destination = {};
    connected: unknown[] = []; disconnect = vi.fn();
    get currentTime() { return this.frozen ? 0 : (Date.now() - origin) / 1000; }
    constructor() { super(); contexts.push(this); }
    resume = vi.fn(() => options.resume?.() ?? Promise.resolve());
    close = vi.fn(() => { this.state = "closed"; return Promise.resolve(); });
    createMediaStreamSource() {
      if (options.failGraph) throw Error("graph failed");
      return { connect: (target: unknown) => this.connected.push(target), disconnect: this.disconnect };
    }
    createAnalyser() { return { disconnect: this.disconnect, getFloatTimeDomainData: (buffer: Float32Array) => {
      for (let i = 0; i < buffer.length; i++) buffer[i] = 0.2 * Math.sin(2 * Math.PI * 440 * i / this.sampleRate);
    } }; }
  }
  const getUserMedia = vi.fn(() => options.request?.(stream) ?? Promise.resolve(stream));
  const capture = createMicrophoneCapture({ Context: FakeContext as unknown as typeof AudioContext,
    mediaDevices: { getUserMedia }, secure: true, eligible: () => eligible,
    now: () => Date.now() - origin, onStatus: (value) => statuses.push(value), onPitch: (value) => readings.push(value),
    onObservation: (value) => observations.push(value) });
  disposals.push(() => {
    contexts.forEach((context) => context.close.mockImplementation(() => { context.state = "closed"; return Promise.resolve(); }));
    capture.stop();
  });
  return { capture, contexts, track, getUserMedia, statuses, readings, observations, stream,
    setEligible: (value: boolean) => { eligible = value; }, state: () => statuses.at(-1)?.state };
}
describe("microphone session ownership", () => {
  it("publishes immutable scalar evidence with advancing clocks and capture identity", async () => {
    const env = setup(); await env.capture.start();
    await vi.advanceTimersByTimeAsync(250);
    const first = env.observations[0], last = env.observations.at(-1)!;
    expect(last.snapshot.fresh).toBe(true);
    expect(last.observation.frequencyHz).toBeCloseTo(440, 0);
    expect(last.observedAtMs).toBeGreaterThan(first.observedAtMs);
    expect(last.audioSeconds).toBeGreaterThan(first.audioSeconds);
    expect(last.captureGeneration).toBe(env.capture.generation());
    expect(Object.keys(last).sort()).toEqual(["audioSeconds", "captureGeneration", "observation", "observedAtMs", "snapshot"]);
    for (const value of [last, last.observation, last.snapshot, last.snapshot.pitch]) expect(Object.isFrozen(value)).toBe(true);
    const count = env.observations.length;
    env.capture.stop(); await vi.advanceTimersByTimeAsync(250);
    expect(env.observations).toHaveLength(count);
    expect(env.capture.generation()).toBeGreaterThan(last.captureGeneration);
  });
  for (const failure of ["rejected", "thrown"]) {
    it(`retains ${failure} closure, bounds allocation, and recovers on a later Start`, async () => {
      const env = setup(); await env.capture.start(); const context = env.contexts[0];
      context.close.mockImplementation(() => {
        if (failure === "thrown") throw Error("inactive document");
        return Promise.reject(Error("inactive document"));
      });
      env.capture.stop(); await flush();
      expect(env.track.stop).toHaveBeenCalledOnce(); expect(context.state).toBe("running");
      expect(env.capture.resources()).toEqual({ contexts: 1, tracks: 0 });
      expect(env.statuses.at(-1)?.message).toContain("unfinished cleanup");
      for (let i = 0; i < 3; i++) {
        await env.capture.start(); await flush(); expect(env.state()).toBe("error");
        expect(env.statuses.at(-1)?.message).toContain("No new microphone session");
        env.capture.stop(); await flush();
      }
      expect(env.contexts).toHaveLength(1); expect(env.getUserMedia).toHaveBeenCalledTimes(1);
      expect(context.close).toHaveBeenCalledTimes(7); expect(vi.getTimerCount()).toBe(0);
      context.close.mockImplementation(() => { context.state = "closed"; return Promise.resolve(); });
      env.track.readyState = "live"; await env.capture.start();
      expect(env.state()).toBe("listening"); expect(env.contexts).toHaveLength(2);
      expect(env.capture.resources()).toEqual({ contexts: 1, tracks: 1 });
      env.capture.stop(); await flush(); expect(env.capture.resources()).toEqual({ contexts: 0, tracks: 0 });
    });
    it(`recognizes an already-closed context despite ${failure} close`, async () => {
      const env = setup(); await env.capture.start(); const context = env.contexts[0];
      context.close.mockImplementation(() => {
        context.state = "closed";
        if (failure === "thrown") throw Error("already closed");
        return Promise.reject(Error("already closed"));
      });
      env.capture.stop(); await flush(); expect(env.capture.resources()).toEqual({ contexts: 0, tracks: 0 });
      env.track.readyState = "live"; await env.capture.start(); expect(env.state()).toBe("listening");
    });
  }
  it("does not claim closure merely because close resolves", async () => {
    const env = setup(); await env.capture.start(); const context = env.contexts[0];
    context.close.mockResolvedValue(undefined); env.capture.stop(); await flush();
    await env.capture.start(); await flush();
    expect(context.state).toBe("running"); expect(env.capture.resources()).toEqual({ contexts: 1, tracks: 0 });
    expect(env.contexts).toHaveLength(1); expect(env.state()).toBe("error"); expect(vi.getTimerCount()).toBe(0);
  });
  it("retains pending cleanup across controller replacement without overlapping close attempts", async () => {
    const old = setup(); await old.capture.start(); const context = old.contexts[0]; let closed!: () => void;
    context.close.mockImplementation(() => new Promise((resolve) => { closed = () => { context.state = "closed"; resolve(); }; }));
    old.capture.stop(); const next = setup();
    await next.capture.start(); old.capture.stop(); await next.capture.start();
    expect(context.close).toHaveBeenCalledOnce(); expect(next.contexts).toHaveLength(0);
    expect(next.getUserMedia).not.toHaveBeenCalled(); expect(next.state()).toBe("error");
    expect(next.capture.resources()).toEqual({ contexts: 1, tracks: 0 }); expect(vi.getTimerCount()).toBe(0);
    closed(); await flush(); await next.capture.start(); expect(next.state()).toBe("listening");
  });
  it("old cleanup completion cannot change a newer session's status", async () => {
    const env = setup(); await env.capture.start(); const context = env.contexts[0]; let reject!: (error: Error) => void;
    context.close.mockImplementation(() => { context.state = "closed"; return new Promise((_resolve, fail) => { reject = fail; }); });
    env.capture.stop(); env.track.readyState = "live"; await env.capture.start();
    const statuses = [...env.statuses]; reject(Error("late close rejection")); await flush();
    expect(env.statuses).toEqual(statuses); expect(env.state()).toBe("listening");
    expect(env.capture.resources()).toEqual({ contexts: 1, tracks: 1 });
  });
  it("a later explicit Stop makes one safe cleanup retry", async () => {
    const env = setup(); await env.capture.start(); const context = env.contexts[0];
    context.close.mockRejectedValueOnce(Error("inactive")); env.capture.stop(); await flush();
    expect(env.capture.resources()).toEqual({ contexts: 1, tracks: 0 });
    env.capture.stop(); await flush(); expect(context.close).toHaveBeenCalledTimes(2);
    expect(env.track.stop).toHaveBeenCalledOnce(); expect(env.capture.resources()).toEqual({ contexts: 0, tracks: 0 });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("explains that stopping startup may leave the browser permission prompt visible", async () => {
    let grant!: (stream: MediaStream) => void;
    const env = setup({ request: () => new Promise((resolve) => { grant = resolve; }) });
    const started = env.capture.start();
    expect(env.statuses.at(-1)?.message).toContain("cancels Prelude's pending startup");
    expect(env.statuses.at(-1)?.message).toContain("browser permission prompt may remain visible");
    env.capture.stop(); grant(env.stream); await started;
  });
  for (const interruption of ["mute", "ended", "mute-unmute"]) {
    it(`handles ${interruption} before activation, releases resources, and guards a restarted session`, async () => {
      const activations: (() => void)[] = [];
      const env = setup({ resume: () => new Promise((resolve) => { activations.push(resolve); }) });
      const first = env.capture.start(); await flush();
      if (interruption === "ended") env.track.readyState = "ended"; else env.track.muted = true;
      env.track.dispatchEvent(new Event(interruption === "ended" ? "ended" : "mute"));
      if (interruption === "mute-unmute") { env.track.muted = false; env.track.dispatchEvent(new Event("unmute")); }
      await flush(); expect(env.state()).toBe("paused"); expect(env.track.stop).toHaveBeenCalledOnce();
      expect(env.capture.resources()).toEqual({ contexts: 0, tracks: 0 }); expect(vi.getTimerCount()).toBe(0);
      expect(env.getUserMedia).toHaveBeenCalledTimes(1);
      // A fresh explicit request supplies a live track; resolving the old activation must leave it alone.
      env.track.readyState = "live"; env.track.muted = false;
      const second = env.capture.start(); await flush(); activations[0](); await first;
      expect(env.state()).toBe("starting"); expect(env.track.stop).toHaveBeenCalledOnce();
      activations[1](); await second; expect(env.state()).toBe("listening"); env.capture.stop();
    });
  }
  it("allows ordinary initial suspension while activation is pending", async () => {
    let resume!: () => void;
    const env = setup({ initialState: "suspended", resume: () => new Promise((resolve) => { resume = resolve; }) });
    const started = env.capture.start(); await flush(); const context = env.contexts[0];
    context.dispatchEvent(new Event("statechange")); expect(env.state()).toBe("starting"); expect(env.track.stop).not.toHaveBeenCalled();
    context.state = "running"; context.dispatchEvent(new Event("statechange")); resume(); await started;
    expect(env.state()).toBe("listening");
  });
  it("recognizes completed activation before permission resolves, even before its running event", async () => {
    let grant!: (stream: MediaStream) => void;
    const env = setup({ initialState: "suspended", request: () => new Promise((resolve) => { grant = resolve; }) });
    const started = env.capture.start(); const context = env.contexts[0];
    context.state = "running"; await flush();
    context.state = "suspended"; context.dispatchEvent(new Event("statechange")); await flush();
    expect(env.state()).toBe("paused"); expect(env.capture.resources()).toEqual({ contexts: 0, tracks: 0 });
    grant(env.stream); await started;
    expect(env.track.stop).toHaveBeenCalledOnce(); expect(env.state()).toBe("paused"); expect(vi.getTimerCount()).toBe(0);
  });
  for (const state of ["interrupted", "suspended"]) {
    it(`stops actual context ${state} during pending activation`, async () => {
      let resume!: () => void;
      const env = setup({ initialState: "suspended", resume: () => new Promise((resolve) => { resume = resolve; }) });
      const started = env.capture.start(); await flush(); const context = env.contexts[0];
      if (state === "suspended") { context.state = "running"; context.dispatchEvent(new Event("statechange")); }
      context.state = state; context.dispatchEvent(new Event("statechange")); await flush();
      expect(env.state()).toBe("paused"); expect(env.capture.resources()).toEqual({ contexts: 0, tracks: 0 });
      expect(env.track.stop).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
      resume(); await started; expect(env.state()).toBe("paused");
    });
  }
  it("checks track state again when activation settles even without an event", async () => {
    let resume!: () => void;
    const env = setup({ resume: () => new Promise((resolve) => { resume = resolve; }) });
    const started = env.capture.start(); await flush(); env.track.muted = true; resume(); await started;
    expect(env.state()).toBe("error"); expect(env.track.stop).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("does not request permission without secure browser support", async () => {
    const getUserMedia = vi.fn(), onStatus = vi.fn();
    const capture = createMicrophoneCapture({ secure: false, mediaDevices: { getUserMedia }, eligible: () => true, onStatus, onPitch: vi.fn() });
    await capture.start(); expect(getUserMedia).not.toHaveBeenCalled(); expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ state: "unavailable" }));
  });
  it("handles AudioContext construction failure without asking permission", async () => {
    const getUserMedia = vi.fn(), onStatus = vi.fn();
    class BrokenContext { constructor() { throw Error("unavailable context"); } }
    const capture = createMicrophoneCapture({ secure: true, Context: BrokenContext as unknown as typeof AudioContext,
      mediaDevices: { getUserMedia }, eligible: () => true, onStatus, onPitch: vi.fn() });
    await capture.start(); expect(getUserMedia).not.toHaveBeenCalled(); expect(capture.resources()).toEqual({ contexts: 0, tracks: 0 });
    expect(onStatus).toHaveBeenLastCalledWith(expect.objectContaining({ state: "error" }));
  });
  it("Stop prevents startup after pending activation resolves", async () => {
    let resume!: () => void;
    const env = setup({ resume: () => new Promise((resolve) => { resume = resolve; }) });
    const started = env.capture.start(); await flush(); env.capture.stop(); resume(); await started;
    expect(env.state()).toBe("idle"); expect(env.track.stop).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("rejects a granted but already muted track", async () => {
    const env = setup(); env.track.muted = true; await env.capture.start();
    expect(env.state()).toBe("error"); expect(env.track.stop).toHaveBeenCalledOnce();
  });
  it("requests only on explicit Start and creates a silent graph", async () => {
    const env = setup(); expect(env.getUserMedia).not.toHaveBeenCalled(); await env.capture.start();
    expect(env.state()).toBe("listening"); expect(env.contexts[0].connected).toHaveLength(1);
    expect(env.contexts[0].connected).not.toContain(env.contexts[0].destination);
    expect(env.getUserMedia).toHaveBeenCalledWith({ audio: expect.any(Object), video: false });
    env.capture.stop(); await flush(); expect(env.capture.resources()).toEqual({ contexts: 0, tracks: 0 });
  });
  it("deduplicates Start and makes Stop idempotent", async () => {
    const env = setup(); await Promise.all([env.capture.start(), env.capture.start()]);
    expect(env.getUserMedia).toHaveBeenCalledTimes(1); env.capture.stop(); env.capture.stop();
    expect(env.track.stop).toHaveBeenCalledTimes(1); expect(env.contexts[0].close).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("cancels unresolved permission and stops the late stream", async () => {
    let grant!: (stream: MediaStream) => void;
    const env = setup({ request: () => new Promise((resolve) => { grant = resolve; }) });
    const started = env.capture.start(); env.capture.stop(); grant(env.stream); await started;
    expect(env.state()).toBe("idle"); expect(env.track.stop).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("stops an old late grant without disrupting a restarted session", async () => {
    let grant!: (stream: MediaStream) => void;
    const env = setup({ request: () => new Promise((resolve) => { grant = resolve; }) });
    const first = env.capture.start(), grantFirst = grant;
    env.capture.stop(); const second = env.capture.start();
    const oldStop = vi.fn(), oldStream = { getTracks: () => [{ stop: oldStop }] } as unknown as MediaStream;
    grantFirst(oldStream); await first; expect(oldStop).toHaveBeenCalledOnce(); expect(env.state()).toBe("requesting");
    grant(env.stream); await second; expect(env.state()).toBe("listening"); env.capture.stop();
  });
  for (const [name, state] of [["NotAllowedError", "denied"], ["NotFoundError", "unavailable"], ["NotReadableError", "error"]]) {
    it(`handles ${name} with actionable feedback and cleanup`, async () => {
      const env = setup({ request: () => Promise.reject(Object.assign(Error(), { name })) });
      await env.capture.start(); await flush(); expect(env.state()).toBe(state);
      expect(env.statuses.at(-1)?.message.length).toBeGreaterThan(20); expect(env.capture.resources()).toEqual({ contexts: 0, tracks: 0 });
    });
  }
  it("does not ask permission when foreground ownership is unavailable", async () => {
    const env = setup(); env.setEligible(false); await env.capture.start();
    expect(env.getUserMedia).not.toHaveBeenCalled(); expect(env.state()).toBe("paused");
  });
  it("rechecks foreground ownership after a permission grant", async () => {
    let grant!: (stream: MediaStream) => void;
    const env = setup({ request: () => new Promise((resolve) => { grant = resolve; }) });
    const started = env.capture.start(); env.setEligible(false); grant(env.stream); await started;
    expect(env.state()).toBe("paused"); expect(env.track.stop).toHaveBeenCalledOnce(); expect(env.contexts[0].connected).toHaveLength(0);
  });
  it("rechecks ownership after pending AudioContext activation", async () => {
    let resume!: () => void;
    const env = setup({ resume: () => new Promise((resolve) => { resume = resolve; }) });
    const started = env.capture.start(); await flush(); env.setEligible(false); resume(); await started;
    expect(env.state()).toBe("paused"); expect(env.track.stop).toHaveBeenCalledOnce();
  });
  it("cleans up partial graph and activation failures", async () => {
    for (const options of [{ failGraph: true }, { resume: () => Promise.reject(Error("activation")) }]) {
      const env = setup(options); await env.capture.start(); expect(env.state()).toBe("error");
      expect(env.track.stop).toHaveBeenCalledOnce(); expect(env.contexts[0].close).toHaveBeenCalledOnce();
    }
  });
  for (const event of ["mute", "ended", "statechange"]) {
    it(`stops on ${event} and does not resume automatically`, async () => {
      const env = setup(); await env.capture.start();
      if (event === "statechange") { env.contexts[0].state = "suspended"; env.contexts[0].dispatchEvent(new Event(event)); }
      else env.track.dispatchEvent(new Event(event));
      await flush(); expect(env.state()).toBe("paused"); expect(env.capture.resources()).toEqual({ contexts: 0, tracks: 0 });
      expect(env.getUserMedia).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    });
  }
  it("samples credible pitch and ages it independently of callbacks", async () => {
    const env = setup(); await env.capture.start(); await vi.advanceTimersByTimeAsync(200);
    expect(env.readings.at(-1)?.fresh).toBe(true);
    env.contexts[0].frozen = true; await vi.advanceTimersByTimeAsync(40);
    expect(env.capture.snapshot().fresh).toBe(false); await vi.advanceTimersByTimeAsync(410);
    expect(env.capture.snapshot().pitch).toBeNull(); env.capture.stop();
  });
  it("interrupts a stalled clock rather than presenting repeated samples as fresh", async () => {
    const env = setup(); await env.capture.start(); env.contexts[0].frozen = true;
    await vi.advanceTimersByTimeAsync(600); expect(env.state()).toBe("paused"); expect(env.track.stop).toHaveBeenCalledOnce();
  });
  it("times out startup, cleans resources, and stops a later grant", async () => {
    let grant!: (stream: MediaStream) => void;
    const env = setup({ request: () => new Promise((resolve) => { grant = resolve; }) });
    const started = env.capture.start(); await vi.advanceTimersByTimeAsync(30001); expect(env.state()).toBe("error");
    grant(env.stream); await started; expect(env.track.stop).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
  it("stops capture when eligibility changes during sampling", async () => {
    const env = setup(); await env.capture.start(); env.setEligible(false); await vi.advanceTimersByTimeAsync(40);
    expect(env.state()).toBe("paused"); expect(env.track.stop).toHaveBeenCalledOnce();
  });
  it("supports 100 Start/Stop cycles without live resources or timers", async () => {
    const env = setup();
    for (let i = 0; i < 100; i++) { env.track.readyState = "live"; await env.capture.start(); env.capture.stop(); await flush(); }
    expect(env.contexts).toHaveLength(100); expect(env.track.stop).toHaveBeenCalledTimes(100);
    expect(env.capture.resources()).toEqual({ contexts: 0, tracks: 0 }); expect(vi.getTimerCount()).toBe(0);
  });
});
