import type { StaffBuilderCaptureInputMode } from "../staff-builder-capture";
import { StaffBuilderMusicGlyph } from "./staff-builder-music-glyph";

const MODES = [
  { value: "treble", label: "Treble Only input", glyph: "treble-clef" },
  { value: "grand", label: "Grand Staff input", glyph: "grand-staff" },
  { value: "bass", label: "Bass Only input", glyph: "bass-clef" },
] as const;

export function StaffBuilderStaffModeSelector({ inputMode, disabled = false, onChange }: Readonly<{
  inputMode: StaffBuilderCaptureInputMode;
  disabled?: boolean;
  onChange: (mode: StaffBuilderCaptureInputMode) => void;
}>) {
  return <div aria-label="Staff input routing" className="staff-builder-staff-mode-selector" role="group">
    {MODES.map(({ value, label, glyph }) => <button aria-label={label} aria-pressed={inputMode === value} disabled={disabled} key={value} onClick={() => onChange(value)} title={disabled ? `${label} is available in Capture Notes` : label} type="button"><StaffBuilderMusicGlyph kind={glyph} /></button>)}
  </div>;
}
