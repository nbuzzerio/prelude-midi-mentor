import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import { getInstrumentVolume, subscribeInstrumentVolume } from "@/lib/audio/instrument-volume";
import { useState, useSyncExternalStore } from "react";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { StaffBuilderMeasureNavigation } from "./staff-builder-measure-navigation";

export function StaffBuilderScoreToolbar({ score, measureIndex, navigationDisabled = false, navigationDisabledReason, onNavigate }: Readonly<{
  score: StaffBuilderScoreV1;
  measureIndex: number;
  navigationDisabled?: boolean;
  navigationDisabledReason?: string;
  onNavigate: (measureIndex: number) => unknown;
}>) {
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volumePercent = Math.round(useSyncExternalStore(subscribeInstrumentVolume, getInstrumentVolume, getInstrumentVolume) * 100);
  return <section aria-label="Score controls" className="staff-builder-score-toolbar">
    <div className="staff-builder-score-toolbar-row">
      <StaffBuilderMeasureNavigation disabled={navigationDisabled} disabledReason={navigationDisabledReason} measureCount={score.measures.length} measureIndex={measureIndex} onNavigate={onNavigate} />
      <button aria-controls="staff-builder-volume-controls" aria-expanded={volumeOpen} aria-label={`Instrument volume, ${volumePercent} percent${volumePercent === 0 ? ", muted" : ""}`} className="staff-builder-toolbar-trigger staff-builder-volume-trigger" onClick={() => setVolumeOpen((open) => !open)} type="button">
        <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2-3.74v7.48A4.5 4.5 0 0 0 16.5 12Z" fill="currentColor" />{volumePercent === 0 && <path d="m18 9 4 4m0-4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />}</svg>
        <span aria-hidden="true">{volumePercent}%</span>
      </button>
    </div>
    {volumeOpen && <div id="staff-builder-volume-controls"><InstrumentVolumeControl inputId="staff-builder-instrument-volume" showReplayCompletedChords={false} /></div>}
  </section>;
}
