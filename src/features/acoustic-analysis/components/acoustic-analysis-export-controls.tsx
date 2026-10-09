export function AcousticAnalysisExportControls({ control, capturing }: {
  control: { enabled: boolean; notice: string | null; changeEnabled: (enabled: boolean) => void; export: () => void };
  capturing: boolean;
}) {
  return <section aria-label="Acoustic analysis data" className="grid gap-2 rounded border border-zinc-600 p-3">
    <p className="text-sm text-zinc-300">Analysis and calibration are temporary. Export before leaving, reloading, restarting, or opening another practice run. Only the On/Off preference is remembered.</p>
    {control.notice && <p role="status">{control.notice}</p>}
    <details><summary className="min-h-11 cursor-pointer py-2 font-semibold">Acoustic Analysis / Export · {control.enabled ? "On" : "Off"}</summary>
    <div className="grid gap-2">
    <label className="flex items-center gap-2">Analysis data
      <select aria-label="Analysis data" className="min-h-11 rounded border border-zinc-500 bg-zinc-950 px-3" value={control.enabled ? "on" : "off"}
        onChange={(event) => control.changeEnabled(event.target.value === "on")}><option value="on">On</option><option value="off">Off</option></select>
    </label>
    <p>Local scalar pitch data only. No audio is recorded or uploaded.</p>
    <button type="button" className="min-h-11 justify-self-start rounded border border-sky-400 px-3 disabled:opacity-50" disabled={capturing} onClick={control.export}>Export Acoustic Analysis</button>
    {capturing && <p>Stop Listening to export the collected evidence.</p>}
    </div></details>
  </section>;
}
