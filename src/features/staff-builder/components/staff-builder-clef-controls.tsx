import { DEFAULT_STAFF_BUILDER_CLEFS, STAFF_BUILDER_CLEFS, type StaffBuilderClef } from "../staff-builder-clefs";
import { resolveStaffBuilderMeasureContext } from "../staff-builder-score";
import type { StaffBuilderScore, StaffBuilderStaff } from "../staff-builder-types";

const clefName = (clef: StaffBuilderClef) => clef === "treble" ? "Treble" : "Bass";

export function StaffBuilderClefControls({ score, measureIndex, onChange, disabled = false }: Readonly<{
  score: StaffBuilderScore;
  measureIndex: number;
  onChange: (measureIndex: number, staff: StaffBuilderStaff, clef: StaffBuilderClef | null) => unknown;
  disabled?: boolean;
}>) {
  const measure = score.measures[measureIndex];
  if (!measure) return null;
  const effective = resolveStaffBuilderMeasureContext(score, measureIndex).clefs;
  const inherited = measureIndex === 0 ? DEFAULT_STAFF_BUILDER_CLEFS : resolveStaffBuilderMeasureContext(score, measureIndex - 1).clefs;
  return <details className="mt-3 rounded border border-zinc-700 p-2">
    <summary className="min-h-11 cursor-pointer py-2">Measure {measureIndex + 1} display clefs: Upper {clefName(effective.treble)} · Lower {clefName(effective.bass)}</summary>
    <fieldset className="staff-builder-context-controls" disabled={disabled}>
      <legend>Measure {measureIndex + 1} display clefs</legend>
      {(["treble", "bass"] as const).map((staff) => <label key={staff}>
        {staff === "treble" ? "Upper" : "Lower"} staff display clef
        <select aria-label={`${staff === "treble" ? "Upper" : "Lower"} staff display clef`} className="staff-builder-input min-h-11" onChange={(event) => onChange(measureIndex, staff, event.target.value === "inherit" ? null : event.target.value as StaffBuilderClef)} value={measure.clefChanges?.[staff] ?? "inherit"}>
          <option value="inherit">{measureIndex === 0 ? "Default" : "Inherit"} — {clefName(inherited[staff])}</option>
          {STAFF_BUILDER_CLEFS.map((clef) => <option key={clef} value={clef}>Use {clefName(clef)}</option>)}
        </select>
        <span className="text-sm text-zinc-400">{measure.clefChanges?.[staff] ? "Explicit change at this measure." : "Inherited display clef."}</span>
      </label>)}
      <p>Applies from this measure onward. Changes notation only; pitches stay unchanged. Select {measureIndex === 0 ? "Default" : "Inherit"} to remove this staff&apos;s authored change.</p>
    </fieldset>
  </details>;
}
