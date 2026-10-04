import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useTuner } from "./use-tuner";
import type { createMicrophoneCapture } from "../microphone-capture";

const mock = vi.hoisted(() => ({ sessions: [] as {
  options: Parameters<typeof createMicrophoneCapture>[0]; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>; snapshot: ReturnType<typeof vi.fn>;
}[] }));
vi.mock("../microphone-capture", () => ({ createMicrophoneCapture: (options: Parameters<typeof createMicrophoneCapture>[0]) => {
  const session = { options, start: vi.fn(async () => {}), stop: vi.fn(), snapshot: vi.fn(() => ({ state: "listening", pitch: null, fresh: false, ageMs: null })) };
  mock.sessions.push(session); return session;
} }));
beforeEach(() => { vi.useFakeTimers(); mock.sessions.length = 0; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe("foreground tuner lifecycle", () => {
  it("starts only explicitly and offers Stop", () => {
    const { result } = renderHook(() => useTuner(true)); const session = mock.sessions[0];
    expect(session.start).not.toHaveBeenCalled(); expect(session.options.eligible()).toBe(true);
    act(() => result.current.start()); expect(session.start).toHaveBeenCalledOnce();
    act(() => result.current.stop()); expect(session.stop).toHaveBeenCalledOnce();
  });
  it("stops on hiding and requires explicit restart on return", () => {
    const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
    renderHook(() => useTuner(true)); const session = mock.sessions[0];
    visibility.mockReturnValue("hidden"); act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(session.options.eligible()).toBe(false); expect(session.stop).toHaveBeenCalledWith("paused", expect.any(String));
    visibility.mockReturnValue("visible"); act(() => document.dispatchEvent(new Event("visibilitychange"))); expect(session.start).not.toHaveBeenCalled();
  });
  it("stops on pagehide and freeze", () => {
    renderHook(() => useTuner(true)); const session = mock.sessions[0];
    act(() => window.dispatchEvent(new Event("pagehide"))); act(() => document.dispatchEvent(new Event("freeze")));
    expect(session.stop).toHaveBeenCalledTimes(2);
  });
  it("revokes eligibility immediately when a hosted run becomes active", () => {
    const { rerender } = renderHook(({ available }) => useTuner(available), { initialProps: { available: true } });
    const session = mock.sessions[0]; rerender({ available: false });
    expect(session.options.eligible()).toBe(false); expect(session.stop).toHaveBeenCalledWith("paused", expect.stringContaining("Practice Session"));
    rerender({ available: true }); expect(session.options.eligible()).toBe(true); expect(session.start).not.toHaveBeenCalled();
  });
  it("refreshes stale snapshots without capture callbacks", () => {
    const { result } = renderHook(() => useTuner(true)); const session = mock.sessions[0];
    act(() => session.options.onPitch({ state: "stable", pitch: { frequencyHz: 440, semitone: 69 }, fresh: true, ageMs: 0 }));
    expect(result.current.reading.fresh).toBe(true); act(() => vi.advanceTimersByTime(50)); expect(result.current.reading.pitch).toBeNull();
  });
  it("unmount cleans resources and handlers and ignores stale callbacks", () => {
    const { result, unmount } = renderHook(() => useTuner(true)); const session = mock.sessions[0], previous = result.current;
    unmount(); expect(session.options.eligible()).toBe(false); expect(session.stop).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
    session.options.onStatus({ state: "listening", message: "late" }); expect(result.current).toBe(previous);
    window.dispatchEvent(new Event("pagehide")); expect(session.stop).toHaveBeenCalledOnce();
  });
  it("survives Strict Mode with an eligible live session and no leaked timers", () => {
    const { unmount } = renderHook(() => useTuner(true), { reactStrictMode: true });
    expect(mock.sessions).toHaveLength(2); expect(mock.sessions[0].stop).toHaveBeenCalledOnce();
    expect(mock.sessions[1].options.eligible()).toBe(true); unmount(); expect(vi.getTimerCount()).toBe(0);
  });
});
