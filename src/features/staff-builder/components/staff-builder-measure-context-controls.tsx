import { MUSIC_KEYS, type MusicKeyId } from "@/lib/music/keys";
import { resolveStaffBuilderMeasureContext } from "../staff-builder-score";
import { STAFF_BUILDER_TIME_SIGNATURES, type StaffBuilderTimeSignature } from "../staff-builder-time";
import type { StaffBuilderScore } from "../staff-builder-types";

export function StaffBuilderMeasureContextControls({ score, measureIndex, onKeyChange, onTimeChange, control }: Readonly<{
  score: StaffBuilderScore;
  measureIndex: number;
  onKeyChange: (measureIndex: number, key: MusicKeyId | null) => void;
  onTimeChange: (measureIndex: number, time: StaffBuilderTimeSignature | null) => void;
  control?: "key" | "time" | "both";
}>) {
  const measure = score.measures[measureIndex];
  if (!measure) return null;
  const context = resolveStaffBuilderMeasureContext(score, measureIndex);
  const keyValue = measureIndex === 0 ? score.initialKeySignatureId : measure.keySignatureChange ?? "inherit";
  const timeValue = measureIndex === 0 ? score.initialTimeSignature : measure.timeSignatureChange ?? "inherit";
  const visibleControl = control ?? "both";
  return <fieldset className="staff-builder-context-controls"><legend>Measure {measureIndex + 1} {visibleControl === "both" ? "context" : visibleControl === "key" ? "key signature" : "time signature"}</legend>
    {visibleControl !== "time" && <label>Key signature <select className="staff-builder-input" onChange={(event) => onKeyChange(measureIndex, event.target.value === "inherit" ? null : event.target.value as MusicKeyId)} value={keyValue}>{measureIndex > 0 && <option value="inherit">Inherit ({getMusicKeyName(context.keySignatureId)})</option>}{MUSIC_KEYS.map((key) => <option key={key.id} value={key.id}>Use {key.name}</option>)}</select></label>}
    {visibleControl !== "key" && <label>Time signature <select className="staff-builder-input" onChange={(event) => onTimeChange(measureIndex, event.target.value === "inherit" ? null : event.target.value as StaffBuilderTimeSignature)} value={timeValue}>{measureIndex > 0 && <option value="inherit">Inherit ({context.timeSignature})</option>}{STAFF_BUILDER_TIME_SIGNATURES.map((time) => <option key={time} value={time}>Use {time}</option>)}</select></label>}
    <p>{measureIndex === 0 ? "Initial score context." : `${measure.keySignatureChange || measure.timeSignatureChange ? "This measure contains an explicit context change where selected; other values inherit." : "This measure inherits its key and time."}`}</p>
  </fieldset>;
}

function getMusicKeyName(keyId: MusicKeyId): string {
  return MUSIC_KEYS.find((key) => key.id === keyId)?.name ?? keyId;
}
