import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { exportPreferences } from "@/lib/files/export-preferences";
import { afterEach, expect, it, vi } from "vitest";
import { AcousticAnalysisExportControls } from "./acoustic-analysis-export-controls";

afterEach(cleanup);

it("passes native Saved to the existing analysis notice boundary without requesting a download", async () => {
  const snapshot={blob:new Blob(["scalar evidence"]),name:"Study",fallback:"analysis",extension:"json" as const,format:"Acoustic Analysis JSON"};
  const control={enabled:true,notice:"Collected evidence retained.",changeEnabled:vi.fn(),prepareExport:()=>snapshot,export:vi.fn()};
  const write=vi.fn().mockResolvedValue(undefined),directory={kind:"directory" as const,name:"Music",queryPermission:async()=>"granted" as const,requestPermission:async()=>"granted" as const};
  vi.stubGlobal("isSecureContext",true);vi.stubGlobal("showDirectoryPicker",vi.fn().mockResolvedValue(directory));
  vi.stubGlobal("showSaveFilePicker",vi.fn().mockResolvedValue({name:"study_001.json",createWritable:async()=>({write,close:async()=>{},abort:async()=>{}})}));
  try { await exportPreferences.choose();render(<AcousticAnalysisExportControls control={control} capturing={false} />);
    fireEvent.click(screen.getByText(/Acoustic Analysis \/ Export/));fireEvent.click(screen.getByRole("button",{name:"Export Acoustic Analysis"}));
    fireEvent.click(await screen.findByRole("button",{name:"Save As…"}));
    await vi.waitFor(()=>expect(control.export).toHaveBeenCalledExactlyOnceWith(snapshot,"study_001.json","saved"));
    expect(write).toHaveBeenCalledExactlyOnceWith(snapshot.blob);expect(screen.getByText("Collected evidence retained.")).toBeTruthy();
  } finally { cleanup();await act(async()=>{await exportPreferences.forget();});vi.unstubAllGlobals(); }
});

it("collapses display independently of collection preference, keeping loss/error notices visible", () => {
  const snapshot = { blob: new Blob(["{}"]), name: "Study", fallback: "acoustic_analysis", extension: "json" as const, format: "Acoustic Analysis JSON" };
  const control = { enabled: true, notice: "Collected evidence can still be exported.", changeEnabled: vi.fn(), prepareExport: vi.fn(() => snapshot), export: vi.fn() };
  const view = render(<AcousticAnalysisExportControls control={control} capturing />);
  const summary = screen.getByText(/Acoustic Analysis \/ Export/);
  const details = summary.closest("details")!;
  expect(details.open).toBe(false);
  expect(screen.getByText(/Export before leaving/).closest("details")).toBeNull();
  expect(screen.getByRole("status").closest("details")).toBeNull();
  summary.focus(); expect(document.activeElement).toBe(summary);
  fireEvent.click(summary); expect(details.open).toBe(true);
  fireEvent.click(summary); expect(details.open).toBe(false);
  expect(control.changeEnabled).not.toHaveBeenCalled();
  expect(control.export).not.toHaveBeenCalled();
  view.rerender(<AcousticAnalysisExportControls control={control} capturing={false} />);
  fireEvent.click(summary);
  fireEvent.click(screen.getByRole("button", { name: "Export Acoustic Analysis" }));
  expect(control.prepareExport).toHaveBeenCalledOnce(); expect(control.export).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("Number"), { target: { value: "007" } });
  fireEvent.click(screen.getByRole("button", { name: "Download" }));
  expect(control.export).toHaveBeenCalledExactlyOnceWith(snapshot, "study_007.json");
  fireEvent.change(screen.getByLabelText("Analysis data"), { target: { value: "off" } });
  expect(control.changeEnabled).toHaveBeenCalledExactlyOnceWith(false);
});
