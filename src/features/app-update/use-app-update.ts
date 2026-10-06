import { useState, useSyncExternalStore } from "react";
import type { PwaUpdateController, PwaUpdateSnapshot } from "@/lib/pwa/register-service-worker";
import { acknowledgeAppUpdates, browserAppUpdateStorage, readAppUpdateAcknowledgment, type AppUpdateStorage } from "./app-update-storage";
import { APP_UPDATES, unseenAppUpdates, type AppUpdate } from "./app-updates";

const idle: PwaUpdateSnapshot = { updateId: 0, available: false, activated: false, updating: false, error: null };
const idleSnapshot = () => idle;
const idleSubscribe = () => () => {};

export function useAppUpdate(controller?: PwaUpdateController, updates: readonly AppUpdate[] = APP_UPDATES, storage: AppUpdateStorage | null = browserAppUpdateStorage()) {
  const pwa = useSyncExternalStore(controller?.subscribe ?? idleSubscribe, controller?.getSnapshot ?? idleSnapshot, idleSnapshot);
  // What's New is a startup snapshot, never a modal opened by a worker event
  // in the middle of practice. Storage failure still permits dismissal this visit.
  const [displayed, setDisplayed] = useState(() => unseenAppUpdates(updates, readAppUpdateAcknowledgment(storage)));
  const [deferredId, setDeferredId] = useState<number | null>(null);
  return {
    pwa,
    displayed,
    deferred: deferredId === pwa.updateId,
    defer: () => setDeferredId(pwa.updateId),
    expand: () => setDeferredId(null),
    reload: () => controller?.requestReload(),
    acknowledge: () => { acknowledgeAppUpdates(storage, displayed); setDisplayed([]); },
  };
}
