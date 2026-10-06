import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PwaUpdateController, PwaUpdateSnapshot } from "@/lib/pwa/register-service-worker";
import { APP_UPDATES } from "./app-updates";
import { useAppUpdate } from "./use-app-update";

afterEach(cleanup);

describe("app update presentation state", () => {
  it("takes one startup snapshot and acknowledges it only when requested", () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    const { result, rerender } = renderHook(() => useAppUpdate(undefined, APP_UPDATES, storage));
    expect(result.current.displayed).toEqual(APP_UPDATES);
    expect(storage.setItem).not.toHaveBeenCalled();
    act(() => result.current.acknowledge());
    expect(result.current.displayed).toEqual([]);
    rerender();
    expect(result.current.displayed).toEqual([]);
    expect(storage.setItem).toHaveBeenCalledTimes(1);
  });
  it("dismisses notes for this visit after a failed write but offers them on a fresh visit", () => {
    const storage = { getItem: () => null, setItem: () => { throw new Error("Unavailable"); } };
    const first = renderHook(() => useAppUpdate(undefined, APP_UPDATES, storage));
    act(() => first.result.current.acknowledge());
    expect(first.result.current.displayed).toEqual([]);
    first.unmount();
    const second = renderHook(() => useAppUpdate(undefined, APP_UPDATES, storage));
    expect(second.result.current.displayed).toEqual(APP_UPDATES);
  });
  it("does not open notes already acknowledged or newer than this build", () => {
    for (const marker of [{ id: APP_UPDATES[0]!.id, sequence: 1 }, { id: "future", sequence: 3 }]) {
      const { result, unmount } = renderHook(() => useAppUpdate(undefined, APP_UPDATES, { getItem: () => JSON.stringify(marker), setItem: vi.fn() }));
      expect(result.current.displayed).toEqual([]); unmount();
    }
  });
  it("keeps Later for duplicate/external activation of the same update and cleans up subscriptions", () => {
    let state: PwaUpdateSnapshot = { updateId: 1, available: true, activated: false, updating: false, error: null };
    const listeners = new Set<() => void>();
    const reload = vi.fn(async () => {});
    const controller: PwaUpdateController = { getSnapshot: () => state, subscribe: (listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; }, requestReload: reload, checkForUpdates: vi.fn(async () => {}), dispose: vi.fn() };
    const { result, unmount } = renderHook(() => useAppUpdate(controller, [], null));
    act(() => result.current.defer());
    expect(result.current.deferred).toBe(true);
    expect(reload).not.toHaveBeenCalled();
    act(() => { state = { ...state, activated: true }; listeners.forEach((listener) => listener()); });
    expect(result.current.deferred).toBe(true);
    expect(result.current.displayed).toEqual([]);
    act(() => { state = { ...state, updateId: 2 }; listeners.forEach((listener) => listener()); });
    expect(result.current.deferred).toBe(false);
    unmount(); expect(listeners.size).toBe(0);
  });
});
