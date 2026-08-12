import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import { getInstrumentVolume, subscribeInstrumentVolume } from "@/lib/audio/instrument-volume";
import { type ReactNode, useState, useSyncExternalStore } from "react";
import type { StaffBuilderScoreV1 } from "../staff-builder-types";
import { StaffBuilderMeasureNavigation } from "./staff-builder-measure-navigation";

export function StaffBuilderScoreToolbar({ score, measureIndex, navigationDisabled = false, navigationDisabledReason, onNavigate, onInsertMeasureBefore, onInsertMeasureAfter, playbackControls }: Readonly<{
  score: StaffBuilderScoreV1;
  measureIndex: number;
  navigationDisabled?: boolean;
  navigationDisabledReason?: string;
  onNavigate: (measureIndex: number) => unknown;
  onInsertMeasureBefore?: () => unknown;
  onInsertMeasureAfter?: () => unknown;
  playbackControls?: ReactNode;
}>) {
  const [volumeOpen, setVolumeOpen] = useState(false);
  const volumePercent = Math.round(useSyncExternalStore(subscribeInstrumentVolume, getInstrumentVolume, getInstrumentVolume) * 100);
  return <section aria-label="Score controls" className="staff-builder-score-toolbar">
    <div className="staff-builder-score-toolbar-row">
      <div className="staff-builder-score-toolbar-playback">{playbackControls}</div>
      <div className="staff-builder-score-toolbar-navigation">
        <StaffBuilderMeasureNavigation disabled={navigationDisabled} disabledReason={navigationDisabledReason} measureCount={score.measures.length} measureIndex={measureIndex} onNavigate={onNavigate} />
        {onInsertMeasureBefore && <button aria-label={`Insert Measure Before Measure ${measureIndex + 1}`} className="staff-builder-secondary-button" disabled={navigationDisabled} onClick={onInsertMeasureBefore} title={navigationDisabled ? navigationDisabledReason : undefined} type="button">Insert Before</button>}
        {onInsertMeasureAfter && <button aria-label={`Insert Measure After Measure ${measureIndex + 1}`} className="staff-builder-secondary-button" disabled={navigationDisabled} onClick={onInsertMeasureAfter} title={navigationDisabled ? navigationDisabledReason : undefined} type="button">Insert After</button>}
      </div>
      <div className="staff-builder-score-toolbar-volume">
      <button aria-controls="staff-builder-volume-controls" aria-expanded={volumeOpen} aria-label={`Instrument volume, ${volumePercent} percent${volumePercent === 0 ? ", muted" : ""}`} className="staff-builder-toolbar-trigger staff-builder-volume-trigger" onClick={() => setVolumeOpen((open) => !open)} type="button">
        <svg aria-hidden="true" height="20" viewBox="0 0 24 24" width="20"><path d="M4 9v6h4l5 4V5L8 9H4Zm12.5 3a4.5 4.5 0 0 0-2-3.74v7.48A4.5 4.5 0 0 0 16.5 12Z" fill="currentColor" />{volumePercent === 0 && <path d="m18 9 4 4m0-4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" />}</svg>
        <span aria-hidden="true" className="staff-builder-volume-percent">{volumePercent}%</span>
      </button>
      </div>
    </div>
    {volumeOpen && <div id="staff-builder-volume-controls"><InstrumentVolumeControl inputId="staff-builder-instrument-volume" showReplayCompletedChords={false} /></div>}
  </section>;
}
