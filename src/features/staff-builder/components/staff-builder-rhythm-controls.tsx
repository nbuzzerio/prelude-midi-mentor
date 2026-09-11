import { useRef, useState } from "react";
import type { NoteLetter } from "@/lib/music/note-utils";
import { getStaffBuilderPitchSpellingCandidates } from "../staff-builder-rhythm";
import { STAFF_BUILDER_DURATIONS, type StaffBuilderDuration } from "../staff-builder-time";
import type { StaffBuilderArpeggiation, StaffBuilderEvent, StaffBuilderStaff } from "../staff-builder-types";
import type { StaffBuilderScore } from "../staff-builder-types";
import { StaffBuilderTieControls } from "./staff-builder-tie-controls";

const durationLabel = (duration: StaffBuilderDuration) => duration.split("-").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ");
const pitchSymbol = (pitch: Readonly<{ letter: NoteLetter; accidental: "natural" | "sharp" | "flat"; octave: number }>) => `${pitch.letter}${pitch.accidental === "sharp" ? "♯" : pitch.accidental === "flat" ? "♭" : ""}${pitch.octave}`;
const pitchAccessibleName = (pitch: Readonly<{ letter: NoteLetter; accidental: "natural" | "sharp" | "flat"; octave: number }>) => `${pitch.letter}${pitch.accidental === "sharp" ? " sharp" : pitch.accidental === "flat" ? " flat" : ""} ${pitch.octave}`;

export function StaffBuilderRhythmControls({ score, selectedMeasureIndex, selectedEvent, selectedDescription, selectedIndex, eventCount, canPrevious, canNext, canUndo, canRedo, status, onPrevious, onNext, onAssignDuration, onSetArpeggiation, onConvertToRest, onMoveToStaff, onRespellPitch, onDelete, onUndo, onRedo, onCreateTies, onRemoveTie, onSplitAndTie }: Readonly<{
  score?: StaffBuilderScore;
  selectedMeasureIndex?: number;
  selectedEvent: StaffBuilderEvent | null;
  selectedDescription: string;
  selectedIndex: number;
  eventCount: number;
  canPrevious: boolean;
  canNext: boolean;
  canUndo: boolean;
  canRedo: boolean;
  status: string | null;
  onPrevious: () => void;
  onNext: () => void;
  onAssignDuration: (duration: StaffBuilderDuration) => void;
  onSetArpeggiation?: (arpeggiation: StaffBuilderArpeggiation | null) => void;
  onConvertToRest: (duration: StaffBuilderDuration) => void;
  onMoveToStaff: (staff: StaffBuilderStaff) => void;
  onRespellPitch: (pitchId: string, letter: NoteLetter) => void;
  onDelete: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCreateTies?: (fromEventId: string, toEventId: string, pitchIds: readonly string[]) => void;
  onRemoveTie?: (tieId: string) => void;
  onSplitAndTie?: (eventId: string, duration: StaffBuilderDuration, pitchIds: readonly string[], useEventId?: string) => void;
}>) {
  const rhythmSignature = `${selectedEvent?.id ?? "none"}:${selectedEvent?.rhythm.status ?? "none"}:${selectedEvent?.rhythm.status === "final" ? selectedEvent.rhythm.duration : ""}`;
  const defaultDuration = selectedEvent?.rhythm.status === "final" ? selectedEvent.rhythm.duration : "";
  const [targetSelection, setTargetSelection] = useState<Readonly<{ rhythmSignature: string; duration: StaffBuilderDuration | "" }>>({ rhythmSignature, duration: defaultDuration });
  const targetDuration = targetSelection.rhythmSignature === rhythmSignature ? targetSelection.duration : defaultDuration;
  const selectedStatusRef = useRef<HTMLParagraphElement>(null);
  const hasDuration = targetDuration !== "";
  const respellablePitches = selectedEvent?.kind === "notes"
    ? [...selectedEvent.pitches]
      .sort((left, right) => left.midiNumber - right.midiNumber || left.id.localeCompare(right.id))
      .map((pitch) => ({ pitch, candidates: getStaffBuilderPitchSpellingCandidates(pitch) }))
      .filter(({ candidates }) => candidates.length >= 2)
    : [];
  return (
    <section className="staff-builder-rhythm-controls">
      {respellablePitches.length > 0 && <section aria-labelledby="staff-builder-enharmonic-spelling-title" className="staff-builder-spelling-controls">
        <h3 className="font-semibold" id="staff-builder-enharmonic-spelling-title">Enharmonic spelling</h3>
        <p className="text-sm text-zinc-300">Respell a note without changing its sounding pitch.</p>
        {respellablePitches.map(({ pitch, candidates }) => <fieldset key={pitch.id}>
          <legend>Respell note <strong>{pitchSymbol(pitch)}</strong></legend>
          <div aria-label={`Enharmonic choices for ${pitchAccessibleName(pitch)}`} className="flex flex-wrap gap-2">
            {candidates.map((candidate) => <button
              aria-label={candidate.letter === pitch.letter ? `Current spelling ${pitchAccessibleName(candidate)}` : `Respell ${pitchAccessibleName(pitch)} as ${pitchAccessibleName(candidate)}`}
              aria-pressed={candidate.letter === pitch.letter}
              className="staff-builder-secondary-button"
              key={candidate.letter}
              onClick={() => onRespellPitch(pitch.id, candidate.letter)}
              type="button"
            >{pitchSymbol(candidate)}</button>)}
          </div>
        </fieldset>)}
      </section>}
      <details>
      <summary>Rhythm Correction controls</summary>
      <div className="staff-builder-rhythm-controls-content">
      <div className="staff-builder-rhythm-heading"><div><h3 className="font-semibold">Detailed event correction</h3><p>Event {selectedIndex + 1} of {eventCount}</p></div><div className="flex gap-2"><button className="staff-builder-secondary-button" disabled={!canUndo} onClick={onUndo} type="button">Undo</button><button className="staff-builder-secondary-button" disabled={!canRedo} onClick={onRedo} type="button">Redo</button></div></div>
      <p aria-live="polite" ref={selectedStatusRef} tabIndex={-1}>{selectedDescription}</p>
      <div className="staff-builder-capture-actions"><button className="staff-builder-secondary-button" disabled={!canPrevious} onClick={onPrevious} type="button">Previous Event</button><button className="staff-builder-secondary-button" disabled={!canNext} onClick={onNext} type="button">Next Event</button></div>
      {selectedEvent && <>
        <div className="staff-builder-rhythm-edit-grid">
          <label>Target Duration<select className="staff-builder-input" onChange={(event) => setTargetSelection({ rhythmSignature, duration: event.target.value as StaffBuilderDuration | "" })} value={targetDuration}><option value="">Choose duration</option>{STAFF_BUILDER_DURATIONS.map((duration) => <option key={duration} value={duration}>{durationLabel(duration)}</option>)}</select></label>
          <button className="staff-builder-primary-button" disabled={!hasDuration} onClick={() => hasDuration && onAssignDuration(targetDuration)} type="button">Assign Duration</button>
          {selectedEvent.kind === "notes" && <button className="staff-builder-secondary-button" disabled={!hasDuration} onClick={() => hasDuration && onConvertToRest(targetDuration)} type="button">Convert to Rest</button>}
        </div>
        <fieldset><legend>Staff</legend><div className="flex gap-2">{(["treble", "bass"] as const).map((staff) => <button aria-pressed={selectedEvent.staff === staff} className="staff-builder-secondary-button" key={staff} onClick={() => onMoveToStaff(staff)} type="button">{staff === "treble" ? "Treble" : "Bass"}</button>)}</div></fieldset>
        {selectedEvent.kind === "notes" && selectedEvent.pitches.length >= 2 && onSetArpeggiation && <label>Arpeggiation<select aria-label={`Arpeggiation: ${selectedEvent.arpeggiation === "up" ? "Rolled upward" : "None"}`} className="staff-builder-input" onChange={(event) => onSetArpeggiation(event.target.value === "up" ? "up" : null)} value={selectedEvent.arpeggiation ?? ""}><option value="">None</option><option value="up">Rolled upward</option></select></label>}
        {score && onCreateTies && onRemoveTie && onSplitAndTie && <StaffBuilderTieControls event={selectedEvent} measureIndex={selectedMeasureIndex ?? 0} onCreateTies={onCreateTies} onRemoveTie={onRemoveTie} onSplitAndTie={onSplitAndTie} score={score} />}
        <button className="staff-builder-danger-button" onClick={() => { selectedStatusRef.current?.focus(); onDelete(); }} type="button">Delete Event</button>
      </>}
      </div>
      </details>
      {status && <p aria-live="polite" className="text-amber-300" role="status">{status}</p>}
    </section>
  );
}
