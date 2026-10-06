import { registerSW } from "virtual:pwa-register";

export type PwaUpdateSnapshot = Readonly<{
  updateId: number;
  available: boolean;
  activated: boolean;
  updating: boolean;
  error: string | null;
}>;

export type PwaUpdateController = Readonly<{
  getSnapshot: () => PwaUpdateSnapshot;
  subscribe: (listener: () => void) => () => void;
  checkForUpdates: () => Promise<void>;
  requestReload: () => Promise<void>;
  dispose: () => void;
}>;

const CHECK_INTERVAL_MS = 60 * 60 * 1000;
const CHECK_THROTTLE_MS = 60 * 1000;
const ACTIVATION_TIMEOUT_MS = 30 * 1000;
const RELOAD_WARNING = "Reload Prelude now? Active practice, reports, pending notes and unsaved or in-memory work may be lost. Save or export anything you need first.";

/** One controller per application boot, outside React's Strict Mode lifecycle. */
export function registerServiceWorker({
  reloadPage = () => window.location.reload(),
  confirmReload = () => window.confirm(RELOAD_WARNING),
  now = Date.now,
}: Readonly<{ reloadPage?: () => void; confirmReload?: () => boolean; now?: () => number }> = {}): PwaUpdateController {
  let snapshot: PwaUpdateSnapshot = { updateId: 0, available: false, activated: false, updating: false, error: null };
  const subscribers = new Set<() => void>();
  const workers = new Map<ServiceWorker, EventListener>();
  const identities = new Map<ServiceWorker, number>();
  let registration: ServiceWorkerRegistration | undefined;
  let serviceWorkers: ServiceWorkerContainer | undefined;
  try { serviceWorkers = navigator.serviceWorker; } catch { /* Registration is unavailable in this context. */ }
  let baseline = serviceWorkers?.controller ?? null;
  let nextIdentity = 0;
  let disposed = false;
  let interval: number | undefined;
  let lastCheck = -Infinity;
  let check: Promise<void> | null = null;
  let cancelActivation: (() => void) | null = null;
  let activateWaiting: (() => Promise<void>) | undefined;

  const publish = (patch: Partial<PwaUpdateSnapshot>) => {
    if (disposed) return;
    const next = { ...snapshot, ...patch };
    if (Object.keys(next).every((key) => next[key as keyof PwaUpdateSnapshot] === snapshot[key as keyof PwaUpdateSnapshot])) return;
    snapshot = next;
    subscribers.forEach((listener) => listener());
  };
  const ready = (worker: ServiceWorker, activated: boolean) => {
    let id = identities.get(worker);
    if (id === undefined) { id = ++nextIdentity; identities.set(worker, id); }
    publish({ updateId: id, available: true, activated, ...(snapshot.updateId !== id ? { error: null } : {}) });
  };
  const sync = () => {
    if (disposed || !registration) return;
    const waiting = registration.waiting;
    if (waiting && waiting.state !== "redundant") { ready(waiting, false); return; }
    const active = registration.active;
    if (!baseline && active) { baseline = active; return; }
    if (active && active !== baseline && active.state === "activated") ready(active, true);
  };
  const watch = (worker: ServiceWorker | null) => {
    if (!worker || workers.has(worker)) return;
    const listener: EventListener = () => sync();
    workers.set(worker, listener);
    worker.addEventListener("statechange", listener);
  };
  const updateFound = () => watch(registration?.installing ?? null);
  const controllerChanged = () => {
    if (disposed) return;
    const controller = serviceWorkers?.controller;
    if (!baseline) { baseline = controller ?? null; return; }
    watch(controller ?? null);
    sync();
  };
  const eligible = () => !disposed && document.visibilityState === "visible" && navigator.onLine !== false;
  const checkForUpdates = (): Promise<void> => {
    if (!eligible() || !registration) return Promise.resolve();
    if (check) return check;
    if (now() - lastCheck < CHECK_THROTTLE_MS) return Promise.resolve();
    lastCheck = now();
    check = Promise.resolve().then(() => eligible() ? registration?.update() : undefined).then(() => { sync(); }).catch(() => {
      // Discovery failure is recoverable; it must not interrupt the current app.
    }).finally(() => { check = null; });
    return check;
  };
  const schedule = () => {
    if (interval !== undefined) window.clearInterval(interval);
    interval = eligible() && registration ? window.setInterval(() => { void checkForUpdates(); }, CHECK_INTERVAL_MS) : undefined;
  };
  const resume = () => { schedule(); void checkForUpdates(); };

  const waitForActivation = (worker: ServiceWorker) => {
    let clean = () => {};
    const promise = new Promise<void>((resolve, reject) => {
      const inspect = () => {
        if (worker.state === "activated") resolve();
        else if (worker.state === "redundant") reject(new Error("The waiting update was replaced."));
      };
      const timer = window.setTimeout(() => reject(new Error("The update did not activate in time.")), ACTIVATION_TIMEOUT_MS);
      cancelActivation = () => reject(new Error("Update controller disposed."));
      clean = () => { window.clearTimeout(timer); worker.removeEventListener("statechange", inspect); cancelActivation = null; };
      worker.addEventListener("statechange", inspect);
      inspect();
    });
    return { promise, clean: () => clean() };
  };

  const requestReload = async () => {
    if (disposed || snapshot.updating || !snapshot.available || !confirmReload()) return;
    publish({ updating: true, error: null });
    try {
      sync();
      const waiting = registration?.waiting;
      if (waiting && waiting.state !== "redundant") {
        if (!activateWaiting) throw new Error("Activation is unavailable.");
        const activation = waitForActivation(waiting);
        try {
          await Promise.all([Promise.resolve().then(activateWaiting), activation.promise]);
        } finally { activation.clean(); }
        if (registration?.active !== waiting && serviceWorkers?.controller !== waiting) throw new Error("The update is not active.");
      } else if (!snapshot.activated) {
        throw new Error("The update is no longer ready.");
      }
      if (disposed) return;
      sync();
      // Navigation belongs ONLY to this explicit, confirmed request. No worker
      // callback holds permission, so cancelled navigation can never auto-retry.
      reloadPage();
    } catch {
      publish({ error: "Prelude could not complete the update. Your current page is still open. Try Reload again when ready." });
    } finally { publish({ updating: false }); }
  };

  if (serviceWorkers) {
    serviceWorkers.addEventListener("controllerchange", controllerChanged);
    window.addEventListener("online", resume);
    window.addEventListener("offline", schedule);
    document.addEventListener("visibilitychange", resume);
    try {
      activateWaiting = registerSW({
        immediate: true,
        onNeedRefresh: sync,
        // Suppress the plugin's default location.reload in ALL cases, including
        // external/cross-tab activation. The callback reports state only.
        onNeedReload: sync,
        onRegisteredSW(_url, registered) {
          if (disposed || !registered) return;
          registration = registered;
          baseline ??= registered.active;
          lastCheck = now(); // register() already performs its discovery check.
          registration.addEventListener("updatefound", updateFound);
          watch(registration.installing); watch(registration.waiting); watch(registration.active);
          sync(); schedule();
        },
        onRegisterError(error) { if (!disposed) console.error("Prelude service worker registration failed.", error); },
      });
    } catch (error) { console.error("Prelude service worker registration failed.", error); }
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => { if (!disposed) subscribers.add(listener); return () => { subscribers.delete(listener); }; },
    checkForUpdates,
    requestReload,
    dispose() {
      if (disposed) return;
      disposed = true;
      if (interval !== undefined) window.clearInterval(interval);
      cancelActivation?.();
      serviceWorkers?.removeEventListener("controllerchange", controllerChanged);
      window.removeEventListener("online", resume); window.removeEventListener("offline", schedule);
      document.removeEventListener("visibilitychange", resume);
      registration?.removeEventListener("updatefound", updateFound);
      workers.forEach((listener, worker) => worker.removeEventListener("statechange", listener));
      workers.clear(); identities.clear(); subscribers.clear();
    },
  };
}
