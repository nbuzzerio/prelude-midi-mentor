// @vitest-environment jsdom
import { Profiler, StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ImprovPerformanceStaff } from "./improv-performance-staff";
import { ImprovTakeReview } from "./improv-take-review";
import { createImprovTimeline, timelineFromTake } from "../improv-timeline";
import type { ImprovReplayTransport } from "../improv-replay";
import { createImprovTakeRecorder } from "../improv-take-recorder";
import { fixtureContext, fixtureInput, fixtureObservation, performanceFixture } from "../improv-test-fixture";

const context = { type: "no-key" } as const;
beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function fixture() {
  const model = createImprovTimeline(100); let current = model; let now = 100; let id = 0; let sequence = 0;
  const callbacks = new Map<number, FrameRequestCallback>();
  const clock = { now: () => now, request: vi.fn((fn: FrameRequestCallback) => { callbacks.set(++id, fn); return id; }), cancel: vi.fn((id: number) => { callbacks.delete(id); }) };
  const rec = createImprovTakeRecorder({ createId: () => "one" }); rec.start(fixtureInput, fixtureObservation(100));
  const send = (bytes: number[]) => {
    const result = rec.append({ provenance: "browser-midi-message", input: fixtureInput, sequence: ++sequence, bytes, dataStatus: "available", receivedAtMs: now, sourceTimeStampMs: now }, fixtureContext);
    if (result.ok) model.append(rec.readEvents(result.eventWatermark - 1, 1)[0]);
  };
  const frame = (time: number) => { now = time; act(() => { const pending = [...callbacks.values()]; callbacks.clear(); pending.forEach(fn => fn(time)); }); };
  const tick = (time: number) => { now = time; act(() => vi.advanceTimersByTime(100)); };
  return { model, clock, callbacks, send, frame, tick, source: () => current, replace: () => { current = createImprovTimeline(now); } };
}
const staff = () => screen.getByRole("img", { name: "Time-based performance grand staff" });

describe("bounded rolling grand staff", () => {
  it("freezes Pause without a silent scroll gap, resumes, and replaces Paused with terminal state", () => {
    const f = fixture(); render(<StrictMode><ImprovPerformanceStaff source={f.source} clock={f.clock} context={context} /></StrictMode>);
    const rec = createImprovTakeRecorder({ createId: () => "controls", pauseSupport: true }); rec.start(fixtureInput, fixtureObservation(100));
    const boundary = (kind: "pause" | "pause-ack" | "resume-request" | "resume-ack" | "resume", at: number) => {
      rec.control(kind, fixtureObservation(at), "off"); f.model.control(rec.readControls().at(-1)!);
    };
    f.send([0x90, 60, 80]); boundary("pause", 500); boundary("pause-ack", 500); f.tick(1000); f.frame(10_000);
    expect(staff().getAttribute("data-playhead-ms")).toBe("400"); expect(staff().getAttribute("data-paused")).toBe("true");
    f.send([0x90, 70, 80]); f.tick(10_100); expect(staff().querySelector('[data-pitch="70"]')).toBeNull();
    boundary("resume-request", 10_100); boundary("resume-ack", 10_100); boundary("resume", 10_100); f.tick(10_200); f.frame(10_300);
    expect(staff().getAttribute("data-playhead-ms")).toBe("600"); expect(staff().getAttribute("data-paused")).toBe("false");
    boundary("pause", 10_400); boundary("pause-ack", 10_400); f.tick(10_500); f.model.finish(700, true); f.tick(10_600);
    expect(staff().getAttribute("data-paused")).toBe("false"); expect(staff().getAttribute("data-known-end")).toBe("true");
    expect(screen.getByText(/Frozen performance.*observed end/)).toBeTruthy();
  });
  it("renders an empty ready grand staff without incoming unrecorded pitches", () => {
    render(<ImprovPerformanceStaff source={() => null} context={context} />);
    expect(staff().getAttribute("data-note-count")).toBe("0"); expect(screen.getByText(/Ready.*Start Take/)).toBeTruthy();
    expect(staff().querySelectorAll("ellipse")).toHaveLength(0); expect(staff().getAttribute("aria-describedby")).toBeTruthy();
  });
  it("moves a blue playhead between React updates, including silence", () => {
    const f = fixture(); const commits = vi.fn(); render(<Profiler id="staff" onRender={commits}><ImprovPerformanceStaff source={f.source} clock={f.clock} context={context} /></Profiler>);
    const before = commits.mock.calls.length; f.frame(1100);
    expect(staff().getAttribute("data-playhead-ms")).toBe("1000"); expect(commits.mock.calls.length).toBe(before);
    expect(staff().querySelector('[aria-label="Blue elapsed-time playhead"]')?.getAttribute("stroke")).toBe("#38bdf8");
  });
  it("retains noteheads after release and ends the growing key-down trail", () => {
    const f = fixture(); render(<ImprovPerformanceStaff source={f.source} clock={f.clock} context={context} />);
    f.send([0x90, 60, 90]); f.tick(200); const trail = staff().querySelector('[data-held-onset]')!;
    const before = Number(trail.getAttribute("x2")); f.frame(600); expect(Number(trail.getAttribute("x2"))).toBeGreaterThan(before);
    f.send([0x80, 60, 64]); f.tick(700); expect(staff().querySelectorAll("ellipse")).toHaveLength(1);
    expect(staff().querySelector('[data-attack="1"]')?.getAttribute("data-release-ms")).toBe("500"); expect(staff().querySelector('[data-held-onset]')).toBeNull();
  });
  it("scrolls near the threshold while keeping the playhead steady", () => {
    const f = fixture(); render(<ImprovPerformanceStaff source={f.source} clock={f.clock} context={context} />);
    f.frame(10_100); const x = staff().querySelector('[aria-label="Blue elapsed-time playhead"]')?.getAttribute("x1");
    expect(staff().getAttribute("data-window-start-ms")).toBe("400"); f.frame(11_100);
    expect(staff().getAttribute("data-window-start-ms")).toBe("1400"); expect(staff().querySelector('[aria-label="Blue elapsed-time playhead"]')?.getAttribute("x1")).toBe(x);
  });
  it.each([true, false])("freezes terminal display with knownEnd=%s and rejects late messages", known => {
    const f = fixture(); render(<ImprovPerformanceStaff source={f.source} clock={f.clock} context={context} />);
    f.send([0x90, 60, 90]); f.tick(200); f.model.finish(500, known); f.frame(1000); f.send([0x90, 64, 90]); f.tick(2000);
    expect(staff().getAttribute("data-playhead-ms")).toBe("500"); expect(staff().getAttribute("data-note-count")).toBe("1");
    f.frame(9000); expect(staff().getAttribute("data-playhead-ms")).toBe("500"); expect(staff().getAttribute("data-recording")).toBe("false");
  });
  it("caps render work for a dense burst without a per-message React commit", () => {
    const f = fixture(); const commits = vi.fn(); render(<Profiler id="staff" onRender={commits}><ImprovPerformanceStaff source={f.source} clock={f.clock} context={context} /></Profiler>);
    const before = commits.mock.calls.length; for (let i = 0; i < 600; i++) f.send([0x90, i % 128, 90]);
    expect(commits.mock.calls.length).toBe(before); f.tick(200); expect(staff().querySelectorAll("[data-attack]")).toHaveLength(512);
    expect(screen.getByText(/display detail limited/)).toBeTruthy();
  });
  it("fences old geometry on replacement and starts the next take empty", () => {
    const f = fixture(); render(<ImprovPerformanceStaff source={f.source} clock={f.clock} context={context} />);
    f.send([0x90, 60, 90]); f.tick(200); f.replace(); f.frame(300);
    expect(staff().querySelector('[data-attack]')?.parentElement?.getAttribute("visibility")).toBe("hidden");
    f.tick(400); expect(staff().querySelector('[data-attack]')).toBeNull();
  });
  it("cancels all frames, intervals and stale callbacks under Strict Mode/unmount", () => {
    const f = fixture(); const view = render(<StrictMode><ImprovPerformanceStaff source={f.source} clock={f.clock} context={context} /></StrictMode>);
    expect(f.callbacks.size).toBe(1); const stale = [...f.callbacks.values()][0]; view.unmount();
    expect(f.callbacks.size).toBe(0); expect(vi.getTimerCount()).toBe(0); stale(999); expect(f.callbacks.size).toBe(0);
  });
  it("uses restrained ten-Hz movement with reduced motion", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const f = fixture(); render(<ImprovPerformanceStaff source={f.source} clock={f.clock} context={context} />);
    expect(f.callbacks.size).toBe(0); f.tick(1000); expect(staff().getAttribute("data-playhead-ms")).toBe("900");
  });
  it("retains actual extreme-pitch labels and selected key spelling", () => {
    const f = fixture(); f.send([0x90, 21, 90]); f.send([0x90, 61, 90]);
    render(<ImprovPerformanceStaff source={f.source} clock={f.clock} context={{ type: "key", keyId: "e-flat-major" }} />);
    expect(staff().textContent).toContain("A0"); expect(staff().textContent).toContain("D♭4");
  });
  it("labels long cross-window trails with actual pitch after their attack leaves view", () => {
    const f = fixture(); f.send([0x90, 21, 90]);
    render(<ImprovPerformanceStaff source={f.source} clock={f.clock} context={context} />);
    f.tick(20_100); expect(staff().querySelector('ellipse')).toBeNull();
    expect(staff().querySelector('text[x="56"]')?.textContent).toBe('A0');
  });
});

describe("saved time-window review", () => {
  it("moves archived replay geometry without per-frame queries or React commits and retains saved trail lengths", async () => {
    const take = (await performanceFixture([{ receivedAtMs: 200 }, { receivedAtMs: 20_100, bytes: [0x80, 60, 0] }], { end: 60_100 })).loaded;
    const model = timelineFromTake(take); const query = vi.spyOn(model, "view"); const f = fixture(); const commits = vi.fn();
    let position = 0; let active = true;
    const replay: ImprovReplayTransport = { takeId: take.record.takeId, positionMs: () => position, active: () => active };
    const source = () => model;
    const view = render(<Profiler id="review" onRender={commits}><ImprovPerformanceStaff source={source} context={context} replay={replay} clock={f.clock} /></Profiler>);
    const initialQueries = query.mock.calls.length, initialCommits = commits.mock.calls.length;
    const trail = staff().querySelector('[data-attack="1"] line')!; const length = trail.getAttribute("x2");
    for (let i = 0; i < 60; i++) { position = i * 200; f.frame(90_000 + i); }
    expect(query.mock.calls.length).toBe(initialQueries); expect(commits.mock.calls.length).toBe(initialCommits);
    expect(staff().getAttribute("data-playhead-ms")).toBe("11800"); expect(staff().getAttribute("data-window-start-ms")).toBe("2200");
    expect(screen.getByText(/Saved performance.*replay position/)).toBeTruthy();
    expect(trail.getAttribute("x2")).toBe(length);
    f.tick(99_000); expect(query.mock.calls.length).toBe(initialQueries + 1);
    active = false; position = 12_345; f.frame(100_000);
    expect(staff().getAttribute("data-playhead-ms")).toBe("12345"); expect(f.callbacks.size).toBe(0);
    const frozen = staff().outerHTML; const stale = f.clock.request.mock.calls.at(-1)![0]; view.unmount(); stale(999_999);
    expect(f.callbacks.size).toBe(0); expect(vi.getTimerCount()).toBe(0); expect(frozen).toContain('data-playhead-ms="12345"');
  });
  it("caps dense archived queries at 10 Hz and never displays over 512 notes", async () => {
    const take = (await performanceFixture(Array.from({ length: 1200 }, (_, i) => ({ receivedAtMs: 100 + i * 100 })), { end: 150_100 })).loaded;
    const model = timelineFromTake(take); const query = vi.spyOn(model, "view"); const f = fixture();
    let position = 110_000;
    const replay = { takeId: take.record.takeId, positionMs: () => position, active: () => true };
    render(<ImprovPerformanceStaff source={() => model} context={context} replay={replay} clock={f.clock} />);
    expect(staff().querySelectorAll('[data-attack]')).toHaveLength(512); expect(screen.getByText(/display detail limited/)).toBeTruthy();
    const before = query.mock.calls.length;
    for (let tick = 0; tick < 10; tick++) { for (let frame = 0; frame < 6; frame++) { position += 16; f.frame(position); } f.tick(position); }
    expect(query.mock.calls.length - before).toBe(10); expect(staff().querySelectorAll('[data-attack]')).toHaveLength(512);
  });
  it("uses the 6-second narrow replay window and the same 80 percent threshold", () => {
    vi.stubGlobal("ResizeObserver", class { constructor(callback: ResizeObserverCallback) { callback([{ contentRect: { width: 320 } } as ResizeObserverEntry], this as unknown as ResizeObserver); } observe() {} disconnect() {} });
    const f = fixture(); f.model.finish(30_000, true); let position = 4000;
    const replay = { takeId: "one", positionMs: () => position, active: () => true };
    render(<ImprovPerformanceStaff source={f.source} context={context} clock={f.clock} replay={replay} />);
    expect(screen.getByText(/6-second window/)).toBeTruthy(); f.frame(100_000);
    expect(staff().getAttribute('data-window-start-ms')).toBe('0');
    position = 5000; f.frame(100_001); expect(staff().getAttribute('data-window-start-ms')).toBe('200');
    expect(Number(staff().querySelector('[aria-label="Blue elapsed-time playhead"]')!.getAttribute('x1'))).toBeCloseTo(256.8);
  });
  it("updates reduced-motion replay at ten Hz without RAF even before scrolling begins", () => {
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const f = fixture(); f.model.finish(30_000, true); let position = 0;
    const replay = { takeId: "one", positionMs: () => position, active: () => true };
    render(<ImprovPerformanceStaff source={f.source} context={context} clock={f.clock} replay={replay} />);
    position = 500; f.tick(99_000); expect(staff().getAttribute('data-playhead-ms')).toBe('500'); expect(f.callbacks.size).toBe(0);
  });
  it("disables manual navigation during replay, restores it after Stop and follows a fresh replay", async () => {
    const take = (await performanceFixture([{}], { end: 30_100 })).loaded; let position = 15_000; let active = true;
    const replay = { takeId: take.record.takeId, positionMs: () => position, active: () => active };
    const props = { take, playing: true, disabled: false, error: '', onPlay: vi.fn(), onStop: vi.fn(), onMidi: vi.fn(), context };
    const view = render(<StrictMode><ImprovTakeReview {...props} transport={replay} /></StrictMode>);
    const slider = screen.getByRole('slider') as HTMLInputElement;
    expect(slider.disabled).toBe(true); expect(slider.value).toBe('5400');
    expect((screen.getByRole('button', { name: 'Earlier 10 seconds' }) as HTMLButtonElement).disabled).toBe(true);
    active = false; view.rerender(<StrictMode><ImprovTakeReview {...props} playing={false} transport={replay} /></StrictMode>);
    expect(slider.disabled).toBe(false); fireEvent.change(slider, { target: { value: '1000' } }); expect(slider.value).toBe('1000');
    position = 0; active = true; const next = { ...replay };
    view.rerender(<StrictMode><ImprovTakeReview {...props} transport={next} /></StrictMode>);
    expect(slider.value).toBe('0'); expect(staff().getAttribute('data-playhead-ms')).toBe('0');
    const other = structuredClone(take); Reflect.set(other.record, 'takeId', 'replacement');
    view.rerender(<ImprovTakeReview {...props} take={other} playing={false} transport={next} />);
    expect((screen.getByRole('slider') as HTMLInputElement).value).toBe('0');
  });
  it("reopens immutable history, navigates by labeled controls, and resets selection", async () => {
    vi.useRealTimers();
    const first = (await performanceFixture([{ receivedAtMs: 200, bytes: [0x90, 60, 90] }, { receivedAtMs: 300, bytes: [0x80, 60, 0] },
      { receivedAtMs: 20_100, bytes: [0x90, 67, 90] }], { end: 30_100 })).loaded;
    const original = structuredClone(first);
    const props = { playing: false, disabled: false, error: "", onPlay: vi.fn(), onStop: vi.fn(), onMidi: vi.fn(), context };
    const view = render(<ImprovTakeReview take={first} {...props} />);
    expect(staff().querySelector('[data-pitch="60"]')).toBeTruthy(); expect(staff().querySelector('[data-pitch="67"]')).toBeNull();
    fireEvent.change(screen.getByRole("slider", { name: "Review time position" }), { target: { value: "19000" } });
    expect(staff().querySelector('[data-pitch="67"]')).toBeTruthy(); expect(staff().querySelector('[data-pitch="60"]')).toBeNull();
    expect(screen.getByRole("slider").getAttribute("aria-valuetext")).toContain("19.0 seconds");
    fireEvent.click(screen.getByRole("button", { name: "Earlier 10 seconds" })); expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("9000");
    const next = structuredClone(first); Reflect.set(next.record, "takeId", "two"); Reflect.set(next.record, "number", 2);
    view.rerender(<ImprovTakeReview take={next} {...props} />); expect((screen.getByRole("slider") as HTMLInputElement).value).toBe("0");
    expect(first).toEqual(original); expect(screen.getByRole("img").getAttribute("aria-describedby")).toBeTruthy();
  });
});
