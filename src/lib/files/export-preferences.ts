import { exportNativeApi, exportPickerCanceled, type ExportDirectoryHandle } from "./native-save";

export const EXPORT_PREFERENCES_DATABASE = "prelude-export-preferences";
const STORE = "preferences", KEY = "preferred-directory";
export interface ExportPreferenceStorage {
  read(): Promise<unknown>;
  write(directory: ExportDirectoryHandle | null): Promise<void>;
}

export function indexedDbExportPreferences(factory: () => IDBFactory | undefined = () => globalThis.indexedDB): ExportPreferenceStorage {
  async function transact(write: boolean, directory?: ExportDirectoryHandle | null): Promise<unknown> {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      let settled = false;
      const fail = () => { settled = true; reject(new Error("Export preference storage unavailable")); };
      try {
        const idb = factory(); if (!idb) { fail(); return; }
        const request = idb.open(EXPORT_PREFERENCES_DATABASE, 1);
        request.onupgradeneeded = () => {
          if (settled) { request.transaction?.abort(); return; }
          if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
        };
        request.onerror = fail; request.onblocked = fail;
        request.onsuccess = () => {
          if (settled) { request.result.close(); return; }
          settled = true; request.result.onversionchange = () => request.result.close(); resolve(request.result);
        };
      } catch { fail(); }
    });
    try {
      return await new Promise<unknown>((resolve, reject) => {
        const transaction = db.transaction(STORE, write ? "readwrite" : "readonly");
        let value: unknown;
        transaction.oncomplete = () => resolve(value);
        transaction.onabort = transaction.onerror = () => reject(new Error("Export preference transaction failed"));
        try {
          const store = transaction.objectStore(STORE);
          const request = write ? directory ? store.put({ version: 1, directory }, KEY) : store.delete(KEY) : store.get(KEY);
          request.onsuccess = () => { value = request.result; };
          request.onerror = () => reject(new Error("Export preference request failed"));
        } catch (error) { try { transaction.abort(); } catch { /* Already finished. */ } reject(error); }
      });
    } finally { db.close(); }
  }
  return { read: () => transact(false), write: async directory => { await transact(true, directory); } };
}

export type ExportPreferenceState = Readonly<{
  loaded: boolean; busy: boolean; directory: ExportDirectoryHandle | null;
  permission: PermissionState | "unavailable"; remembered: boolean; message: string;
}>;
const initial: ExportPreferenceState = { loaded: false, busy: false, directory: null, permission: "unavailable", remembered: false, message: "" };
function directoryFromRecord(value: unknown): ExportDirectoryHandle | null {
  if (value == null) return null;
  const record = value as { version?: unknown; directory?: Partial<ExportDirectoryHandle> };
  const directory = record.directory;
  if (record.version !== 1 || directory?.kind !== "directory" || typeof directory.name !== "string"
    || typeof directory.queryPermission !== "function" || typeof directory.requestPermission !== "function") throw new Error("Stale preference");
  return directory as ExportDirectoryHandle;
}

/** Independent of React and every musical evidence/recording database. */
export class ExportPreferences {
  private state = initial;
  private listeners = new Set<() => void>();
  private loading: Promise<void> | null = null;
  private generation = 0;
  constructor(private readonly storage: ExportPreferenceStorage = indexedDbExportPreferences()) {}
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish(update: Partial<ExportPreferenceState>) { this.state = { ...this.state, ...update }; this.listeners.forEach(listener => listener()); }
  load = (): Promise<void> => {
    if (!this.state.loaded && this.loading) return this.loading;
    if (this.state.loaded) {
      if (!this.state.directory || this.state.busy) return Promise.resolve();
      const directory = this.state.directory, generation = this.generation;
      this.publish({ loaded: false });
      this.loading = (async () => {
        let permission: ExportPreferenceState["permission"] = "unavailable";
        try { permission = await directory.queryPermission({ mode: "readwrite" }); } catch { /* Stale or expired access; never prompt automatically. */ }
        if (generation === this.generation) this.publish({ loaded: true, permission });
      })();
      return this.loading;
    }
    const generation = this.generation;
    this.loading = (async () => {
      try {
        const directory = directoryFromRecord(await this.storage.read());
        let permission: ExportPreferenceState["permission"] = "unavailable";
        if (directory) { try { permission = await directory.queryPermission({ mode: "readwrite" }); } catch { /* Stale/expired handle. */ } }
        if (generation === this.generation) this.publish({ loaded: true, directory, permission, remembered: Boolean(directory) });
      } catch { if (generation === this.generation) this.publish({ loaded: true, message: "The remembered export folder could not be loaded. Choose it again in Settings. Normal downloads remain available." }); }
    })();
    return this.loading;
  };
  choose = (): Promise<void> => {
    if (this.state.busy) return Promise.resolve();
    const api = exportNativeApi();
    if (!api) { this.publish({ message: "Preferred folders are unavailable in this browser or context. Use normal downloads." }); return Promise.resolve(); }
    const generation = ++this.generation; this.publish({ busy: true, message: "" });
    let picker: Promise<ExportDirectoryHandle>;
    // No await before native invocation: the original click retains activation.
    try { picker = api.showDirectoryPicker({ mode: "readwrite" }); }
    catch { this.publish({ busy: false, loaded: true, message: "Folder selection is restricted. Your current preference is unchanged." }); return Promise.resolve(); }
    return picker.then(async directory => {
      if (generation !== this.generation) return;
      directoryFromRecord({ version: 1, directory });
      let permission: ExportPreferenceState["permission"] = "unavailable";
      try { permission = await directory.queryPermission({ mode: "readwrite" }); } catch { /* Selection does not establish permanent permission. */ }
      let remembered = true, message = "";
      try { await this.storage.write(directory); } catch { remembered = false; message = "Folder selected for this tab only. Browser storage could not remember it."; }
      if (generation === this.generation) this.publish({ loaded: true, directory, permission, remembered, message });
    }).catch(error => { if (generation === this.generation) this.publish({ loaded: true, message: exportPickerCanceled(error) ? "Folder selection canceled. Your current preference is unchanged." : "The folder is unavailable. Choose it again or use normal downloads." }); })
      .finally(() => { if (generation === this.generation) this.publish({ busy: false }); });
  };
  renew = (): Promise<void> => {
    if (this.state.busy || !this.state.directory) return Promise.resolve();
    const directory = this.state.directory, generation = ++this.generation;
    this.publish({ loaded: true, busy: true, message: "" });
    let request: Promise<PermissionState>;
    // Request directly from the user's Check/Renew Access click, never at startup.
    try { request = directory.requestPermission({ mode: "readwrite" }); }
    catch { this.publish({ busy: false, permission: "unavailable", message: "Access is unavailable. Choose the folder again." }); return Promise.resolve(); }
    return request.then(permission => { if (generation === this.generation) this.publish({ permission, message: permission === "granted" ? "Access checked. Native Save As is available." : "Access not granted. Renew, reselect, Save As elsewhere, or download normally." }); })
      .catch(() => { if (generation === this.generation) this.publish({ permission: "unavailable", message: "The folder may be stale or inaccessible. Choose it again." }); })
      .finally(() => { if (generation === this.generation) this.publish({ busy: false }); });
  };
  forget = async (): Promise<void> => {
    if (this.state.busy) return;
    const generation = ++this.generation; this.publish({ loaded: true, busy: true, directory: null, permission: "unavailable", remembered: false, message: "" });
    try { await this.storage.write(null); }
    catch { if (generation === this.generation) this.publish({ message: "Folder forgotten in this tab, but browser storage could not remove it. It may return after reloading." }); }
    finally { if (generation === this.generation) this.publish({ busy: false }); }
  };
}

export const exportPreferences = new ExportPreferences();
