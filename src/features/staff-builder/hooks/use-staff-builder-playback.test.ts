import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicalEventPlaybackResult } from "@/lib/audio/musical-event-player";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { useStaffBuilderPlayback } from "./use-staff-builder-playback";

const mocks = vi.hoisted(() => ({ cancel: vi.fn(), play: vi.fn(), preload: vi.fn() }));
vi.mock("@/lib/audio/musical-event-player", () => ({ createMusicalEventPlayer: () => ({ cancel: mocks.cancel, play: mocks.play }) }));
vi.mock("@/lib/audio/grand-piano", () => ({ preloadGrandPianoSamples: mocks.preload }));

function deferred() {
  let resolve!: (result: MusicalEventPlaybackResult) => void;
  const completion = new Promise<MusicalEventPlaybackResult>((done) => { resolve = done; });
  return { completion, resolve };
}

function score(updatedAt = "2026-01-01T00:00:00.000Z"): StaffBuilderScoreV1 {
  return {
    schemaVersion: 1, id: "score", title: "Study", createdAt: "2026-01-01T00:00:00.000Z", updatedAt,
    tempoBpm: 120, initialKeySignatureId: "c-major", initialTimeSignature: "4/4", ties: [],
    measures: [{ id: "m1", events: [
      { id: "treble", kind: "rest", staff: "treble", startTick: 0, rhythm: { status: "final", duration: "whole" } },
      { id: "bass", kind: "rest", staff: "bass", startTick: 0, rhythm: { status: "final", duration: "whole" } },
    ] }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.play.mockReturnValue({ cancel: vi.fn(), completion: new Promise(() => undefined) });
});

describe("useStaffBuilderPlayback", () => {
  it("preloads samples, starts scoped playback with written minimum duration, and completes", async () => {
    const playback = deferred();
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: playback.completion });
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
    mocks.play.mockReturnValueOnce({ cancel: vi.fn(), completion: first.completion }).mockReturnValueOnce({ cancel: vi.fn(), completion: second.completion });
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
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: Promise.resolve("failed") });
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
    mocks.play.mockReturnValue({ cancel: vi.fn(), completion: playback.completion });
    const { result, unmount } = renderHook(() => useStaffBuilderPlayback(score()));
    act(() => result.current.playEntirePiece());
    unmount();
    expect(mocks.cancel).toHaveBeenCalled();
    playback.resolve("completed");
    await Promise.resolve();
  });
});
