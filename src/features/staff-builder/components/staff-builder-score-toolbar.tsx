import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import { getInstrumentVolume, subscribeInstrumentVolume } from "@/lib/audio/instrument-volume";
import { getMusicKeyDefinition, type MusicKeyId } from "@/lib/music/keys";
import { useState, useSyncExternalStore } from "react";
import { resolveStaffBuilderMeasureContext } from "../staff-builder-score";
import type { StaffBuilderTimeSignature } from "../staff-builder-time";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { StaffBuilderMeasureContextControls } from "./staff-builder-measure-context-controls";
import { StaffBuilderMeasureNavigation } from "./staff-builder-measure-navigation";

type OpenDisclosure = "key" | "time" | "volume" | null;

export function StaffBuilderScoreToolbar({ score, measureIndex, navigationDisabled = false, navigationDisabledReason, onNavigate, onKeyChange, onTimeChange }: Readonly<{
  score: StaffBuilderScoreV1;
  measureIndex: number;
  navigationDisabled?: boolean;
  navigationDisabledReason?: string;
  onNavigate: (measureIndex: number) => unknown;
  onKeyChange: (measureIndex: number, key: MusicKeyId | null) => void;
  onTimeChange: (measureIndex: number, time: StaffBuilderTimeSignature | null) => void;
}>) {
  const [open, setOpen] = useState<OpenDisclosure>(null);
  const volumePercent = Math.round(useSyncExternalStore(subscribeInstrumentVolume, getInstrumentVolume, getInstrumentVolume) * 100);
  const context = resolveStaffBuilderMeasureContext(score, measureIndex);
  const keyName = getMusicKeyDefinition(context.keySignatureId).name;
  const toggle = (next: Exclude<OpenDisclosure, null>) => setOpen((current) => current === next ? null : next);

  return <section className="staff-builder-score-toolbar" aria-label="Score controls">
    <div className="staff-builder-score-toolbar-row">
      <button aria-controls="staff-builder-key-controls" aria-expanded={open === "key"} aria-label={`Key signature: ${keyName}`} className="staff-builder-toolbar-trigger" onClick={() => toggle("key")} type="button">{keyName} <span aria-hidden="true">▾</span></button>
      <button aria-controls="staff-builder-time-controls" aria-expanded={open === "time"} aria-label={`Time signature: ${context.timeSignature}`} className="staff-builder-toolbar-trigger" onClick={() => toggle("time")} type="button">{context.timeSignature} <span aria-hidden="true">▾</span></button>
      <StaffBuilderMeasureNavigation disabled={navigationDisabled} disabledReason={navigationDisabledReason} measureCount={score.measures.length} measureIndex={measureIndex} onNavigate={onNavigate} />
      <button aria-controls="staff-builder-volume-controls" aria-expanded={open === "volume"} aria-label={`Instrument volume, ${volumePercent} percent${volumePercent === 0 ? ", muted" : ""}`} className="staff-builder-toolbar-trigger staff-builder-volume-trigger" onClick={() => toggle("volume")} type="button">
        <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2-3.74v7.48A4.5 4.5 0 0 0 16.5 12Z" fill="currentColor" />{volumePercent === 0 && <path d="m18 9 4 4m0-4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />}</svg>
        <span aria-hidden="true">{volumePercent}%</span>
      </button>
    </div>
    {open === "key" && <div id="staff-builder-key-controls"><StaffBuilderMeasureContextControls control="key" measureIndex={measureIndex} onKeyChange={onKeyChange} onTimeChange={onTimeChange} score={score} /></div>}
    {open === "time" && <div id="staff-builder-time-controls"><StaffBuilderMeasureContextControls control="time" measureIndex={measureIndex} onKeyChange={onKeyChange} onTimeChange={onTimeChange} score={score} /></div>}
    {open === "volume" && <div id="staff-builder-volume-controls"><InstrumentVolumeControl inputId="staff-builder-instrument-volume" showReplayCompletedChords={false} /></div>}
  </section>;
}
