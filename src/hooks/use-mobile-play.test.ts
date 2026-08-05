import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useMobilePlay } from "./use-mobile-play";

type Deferred = Readonly<{
  promise: Promise<void>;
  reject: (reason?: unknown) => void;
  resolve: () => void;
}>;

function deferred(): Deferred {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

const requestFullscreen = vi.fn<() => Promise<void>>();
const exitFullscreen = vi.fn<() => Promise<void>>();
const lock = vi.fn<(orientation: "landscape") => Promise<void>>();
const unlock = vi.fn<() => void>();
let fullscreenElement: Element | null;

beforeEach(() => {
  vi.clearAllMocks();
  fullscreenElement = null;

  Object.defineProperty(document, "fullscreenElement", {
    configurable: true,
    get: () => fullscreenElement,
  });
  Object.defineProperty(document.documentElement, "requestFullscreen", {
    configurable: true,
    value: requestFullscreen,
  });
  Object.defineProperty(document, "exitFullscreen", {
    configurable: true,
    value: exitFullscreen,
  });
  Object.defineProperty(screen, "orientation", {
    configurable: true,
    value: { lock, unlock },
  });

  requestFullscreen.mockImplementation(async () => {
    fullscreenElement = document.documentElement;
  });
  exitFullscreen.mockImplementation(async () => {
    fullscreenElement = null;
  });
  lock.mockResolvedValue();
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(document.documentElement, "requestFullscreen");
  Reflect.deleteProperty(document, "exitFullscreen");
  Reflect.deleteProperty(document, "fullscreenElement");
  Reflect.deleteProperty(screen, "orientation");
});

async function enterAndSettle(
  result: { current: ReturnType<typeof useMobilePlay> },
) {
  act(() => result.current.enterMobilePlay());
  await waitFor(() => expect(lock).toHaveBeenCalledWith("landscape"));
}

describe("useMobilePlay", () => {
  it("starts inactive and activates layout state immediately", () => {
    const { result } = renderHook(() => useMobilePlay());
    expect(result.current.isMobilePlayMode).toBe(false);

    act(() => result.current.enterMobilePlay());

    expect(result.current.isMobilePlayMode).toBe(true);
  });

  it("tolerates missing and rejected fullscreen requests", async () => {
    Reflect.deleteProperty(document.documentElement, "requestFullscreen");
    const missing = renderHook(() => useMobilePlay());
    act(() => missing.result.current.enterMobilePlay());
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
    expect(missing.result.current.isMobilePlayMode).toBe(true);
    missing.unmount();

    requestFullscreen.mockRejectedValue(new Error("refused"));
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      configurable: true,
      value: requestFullscreen,
    });
    const rejected = renderHook(() => useMobilePlay());
    act(() => rejected.result.current.enterMobilePlay());
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(2));
    expect(rejected.result.current.isMobilePlayMode).toBe(true);
  });

  it("tolerates missing and rejected orientation locks", async () => {
    Object.defineProperty(screen, "orientation", {
      configurable: true,
      value: {},
    });
    const missing = renderHook(() => useMobilePlay());
    act(() => missing.result.current.enterMobilePlay());
    await waitFor(() => expect(requestFullscreen).toHaveBeenCalledTimes(1));
    expect(missing.result.current.isMobilePlayMode).toBe(true);
    missing.unmount();

    Object.defineProperty(screen, "orientation", {
      configurable: true,
      value: { lock, unlock },
    });
    lock.mockRejectedValue(new Error("refused"));
    const rejected = renderHook(() => useMobilePlay());
    act(() => rejected.result.current.enterMobilePlay());
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
    expect(rejected.result.current.isMobilePlayMode).toBe(true);
  });

  it("tracks acquired fullscreen and orientation and releases both on exit", async () => {
    const { result } = renderHook(() => useMobilePlay());
    await enterAndSettle(result);

    act(() => result.current.exitMobilePlay());

    expect(result.current.isMobilePlayMode).toBe(false);
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("releases orientation only when Prelude acquired it", async () => {
    lock.mockRejectedValue(new Error("refused"));
    const { result } = renderHook(() => useMobilePlay());
    act(() => result.current.enterMobilePlay());
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));

    act(() => result.current.exitMobilePlay());

    expect(unlock).not.toHaveBeenCalled();
  });

  it("leaves unrelated fullscreen state alone", async () => {
    fullscreenElement = document.createElement("div");
    const { result } = renderHook(() => useMobilePlay());
    act(() => result.current.enterMobilePlay());
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));

    act(() => result.current.exitMobilePlay());

    expect(requestFullscreen).not.toHaveBeenCalled();
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it("performs acquired browser cleanup on unmount", async () => {
    const { result, unmount } = renderHook(() => useMobilePlay());
    await enterAndSettle(result);

    unmount();

    expect(unlock).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("prevents stale fullscreen requests from reacquiring state after exit", async () => {
    const fullscreenRequest = deferred();
    requestFullscreen.mockImplementation(async () => {
      await fullscreenRequest.promise;
      fullscreenElement = document.documentElement;
    });
    const { result } = renderHook(() => useMobilePlay());
    act(() => result.current.enterMobilePlay());
    act(() => result.current.exitMobilePlay());

    fullscreenRequest.resolve();
    await waitFor(() => expect(exitFullscreen).toHaveBeenCalledTimes(1));

    expect(result.current.isMobilePlayMode).toBe(false);
    expect(lock).not.toHaveBeenCalled();
  });

  it("prevents stale orientation requests from reacquiring state after exit", async () => {
    const orientationRequest = deferred();
    lock.mockReturnValue(orientationRequest.promise);
    const { result } = renderHook(() => useMobilePlay());
    act(() => result.current.enterMobilePlay());
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));
    act(() => result.current.exitMobilePlay());

    orientationRequest.resolve();
    await waitFor(() => expect(unlock).toHaveBeenCalledTimes(1));

    expect(result.current.isMobilePlayMode).toBe(false);
  });

  it("handles repeated enter and exit calls without duplicate acquisition or cleanup", async () => {
    const { result } = renderHook(() => useMobilePlay());
    act(() => {
      result.current.enterMobilePlay();
      result.current.enterMobilePlay();
    });
    await waitFor(() => expect(lock).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.exitMobilePlay();
      result.current.exitMobilePlay();
    });

    expect(requestFullscreen).toHaveBeenCalledTimes(1);
    expect(unlock).toHaveBeenCalledTimes(1);
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
    expect(result.current.isMobilePlayMode).toBe(false);
  });
});
