import { StrictMode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ExportSettingsDialog } from "./export-settings-dialog";
import { ExportPreferences } from "@/lib/files/export-preferences";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it("allows forgetting an unreadable preference even when no usable handle can be loaded", async () => {
  const write=vi.fn().mockResolvedValue(undefined),store=new ExportPreferences({read:async()=>({version:1,directory:{name:"stale"}}),write});
  render(<ExportSettingsDialog onClose={vi.fn()} preferences={store} />);await act(async()=>{await store.load();});
  expect(screen.getByText(/could not be loaded/)).toBeTruthy();
  const forget=screen.getByRole("button",{name:"Forget Folder"});expect((forget as HTMLButtonElement).disabled).toBe(false);
  await act(async()=>{fireEvent.click(forget);});expect(write).toHaveBeenCalledExactlyOnceWith(null);
  expect(screen.queryByText(/could not be loaded/)).toBeNull();
});
it("loads without prompting, chooses, renews and forgets only through explicit controls", async () => {
  const directory = { kind: "directory" as const, name: "Études", queryPermission: vi.fn().mockResolvedValue("prompt"), requestPermission: vi.fn().mockResolvedValue("granted") };
  const write = vi.fn().mockResolvedValue(undefined), picker = vi.fn().mockResolvedValue(directory);
  vi.stubGlobal("isSecureContext", true); vi.stubGlobal("showDirectoryPicker", picker); vi.stubGlobal("showSaveFilePicker", vi.fn());
  const store = new ExportPreferences({ read: async () => undefined, write });
  render(<StrictMode><ExportSettingsDialog onClose={vi.fn()} preferences={store} /></StrictMode>);
  await act(async () => { await store.load(); }); expect(picker).not.toHaveBeenCalled(); expect(directory.requestPermission).not.toHaveBeenCalled();
  expect(screen.getByText(/local to this browser\/device/)).toBeTruthy(); expect(screen.getByText(/global download location/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Choose Preferred Folder" })); expect(picker).toHaveBeenCalledOnce();
  await screen.findByText("Current folder: Études"); expect(screen.getByText(/Permission needed/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Check/Renew Access" })); expect(directory.requestPermission).toHaveBeenCalledOnce();
  await screen.findByText("Access: Granted"); fireEvent.click(screen.getByRole("button", { name: "Forget Folder" }));
  await screen.findByText("Current folder: None selected"); expect(write).toHaveBeenLastCalledWith(null);
});
it("traps keyboard focus, supports Escape, restores the opener and explains unsupported contexts", async () => {
  const opener=document.createElement("button");document.body.append(opener);opener.focus();
  const store=new ExportPreferences({read:async()=>undefined,write:vi.fn()});const close=vi.fn();
  const view=render(<ExportSettingsDialog onClose={close} preferences={store} />);
  await act(async()=>{await store.load();}); expect(screen.getByText(/unavailable in this browser/)).toBeTruthy();
  const button=screen.getByRole("button",{name:"Close Settings"}); expect(document.activeElement).toBe(button);
  fireEvent.keyDown(button,{key:"Tab"});expect(document.activeElement).toBe(button);
  fireEvent.keyDown(button,{key:"Escape"});expect(close).toHaveBeenCalledOnce();view.unmount();expect(document.activeElement).toBe(opener);opener.remove();
});
