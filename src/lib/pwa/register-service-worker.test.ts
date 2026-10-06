import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { registerServiceWorker, type PwaUpdateController } from "./register-service-worker";

const boundary = vi.hoisted(() => ({ options: undefined as Parameters<typeof import("virtual:pwa-register").registerSW>[0], activate: vi.fn(async () => {}) }));
vi.mock("virtual:pwa-register", () => ({ registerSW: vi.fn((options) => { boundary.options = options; return boundary.activate; }) }));

class Worker extends EventTarget {
  constructor(public state: ServiceWorkerState) { super(); }
  change(state: ServiceWorkerState) { this.state = state; this.dispatchEvent(new Event("statechange")); }
}
class Registration extends EventTarget {
  waiting: ServiceWorker | null = null;
  installing: ServiceWorker | null = null;
  active: ServiceWorker | null = null;
  update = vi.fn(async () => this as unknown as ServiceWorkerRegistration);
}
const sw = (worker: Worker) => worker as unknown as ServiceWorker;
let serviceWorkers: EventTarget & { controller: ServiceWorker | null };
let visible: "visible" | "hidden";
let online: boolean;
const controllers: PwaUpdateController[] = [];

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-05T12:00:00Z"));
  visible = "visible"; online = true;
  serviceWorkers = Object.assign(new EventTarget(), { controller: sw(new Worker("activated")) as ServiceWorker | null });
  Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: serviceWorkers });
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visible);
  vi.spyOn(navigator, "onLine", "get").mockImplementation(() => online);
  boundary.options = undefined; boundary.activate.mockReset(); boundary.activate.mockResolvedValue();
});
afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.dispose());
  Reflect.deleteProperty(navigator, "serviceWorker");
  vi.restoreAllMocks(); vi.useRealTimers();
});

function start(waiting = true, confirm = vi.fn(() => true)) {
  const registration = new Registration(); registration.active = serviceWorkers.controller;
  const worker = new Worker("installed"); if (waiting) registration.waiting = sw(worker);
  const reload = vi.fn();
  const controller = registerServiceWorker({ reloadPage: reload, confirmReload: confirm }); controllers.push(controller);
  boundary.options?.onRegisteredSW?.("/prelude/sw.js", registration as unknown as ServiceWorkerRegistration);
  const activate = () => {
    registration.waiting = null; registration.active = sw(worker); serviceWorkers.controller = sw(worker);
    worker.change("activated");
    serviceWorkers.dispatchEvent(new Event("controllerchange"));
    boundary.options?.onNeedReload?.();
  };
  return { controller, registration, worker, reload, confirm, activate };
}

describe("Prelude-owned PWA lifecycle", () => {
  it("registers immediately with an overriding reload callback and reports an existing waiting worker", () => {
    const { controller, reload } = start();
    expect(boundary.options).toMatchObject({ immediate: true, onNeedReload: expect.any(Function) });
    expect(controller.getSnapshot()).toMatchObject({ available: true, activated: false, updating: false });
    boundary.options?.onNeedRefresh?.(); boundary.options?.onNeedReload?.();
    expect(reload).not.toHaveBeenCalled();
  });
  it("deduplicates repeated notifications and the same worker's later activation", () => {
    const { controller, activate, reload } = start();
    const id = controller.getSnapshot().updateId;
    boundary.options?.onNeedRefresh?.(); boundary.options?.onNeedRefresh?.(); activate();
    expect(controller.getSnapshot()).toMatchObject({ updateId: id, available: true, activated: true });
    expect(reload).not.toHaveBeenCalled();
  });
  it("does nothing when explicit reload confirmation is cancelled", async () => {
    const { controller, reload, confirm } = start(true, vi.fn(() => false));
    await controller.requestReload();
    expect(confirm).toHaveBeenCalledOnce();
    expect(boundary.activate).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled();
    expect(controller.getSnapshot().available).toBe(true);
  });
  it("waits for confirmed activation, then reloads once without permission surviving callbacks", async () => {
    const { controller, activate, reload, confirm } = start();
    const request = controller.requestReload();
    await Promise.resolve();
    expect(boundary.activate).toHaveBeenCalledOnce(); expect(reload).not.toHaveBeenCalled();
    activate(); await request;
    expect(reload).toHaveBeenCalledOnce(); expect(confirm).toHaveBeenCalledOnce();
    // reload() returning represents a browser/navigation cancellation: no retry.
    boundary.options?.onNeedReload?.(); serviceWorkers.dispatchEvent(new Event("controllerchange"));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(reload).toHaveBeenCalledOnce();
    await controller.requestReload();
    expect(confirm).toHaveBeenCalledTimes(2); expect(reload).toHaveBeenCalledTimes(2);
    expect(boundary.activate).toHaveBeenCalledOnce();
  });
  it("deduplicates simultaneous explicit attempts", async () => {
    const { controller, activate, reload, confirm } = start();
    const first = controller.requestReload(); const second = controller.requestReload();
    activate(); await Promise.all([first, second]);
    expect(confirm).toHaveBeenCalledOnce(); expect(reload).toHaveBeenCalledOnce();
  });
  it("does not reload when activation rejects", async () => {
    const { controller, reload } = start();
    boundary.activate.mockRejectedValueOnce(new Error("Failed"));
    await controller.requestReload();
    expect(reload).not.toHaveBeenCalled();
    expect(controller.getSnapshot()).toMatchObject({ updating: false, error: expect.stringContaining("could not complete") });
  });
  it("does not reload or hang forever when activation produces no state transition", async () => {
    const { controller, reload } = start();
    const request = controller.requestReload();
    await vi.advanceTimersByTimeAsync(30_000); await request;
    expect(reload).not.toHaveBeenCalled(); expect(controller.getSnapshot().updating).toBe(false);
    expect(controller.getSnapshot().error).toBeTruthy();
  });
  it("rejects a replaced waiting worker without reload", async () => {
    const { controller, worker, reload } = start();
    const request = controller.requestReload(); worker.change("redundant"); await request;
    expect(reload).not.toHaveBeenCalled(); expect(controller.getSnapshot().error).toBeTruthy();
  });
  it("reports unsolicited external activation and only reloads after this tab confirms", async () => {
    const { controller, registration, worker, activate, reload } = start(false);
    registration.installing = sw(worker); registration.dispatchEvent(new Event("updatefound"));
    activate();
    expect(controller.getSnapshot()).toMatchObject({ activated: true, available: true });
    expect(reload).not.toHaveBeenCalled(); expect(boundary.activate).not.toHaveBeenCalled();
    await controller.requestReload();
    expect(reload).toHaveBeenCalledOnce(); expect(boundary.activate).not.toHaveBeenCalled();
  });
  it("notices a controller change even without a plugin refresh callback", () => {
    const { controller, registration, worker, reload } = start(false);
    worker.state = "activated"; registration.active = sw(worker); serviceWorkers.controller = sw(worker);
    serviceWorkers.dispatchEvent(new Event("controllerchange"));
    expect(controller.getSnapshot().activated).toBe(true); expect(reload).not.toHaveBeenCalled();
  });
  it("handles activation that happened before the refresh callback/request", async () => {
    const { controller, registration, worker, reload } = start();
    worker.state = "activated"; registration.waiting = null; registration.active = sw(worker);
    await controller.requestReload();
    expect(reload).toHaveBeenCalledOnce(); expect(boundary.activate).not.toHaveBeenCalled();
  });
  it("does not offer an update for the first worker installation", () => {
    serviceWorkers.controller = null;
    const { controller, registration, worker, reload } = start(false);
    registration.installing = sw(worker); registration.dispatchEvent(new Event("updatefound"));
    registration.active = sw(worker); worker.change("activated");
    expect(controller.getSnapshot().available).toBe(false); expect(reload).not.toHaveBeenCalled();
  });
  it("throttles online/foreground checks and checks hourly only while visible and online", async () => {
    const { controller, registration } = start(false);
    window.dispatchEvent(new Event("online")); document.dispatchEvent(new Event("visibilitychange"));
    await controller.checkForUpdates(); expect(registration.update).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(60_000);
    window.dispatchEvent(new Event("online")); await controller.checkForUpdates();
    expect(registration.update).toHaveBeenCalledTimes(1);
    document.dispatchEvent(new Event("visibilitychange")); await controller.checkForUpdates();
    expect(registration.update).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60 * 60 * 1000);
    expect(registration.update).toHaveBeenCalledTimes(2);
    visible = "hidden"; document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
    expect(registration.update).toHaveBeenCalledTimes(2);
    visible = "visible"; document.dispatchEvent(new Event("visibilitychange")); await controller.checkForUpdates();
    expect(registration.update).toHaveBeenCalledTimes(3);
    online = false; window.dispatchEvent(new Event("offline"));
    await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
    expect(registration.update).toHaveBeenCalledTimes(3);
    online = true; window.dispatchEvent(new Event("online")); await controller.checkForUpdates();
    expect(registration.update).toHaveBeenCalledTimes(4);
  });
  it("deduplicates concurrent checks and tolerates failure", async () => {
    const { controller, registration } = start(false);
    await vi.advanceTimersByTimeAsync(60_000);
    let finish: (value: ServiceWorkerRegistration) => void = () => {};
    registration.update.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const first = controller.checkForUpdates(); const second = controller.checkForUpdates();
    await Promise.resolve(); expect(registration.update).toHaveBeenCalledOnce();
    finish(registration as unknown as ServiceWorkerRegistration); await Promise.all([first, second]);
    await vi.advanceTimersByTimeAsync(60_000);
    registration.update.mockRejectedValueOnce(new Error("Offline"));
    await expect(controller.checkForUpdates()).resolves.toBeUndefined();
    expect(controller.getSnapshot().error).toBeNull();
  });
  it("cleans up timers/listeners and rejects pending activation on disposal", async () => {
    const { controller, registration, worker, reload } = start();
    const listener = vi.fn(); controller.subscribe(listener);
    const request = controller.requestReload(); controller.dispose(); listener.mockClear();
    worker.change("activated"); window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange")); boundary.options?.onNeedRefresh?.();
    await request; await vi.advanceTimersByTimeAsync(2 * 60 * 60 * 1000);
    expect(reload).not.toHaveBeenCalled(); expect(listener).not.toHaveBeenCalled();
    expect(registration.update).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });
  it("safely handles unsupported registration and a late registration after disposal", async () => {
    Reflect.deleteProperty(navigator, "serviceWorker");
    const controller = registerServiceWorker(); controllers.push(controller);
    expect(controller.getSnapshot().available).toBe(false);
    await controller.checkForUpdates(); await controller.requestReload();
    expect(vi.getTimerCount()).toBe(0);
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: serviceWorkers });
    const late = registerServiceWorker(); controllers.push(late); late.dispose();
    boundary.options?.onRegisteredSW?.("/prelude/sw.js", new Registration() as unknown as ServiceWorkerRegistration);
    expect(vi.getTimerCount()).toBe(0);
  });
  it("always gives the real browser confirmation the state-loss warning", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const reload = vi.fn();
    const controller = registerServiceWorker({ reloadPage: reload }); controllers.push(controller);
    const registration = new Registration(); registration.active = serviceWorkers.controller;
    registration.waiting = sw(new Worker("installed"));
    boundary.options?.onRegisteredSW?.("/prelude/sw.js", registration as unknown as ServiceWorkerRegistration);
    await controller.requestReload();
    expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/Active practice, reports, pending notes and unsaved or in-memory work may be lost/));
    expect(boundary.activate).not.toHaveBeenCalled(); expect(reload).not.toHaveBeenCalled();
  });
  it("does not start a queued check after the page becomes hidden", async () => {
    const { controller, registration } = start(false);
    await vi.advanceTimersByTimeAsync(60_000);
    const request = controller.checkForUpdates();
    visible = "hidden"; document.dispatchEvent(new Event("visibilitychange"));
    await request;
    expect(registration.update).not.toHaveBeenCalled();
  });
  it("does not break boot when browser policy prevents service-worker access", async () => {
    Object.defineProperty(navigator, "serviceWorker", { configurable: true, get: () => { throw new DOMException("Blocked", "SecurityError"); } });
    const controller = registerServiceWorker(); controllers.push(controller);
    expect(controller.getSnapshot().available).toBe(false);
    await controller.checkForUpdates(); await controller.requestReload(); controller.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
