// @vitest-environment jsdom
import { StrictMode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useImprovInsights } from "./use-improv-insights";
import { performanceFixture } from "../improv-test-fixture";
import { analyzeImprovTake } from "../insights/improv-musical-insights";
import type { ImprovInsightsResponse } from "../insights/improv-insights.worker";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: MessageEvent<ImprovInsightsResponse>) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor(public url: URL, public options: WorkerOptions) { FakeWorker.instances.push(this); }
  deliver(response: ImprovInsightsResponse) { this.onmessage?.({ data: response } as MessageEvent<ImprovInsightsResponse>); }
}
afterEach(() => { cleanup(); vi.unstubAllGlobals(); FakeWorker.instances = []; });

describe("take insights worker lifecycle", () => {
  it("requests module-worker analysis on mount and releases the worker after completion", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const take = (await performanceFixture([{}])).loaded;
    const view = renderHook(() => useImprovInsights(take));
    expect(view.result.current.status).toBe("loading");
    const worker = FakeWorker.instances[0];
    expect(worker.url.pathname).toContain("improv-insights.worker.ts");
    expect(worker.options).toEqual({ type: "module" }); expect(worker.postMessage).toHaveBeenCalledWith(take);
    const insights = analyzeImprovTake(take);
    act(() => worker.deliver({ status: "ready", insights }));
    expect(view.result.current).toEqual({ status: "ready", insights }); expect(worker.terminate).toHaveBeenCalledOnce();
  });
  it("fences stale Strict Mode, replaced-take and unmounted callbacks", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const take = (await performanceFixture([{}])).loaded;
    const next = structuredClone(take); Reflect.set(next.record, "takeId", "other-take");
    const view = renderHook(({ loaded }) => useImprovInsights(loaded), { initialProps: { loaded: take }, wrapper: StrictMode });
    const [strictStale, first] = FakeWorker.instances;
    expect(strictStale.terminate).toHaveBeenCalledOnce();
    act(() => strictStale.deliver({ status: "ready", insights: analyzeImprovTake(take) }));
    expect(view.result.current.status).toBe("loading");
    act(() => first.deliver({ status: "ready", insights: analyzeImprovTake(take) }));
    view.rerender({ loaded: next });
    expect(view.result.current.status).toBe("loading"); expect(first.terminate).toHaveBeenCalled();
    act(() => first.deliver({ status: "error" })); expect(view.result.current.status).toBe("loading");
    const current = FakeWorker.instances.at(-1)!;
    act(() => current.deliver({ status: "ready", insights: analyzeImprovTake(next) }));
    expect(view.result.current.status).toBe("ready");
    view.unmount(); act(() => current.onerror?.()); expect(current.terminate).toHaveBeenCalled();
  });
  it.each(["error", "messageerror", "analysis-error"])("handles %s without running analysis on the main thread", async failure => {
    vi.stubGlobal("Worker", FakeWorker);
    const take = (await performanceFixture()).loaded;
    const view = renderHook(() => useImprovInsights(take)); const worker = FakeWorker.instances[0];
    act(() => { if (failure === "error") worker.onerror?.(); else if (failure === "messageerror") worker.onmessageerror?.(); else worker.deliver({ status: "error" }); });
    expect(view.result.current.status).toBe("error"); expect(worker.terminate).toHaveBeenCalledOnce();
    act(() => worker.deliver({ status: "ready", insights: analyzeImprovTake(take) }));
    expect(view.result.current.status).toBe("error");
  });
  it("terminates pending work on take replacement and unmount without accepting late results", async () => {
    vi.stubGlobal("Worker", FakeWorker);
    const take = (await performanceFixture()).loaded; const next = structuredClone(take);
    Reflect.set(next.record, "takeId", "next-pending");
    const view = renderHook(({ loaded }) => useImprovInsights(loaded), { initialProps: { loaded: take } });
    const stale = FakeWorker.instances[0]; view.rerender({ loaded: next });
    expect(stale.terminate).toHaveBeenCalledOnce();
    act(() => stale.deliver({ status: "ready", insights: analyzeImprovTake(take) }));
    expect(view.result.current.status).toBe("loading");
    const pending = FakeWorker.instances[1]; view.unmount(); expect(pending.terminate).toHaveBeenCalledOnce();
    act(() => pending.deliver({ status: "ready", insights: analyzeImprovTake(next) }));
    expect(view.result.current.status).toBe("loading");
  });
  it("degrades when workers are missing or cannot be constructed", async () => {
    const take = (await performanceFixture()).loaded;
    vi.stubGlobal("Worker", undefined);
    const first = renderHook(() => useImprovInsights(take)); expect(first.result.current.status).toBe("unavailable"); first.unmount();
    vi.stubGlobal("Worker", class { constructor() { throw new Error("blocked"); } });
    const second = renderHook(() => useImprovInsights(take)); expect(second.result.current.status).toBe("error");
  });
  it("terminates a worker if posting the take fails", async () => {
    vi.stubGlobal("Worker", class extends FakeWorker { postMessage = vi.fn(() => { throw new Error("clone failed"); }); });
    const take = (await performanceFixture()).loaded;
    const view = renderHook(() => useImprovInsights(take));
    expect(view.result.current.status).toBe("error"); expect(FakeWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });
});
