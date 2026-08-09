import { CirclePlay, Ear, ListStart, Square, SquarePlay } from "lucide-react";
import type { StaffBuilderPlaybackState } from "../hooks/use-staff-builder-playback";
import type { StaffBuilderPlaybackAvailability } from "./staff-builder-playback-availability";

const actions = [
  ["selected-event", "Audition Selected Event", Ear],
  ["current-measure", "Play Measure", SquarePlay],
  ["from-position", "Play From Here", ListStart],
  ["entire-piece", "Play Piece", CirclePlay],
] as const;

export function StaffBuilderQuickPlaybackControls({ availability, onAuditionSelectedEvent, onPlayCurrentMeasure, onPlayEntirePiece, onPlayFromHere, onStop, state }: Readonly<{
  availability: StaffBuilderPlaybackAvailability;
  onAuditionSelectedEvent: () => unknown;
  onPlayCurrentMeasure: () => unknown;
  onPlayEntirePiece: () => unknown;
  onPlayFromHere: () => unknown;
  onStop: () => unknown;
  state: StaffBuilderPlaybackState;
}>) {
  const callbacks = [onAuditionSelectedEvent, onPlayCurrentMeasure, onPlayFromHere, onPlayEntirePiece] as const;
  const auditionReasonId = availability.auditionReason ? "staff-builder-quick-audition-reason" : undefined;
  const fullReasonId = availability.fullPlaybackReason ? "staff-builder-quick-playback-reason" : undefined;
  const blockedIssueCount = availability.fullPlaybackReason?.match(/Playback unavailable: (\d+) score issue/)?.[1];
  return <section aria-label="Quick playback" className="staff-builder-quick-playback-group">
    <div className="staff-builder-quick-playback">
      {actions.map(([scope, label, Icon], index) => {
        const disabled = scope === "selected-event" ? !availability.auditionReady : !availability.fullPlaybackReady;
        const reason = scope === "selected-event" ? availability.auditionReason : availability.fullPlaybackReason;
        return <button aria-describedby={scope === "selected-event" ? auditionReasonId : fullReasonId} aria-label={label} aria-pressed={state.status === "playing" && state.scope === scope} disabled={disabled} key={scope} onClick={callbacks[index]} title={disabled && reason ? `${label}. ${reason}` : label} type="button"><Icon aria-hidden="true" /></button>;
      })}
      {state.status === "playing" && <button aria-label="Stop playback" onClick={onStop} title="Stop playback" type="button"><Square aria-hidden="true" /></button>}
    </div>
    {availability.auditionReason && <span className="sr-only" id={auditionReasonId}>{availability.auditionReason}</span>}
    {availability.fullPlaybackReason && <><span aria-hidden="true" className="staff-builder-quick-playback-reason">{blockedIssueCount ? `${blockedIssueCount} ${blockedIssueCount === "1" ? "issue" : "issues"} block playback` : "Score issues block playback"}</span><span className="sr-only" id={fullReasonId}>{availability.fullPlaybackReason}</span></>}
  </section>;
}
