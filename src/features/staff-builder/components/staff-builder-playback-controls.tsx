import type { StaffBuilderEditorPass } from "../hooks/use-staff-builder-editor";
import type { StaffBuilderPlaybackState } from "../hooks/use-staff-builder-playback";
import type { StaffBuilderEvent } from "../staff-builder-types";
import { getStaffBuilderPlaybackAvailability } from "./staff-builder-playback-availability";

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
  const { auditionReady, fullPlaybackReady, fullPlaybackReason } = getStaffBuilderPlaybackAvailability(editorPass, issueCount, selectedEvent);

  return <section className="staff-builder-playback-controls" aria-labelledby="staff-builder-playback-title">
    <h3 id="staff-builder-playback-title">Playback</h3>
    <div className="flex flex-wrap gap-2">
      {auditionReady && <button aria-pressed={state.status === "playing" && state.scope === "selected-event"} className="staff-builder-secondary-button" onClick={onAuditionSelectedEvent} type="button">Audition Selected Event</button>}
      <button aria-pressed={state.status === "playing" && state.scope === "current-measure"} className="staff-builder-secondary-button" disabled={!fullPlaybackReady} onClick={onPlayCurrentMeasure} title={fullPlaybackReason ?? undefined} type="button">Play Measure</button>
      <button aria-pressed={state.status === "playing" && state.scope === "from-position"} className="staff-builder-secondary-button" disabled={!fullPlaybackReady} onClick={onPlayFromHere} title={fullPlaybackReason ?? undefined} type="button">Play From Here</button>
      <button aria-pressed={state.status === "playing" && state.scope === "entire-piece"} className="staff-builder-secondary-button" disabled={!fullPlaybackReady} onClick={onPlayEntirePiece} title={fullPlaybackReason ?? undefined} type="button">Play Piece</button>
      {state.status === "playing" && <button className="staff-builder-secondary-button" onClick={onStop} type="button">Stop</button>}
    </div>
    {fullPlaybackReason && <p className="text-sm text-zinc-300">{fullPlaybackReason}</p>}
    <p aria-live={state.status === "failed" ? "assertive" : "polite"} role={state.status === "failed" ? "alert" : "status"}>{state.message}</p>
  </section>;
}
