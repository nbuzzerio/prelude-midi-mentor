import { afterEach, describe, expect, it, vi } from "vitest";
import { EXPORT_PREFERENCES_DATABASE, ExportPreferences, indexedDbExportPreferences } from "./export-preferences";
import type { ExportDirectoryHandle } from "./native-save";

afterEach(() => vi.unstubAllGlobals());
function fixture(permission: PermissionState = "granted") {
  const directory: ExportDirectoryHandle = { kind: "directory", name: "Music", queryPermission: vi.fn().mockResolvedValue(permission), requestPermission: vi.fn().mockResolvedValue("granted") };
  let value: unknown = { version: 1, directory };
  const storage = { read: vi.fn(async () => value), write: vi.fn(async (chosen: ExportDirectoryHandle | null) => { value = chosen ? { version: 1, directory: chosen } : undefined; }) };
  const choose = vi.fn().mockResolvedValue(directory);
  vi.stubGlobal("isSecureContext", true); vi.stubGlobal("showSaveFilePicker", vi.fn()); vi.stubGlobal("showDirectoryPicker", choose);
  return { directory, storage, choose, store: new ExportPreferences(storage) };
}
describe("independent export preference lifecycle", () => {
  it("rechecks cached permission before reuse and fences a late check superseded by explicit renewal", async () => {
    const f=fixture();await f.store.load();let queried!: (permission:PermissionState)=>void;
    vi.mocked(f.directory.queryPermission).mockImplementationOnce(()=>new Promise(resolve=>{queried=resolve;}));
    const checking=f.store.load();expect(f.store.getSnapshot().loaded).toBe(false);expect(f.directory.requestPermission).not.toHaveBeenCalled();
    await f.store.renew();queried("denied");await checking;expect(f.store.getSnapshot()).toMatchObject({loaded:true,permission:"granted"});
    vi.mocked(f.directory.queryPermission).mockResolvedValue("denied");await f.store.load();expect(f.store.getSnapshot().permission).toBe("denied");
    expect(f.storage.read).toHaveBeenCalledOnce();
  });
  it("loads the opaque handle and checks current access without prompting, including reload expiration", async () => {
    const f = fixture("prompt"); await f.store.load(); await f.store.load();
    expect(f.storage.read).toHaveBeenCalledOnce(); expect(f.store.getSnapshot()).toMatchObject({ loaded: true, directory: f.directory, permission: "prompt", remembered: true });
    expect(f.directory.requestPermission).not.toHaveBeenCalled(); expect(f.choose).not.toHaveBeenCalled();
    await f.store.renew(); expect(f.directory.requestPermission).toHaveBeenCalledExactlyOnceWith({ mode: "readwrite" });
    const reloaded = new ExportPreferences(f.storage); await reloaded.load(); expect(reloaded.getSnapshot().permission).toBe("prompt");
  });
  it("invokes the directory picker synchronously and saves only its opaque handle", async () => {
    const f = fixture(); await f.store.load(); const choosing = f.store.choose();
    expect(f.choose).toHaveBeenCalledExactlyOnceWith({ mode: "readwrite" }); expect(f.store.getSnapshot().busy).toBe(true);
    void f.store.choose(); expect(f.choose).toHaveBeenCalledOnce(); await choosing;
    expect(f.storage.write).toHaveBeenCalledExactlyOnceWith(f.directory); expect(f.store.getSnapshot().remembered).toBe(true);
  });
  it("keeps a selected folder for this tab if structured cloning or storage fails", async () => {
    const f = fixture(); f.storage.write.mockRejectedValue(new DOMException("Clone failed", "DataCloneError"));
    await f.store.choose(); expect(f.store.getSnapshot()).toMatchObject({ directory: f.directory, remembered: false, permission: "granted" });
    expect(f.store.getSnapshot().message).toContain("this tab only");
  });
  it("keeps the previous preference after canceled or restricted pickers", async () => {
    const f = fixture(); await f.store.load(); f.choose.mockRejectedValue(new DOMException("Cancel", "AbortError")); await f.store.choose();
    expect(f.store.getSnapshot().directory).toBe(f.directory); expect(f.storage.write).not.toHaveBeenCalled();
    f.choose.mockImplementation(() => { throw new DOMException("Restricted", "SecurityError"); }); await f.store.choose();
    expect(f.store.getSnapshot().busy).toBe(false); expect(f.store.getSnapshot().directory).toBe(f.directory);
  });
  it("surfaces denied and stale permissions without discarding or silently replacing the handle", async () => {
    const f = fixture("denied"); await f.store.load(); expect(f.store.getSnapshot().permission).toBe("denied");
    vi.mocked(f.directory.requestPermission).mockRejectedValue(new DOMException("Removed", "NotFoundError")); await f.store.renew();
    expect(f.store.getSnapshot()).toMatchObject({ directory: f.directory, permission: "unavailable" }); expect(f.storage.write).not.toHaveBeenCalled();
  });
  it("forgets the preference and prevents a late initial load from restoring it", async () => {
    const f = fixture(); let load!: (value: unknown) => void;
    f.storage.read.mockImplementation(() => new Promise(resolve => { load = resolve; })); const loading = f.store.load();
    await f.store.forget(); load({ version: 1, directory: f.directory }); await loading;
    expect(f.store.getSnapshot().directory).toBeNull(); expect(f.storage.write).toHaveBeenCalledWith(null);
  });
  it("reports failed removal honestly and does not claim persistence", async () => {
    const f = fixture(); await f.store.load(); f.storage.write.mockRejectedValue(Error("Quota")); await f.store.forget();
    expect(f.store.getSnapshot().directory).toBeNull(); expect(f.store.getSnapshot().message).toContain("may return after reloading");
  });
  it("handles unavailable storage and invalid remembered handles without prompting", async () => {
    const f = fixture(); f.storage.read.mockRejectedValue(Error("Private mode")); await f.store.load(); expect(f.store.getSnapshot()).toMatchObject({ loaded: true, directory: null });
    const invalid = new ExportPreferences({ read: async () => ({ version: 1, directory: { name: "Old" } }), write: vi.fn() }); await invalid.load();
    expect(invalid.getSnapshot().message).toContain("could not be loaded"); expect(f.directory.requestPermission).not.toHaveBeenCalled();
  });
  it("rejects unavailable IndexedDB and never touches a musical database", async () => {
    await expect(indexedDbExportPreferences(() => undefined).read()).rejects.toThrow();
    const request: Partial<IDBOpenDBRequest> = {};
    const open = vi.fn(() => { queueMicrotask(() => request.onerror?.call(request as IDBOpenDBRequest, new Event("error"))); return request as IDBOpenDBRequest; });
    await expect(indexedDbExportPreferences(() => ({ open } as unknown as IDBFactory)).read()).rejects.toThrow();
    expect(open).toHaveBeenCalledExactlyOnceWith(EXPORT_PREFERENCES_DATABASE, 1);
  });
  it("closes a late IndexedDB open after blocked failure", async () => {
    const close = vi.fn();
    const request: Partial<IDBOpenDBRequest> = { result: { close } as unknown as IDBDatabase };
    const open = () => { queueMicrotask(() => request.onblocked?.call(request as IDBOpenDBRequest, new Event("blocked") as IDBVersionChangeEvent)); return request as IDBOpenDBRequest; };
    await expect(indexedDbExportPreferences(() => ({ open } as unknown as IDBFactory)).read()).rejects.toThrow();
    request.onsuccess?.call(request as IDBOpenDBRequest, new Event("success")); expect(close).toHaveBeenCalledOnce();
  });
});
