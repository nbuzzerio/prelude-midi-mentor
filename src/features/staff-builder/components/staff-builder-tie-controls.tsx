import { useMemo, useState } from "react";
import { resolveStaffBuilderMeasureContext } from "../staff-builder-score";
import { durationToTicks, STAFF_BUILDER_DURATIONS, type StaffBuilderDuration } from "../staff-builder-time";
import type { StaffBuilderEvent, StaffBuilderScore } from "../staff-builder-types";
import { getStaffBuilderPitchTieCandidate, getStaffBuilderTieDestinationCandidates } from "../staff-builder-corrections";

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
    {notes.pitches.map((pitch) => {
      const checked = selectedIds.includes(pitch.id);
      const incoming = score.ties.find((tie) => tie.toEventId === event.id && tie.toPitchId === pitch.id);
      const outgoing = score.ties.find((tie) => tie.fromEventId === event.id && tie.fromPitchId === pitch.id);
      const incomingCandidate = checked && !incoming ? getStaffBuilderPitchTieCandidate(score, event.id, pitch.id, "incoming") : null;
      const outgoingCandidate = checked && !outgoing ? getStaffBuilderPitchTieCandidate(score, event.id, pitch.id, "outgoing") : null;
      const name = pitchName(pitch);
      return <div key={pitch.id}>
        <label><input checked={checked} onChange={() => toggle(pitch.id)} type="checkbox" /> {name}</label>
        {checked && <div className="staff-builder-capture-actions">
          {incoming
            ? <button className="staff-builder-danger-button" onClick={() => onRemoveTie(incoming.id)} type="button">Remove Tie In for {name}</button>
            : incomingCandidate && <button className="staff-builder-secondary-button" onClick={() => onCreateTies(incomingCandidate.eventId, event.id, [incomingCandidate.pitchId])} type="button">Tie In {name}</button>}
          {outgoing
            ? <button className="staff-builder-danger-button" onClick={() => onRemoveTie(outgoing.id)} type="button">Remove Tie Out for {name}</button>
            : outgoingCandidate && <button className="staff-builder-secondary-button" onClick={() => onCreateTies(event.id, outgoingCandidate.eventId, [pitch.id])} type="button">Tie Out {name}</button>}
        </div>}
      </div>;
    })}
    <div className="staff-builder-rhythm-edit-grid"><label>Cross-bar target duration<select className="staff-builder-input" onChange={(eventValue) => setTargetDuration(eventValue.target.value as StaffBuilderDuration)} value={targetDuration}>{STAFF_BUILDER_DURATIONS.map((duration) => <option key={duration} value={duration}>{duration}</option>)}</select></label>
      <button className="staff-builder-secondary-button" disabled={!targetCrosses || selectedIds.length === 0 || !score.measures[measureIndex + 1] || (!compatible[0] && !targetSlotEmpty)} onClick={() => onSplitAndTie(event.id, targetDuration, selectedIds, compatible[0]?.id)} type="button">{compatible[0] ? "Split and use selected continuation" : "Split and create continuation"}</button></div>
    {ties.length > 0 && <ul>{ties.map((tie) => <li key={tie.id}><span>Tie {tie.id}: {tie.fromEventId === event.id ? "outgoing" : "incoming"}</span> <button className="staff-builder-danger-button" onClick={() => onRemoveTie(tie.id)} type="button">Remove tie {tie.id}</button></li>)}</ul>}
  </fieldset>;
}
