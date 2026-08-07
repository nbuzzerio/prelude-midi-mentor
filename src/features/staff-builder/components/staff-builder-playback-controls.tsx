import InstrumentVolumeControl from "@/components/audio/instrument-volume-control";
import type { StaffBuilderEditorPass } from "../hooks/use-staff-builder-editor";
import type { StaffBuilderPlaybackState } from "../hooks/use-staff-builder-playback";
import type { StaffBuilderEvent } from "../staff-builder-types";

export function StaffBuilderPlaybackControls({
  editorPass,
  issueCount,
  onAuditionSelectedEvent,
  onPlayCurrentMeasure,
  onPlayEntirePiece,
  onPlayFromHere,
  onStop,
  selectedEvent,
  state,
}: Readonly<{
  editorPass: StaffBuilderEditorPass;
  issueCount: number;
  onAuditionSelectedEvent: () => void;
  onPlayCurrentMeasure: () => void;
  onPlayEntirePiece: () => void;
  onPlayFromHere: () => void;
  onStop: () => void;
  selectedEvent: StaffBuilderEvent | null;
  state: StaffBuilderPlaybackState;
}>) {
  const fullPlaybackReady = issueCount === 0;
  const auditionReady = editorPass === "rhythm" && selectedEvent?.kind === "notes" && selectedEvent.rhythm.status === "final";
  const auditionReason = editorPass !== "rhythm"
    ? "Choose Rhythm Correction and select a final note or chord to audition it."
    : !selectedEvent ? "Select a final note or chord to audition it."
      : selectedEvent.kind === "rest" ? "Rests do not have pitches to audition."
        : selectedEvent.rhythm.status !== "final" ? "Assign a final duration before auditioning this event."
          : null;
  const fullPlaybackReason = fullPlaybackReady
    ? "The current score is structurally valid and ready for playback."
    : `${issueCount} structural ${issueCount === 1 ? "issue" : "issues"} must be corrected before rhythmic playback.`;

  return <section className="staff-builder-playback-controls" aria-labelledby="staff-builder-playback-title">
    <h3 id="staff-builder-playback-title">Playback</h3>
    <div className="flex flex-wrap gap-2">
      <button aria-pressed={state.status === "playing" && state.scope === "selected-event"} className="staff-builder-secondary-button" disabled={!auditionReady} onClick={onAuditionSelectedEvent} title={auditionReason ?? undefined} type="button">Audition Selected Event</button>
      <button aria-pressed={state.status === "playing" && state.scope === "current-measure"} className="staff-builder-secondary-button" disabled={!fullPlaybackReady} onClick={onPlayCurrentMeasure} title={fullPlaybackReady ? undefined : fullPlaybackReason} type="button">Play Current Measure</button>
      <button aria-pressed={state.status === "playing" && state.scope === "from-position"} className="staff-builder-secondary-button" disabled={!fullPlaybackReady} onClick={onPlayFromHere} title={fullPlaybackReady ? undefined : fullPlaybackReason} type="button">Play From Here</button>
      <button aria-pressed={state.status === "playing" && state.scope === "entire-piece"} className="staff-builder-secondary-button" disabled={!fullPlaybackReady} onClick={onPlayEntirePiece} title={fullPlaybackReady ? undefined : fullPlaybackReason} type="button">Play Entire Piece</button>
      <button className="staff-builder-secondary-button" disabled={state.status !== "playing"} onClick={onStop} type="button">Stop</button>
    </div>
    <p className="text-sm text-zinc-300">{fullPlaybackReason}</p>
    {auditionReason && <p className="text-sm text-zinc-300">{auditionReason}</p>}
    <p aria-live={state.status === "failed" ? "assertive" : "polite"} role={state.status === "failed" ? "alert" : "status"}>{state.message}</p>
    <InstrumentVolumeControl showReplayCompletedChords={false} />
  </section>;
}
