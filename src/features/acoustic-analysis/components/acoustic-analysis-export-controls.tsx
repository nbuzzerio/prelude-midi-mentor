import { useState } from "react";
import { DownloadDialog } from "@/components/download-dialog";
import type { DownloadSnapshot } from "@/lib/files/browser-download";
import type { ExportDestination } from "@/lib/files/native-save";

export function AcousticAnalysisExportControls({ control, capturing }: {
  control: { enabled: boolean; notice: string | null; changeEnabled: (enabled: boolean) => void;
    prepareExport: () => DownloadSnapshot; export: (snapshot?: DownloadSnapshot, filename?: string, destination?: ExportDestination) => void };
  capturing: boolean;
}) {
  const [snapshot, setSnapshot] = useState<DownloadSnapshot | null>(null);
  const [error, setError] = useState("");
  return <section aria-label="Acoustic analysis data" className="grid gap-2 rounded border border-zinc-600 p-3">
    <p className="text-sm text-zinc-300">Analysis and calibration are temporary. Export before leaving, reloading, restarting, or opening another practice run. Only the On/Off preference is remembered.</p>
    {control.notice && <p role="status">{control.notice}</p>}
    <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Acoustic Analysis / Export · {control.enabled ? "On" : "Off"}</summary>
    <div className="grid gap-2">
    <label className="flex items-center gap-2">Analysis data
      <select aria-label="Analysis data" className="min-h-11 rounded border border-zinc-500 bg-zinc-950 px-3" value={control.enabled ? "on" : "off"}
        onChange={(event) => control.changeEnabled(event.target.value === "on")}><option value="on">On</option><option value="off">Off</option></select>
    </label>
    <p>This JSON contains local scalar pitch data only. Optional performance recordings are separate and are not included in the export.</p>
    <button type="button" className="min-h-11 justify-self-start rounded border border-sky-400 px-3 disabled:opacity-50" disabled={capturing} onClick={() => {
      try { setSnapshot(control.prepareExport()); setError(""); }
      catch { setError("Prelude could not prepare this export. Practice and collected evidence are unchanged."); }
    }}>Export Acoustic Analysis</button>
    {capturing && <p>Stop Listening to export the collected evidence.</p>}
    </div></details>
    {error && <p role="alert">{error}</p>}
    {snapshot && <DownloadDialog snapshot={snapshot} onCancel={() => setSnapshot(null)}
      deliver={(_blob, filename) => control.export(snapshot, filename)} onRequested={() => setSnapshot(null)}
      onSaved={filename => { control.export(snapshot, filename, "saved"); setSnapshot(null); }} />}
  </section>;
}
