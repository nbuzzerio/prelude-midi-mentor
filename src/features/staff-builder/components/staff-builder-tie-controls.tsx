import { useMemo, useState } from "react";
import { resolveStaffBuilderMeasureContext } from "../staff-builder-score";
import { durationToTicks, STAFF_BUILDER_DURATIONS, type StaffBuilderDuration } from "../staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderScore } from "../staff-builder-types";
import { getStaffBuilderTieDestinationCandidates } from "../staff-builder-corrections";

function pitchName(pitch: Extract<StaffBuilderEvent, { kind: "notes" }>["pitches"][number]): string {
  return `${pitch.letter}${pitch.accidental === "sharp" ? "♯" : pitch.accidental === "flat" ? "♭" : ""}${pitch.octave} (MIDI ${pitch.midiNumber})`;
}

export function StaffBuilderTieControls({ score, measureIndex, event, onCreateTies, onRemoveTie, onSplitAndTie }: Readonly<{
  score: StaffBuilderScore;
  measureIndex: number;
  event: StaffBuilderEvent;
  onCreateTies: (fromEventId: string, toEventId: string, pitchIds: readonly string[]) => void;
  onRemoveTie: (tieId: string) => void;
  onSplitAndTie: (eventId: string, duration: StaffBuilderDuration, pitchIds: readonly string[], useEventId?: string) => void;
}>) {
  const notes = event.kind === "notes" ? event : null;
  const [selected, setSelected] = useState<readonly string[]>([]);
  const [targetDuration, setTargetDuration] = useState<StaffBuilderDuration>("quarter");
  const compatible = useMemo(() => !notes ? [] : getStaffBuilderTieDestinationCandidates(score, event.id, selected), [event.id, notes, score, selected]);
  if (!notes) return null;
  const ties = score.ties.filter((tie) => tie.fromEventId === event.id || tie.toEventId === event.id);
  const selectedIds = selected.filter((id) => notes.pitches.some((pitch) => pitch.id === id));
  const toggle = (id: string) => setSelected((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const targetCrosses = event.startTick + durationToTicks(targetDuration) > resolveStaffBuilderMeasureContext(score, measureIndex).capacityTicks;
  const nextMeasureStartEvents = score.measures[measureIndex + 1]?.events.filter((candidate) => candidate.staff === event.staff && candidate.startTick === 0) ?? [];
  const targetSlotEmpty = nextMeasureStartEvents.length === 0;
  return <fieldset className="staff-builder-tie-controls"><legend>Ties and barline correction</legend>
    <p>Select the pitches that continue without a new attack. Repeated notes are not tied automatically.</p>
    {notes.pitches.map((pitch) => <label key={pitch.id}><input checked={selectedIds.includes(pitch.id)} onChange={() => toggle(pitch.id)} type="checkbox" /> {pitchName(pitch)}</label>)}
    {compatible.length > 0 && <div className="staff-builder-capture-actions">{compatible.map((destination) => <button className="staff-builder-secondary-button" disabled={selectedIds.length === 0} key={destination.id} onClick={() => onCreateTies(event.id, destination.id, selectedIds)} type="button">Tie selected pitches to contiguous event</button>)}</div>}
    <div className="staff-builder-rhythm-edit-grid"><label>Cross-bar target duration<select className="staff-builder-input" onChange={(eventValue) => setTargetDuration(eventValue.target.value as StaffBuilderDuration)} value={targetDuration}>{STAFF_BUILDER_DURATIONS.map((duration) => <option key={duration} value={duration}>{duration}</option>)}</select></label>
      <button className="staff-builder-secondary-button" disabled={!targetCrosses || selectedIds.length === 0 || !score.measures[measureIndex + 1] || (!compatible[0] && !targetSlotEmpty)} onClick={() => onSplitAndTie(event.id, targetDuration, selectedIds, compatible[0]?.id)} type="button">{compatible[0] ? "Split and use selected continuation" : "Split and create continuation"}</button></div>
    {ties.length > 0 && <ul>{ties.map((tie) => <li key={tie.id}><span>Tie {tie.id}: {tie.fromEventId === event.id ? "outgoing" : "incoming"}</span> <button className="staff-builder-danger-button" onClick={() => onRemoveTie(tie.id)} type="button">Remove tie {tie.id}</button></li>)}</ul>}
  </fieldset>;
}
