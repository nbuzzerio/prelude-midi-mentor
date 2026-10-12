import type { DownloadSnapshot } from "./browser-download";

export type ExportDestination = "download-requested" | "saved";
export interface ExportDirectoryHandle {
  readonly kind: "directory";
  readonly name: string;
  queryPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(options: { mode: "readwrite" }): Promise<PermissionState>;
}
export interface ExportWritable {
  write(blob: Blob): Promise<void>;
  close(): Promise<void>;
  abort(): Promise<void>;
}
export interface ExportFileHandle {
  readonly name: string;
  createWritable(): Promise<ExportWritable>;
}
export type ExportSaveOptions = Readonly<{
  suggestedName: string;
  startIn?: ExportDirectoryHandle;
  excludeAcceptAllOption: true;
  types: readonly { description: string; accept: Record<string, string[]> }[];
}>;
export type ExportNativeApi = Readonly<{
  showDirectoryPicker(options: { mode: "readwrite" }): Promise<ExportDirectoryHandle>;
  showSaveFilePicker(options: ExportSaveOptions): Promise<ExportFileHandle>;
}>;

/** Accessors themselves never invoke pickers or permission requests. */
export function exportNativeApi(): ExportNativeApi | null {
  if (typeof window === "undefined" || !window.isSecureContext) return null;
  const native = window as unknown as Partial<ExportNativeApi>;
  try {
    if (typeof native.showDirectoryPicker !== "function" || typeof native.showSaveFilePicker !== "function") return null;
    return { showDirectoryPicker: options => native.showDirectoryPicker!.call(window, options),
      showSaveFilePicker: options => native.showSaveFilePicker!.call(window, options) };
  } catch { return null; }
}

export function nativeSaveOptions(snapshot: DownloadSnapshot, filename: string, directory?: ExportDirectoryHandle): ExportSaveOptions {
  const mime = { "prelude.json": "application/json", json: "application/json", mid: "audio/midi", webm: "audio/webm", m4a: "audio/mp4", ogg: "audio/ogg" }[snapshot.extension];
  return { suggestedName: filename, ...(directory ? { startIn: directory } : {}), excludeAcceptAllOption: true,
    types: [{ description: snapshot.format, accept: { [mime]: [`.${snapshot.extension}`] } }] };
}

export type NativeSaveResult = Readonly<
  { kind: "saved"; filename: string } | { kind: "canceled" | "failed" | "uncertain"; message: string }
>;

export const NATIVE_OVERWRITE_WARNING = "Choosing an existing file and confirming replacement may erase its previous contents, even if saving later fails.";
const retry = "Your original export is retained. Retry, choose another folder, Save As elsewhere, download normally, or cancel.";
const changed = "The destination file may have changed. Previous contents cannot be guaranteed or restored by aborting.";

export function exportPickerCanceled(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}
export function pickerFailure(error: unknown): NativeSaveResult {
  return exportPickerCanceled(error)
    ? { kind: "canceled", message: `Save As canceled. ${retry}` }
    : { kind: "failed", message: `Save As could not open or finish selecting a file. ${changed} ${retry}` };
}

/** Caller invokes the picker synchronously in its click handler, then passes its promise here. */
export async function finishNativeSave(picker: Promise<ExportFileHandle>, snapshot: DownloadSnapshot, signal: AbortSignal): Promise<NativeSaveResult> {
  let selected = false, writable: ExportWritable | undefined, aborted = false;
  const abort = async () => { if (writable && !aborted) { aborted = true; try { await writable.abort(); } catch { /* No rollback claim. */ } } };
  const check = () => { if (signal.aborted) throw new Error("Save operation detached"); };
  const onAbort = () => { void abort(); };
  signal.addEventListener("abort", onAbort, { once: true });
  try {
    const handle = await picker; selected = true; check();
    if (!handle.name.toLowerCase().endsWith(`.${snapshot.extension}`)) {
      return { kind: "uncertain", message: `File not written: choose a .${snapshot.extension} file. Prelude did not rename the selected target. ${changed} ${retry}` };
    }
    writable = await handle.createWritable(); check();
    await writable.write(snapshot.blob); check();
    await writable.close();
    return { kind: "saved", filename: handle.name };
  } catch (error) {
    await abort();
    return selected ? { kind: "uncertain", message: `Saving failed or its result is uncertain. ${changed} ${retry}` } : pickerFailure(error);
  } finally { signal.removeEventListener("abort", onAbort); }
}
