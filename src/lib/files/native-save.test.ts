import { afterEach, describe, expect, it, vi } from "vitest";
import { exportNativeApi, finishNativeSave, nativeSaveOptions, type ExportFileHandle } from "./native-save";
import type { DownloadSnapshot } from "./browser-download";

afterEach(() => vi.unstubAllGlobals());
const snapshot: DownloadSnapshot = Object.freeze({ blob: new Blob([new Uint8Array([0, 255, 1, 2])]), name: "Study", fallback: "study", extension: "mid", format: "MIDI file" });
function fixture(name = "study_007.mid") {
  const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), abort: vi.fn().mockResolvedValue(undefined) };
  const handle: ExportFileHandle = { name, createWritable: vi.fn().mockResolvedValue(writable) };
  return { writable, handle, signal: new AbortController() };
}
describe("native Save As boundary", () => {
  it("requires a secure context and both APIs without invoking either", () => {
    const save = vi.fn(), choose = vi.fn();
    vi.stubGlobal("showSaveFilePicker", save); vi.stubGlobal("showDirectoryPicker", choose); vi.stubGlobal("isSecureContext", false);
    expect(exportNativeApi()).toBeNull(); vi.stubGlobal("isSecureContext", true); expect(exportNativeApi()).not.toBeNull();
    expect(save).not.toHaveBeenCalled(); expect(choose).not.toHaveBeenCalled(); vi.stubGlobal("showDirectoryPicker", undefined); expect(exportNativeApi()).toBeNull();
  });
  it.each(["prelude.json", "json", "mid", "webm", "m4a", "ogg"] as const)("proposes only the actual %s format and preserves the chosen suggestion", extension => {
    const options = nativeSaveOptions({ ...snapshot, extension }, `étude_999.${extension}`);
    expect(options.suggestedName).toBe(`étude_999.${extension}`); expect(options.excludeAcceptAllOption).toBe(true);
    expect(Object.values(options.types[0].accept)).toEqual([[`.${extension}`]]); expect(options).not.toHaveProperty("startIn");
  });
  it("writes the exact immutable Blob once and waits for close before Saved", async () => {
    const f = fixture(); let close!: () => void;
    f.writable.close.mockImplementation(() => new Promise<void>(resolve => { close = resolve; }));
    const settled = vi.fn(); const saving = finishNativeSave(Promise.resolve(f.handle), snapshot, f.signal.signal).then(settled);
    await vi.waitFor(() => expect(f.writable.close).toHaveBeenCalledOnce()); expect(settled).not.toHaveBeenCalled();
    expect(f.writable.write).toHaveBeenCalledExactlyOnceWith(snapshot.blob);
    expect([...new Uint8Array(await (f.writable.write.mock.calls[0][0] as Blob).arrayBuffer())]).toEqual([0, 255, 1, 2]);
    close(); await saving; expect(settled).toHaveBeenCalledExactlyOnceWith({ kind: "saved", filename: f.handle.name }); expect(f.writable.abort).not.toHaveBeenCalled();
  });
  it.each(["study_001.wav", "study_001.mid.exe", "study_001.json"])("refuses incompatible %s without a writable stream or renaming", async name => {
    const f = fixture(name); expect(await finishNativeSave(Promise.resolve(f.handle), snapshot, f.signal.signal)).toMatchObject({ kind: "uncertain", message: expect.stringContaining("destination file may have changed") });
    expect(f.handle.createWritable).not.toHaveBeenCalled();
  });
  it("distinguishes native cancellation and selection failure, with no delivery fallback", async () => {
    expect(await finishNativeSave(Promise.reject(new DOMException("Canceled", "AbortError")), snapshot, new AbortController().signal)).toMatchObject({ kind: "canceled" });
    expect(await finishNativeSave(Promise.reject(new DOMException("Stale startIn", "NotFoundError")), snapshot, new AbortController().signal)).toMatchObject({ kind: "failed", message: expect.stringContaining("Save As elsewhere") });
  });
  it.each(["write", "close"] as const)("reports %s failure as uncertain, aborts without claiming restoration and retains the source", async step => {
    const f = fixture(); f.writable[step].mockRejectedValue(new Error("Disk failed"));
    const result = await finishNativeSave(Promise.resolve(f.handle), snapshot, f.signal.signal);
    expect(result).toMatchObject({ kind: "uncertain", message: expect.stringContaining("Previous contents cannot be guaranteed") });
    expect(f.writable.abort).toHaveBeenCalledOnce(); expect(snapshot.blob.size).toBe(4);
  });
  it("refuses a late picker result after detach", async () => {
    const f = fixture(); f.signal.abort(); expect(await finishNativeSave(Promise.resolve(f.handle), snapshot, f.signal.signal)).toMatchObject({ kind: "uncertain" });
    expect(f.handle.createWritable).not.toHaveBeenCalled();
  });
  it("aborts an in-flight write on detach, never closes it or reports Saved", async () => {
    const f = fixture(); let write!: () => void;
    f.writable.write.mockImplementation(() => new Promise<void>(resolve => { write = resolve; }));
    const operation = finishNativeSave(Promise.resolve(f.handle), snapshot, f.signal.signal);
    await vi.waitFor(() => expect(f.writable.write).toHaveBeenCalledOnce()); f.signal.abort(); write();
    expect(await operation).toMatchObject({ kind: "uncertain" }); expect(f.writable.abort).toHaveBeenCalledOnce(); expect(f.writable.close).not.toHaveBeenCalled();
  });
});
