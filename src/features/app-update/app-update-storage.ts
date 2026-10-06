import { parseAppUpdateAcknowledgment, type AppUpdate, type AppUpdateAcknowledgment } from "./app-updates";

export const APP_UPDATE_STORAGE_KEY = "prelude-app-updates-last-seen-v1";
export type AppUpdateStorage = Pick<Storage, "getItem" | "setItem">;

export function browserAppUpdateStorage(): AppUpdateStorage | null {
  try { return window.localStorage; } catch { return null; }
}

export function readAppUpdateAcknowledgment(storage: AppUpdateStorage | null): AppUpdateAcknowledgment | null {
  try {
    const raw = storage?.getItem(APP_UPDATE_STORAGE_KEY);
    return raw ? parseAppUpdateAcknowledgment(JSON.parse(raw)) : null;
  } catch { return null; }
}

/** Re-read at acknowledgment time so an older tab cannot lower a newer marker. */
export function acknowledgeAppUpdates(storage: AppUpdateStorage | null, displayed: readonly AppUpdate[]): boolean {
  const newest = displayed.reduce<AppUpdate | null>((latest, update) => !latest || update.sequence > latest.sequence ? update : latest, null);
  if (!newest || !storage) return false;
  try {
    const raw = storage.getItem(APP_UPDATE_STORAGE_KEY);
    let existing: AppUpdateAcknowledgment | null = null;
    try { existing = raw ? parseAppUpdateAcknowledgment(JSON.parse(raw)) : null; } catch { /* Replace malformed state only. */ }
    if (existing && (existing.sequence > newest.sequence
      || (existing.sequence === newest.sequence && existing.id === newest.id))) return true;
    storage.setItem(APP_UPDATE_STORAGE_KEY, JSON.stringify({ id: newest.id, sequence: newest.sequence }));
    return true;
  } catch { return false; }
}
