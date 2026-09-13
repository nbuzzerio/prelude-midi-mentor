import { useState } from "react";
import { entireStaffBuilderPrintRange, parseStaffBuilderPrintRange } from "../staff-builder-print-range";

export type StaffBuilderPrintMeasuresPerLine = 2 | 3 | 4 | 5;
export type StaffBuilderPrintRequest = Readonly<{ measureIndexes: readonly number[]; measuresPerLine: StaffBuilderPrintMeasuresPerLine }>;

const MEASURES_PER_LINE_OPTIONS: readonly StaffBuilderPrintMeasuresPerLine[] = [2, 3, 4, 5];

export function StaffBuilderPrintOptions({ measureCount, onCancel, onPrint }: Readonly<{ measureCount: number; onCancel: () => void; onPrint: (request: StaffBuilderPrintRequest) => void }>) {
  const [mode, setMode] = useState<"entire" | "ranges">("entire");
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [measuresPerLine, setMeasuresPerLine] = useState<StaffBuilderPrintMeasuresPerLine>(4);
  const submit = () => {
    const result = mode === "entire" ? entireStaffBuilderPrintRange(measureCount) : parseStaffBuilderPrintRange(input, measureCount);
    if (!result.ok) { setError(result.message); return; }
    onPrint({ measureIndexes: result.measureIndexes, measuresPerLine });
  };
  return <div aria-labelledby="staff-builder-print-options-title" aria-modal="true" className="staff-builder-print-options" role="dialog">
    <h2 id="staff-builder-print-options-title">Print / Save PDF</h2>
    <fieldset><legend>Measures to print</legend><label><input checked={mode === "entire"} name="print-scope" onChange={() => { setMode("entire"); setError(""); }} type="radio" />Entire piece</label><label><input checked={mode === "ranges"} name="print-scope" onChange={() => setMode("ranges")} type="radio" />Measure ranges</label></fieldset>
    <label>Measure ranges<input aria-describedby={error ? "staff-builder-print-range-error" : undefined} disabled={mode !== "ranges"} onChange={(event) => { setInput(event.target.value); setError(""); }} placeholder="5-10, 15-20, 27-28" type="text" value={input} /></label>
    {error && <p id="staff-builder-print-range-error" role="alert">{error}</p>}
    <fieldset><legend>Measures per line</legend>{MEASURES_PER_LINE_OPTIONS.map((value) => <label key={value}><input checked={measuresPerLine === value} name="measures-per-line" onChange={() => setMeasuresPerLine(value)} type="radio" />{value}</label>)}</fieldset>
    <div><button className="staff-builder-primary-button" onClick={submit} type="button">Print / Save PDF</button><button className="staff-builder-secondary-button" onClick={onCancel} type="button">Cancel</button></div>
  </div>;
}
