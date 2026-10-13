// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useImprovReplay } from "./use-improv-replay";
import { performanceFixture } from "../improv-test-fixture";

const sound = vi.hoisted(() => ({ release: vi.fn(), dispose: vi.fn(), fail: false }));
vi.mock("../improv-piano-voices", () => ({ createImprovPianoVoices: () => ({
  attack: () => ({ started: sound.fail ? Promise.resolve(false) : Promise.resolve(true), release: sound.release }), dispose: sound.dispose,
}) }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.clearAllMocks(); sound.fail = false; });

describe("replay transport ownership", () => {
  it("publishes one stable run reader, freezes Stop, restarts and retains natural completion", async () => {
    const take = (await performanceFixture([{ receivedAtMs: 100 }], { end: 5100 })).loaded;
    vi.useFakeTimers(); let now = 10_000; vi.spyOn(performance, "now").mockImplementation(() => now);
    const { result } = renderHook(() => useImprovReplay(), { wrapper: StrictMode });
    act(() => result.current.play(take)); const first = result.current.transport!;
    expect(first.positionMs()).toBe(0); now += 1200; expect(first.positionMs()).toBe(1200);
    act(() => result.current.stop()); expect(result.current.transport).toBe(first); expect(first.positionMs()).toBe(1200);
    now += 4000; act(() => result.current.play(take)); const next = result.current.transport!;
    expect(next).not.toBe(first); expect(next.positionMs()).toBe(0); expect(first.positionMs()).toBe(1200);
    now += 5000; await act(async () => { vi.advanceTimersByTime(5000); await Promise.resolve(); });
    expect(result.current.playing).toBe(false); expect(result.current.transport).toBe(next); expect(next.positionMs()).toBe(5000);
    expect(sound.dispose).toHaveBeenCalledTimes(2); expect(vi.getTimerCount()).toBe(0);
  });
  it("keeps failed position and ignores stale completion after replacing a run", async () => {
    const take = (await performanceFixture([{ receivedAtMs: 100 }], { end: 5100 })).loaded;
    vi.useFakeTimers(); let now = 100; vi.spyOn(performance, "now").mockImplementation(() => now);
    const { result } = renderHook(() => useImprovReplay());
    act(() => result.current.play(take)); const old = result.current.transport!;
    now = 500; act(() => result.current.play(take)); const next = result.current.transport!;
    await act(async () => { await Promise.resolve(); }); expect(result.current.playing).toBe(true); expect(old.positionMs()).toBe(400);
    sound.fail = true; act(() => result.current.play(take)); const failed = result.current.transport!;
    now = 650; await act(async () => { await Promise.resolve(); });
    expect(next.positionMs()).toBe(0); expect(failed.positionMs()).toBe(150); expect(result.current.error).toMatch(/could not continue/);
    now = 3000; expect(failed.positionMs()).toBe(150); expect(vi.getTimerCount()).toBe(0);
  });
  it("disposes Strict Mode ownership on unmount and fences late completions", async () => {
    const take = (await performanceFixture([{ receivedAtMs: 100 }], { end: 5100 })).loaded;
    vi.useFakeTimers(); let now = 100; vi.spyOn(performance, "now").mockImplementation(() => now);
    const view = renderHook(() => useImprovReplay(), { wrapper: StrictMode });
    act(() => view.result.current.play(take)); const run = view.result.current.transport!; now += 700;
    view.unmount(); await Promise.resolve(); now += 5000;
    expect(run.active()).toBe(false); expect(run.positionMs()).toBe(700); expect(sound.release).toHaveBeenCalledOnce();
    expect(sound.dispose).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });
});
