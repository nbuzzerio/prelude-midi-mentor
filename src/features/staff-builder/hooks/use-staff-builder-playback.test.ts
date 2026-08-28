import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicalEventPlaybackResult } from "@/lib/audio/musical-event-player";
import type { StaffBuilderScore } from "../staff-builder-types";
import { useStaffBuilderPlayback } from "./use-staff-builder-playback";

const mocks = vi.hoisted(() => ({ cancel: vi.fn(), play: vi.fn(), preload: vi.fn() }));
vi.mock("@/lib/audio/musical-event-player", () => ({ createMusicalEventPlayer: () => ({ cancel: mocks.cancel, play: mocks.play }) }));
vi.mock("@/lib/audio/grand-piano", () => ({ preloadGrandPianoSamples: mocks.preload }));

function deferred() {
  let resolve!: (result: MusicalEventPlaybackResult) => void;
  const completion = new Promise<MusicalEventPlaybackResult>((done) => { resolve = done; });
  return { completion, resolve };
}

function score(updatedAt = "2026-01-01T00:00:00.000Z"): StaffBuilderScore {
  return {
    schemaVersion: 3, annotations: [], id: "score", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt,
    tempoBpm: 120, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [],
    measures: [{ id: "m1", events: [
      { id: "treble", kind: "rest", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" } },
      { id: "bass", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
    ] }],
  };
}

function twoMeasureScore(): StaffBuilderScore {
  const first = score();
  return { ...first, measures: [first.measures[0]!, { ...first.measures[0]!, id: "m2", events: first.measures[0]!.events.map((event) => ({ ...event, id: `${event.id}-2` })) }] };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.play.mockReturnValue({ cancel: vi.fn(), completion: new Promise(() => undefined), startedAtMs: 1000 });
});
afterEach(() => vi.unstubAllGlobals());

describe("useStaffBuilderPlayback", () => {
  it("preloads samples, starts scoped playback with written minimum duration, and completes", async () => {
    const playback = deferred();
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: playback.completion, startedAtMs: 1000 });
    const { result } = renderHook(() => useStaffBuilderPlayback(score()));
    expect(mocks.preload).toHaveBeenCalledOnce();
    act(() => result.current.playCurrentMeasure(0));
    expect(mocks.play).toHaveBeenCalledWith([], { minimumDurationMs: 2000 });
    expect(result.current.state).toMatchObject({ status: "playing", scope: "current-measure", message: "Playing measure 1." });
    act(() => playback.resolve("completed"));
    await waitFor(() => expect(result.current.state.status).toBe("complete"));
  });

  it("stops explicitly and replaces rapid playback without accepting a stale completion", async () => {
    const first = deferred();
    const second = deferred();
    mocks.play.mockReturnValueOnce({ cancel: vi.fn(), completion: first.completion, startedAtMs: 1000 }).mockReturnValueOnce({ cancel: vi.fn(), completion: second.completion, startedAtMs: 1200 });
    const { result } = renderHook(() => useStaffBuilderPlayback(score()));
    act(() => { result.current.playEntirePiece(); result.current.playCurrentMeasure(0); });
    act(() => first.resolve("completed"));
    await Promise.resolve();
    expect(result.current.state).toMatchObject({ status: "playing", scope: "current-measure" });
    act(() => result.current.stop());
    expect(mocks.cancel).toHaveBeenCalled();
    expect(result.current.state).toMatchObject({ status: "idle", message: "Playback stopped." });
  });

  it("reports audio start failure without reporting completion", async () => {
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: Promise.resolve("failed"), startedAtMs: 1000 });
    const { result } = renderHook(() => useStaffBuilderPlayback(score()));
    act(() => result.current.playEntirePiece());
    await waitFor(() => expect(result.current.state.status).toBe("failed"));
    expect(result.current.state.message).toMatch(/Audio could not start/);
  });

  it("cancels on semantic score mutation but not an equivalent score wrapper", () => {
    const initial = score();
    const { result, rerender } = renderHook(({ current }) => useStaffBuilderPlayback(current), { initialProps: { current: initial } });
    act(() => result.current.playEntirePiece());
    mocks.cancel.mockClear();
    rerender({ current: { ...initial, measures: [...initial.measures] } });
    expect(mocks.cancel).not.toHaveBeenCalled();
    rerender({ current: score("2026-01-02T00:00:00.000Z") });
    expect(mocks.cancel).toHaveBeenCalledOnce();
    expect(result.current.state.message).toMatch(/score changed/);
  });

  it("cancels and suppresses pending work on unmount", async () => {
    const playback = deferred();
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: playback.completion, startedAtMs: 1000 });
    const { result, unmount } = renderHook(() => useStaffBuilderPlayback(score()));
    act(() => result.current.playEntirePiece());
    unmount();
    expect(mocks.cancel).toHaveBeenCalled();
    playback.resolve("completed");
    await Promise.resolve();
  });

  it("samples the returned monotonic origin continuously and clears on completion", async () => {
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const playback = deferred();
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: playback.completion, startedAtMs: 1000 });
    const { result } = renderHook(() => useStaffBuilderPlayback(score()));
    act(() => result.current.playEntirePiece());
    expect(result.current.position).toEqual({ measureIndex: 0, offsetTicks: 0 });
    act(() => frame?.(2000));
    expect(result.current.position).toEqual({ measureIndex: 0, offsetTicks: 960 });
    act(() => frame?.(3000));
    expect(result.current.position).toEqual({ measureIndex: 0, offsetTicks: 1920 });
    act(() => playback.resolve("completed"));
    await waitFor(() => expect(result.current.position).toBeNull());
  });

  it("quantizes reduced motion without changing playback and rejects stale replacement frames", () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { frames.push(callback); return frames.length; }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: true })));
    const { result } = renderHook(() => useStaffBuilderPlayback(score()));
    act(() => result.current.playEntirePiece());
    const staleFrame = frames[0]!;
    act(() => staleFrame(1666));
    expect(result.current.position?.offsetTicks).toBe(600);
    expect(mocks.play).toHaveBeenLastCalledWith([], { minimumDurationMs: 2000 });
    act(() => result.current.playFromHere({ measureIndex: 0, offsetTicks: 480 }));
    expect(result.current.position?.offsetTicks).toBe(480);
    act(() => staleFrame(2500));
    expect(result.current.position?.offsetTicks).toBe(480);
  });

  it("follows deterministic measure boundaries and restores no persisted editor state itself", () => {
    let frame: FrameRequestCallback | undefined;
    vi.stubGlobal("requestAnimationFrame", vi.fn((callback: FrameRequestCallback) => { frame = callback; return 1; }));
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
    const playback = deferred();
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: playback.completion, startedAtMs: 1000 });
    const captureCursor = Object.freeze({ measureIndex: 0, offsetTicks: 480 });
    const rhythmSelection = Object.freeze({ measureIndex: 0, eventId: "treble" });
    const { result } = renderHook(() => useStaffBuilderPlayback(twoMeasureScore()));
    act(() => result.current.playEntirePiece());
    act(() => frame?.(3000));
    expect(result.current.position).toEqual({ measureIndex: 1, offsetTicks: 0 });
    act(() => result.current.stop());
    expect(result.current.position).toBeNull();
    expect(captureCursor).toEqual({ measureIndex: 0, offsetTicks: 480 });
    expect(rhythmSelection).toEqual({ measureIndex: 0, eventId: "treble" });
  });
});
