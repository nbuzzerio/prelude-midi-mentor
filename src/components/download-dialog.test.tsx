import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DownloadDialog } from "./download-dialog";
import type { DownloadSnapshot } from "@/lib/files/browser-download";
import { ExportPreferences } from "@/lib/files/export-preferences";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
const snapshot: DownloadSnapshot = Object.freeze({ name: "Bells of Notre Dame", blob: new Blob(["original evidence"], { type: "audio/midi" }),
  extension: "mid", fallback: "improv", format: "MIDI file", detail: "Take 8. Original-first identity is unchanged." });

describe("shared download dialog", () => {
  it("focuses Name, fixes the format, and starts at 001 independently of Take 8", () => {
    render(<StrictMode><DownloadDialog snapshot={snapshot} onCancel={vi.fn()} onRequested={vi.fn()} /></StrictMode>);
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
    expect((screen.getByLabelText("Number") as HTMLInputElement).value).toBe("001");
    expect((screen.getByLabelText("Format") as HTMLInputElement).readOnly).toBe(true);
    expect(screen.getByLabelText("Filename preview").textContent).toBe("bells_of_notre_dame_001.mid");
    expect(screen.getByText(/Take 8/)).toBeTruthy();
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(screen.getByRole("button", { name: "Cancel" }), { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByLabelText("Name"));
  });
  it("delivers the exact captured Blob after name/number edits and parent changes", () => {
    const deliver = vi.fn(), requested = vi.fn(), replacementDelivery = vi.fn(), replacementRequested = vi.fn();
    const view = render(<DownloadDialog snapshot={snapshot} deliver={deliver} onCancel={vi.fn()} onRequested={requested} />);
    view.rerender(<DownloadDialog snapshot={{ ...snapshot, name: "replacement", blob: new Blob(["later take"]) }} deliver={replacementDelivery} onCancel={vi.fn()} onRequested={replacementRequested} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Étude / 日本語" } });
    fireEvent.change(screen.getByLabelText("Number"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(deliver).toHaveBeenCalledExactlyOnceWith(snapshot.blob, "étude_日本語_007.mid");
    expect(requested).toHaveBeenCalledExactlyOnceWith("étude_日本語_007.mid");
    expect(replacementDelivery).not.toHaveBeenCalled(); expect(replacementRequested).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download" })); expect(deliver).toHaveBeenCalledOnce();
  });
  it("blocks 000 and invalid input, allows an empty name fallback, and uses a fixed extension", () => {
    const deliver = vi.fn(); render(<DownloadDialog snapshot={snapshot} deliver={deliver} onCancel={vi.fn()} onRequested={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Number"), { target: { value: "000" } });
    expect((screen.getByRole("button", { name: "Download" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!); expect(deliver).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Number"), { target: { value: "999" } });
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "" } });
    expect(screen.getByLabelText("Filename preview").textContent).toBe("improv_999.mid");
  });
  it("cancel, Escape and unmount perform no delivery or object-URL creation and restore focus", () => {
    const opener = document.createElement("button"); document.body.append(opener); opener.focus();
    const deliver = vi.fn(), cancel = vi.fn();
    const view = render(<DownloadDialog snapshot={snapshot} deliver={deliver} onCancel={cancel} onRequested={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Escape" });
    expect(cancel).toHaveBeenCalledTimes(2); expect(deliver).not.toHaveBeenCalled();
    view.unmount(); expect(document.activeElement).toBe(opener); opener.remove();
  });
  it("retains the frozen export on delivery failure and allows retry", () => {
    const deliver = vi.fn().mockImplementationOnce(() => { throw Error("blocked"); }), requested = vi.fn();
    render(<DownloadDialog snapshot={snapshot} deliver={deliver} onCancel={vi.fn()} onRequested={requested} />);
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(screen.getByRole("alert").textContent).toMatch(/original export is retained/); expect(requested).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download" }));
    expect(deliver).toHaveBeenLastCalledWith(snapshot.blob, "bells_of_notre_dame_001.mid"); expect(requested).toHaveBeenCalledOnce();
  });
});

function nativeFixture(permission: PermissionState = "granted") {
  const directory = { kind: "directory" as const, name: "Music", queryPermission: vi.fn().mockResolvedValue(permission), requestPermission: vi.fn().mockResolvedValue("granted") };
  const preferences = new ExportPreferences({ read: async () => ({ version: 1, directory }), write: vi.fn().mockResolvedValue(undefined) });
  const writable = { write: vi.fn().mockResolvedValue(undefined), close: vi.fn().mockResolvedValue(undefined), abort: vi.fn().mockResolvedValue(undefined) };
  const handle = { name: "native_007.mid", createWritable: vi.fn().mockResolvedValue(writable) };
  const picker = vi.fn().mockResolvedValue(handle), choose = vi.fn().mockResolvedValue(directory);
  vi.stubGlobal("isSecureContext", true); vi.stubGlobal("showSaveFilePicker", picker); vi.stubGlobal("showDirectoryPicker", choose);
  return { directory, preferences, writable, handle, picker, choose };
}
describe("shared native destinations", () => {
  it("Enter from filename fields opens Save As synchronously with the edited preview and fences a second submission", async () => {
    const f = nativeFixture(), normal = vi.fn(), requested = vi.fn(), saved = vi.fn();
    const view = render(<DownloadDialog snapshot={snapshot} preferences={f.preferences} deliver={normal} onCancel={vi.fn()} onRequested={requested} onSaved={saved} />);
    await act(async () => { await f.preferences.load(); });
    view.rerender(<DownloadDialog snapshot={{ ...snapshot, blob: new Blob(["later evidence"]) }} preferences={f.preferences} deliver={normal} onCancel={vi.fn()} onRequested={requested} onSaved={saved} />);
    fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Étude / 日本語" } });
    fireEvent.change(screen.getByLabelText("Number"), { target: { value: "7" } });
    const reads = vi.spyOn(f.preferences, "load");
    fireEvent.keyDown(screen.getByLabelText("Number"), { key: "Enter" });
    // Before yielding to any microtask: the actual mounted keyboard handler invoked the picker.
    expect(f.picker).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ startIn: f.directory, suggestedName: "étude_日本語_007.mid" }));
    expect(reads).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" });
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    fireEvent.click(screen.getByRole("button", { name: "Download Normally" }));
    expect(f.picker).toHaveBeenCalledOnce(); expect(normal).not.toHaveBeenCalled(); expect(requested).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(saved).toHaveBeenCalledExactlyOnceWith("native_007.mid"));
    expect(f.writable.write).toHaveBeenCalledExactlyOnceWith(snapshot.blob);
  });
  it("explicit Download Normally uses only normal delivery even when Save As is available", async () => {
    const f = nativeFixture(), normal = vi.fn(), requested = vi.fn();
    render(<DownloadDialog snapshot={snapshot} preferences={f.preferences} deliver={normal} onCancel={vi.fn()} onRequested={requested} />);
    await act(async () => { await f.preferences.load(); });
    const button = screen.getByRole("button", { name: "Download Normally" });
    fireEvent.keyDown(button, { key: "Enter" }); fireEvent.click(button);
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" });
    expect(normal).toHaveBeenCalledExactlyOnceWith(snapshot.blob, "bells_of_notre_dame_001.mid");
    expect(requested).toHaveBeenCalledOnce(); expect(f.picker).not.toHaveBeenCalled();
  });
  it.each(["unconfigured", "unsupported"])("Enter retains normal downloading when %s", async mode => {
    const f = nativeFixture(), normal = vi.fn(), requested = vi.fn();
    if (mode === "unconfigured") await f.preferences.forget();
    else vi.stubGlobal("showSaveFilePicker", undefined);
    render(<DownloadDialog snapshot={snapshot} preferences={f.preferences} deliver={normal} onCancel={vi.fn()} onRequested={requested} />);
    await act(async () => { await f.preferences.load(); });
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" });
    fireEvent.keyDown(screen.getByLabelText("Number"), { key: "Enter" });
    expect(normal).toHaveBeenCalledExactlyOnceWith(snapshot.blob, "bells_of_notre_dame_001.mid");
    expect(requested).toHaveBeenCalledOnce(); expect(f.picker).not.toHaveBeenCalled();
  });
  it.each(["denied", "prompt", "unavailable"] as const)("Enter requires an explicit destination when preferred access is %s", async permission => {
    const f = nativeFixture(permission === "unavailable" ? "granted" : permission), normal = vi.fn();
    if (permission === "unavailable") f.directory.queryPermission.mockRejectedValue(new Error("Stale handle"));
    render(<DownloadDialog snapshot={snapshot} preferences={f.preferences} deliver={normal} onCancel={vi.fn()} onRequested={vi.fn()} />);
    await act(async () => { await f.preferences.load(); });
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" });
    fireEvent.submit(screen.getByRole("dialog").querySelector("form")!);
    expect(screen.getByRole("alert").textContent).toMatch(/choose a destination explicitly/);
    expect(normal).not.toHaveBeenCalled(); expect(f.picker).not.toHaveBeenCalled(); expect(f.directory.requestPermission).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download Normally" }));
    expect(normal).toHaveBeenCalledExactlyOnceWith(snapshot.blob, "bells_of_notre_dame_001.mid");
  });
  it("Enter cannot bypass a pending preferred-folder access check", async () => {
    const f = nativeFixture(), normal = vi.fn(); let finish!: (permission: PermissionState) => void;
    f.directory.queryPermission.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    render(<DownloadDialog snapshot={snapshot} preferences={f.preferences} deliver={normal} onCancel={vi.fn()} onRequested={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" });
    expect(normal).not.toHaveBeenCalled(); expect(f.picker).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toMatch(/access check/);
    await act(async () => { finish("granted"); });
  });
  it.each(["AbortError", "NotFoundError"])("keyboard native %s retains the Blob without normal fallback", async name => {
    const f = nativeFixture(), normal = vi.fn(), saved = vi.fn(); f.picker.mockRejectedValue(new DOMException("Picker stopped", name));
    render(<DownloadDialog snapshot={snapshot} preferences={f.preferences} deliver={normal} onCancel={vi.fn()} onRequested={vi.fn()} onSaved={saved} />);
    await act(async () => { await f.preferences.load(); });
    fireEvent.keyDown(screen.getByLabelText("Name"), { key: "Enter" });
    expect(f.picker).toHaveBeenCalledOnce();
    await screen.findByText(name === "AbortError" ? /Save As canceled/ : /Save As could not open/);
    expect(normal).not.toHaveBeenCalled(); expect(saved).not.toHaveBeenCalled(); expect(f.writable.write).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Download Normally" }));
    expect(normal).toHaveBeenCalledExactlyOnceWith(snapshot.blob, "bells_of_notre_dame_001.mid");
  });
  it("preserves the preview, snapshot and filename suggestion; opens synchronously and fences rapid clicks", async () => {
    const f = nativeFixture(); const saved = vi.fn(), requested = vi.fn(), normal = vi.fn();
    const view=render(<StrictMode><DownloadDialog snapshot={snapshot} preferences={f.preferences} deliver={normal} onCancel={vi.fn()} onRequested={requested} onSaved={saved} /></StrictMode>);
    await act(async () => { await f.preferences.load(); });
    const replacementSaved=vi.fn();view.rerender(<StrictMode><DownloadDialog snapshot={{...snapshot,blob:new Blob(["later evidence"]),name:"Later take"}} preferences={f.preferences} deliver={normal} onCancel={vi.fn()} onRequested={requested} onSaved={replacementSaved} /></StrictMode>);
    expect(screen.getByText(/even if saving later fails/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Number"), { target: { value: "7" } });
    const button = screen.getByRole("button", { name: "Save As…" }); fireEvent.click(button); fireEvent.click(button);
    expect(f.picker).toHaveBeenCalledOnce(); expect(f.picker.mock.calls[0][0]).toMatchObject({ startIn: f.directory, suggestedName: "bells_of_notre_dame_007.mid" });
    await vi.waitFor(() => expect(saved).toHaveBeenCalledExactlyOnceWith("native_007.mid"));
    expect(f.writable.write).toHaveBeenCalledExactlyOnceWith(snapshot.blob); expect(requested).not.toHaveBeenCalled(); expect(normal).not.toHaveBeenCalled();
    expect(replacementSaved).not.toHaveBeenCalled();
  });
  it("retains the Blob after cancellation and uses normal download only on explicit selection", async () => {
    const f = nativeFixture(); f.picker.mockRejectedValue(new DOMException("Cancel", "AbortError"));const normal=vi.fn(),saved=vi.fn();
    render(<DownloadDialog snapshot={snapshot} preferences={f.preferences} deliver={normal} onCancel={vi.fn()} onRequested={vi.fn()} onSaved={saved} />);
    await act(async()=>{await f.preferences.load();});fireEvent.click(screen.getByRole("button",{name:"Save As…"}));
    await screen.findByText(/Save As canceled/);expect(normal).not.toHaveBeenCalled();expect(saved).not.toHaveBeenCalled();
    expect(screen.getByRole("button",{name:"Save As elsewhere"})).toBeTruthy();
    fireEvent.click(screen.getByRole("button",{name:"Download Normally"}));expect(normal).toHaveBeenCalledExactlyOnceWith(snapshot.blob,"bells_of_notre_dame_001.mid");
  });
  it("requires loaded access, never prompts at mount, and permits explicit Save As elsewhere without startIn", async () => {
    const f=nativeFixture("denied");render(<DownloadDialog snapshot={snapshot} preferences={f.preferences} onCancel={vi.fn()} onRequested={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.queryByRole("button",{name:"Save As…"})).toBeNull();await act(async()=>{await f.preferences.load();});
    expect((screen.getByRole("button",{name:"Save As…"}) as HTMLButtonElement).disabled).toBe(true);expect(f.directory.requestPermission).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Save As elsewhere"}));expect(f.picker).toHaveBeenCalledOnce();expect(f.picker.mock.calls[0][0]).not.toHaveProperty("startIn");
    await act(async()=>{});
  });
  it("keeps a rejected startIn explicit and retries elsewhere without silently downloading", async () => {
    const f=nativeFixture();f.picker.mockRejectedValueOnce(new DOMException("Removed", "NotFoundError"));const normal=vi.fn();
    render(<DownloadDialog snapshot={snapshot} preferences={f.preferences} deliver={normal} onCancel={vi.fn()} onRequested={vi.fn()} onSaved={vi.fn()} />);
    await act(async()=>{await f.preferences.load();});fireEvent.click(screen.getByRole("button",{name:"Save As…"}));
    await screen.findByRole("alert");expect(f.picker).toHaveBeenCalledOnce();expect(normal).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Save As elsewhere"}));expect(f.picker.mock.calls[1][0]).not.toHaveProperty("startIn");await act(async()=>{});
  });
  it("fences a late picker after unmount, including Strict Mode setup/cleanup", async () => {
    const f=nativeFixture();let select!: (handle: typeof f.handle)=>void;f.picker.mockImplementation(()=>new Promise(resolve=>{select=resolve;}));const saved=vi.fn();
    const view=render(<StrictMode><DownloadDialog snapshot={snapshot} preferences={f.preferences} onCancel={vi.fn()} onRequested={vi.fn()} onSaved={saved} /></StrictMode>);
    await act(async()=>{await f.preferences.load();});fireEvent.click(screen.getByRole("button",{name:"Save As…"}));view.unmount();
    await act(async()=>{select(f.handle);});expect(f.handle.createWritable).not.toHaveBeenCalled();expect(saved).not.toHaveBeenCalled();
  });
});
